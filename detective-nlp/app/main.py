# app/main.py
from typing import Any, Dict, List, Optional, Literal, Annotated
from fastapi import FastAPI, Query
from pydantic import BaseModel
import numpy as np
import re
import os
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModel, AutoModelForSequenceClassification
from sklearn.metrics.pairwise import cosine_similarity

# ---- 안정성 옵션 ----
os.environ["TRANSFORMERS_NO_FAST_TOKENIZER"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# ========================
# 요청/응답 스키마
# ========================
class AnalyzeRequest(BaseModel):
    session_id: Optional[int] = None
    logJson: Dict[str, Any]
    caseTitle: Optional[str] = None
    caseSummary: Optional[str] = None
    facts: Optional[List[str]] = None
    finalAnswer: Optional[Dict[str, Any]] = None
    timings: Optional[Dict[str, Any]] = None
    engine: Optional[Literal["hf","dummy"]] = None

class AnalyzeResponse(BaseModel):
    engine: Literal["hf","dummy"]
    skills: Dict[str, int]
    submetrics: Dict[str, float] = {}

# ========================
# 유틸 함수
# ========================
def scale_0_100(x: float, lo=0.0, hi=1.0) -> int:
    x = (x - lo) / (hi - lo + 1e-9)
    return int(round(float(np.clip(x, 0.0, 1.0)) * 100))

def clamp_0_100(v: int) -> int:
    return max(0, min(100, int(round(v))))

def tokenize_ko(text: str) -> List[str]:
    return re.findall(r"[가-힣a-zA-Z0-9]+", (text or "").lower())

def jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 0.0
    return len(a & b) / max(1, len(a | b))

def extract_user_questions(log_json: Dict[str, Any]) -> List[str]:
    logs = log_json.get("logs", []) or []
    qs = []
    for l in logs:
        spk = (l.get("speaker") or "").upper()
        msg = (l.get("message") or "").strip()
        if spk == "PLAYER" and msg:
            qs.append(msg)
    return qs

# === 무의미 입력 판정 ===
_TRIVIAL_PATTERNS = [
    r"^[ㅇ]+$", r"^[ㄴ]+$", r"^[ㅋ]+$", r"^[ㅎ]+$", r"^\?+$", r"^[\.\,\!\s]+$",
    r"^ㅁㄴㅇㄹ$", r"^ㄹㅇ$", r"^ㅇㅇ$", r"^ㄴㄴ$", r"^ㅋㅋ+$", r"^ㅎㅎ+$",
]
_TRIVIAL_REGEX = [re.compile(p) for p in _TRIVIAL_PATTERNS]

def is_trivial(text: str) -> bool:
    t = (text or "").strip()
    if len(t) == 0:
        return True
    # 순수 자모만, 동일문자 반복
    if re.fullmatch(r"[ㄱ-ㅎㅏ-ㅣ]+", t):
        return True
    if re.fullmatch(r"(.)\1{2,}", t):
        return True
    # 사전 패턴
    for rgx in _TRIVIAL_REGEX:
        if rgx.fullmatch(t):
            return True
    # 의미 토큰 거의 없음
    toks = tokenize_ko(t)
    return len(toks) < 2

def nonsense_penalty_per_q(text: str) -> int:
    t = (text or "").strip()
    score = 0
    if len(t) < 3:
        score -= 60
    elif len(t) < 5:
        score -= 35
    # 자모만/반복/사전 패턴
    if re.fullmatch(r"[ㄱ-ㅎㅏ-ㅣ]+", t):
        score -= 50
    if re.fullmatch(r"(.)\1{2,}", t):
        score -= 30
    for rgx in _TRIVIAL_REGEX:
        if rgx.fullmatch(t):
            score -= 50
            break
    # 의미 토큰 거의 없음
    if len(tokenize_ko(t)) < 2:
        score -= 25
    return score

def normalize_score(base_score: int, penalties: List[int], engagement_factor: float = 1.0) -> int:
    adjusted = base_score + sum(penalties)
    adjusted = int(round(adjusted * engagement_factor))
    return clamp_0_100(adjusted)

# ========================
# 모델 준비
# ========================
_TORCH_DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# 1) 한국어 문장 임베딩 (요청 모델)
EMB_MODEL = "jhgan/ko-sroberta-multitask"
_emb_tok = AutoTokenizer.from_pretrained(EMB_MODEL, use_fast=False)
_emb_model = AutoModel.from_pretrained(EMB_MODEL).to(_TORCH_DEVICE).eval()

def embed(texts: List[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, 768))
    toks = _emb_tok(texts, padding=True, truncation=True, return_tensors="pt")
    toks = {k: v.to(_TORCH_DEVICE) for k, v in toks.items()}
    with torch.no_grad():
        outs = _emb_model(**toks)
        hidden = outs.last_hidden_state
        mask = toks["attention_mask"].unsqueeze(-1)
        vec = (hidden * mask).sum(dim=1) / mask.sum(dim=1)
    return vec.cpu().numpy()

# 2) 한국어 NLI (쌍문장 직접 forward)
ZSC_MODEL = "Huffon/klue-roberta-base-nli"
zsc_tokenizer = AutoTokenizer.from_pretrained(ZSC_MODEL, use_fast=False)
zsc_model = AutoModelForSequenceClassification.from_pretrained(ZSC_MODEL).to(_TORCH_DEVICE).eval()

def _pair_tokens_safe(premise: str, hypothesis: str):
    inputs = zsc_tokenizer(
        premise, hypothesis,
        return_tensors="pt", truncation=True, padding=True
    )
    if "token_type_ids" in inputs:
        inputs["token_type_ids"] = torch.zeros_like(inputs["input_ids"])
    return {k: v.to(_TORCH_DEVICE) for k, v in inputs.items()}

def zsc_score(texts: List[str], pos: str, neg: str) -> float:
    if not texts:
        return 0.5
    hyp_tpl = "이 문장은 {}이다."
    probs = []
    for t in texts:
        hyp_pos = hyp_tpl.format(pos)
        try:
            inputs = _pair_tokens_safe(t, hyp_pos)
            with torch.no_grad():
                logits = zsc_model(**inputs).logits  # [contradiction, neutral, entailment]
                entail_prob = F.softmax(logits, dim=-1)[0, 2].item()
        except Exception:
            entail_prob = 0.5
        probs.append(entail_prob)
    return float(np.mean(probs)) if probs else 0.5

# ========================
# 핵심 스코어 함수
# ========================
def score_hf(req: AnalyzeRequest) -> AnalyzeResponse:
    user_qs = extract_user_questions(req.logJson)
    hints = (req.facts or []) + ([req.caseSummary] if req.caseSummary else [])
    topic = " ".join([req.caseTitle or "", req.caseSummary or ""]).strip()

    # === 기본 통계 ===
    n_user = len(user_qs)
    avg_len = float(np.mean([len(q) for q in user_qs])) if user_qs else 0.0
    trivial_flags = [is_trivial(q) for q in user_qs]
    n_trivial = int(np.sum(trivial_flags))
    meaningful_qs = [q for q, tr in zip(user_qs, trivial_flags) if not tr]
    n_meaningful = len(meaningful_qs)
    trivial_ratio = (n_trivial / n_user) if n_user > 0 else 1.0

    # === 유사도/엔테일먼트 ===
    if meaningful_qs and hints:
        E_q = embed(meaningful_qs)
        E_h = embed([" ".join(hints)])
        focus_sim = float(cosine_similarity(E_q, E_h).mean())
    else:
        focus_sim = 0.05 if n_meaningful == 0 else 0.5

    focus_z = zsc_score(meaningful_qs, "집중됨", "산만함") if meaningful_qs else 0.05
    logic_z = zsc_score(meaningful_qs, "논리적", "비논리적") if meaningful_qs else 0.05
    depth_z = zsc_score(meaningful_qs, "깊이있음", "피상적") if meaningful_qs else 0.05
    creat_z = zsc_score(meaningful_qs, "창의적", "평범함") if meaningful_qs else 0.05

    # === 다양성/참신성 ===
    if len(meaningful_qs) >= 2:
        E = embed(meaningful_qs)
        sim = cosine_similarity(E)
        tri = sim[np.triu_indices(len(meaningful_qs), k=1)]
        diversity_raw = float(1.0 - tri.mean())
    else:
        diversity_raw = 0.2 if n_meaningful == 0 else 0.5

    if meaningful_qs and hints:
        E_q = embed(meaningful_qs)
        E_h = embed(hints)
        sims = cosine_similarity(E_q, E_h).max(axis=1)
        novelty = float(1.0 - np.mean(sims))
    else:
        novelty = 0.6 if n_meaningful == 0 else 0.5

    # === 기본 스케일 ===
    focus = scale_0_100(0.5 * focus_sim + 0.5 * focus_z, lo=0.2, hi=0.85)
    logic = scale_0_100(0.6 * logic_z + 0.4 * focus_sim, lo=0.15, hi=0.85)
    depth = scale_0_100(0.6 * depth_z + 0.4 * np.tanh(avg_len / 40.0), lo=0.2, hi=0.9)
    diversity = scale_0_100(diversity_raw, lo=0.1, hi=0.85)
    creativity = scale_0_100(0.6 * creat_z + 0.4 * novelty, lo=0.1, hi=0.85)

    # === 패널티(강화) ===
    per_q_penalties = [nonsense_penalty_per_q(q) for q in user_qs]
    # 참여도 계수: 질문 수/의미 있는 질문 수 모두 반영
    if n_user == 0:
        engagement_factor = 0.05
    elif n_meaningful == 0:
        engagement_factor = 0.1
    else:
        # 0~1 사이, 의미있는 질문 수 우대
        engagement_factor = min(1.0, (0.3 * (n_user / 10.0) + 0.7 * (n_meaningful / 10.0)))

    # 길이가 너무 짧으면 추가로 축소
    if avg_len < 5:
        engagement_factor *= 0.6
    elif avg_len < 8:
        engagement_factor *= 0.8

    # 최종 스코어 정규화
    logic = normalize_score(logic, per_q_penalties, engagement_factor)
    focus = normalize_score(focus, per_q_penalties, engagement_factor)
    creativity = normalize_score(creativity, per_q_penalties, engagement_factor)
    depth = clamp_0_100(int(round(depth * engagement_factor)))
    diversity = clamp_0_100(int(round(diversity * engagement_factor)))

    # 의미있는 질문 0개면 모든 점수 바닥으로
    if n_meaningful == 0:
        logic = min(logic, 5)
        focus = min(focus, 5)
        creativity = min(creativity, 10)
        depth = min(depth, 10)
        diversity = min(diversity, 15)

    # === 로그 출력 ===
    print("=== [NLP Analyzer] HF ===")
    print(f"- Topic        : {topic}")
    print(f"- n_user       : {n_user}, n_meaningful: {n_meaningful}, n_trivial: {n_trivial}, trivial_ratio: {trivial_ratio:.3f}")
    print(f"- avg_len      : {avg_len:.2f}")
    print(f"- focus_sim    : {focus_sim:.3f}, focus_z: {focus_z:.3f}")
    print(f"- logic_z      : {logic_z:.3f}, depth_z: {depth_z:.3f}, creat_z: {creat_z:.3f}")
    print(f"- diversity_raw: {diversity_raw:.3f}, novelty: {novelty:.3f}")
    print(f"- penalties(sum): {sum(per_q_penalties)} ; engagement_factor: {engagement_factor:.3f}")
    print(f"- FINAL skills : focus={focus}, logic={logic}, depth={depth}, diversity={diversity}, creativity={creativity}")

    skills = {
        "logic": logic,
        "focus": focus,
        "creativity": creativity,
        "diversity": diversity,
        "depth": depth,
    }

    sub = {
        "n_user_turns": float(n_user),
        "n_meaningful": float(n_meaningful),
        "n_trivial": float(n_trivial),
        "trivial_ratio": float(trivial_ratio),
        "avg_len": float(avg_len),
        "focus_sim": float(focus_sim),
        "focus_z": float(focus_z),
        "logic_z": float(logic_z),
        "depth_z": float(depth_z),
        "creativity_z": float(creat_z),
        "diversity_raw": float(diversity_raw),
        "novelty": float(novelty),
        "penalty_sum": float(sum(per_q_penalties)),
        "engagement_factor": float(engagement_factor),
    }
    return AnalyzeResponse(engine="hf", skills=skills, submetrics=sub)

def score_dummy(req: AnalyzeRequest) -> AnalyzeResponse:
    """모델 실패 시에도 200으로 간단 점수 반환(패널티는 동일하게 적용)."""
    user_qs = extract_user_questions(req.logJson)
    base_tokens = set(tokenize_ko(" ".join((req.facts or [])) + " " + (req.caseSummary or "")))

    n_user = len(user_qs)
    avg_len = float(np.mean([len(q) for q in user_qs])) if user_qs else 0.0
    trivial_flags = [is_trivial(q) for q in user_qs]
    n_trivial = int(np.sum(trivial_flags))
    meaningful_qs = [q for q, tr in zip(user_qs, trivial_flags) if not tr]
    n_meaningful = len(meaningful_qs)
    trivial_ratio = (n_trivial / n_user) if n_user > 0 else 1.0

    # 간단 휴리스틱
    if meaningful_qs and base_tokens:
        sims = [jaccard(set(tokenize_ko(q)), base_tokens) for q in meaningful_qs]
        focus_raw = float(np.mean(sims))
        logic_raw = focus_raw
        depth_raw = float(np.tanh(np.mean([len(q) for q in meaningful_qs]) / 40.0))
        if len(meaningful_qs) >= 2:
            toks = [set(tokenize_ko(q)) for q in meaningful_qs]
            pairs = [jaccard(toks[i], toks[j]) for i in range(len(toks)) for j in range(i+1, len(toks))]
            diversity_raw = float(1.0 - np.mean(pairs))
        else:
            diversity_raw = 0.2 if n_meaningful == 0 else 0.5
        novelty = float(1.0 - focus_raw)
    else:
        focus_raw = logic_raw = depth_raw = diversity_raw = 0.2 if n_meaningful == 0 else 0.5
        novelty = 0.6 if n_meaningful == 0 else 0.5

    focus = scale_0_100(focus_raw, lo=0.2, hi=0.85)
    logic = scale_0_100(logic_raw, lo=0.15, hi=0.85)
    depth = scale_0_100(depth_raw, lo=0.2, hi=0.9)
    diversity = scale_0_100(diversity_raw, lo=0.1, hi=0.85)
    creativity = scale_0_100(0.6 * 0.5 + 0.4 * novelty, lo=0.1, hi=0.85)

    per_q_penalties = [nonsense_penalty_per_q(q) for q in user_qs]
    if n_user == 0:
        engagement_factor = 0.05
    elif n_meaningful == 0:
        engagement_factor = 0.1
    else:
        engagement_factor = min(1.0, (0.3 * (n_user / 10.0) + 0.7 * (n_meaningful / 10.0)))

    if avg_len < 5:
        engagement_factor *= 0.6
    elif avg_len < 8:
        engagement_factor *= 0.8

    logic = normalize_score(logic, per_q_penalties, engagement_factor)
    focus = normalize_score(focus, per_q_penalties, engagement_factor)
    creativity = normalize_score(creativity, per_q_penalties, engagement_factor)
    depth = clamp_0_100(int(round(depth * engagement_factor)))
    diversity = clamp_0_100(int(round(diversity * engagement_factor)))

    if n_meaningful == 0:
        logic = min(logic, 5)
        focus = min(focus, 5)
        creativity = min(creativity, 10)
        depth = min(depth, 10)
        diversity = min(diversity, 15)

    print("=== [NLP Analyzer] DUMMY ===")
    print(f"- n_user       : {n_user}, n_meaningful: {n_meaningful}, n_trivial: {n_trivial}, trivial_ratio: {trivial_ratio:.3f}")
    print(f"- avg_len      : {avg_len:.2f}")
    print(f"- focus_raw    : {focus_raw:.3f}, logic_raw: {logic_raw:.3f}, depth_raw: {depth_raw:.3f}")
    print(f"- diversity_raw: {diversity_raw:.3f}, novelty: {novelty:.3f}")
    print(f"- penalties(sum): {sum(per_q_penalties)} ; engagement_factor: {engagement_factor:.3f}")
    print(f"- FINAL skills : focus={focus}, logic={logic}, depth={depth}, diversity={diversity}, creativity={creativity}")

    skills = {
        "logic": logic, "focus": focus, "creativity": creativity,
        "diversity": diversity, "depth": depth
    }
    sub = {
        "n_user_turns": float(n_user),
        "n_meaningful": float(n_meaningful),
        "n_trivial": float(n_trivial),
        "trivial_ratio": float(trivial_ratio),
        "avg_len": float(avg_len),
        "penalty_sum": float(sum(per_q_penalties)),
        "engagement_factor": float(engagement_factor),
    }
    return AnalyzeResponse(engine="dummy", skills=skills, submetrics=sub)

# ========================
# FastAPI 앱
# ========================
app = FastAPI(title="Detective NLP Analyzer (KR-safe)")

@app.post("/nlp/analyze", response_model=AnalyzeResponse)
def analyze(
    req: AnalyzeRequest,
    engine: Annotated[Literal["hf","dummy"], Query()] = "hf"
):
    """항상 200 OK를 목표. hf 실패 시 dummy로 내부 fallback."""
    use_engine = engine or req.engine or "hf"
    if use_engine == "dummy":
        return score_dummy(req)
    try:
        return score_hf(req)
    except Exception as e:
        print("[WARN] HF engine failed, fallback to dummy:", e)
        return score_dummy(req)
