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
    return [l["message"].strip() for l in logs if (l.get("speaker") or "").upper() == "PLAYER" and l.get("message")]

# 간단한 무의미 입력 감점
def penalize_nonsense(text: str) -> int:
    score = 0
    if len(text.strip()) < 5:
        score -= 30
    # 자모만 반복 등
    if re.fullmatch(r"[ㄱ-ㅎㅏ-ㅣ]+", text.strip()):
        score -= 40
    if re.fullmatch(r"(.)\1{2,}", text.strip()):
        score -= 20
    return score

def normalize_score(base_score: int, penalties: List[int]) -> int:
    adjusted = base_score + sum(penalties)
    return clamp_0_100(adjusted)

# ========================
# 모델 준비
# ========================
_TORCH_DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# 1) 한국어 문장 임베딩 (KoSimCSE)
EMB_MODEL = "BM-K/KoSimCSE-roberta-multitask"
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

# 2) 한국어 NLI (쌍문장, 직접 forward)  <<-- pipeline 없이
ZSC_MODEL = "Huffon/klue-roberta-base-nli"
zsc_tokenizer = AutoTokenizer.from_pretrained(ZSC_MODEL, use_fast=False)
zsc_model = AutoModelForSequenceClassification.from_pretrained(ZSC_MODEL).to(_TORCH_DEVICE).eval()

def _pair_tokens_safe(premise: str, hypothesis: str):
    """RoBERTa는 token_type_ids를 쓰지 않으므로 0으로 강제하거나 제거."""
    inputs = zsc_tokenizer(
        premise, hypothesis,
        return_tensors="pt", truncation=True, padding=True
    )
    # token_type_ids가 존재하면 모두 0으로 치환 (또는 삭제)
    if "token_type_ids" in inputs:
        # RoBERTa는 type_vocab_size=1이라 0만 허용
        inputs["token_type_ids"] = torch.zeros_like(inputs["input_ids"])
    return {k: v.to(_TORCH_DEVICE) for k, v in inputs.items()}

def zsc_score(texts: List[str], pos: str, neg: str) -> float:
    """라벨(pos/neg)에 대해 entail 확률을 평균. 에러시 0.5 반환."""
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
    # 시나리오 단서/요약을 힌트로 묶음
    hints = (req.facts or []) + ([req.caseSummary] if req.caseSummary else [])
    topic = " ".join([req.caseTitle or "", req.caseSummary or ""]).strip()

    # ---- Focus: 질문 ↔ 단서 유사도 + '집중됨' NLI ----
    if user_qs and hints:
        E_q = embed(user_qs)
        E_h = embed([" ".join(hints)])
        focus_sim = float(cosine_similarity(E_q, E_h).mean())
    else:
        focus_sim = 0.5
    focus_z = zsc_score(user_qs, "집중됨", "산만함")
    focus = scale_0_100(0.5 * focus_sim + 0.5 * focus_z, lo=0.2, hi=0.8)

    # ---- Logic: 단서 일치 + '논리적' NLI ----
    logic_sim = focus_sim  # 단서 일치도 재사용
    logic_z = zsc_score(user_qs, "논리적", "비논리적")
    logic = scale_0_100(0.6 * logic_z + 0.4 * logic_sim, lo=0.15, hi=0.85)

    # ---- Depth: 평균 길이 + '깊이있음' NLI ----
    avg_len = float(np.mean([len(q) for q in user_qs])) if user_qs else 0.0
    length_raw = float(np.tanh(avg_len / 40.0))
    depth_z = zsc_score(user_qs, "깊이있음", "피상적")
    depth = scale_0_100(0.6 * depth_z + 0.4 * length_raw, lo=0.2, hi=0.9)

    # ---- Diversity: 질문 간 상호 유사도 역수 ----
    if len(user_qs) >= 2:
        E = embed(user_qs)
        sim = cosine_similarity(E)
        tri = sim[np.triu_indices(len(user_qs), k=1)]
        diversity_raw = float(1.0 - tri.mean())
    else:
        diversity_raw = 0.5
    diversity = scale_0_100(diversity_raw, lo=0.1, hi=0.8)

    # ---- Creativity: 단서와의 차별성 + '창의적' NLI ----
    if user_qs and hints:
        E_q = embed(user_qs)
        E_h = embed(hints)
        sims = cosine_similarity(E_q, E_h).max(axis=1)
        novelty = float(1.0 - np.mean(sims))
    else:
        novelty = 0.5
    creat_z = zsc_score(user_qs, "창의적", "평범함")
    creativity = scale_0_100(0.6 * creat_z + 0.4 * novelty, lo=0.1, hi=0.8)

    # ---- 무의미 입력 감점 적용 ----
    penalties = [penalize_nonsense(q) for q in user_qs]
    logic = normalize_score(logic, penalties)
    focus = normalize_score(focus, penalties)
    creativity = normalize_score(creativity, penalties)
    # depth/diversity는 감점 영향 적게 유지 (원하면 동일 적용 가능)

    skills = {
        "logic": clamp_0_100(logic),
        "focus": clamp_0_100(focus),
        "creativity": clamp_0_100(creativity),
        "diversity": clamp_0_100(diversity),
        "depth": clamp_0_100(depth),
    }

    sub = {
        "focus_sim": focus_sim, "focus_z": focus_z,
        "logic_sim": logic_sim, "logic_z": logic_z,
        "depth_z": depth_z, "avg_len": avg_len,
        "diversity_raw": diversity_raw,
        "creativity_z": creat_z, "novelty": novelty,
        "n_user_turns": len(user_qs),
    }
    return AnalyzeResponse(engine="hf", skills=skills, submetrics=sub)

