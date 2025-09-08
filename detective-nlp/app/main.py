# app/main.py
from typing import Any, Dict, List, Optional, Literal, Annotated, Tuple
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
    goldAnswer: Optional[Dict[str, Any]] = None  # 정답 메타(범인/동기/수법/핵심증거)
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

def safe_str(x: Any) -> str:
    return str(x or "").strip()

def safe_lower(x: Any) -> str:
    return safe_str(x).lower()

def as_list(obj: Any) -> List[Any]:
    if isinstance(obj, list):
        return obj
    if obj is None:
        return []
    return [obj]

def prf(selected: List[str], gold: List[str]) -> Tuple[float,float,float]:
    sel = set([safe_str(s) for s in selected if safe_str(s)])
    gd  = set([safe_str(s) for s in gold if safe_str(s)])
    tp = len(sel & gd)
    p = tp / max(1, len(sel))
    r = tp / max(1, len(gd))
    if p + r == 0:
        f1 = 0.0
    else:
        f1 = 2 * p * r / (p + r)
    return p, r, f1

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

def cos_sim_text(a: str, b: str, default: float = 0.0) -> float:
    a = safe_str(a); b = safe_str(b)
    if not a or not b:
        return default
    E = embed([a, b])
    if E.shape[0] < 2:
        return default
    return float(cosine_similarity(E[0:1], E[1:2])[0,0])

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
# 정답 메타 비교(범인/수법/동기/증거)
# ========================
def compare_to_gold(final_answer: Dict[str, Any], gold_answer: Dict[str, Any]) -> Dict[str, float]:
    fa = final_answer or {}
    ga = gold_answer or {}

    # 범인 일치: id 또는 이름 대소문자/공백 무시 비교
    chosen = safe_lower(fa.get("culprit"))
    gold_id = safe_lower(ga.get("culpritId"))
    gold_name = safe_lower(ga.get("culpritName"))
    culprit_exact = 1.0 if (chosen and (chosen == gold_id or chosen == gold_name)) else 0.0

    # 수법/동기 유사도: how ↔ method, why ↔ motive
    how = safe_str(fa.get("how"))
    method_gold = safe_str(ga.get("method"))
    method_sim = cos_sim_text(how, method_gold, default=0.0)

    why = safe_str(fa.get("why"))
    motive_gold = safe_str(ga.get("motive"))
    motive_sim = cos_sim_text(why, motive_gold, default=0.0)

    # 핵심 증거: evidence_selected ↔ keyEvidenceIds
    selected_ids = [safe_str(x) for x in as_list(fa.get("evidence_selected"))]
    key_ids = [safe_str(x) for x in as_list(ga.get("keyEvidenceIds"))]
    p, r, f1 = prf(selected_ids, key_ids)

    # 종합 품질(0~1): 범인 0.4, 수법 0.2, 동기 0.2, 증거F1 0.2
    answer_quality = float(0.4 * culprit_exact + 0.2 * method_sim + 0.2 * motive_sim + 0.2 * f1)

    return {
        "culprit_exact": float(culprit_exact),
        "method_sim": float(method_sim),
        "motive_sim": float(motive_sim),
        "evidence_precision": float(p),
        "evidence_recall": float(r),
        "evidence_f1": float(f1),
        "answer_quality": float(answer_quality),
    }

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

    # === 정답 메타 비교(범인/수법/동기/증거) ===
    gold_cmp = compare_to_gold(req.finalAnswer or {}, req.goldAnswer or {})

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

    # === 정답 메타 보너스(참여도 반영, 무조건 큰 영향은 아님)
    # 범인/수법/동기/증거를 잘 맞출수록 논리·깊이에 소폭 가산
    answer_bonus_logic = int(round(20.0 * gold_cmp["answer_quality"] * engagement_factor))
    answer_bonus_depth = int(round(10.0 * gold_cmp["answer_quality"] * engagement_factor))

    # 최종 스코어 정규화
    logic = normalize_score(logic + answer_bonus_logic, per_q_penalties, engagement_factor)
    focus = normalize_score(focus, per_q_penalties, engagement_factor)
    creativity = normalize_score(creativity, per_q_penalties, engagement_factor)
    depth = clamp_0_100(int(round((depth + answer_bonus_depth) * engagement_factor)))
    diversity = clamp_0_100(int(round(diversity * engagement_factor)))

    # 의미있는 질문 0개면 모든 점수 바닥으로
    if n_meaningful == 0:
        logic = min(logic, 5)
        focus = min(focus, 5)
        creativity = min(creativity, 10)
        depth = min(depth, 10)
        diversity = min(diversity, 15)

    # === 로그 출력(영문 라벨 + 한글 설명) ===
    print("=== [NLP Analyzer] HF (고급모델) ===")
    print(f"- Topic (사건 주제): {topic}")
    print(f"- n_user (총 질문 수): {n_user}, n_meaningful (의미있는 질문 수): {n_meaningful}, n_trivial (무의미 질문 수): {n_trivial}, trivial_ratio (무의미 비율): {trivial_ratio:.3f}")
    print(f"- avg_len (평균 길이): {avg_len:.2f}")
    print(f"- focus_sim (단서집중 유사도): {focus_sim:.3f}, focus_z (집중 NLI): {focus_z:.3f}")
    print(f"- logic_z (논리 NLI): {logic_z:.3f}, depth_z (깊이 NLI): {depth_z:.3f}, creat_z (창의 NLI): {creat_z:.3f}")
    print(f"- diversity_raw (질문 다양성 원값): {diversity_raw:.3f}, novelty (참신성): {novelty:.3f}")
    print(f"- GOLD compare (정답 비교): culprit_exact={gold_cmp['culprit_exact']:.3f}, method_sim={gold_cmp['method_sim']:.3f}, motive_sim={gold_cmp['motive_sim']:.3f}, evidence_f1={gold_cmp['evidence_f1']:.3f}")
    print(f"- penalties(sum) (패널티 합): {sum(per_q_penalties)} ; engagement_factor (참여 계수): {engagement_factor:.3f}")
    print(f"- answer_bonus_logic/depth (정답 보너스 논리/깊이): {answer_bonus_logic}/{answer_bonus_depth}")
    print(f"- FINAL skills (최종 점수) : focus={focus}, logic={logic}, depth={depth}, diversity={diversity}, creativity={creativity}")

    skills = {
        "logic": logic,
        "focus": focus,
        "creativity": creativity,
        "diversity": diversity,
        "depth": depth,
    }

    sub = {
        # 활동 통계
        "n_user_turns": float(n_user),
        "n_meaningful": float(n_meaningful),
        "n_trivial": float(n_trivial),
        "trivial_ratio": float(trivial_ratio),
        "avg_len": float(avg_len),
        # 집중/논리/깊이/창의 관련
        "focus_sim": float(focus_sim),
        "focus_z": float(focus_z),
        "logic_z": float(logic_z),
        "depth_z": float(depth_z),
        "creativity_z": float(creat_z),
        "diversity_raw": float(diversity_raw),
        "novelty": float(novelty),
        # 패널티/참여
        "penalty_sum": float(sum(per_q_penalties)),
        "engagement_factor": float(engagement_factor),
        # 정답 비교 서브지표
        "culprit_exact": gold_cmp["culprit_exact"],
        "method_sim": gold_cmp["method_sim"],
        "motive_sim": gold_cmp["motive_sim"],
        "evidence_precision": gold_cmp["evidence_precision"],
        "evidence_recall": gold_cmp["evidence_recall"],
        "evidence_f1": gold_cmp["evidence_f1"],
        "answer_quality": gold_cmp["answer_quality"],
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

    # 간단 휴리스틱(자카드/길이 기반)
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

    # 정답 비교(간이판정: 임베딩 없이 토큰 유사도)
    fa = req.finalAnswer or {}
    ga = req.goldAnswer or {}

    chosen = safe_lower(fa.get("culprit"))
    gold_id = safe_lower(ga.get("culpritId"))
    gold_name = safe_lower(ga.get("culpritName"))
    culprit_exact = 1.0 if (chosen and (chosen == gold_id or chosen == gold_name)) else 0.0

    method_sim = jaccard(set(tokenize_ko(safe_str(fa.get("how")))), set(tokenize_ko(safe_str(ga.get("method")))))
    motive_sim = jaccard(set(tokenize_ko(safe_str(fa.get("why")))), set(tokenize_ko(safe_str(ga.get("motive")))))

    p, r, f1 = prf([safe_str(x) for x in as_list(fa.get("evidence_selected"))],
                   [safe_str(x) for x in as_list(ga.get("keyEvidenceIds"))])

    answer_quality = float(0.4 * culprit_exact + 0.2 * method_sim + 0.2 * motive_sim + 0.2 * f1)

    # 기본 스케일
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

    answer_bonus_logic = int(round(20.0 * answer_quality * engagement_factor))
    answer_bonus_depth = int(round(10.0 * answer_quality * engagement_factor))

    logic = normalize_score(logic + answer_bonus_logic, per_q_penalties, engagement_factor)
    focus = normalize_score(focus, per_q_penalties, engagement_factor)
    creativity = normalize_score(creativity, per_q_penalties, engagement_factor)
    depth = clamp_0_100(int(round((depth + answer_bonus_depth) * engagement_factor)))
    diversity = clamp_0_100(int(round(diversity * engagement_factor)))

    if n_meaningful == 0:
        logic = min(logic, 5)
        focus = min(focus, 5)
        creativity = min(creativity, 10)
        depth = min(depth, 10)
        diversity = min(diversity, 15)

    print("=== [NLP Analyzer] DUMMY (대체모델) ===")
    print(f"- n_user (총 질문 수): {n_user}, n_meaningful (의미있는 질문 수): {n_meaningful}, n_trivial (무의미 질문 수): {n_trivial}, trivial_ratio (무의미 비율): {trivial_ratio:.3f}")
    print(f"- avg_len (평균 길이): {avg_len:.2f}")
    print(f"- focus_raw (단서집중 원값): {focus_raw:.3f}, logic_raw (논리 원값): {logic_raw:.3f}, depth_raw (깊이 원값): {depth_raw:.3f}")
    print(f"- diversity_raw (다양성 원값): {diversity_raw:.3f}, novelty (참신성): {novelty:.3f}")
    print(f"- GOLD compare (정답 비교): culprit_exact={culprit_exact:.3f}, method_sim={method_sim:.3f}, motive_sim={motive_sim:.3f}, evidence_f1={f1:.3f}")
    print(f"- penalties(sum) (패널티 합): {sum(per_q_penalties)} ; engagement_factor (참여 계수): {engagement_factor:.3f}")
    print(f"- answer_bonus_logic/depth (정답 보너스 논리/깊이): {answer_bonus_logic}/{answer_bonus_depth}")
    print(f"- FINAL skills (최종 점수) : focus={focus}, logic={logic}, depth={depth}, diversity={diversity}, creativity={creativity}")

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
        # 정답 비교 서브지표(간이)
        "culprit_exact": float(culprit_exact),
        "method_sim": float(method_sim),
        "motive_sim": float(motive_sim),
        "evidence_precision": float(p),
        "evidence_recall": float(r),
        "evidence_f1": float(f1),
        "answer_quality": float(answer_quality),
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
        print("[WARN] HF engine failed, fallback to dummy (HF 엔진 실패, 대체모델로 전환):", e)
        return score_dummy(req)