def score_dummy(req: AnalyzeRequest) -> AnalyzeResponse:
    """모델 실패 시에도 200으로 간단 점수 반환."""
    user_qs = extract_user_questions(req.logJson)
    base_tokens = set(tokenize_ko(" ".join((req.facts or [])) + " " + (req.caseSummary or "")))

    # 간단 휴리스틱
    if user_qs and base_tokens:
        sims = [jaccard(set(tokenize_ko(q)), base_tokens) for q in user_qs]
        focus_raw = float(np.mean(sims))
        logic_raw = focus_raw
        depth_raw = float(np.tanh(np.mean([len(q) for q in user_qs]) / 40.0))
        if len(user_qs) >= 2:
            toks = [set(tokenize_ko(q)) for q in user_qs]
            pairs = [jaccard(toks[i], toks[j]) for i in range(len(toks)) for j in range(i+1, len(toks))]
            diversity_raw = float(1.0 - np.mean(pairs))
        else:
            diversity_raw = 0.5
        novelty = float(1.0 - focus_raw)
    else:
        focus_raw = logic_raw = depth_raw = diversity_raw = novelty = 0.5

    focus = scale_0_100(focus_raw, lo=0.2, hi=0.8)
    logic = scale_0_100(logic_raw, lo=0.15, hi=0.85)
    depth = scale_0_100(depth_raw, lo=0.2, hi=0.9)
    diversity = scale_0_100(diversity_raw, lo=0.1, hi=0.8)
    creativity = scale_0_100(0.6 * 0.5 + 0.4 * novelty, lo=0.1, hi=0.8)

    penalties = [penalize_nonsense(q) for q in user_qs]
    logic = normalize_score(logic, penalties)
    focus = normalize_score(focus, penalties)
    creativity = normalize_score(creativity, penalties)

    skills = {
        "logic": logic, "focus": focus, "creativity": creativity,
        "diversity": diversity, "depth": depth
    }
    return AnalyzeResponse(engine="dummy", skills=skills, submetrics={})

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
    # hf
    try:
        return score_hf(req)
    except Exception as e:
        # 마지막 방어선: 모델 에러가 나도 200으로 dummy 반환
        return score_dummy(req)
