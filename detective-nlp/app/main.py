# app/main.py
from typing import Any, Dict, List, Optional, Literal, Annotated
from fastapi import FastAPI, Query
from pydantic import BaseModel
import numpy as np
import re
import os

# ---- 안정성 옵션(3.13): fast tokenizer 비활성 & 병렬 경고 억제 ----
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

    # 타이머/시간 정보
    # e.g. { "total_duration": 317, "per_turn": [12,18,25,...], "report_duration": 45 }
    timings: Optional[Dict[str, Any]] = None

    # 쿼리 우선, 없으면 바디로
    engine: Optional[Literal["dummy", "hf"]] = None

class AnalyzeResponse(BaseModel):
    engine: Literal["dummy", "hf"]
    skills: Dict[str, int]
    submetrics: Dict[str, float] = {}

# ========================
# 공통 유틸/파서
# ========================
def scale_0_100(x: float, lo=0.0, hi=1.0) -> int:
    x = (x - lo) / (hi - lo + 1e-9)
    x = float(np.clip(x, 0.0, 1.0))
    return int(round(x * 100))

def tokenize_ko(text: str) -> List[str]:
    return re.findall(r"[가-힣a-zA-Z0-9]+", (text or "").lower())

def jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 0.0
    return len(a & b) / max(1, len(a | b))

def extract_user_questions(log_json: Dict[str, Any]) -> List[str]:
    # logJson = {"logs":[{"speaker":"PLAYER","message":"..."}, ...]}
    logs = log_json.get("logs", []) or []
    qs = []
    for l in logs:
        spk = (l.get("speaker") or "").upper()
        msg = l.get("message") or ""
        if spk == "PLAYER" and msg.strip():
            qs.append(msg.strip())
    return qs

# ========================
# 입력 품질 검증 (감점 로직)
# ========================
def penalize_nonsense(text: str) -> int:
    score = 0
    if len(text.strip()) < 5:
        score -= 30
    if re.fullmatch(r"[ㄱ-ㅎㅏ-ㅣ]+", text.strip()):
        score -= 40
    if re.fullmatch(r"(.)\1{2,}", text.strip()):
        score -= 20
    return score

def clamp_0_100(v: int) -> int:
    return max(0, min(100, int(round(v))))

def normalize_score(base_score: int, penalties: List[int]) -> int:
    adjusted = base_score + sum(penalties)
    return clamp_0_100(adjusted)

# ========================
# 시간 피처 & 보정
# ========================
def _safe_num(x) -> Optional[float]:
    try:
        if x is None:
            return None
        return float(x)
    except Exception:
        return None

def _coerce_per_turn(v) -> List[float]:
    if not v:
        return []
    out = []
    for x in v:
        fx = _safe_num(x)
        if fx is not None and fx >= 0:
            out.append(fx)
    return out

def time_features(timings: Optional[Dict[str, Any]], fallback_turns: int) -> Dict[str, float]:
    """
    timings에서 총 시간/턴별 시간/보고서 작성 시간 등을 추출해 특징값 생성.
    per_turn이 없으면 총 시간과 턴 수로 균등 추정.
    """
    total = _safe_num(timings.get("total_duration")) if isinstance(timings, dict) else None
    report_dur = _safe_num(timings.get("report_duration")) if isinstance(timings, dict) else None
    per_turn = _coerce_per_turn(timings.get("per_turn")) if isinstance(timings, dict) else []

    n_turns = len(per_turn) if per_turn else (int(fallback_turns) if fallback_turns else 0)

    if (not per_turn) and total is not None and n_turns > 0:
        # 균등 추정 (로그만 있고 per_turn 미전달된 경우)
        per_turn = [float(total) / n_turns] * n_turns

    # 기본 통계
    avg_turn = float(np.mean(per_turn)) if per_turn else 0.0
    std_turn = float(np.std(per_turn)) if per_turn else 0.0
    med_turn = float(np.median(per_turn)) if per_turn else 0.0

    return {
        "total": float(total or 0.0),
        "n_turns": float(n_turns),
        "avg_turn": avg_turn,
        "std_turn": std_turn,
        "med_turn": med_turn,
        "report_duration": float(report_dur or 0.0),
    }

def time_adjustments(tf: Dict[str, float]) -> Dict[str, int]:
    """
    시간 기반 보정치(정수 델타)를 산출.
    규칙(경험적):
      - 총시간 너무 짧음(<60s): depth -10, logic -5
      - 적정 총시간(3~15분): depth +5, focus +5
      - 너무 김(>30분): focus -10, creativity -5
      - 턴 수 너무 적음(<3): diversity -8, depth -6
      - 평균 턴시간 너무 짧음(<3s): depth -12, logic -6
      - 평균 턴시간 너무 김(>120s): focus -8
      - 턴 편차 과도(>45s): focus -5
      - 보고서 작성시간(선택): 20~180s 사이면 depth +3, 너무 짧음<10s면 depth -5
    """
    total = tf["total"]
    n_turns = tf["n_turns"]
    avg_t = tf["avg_turn"]
    std_t = tf["std_turn"]
    rep_t = tf["report_duration"]

    d = dict(logic=0, creativity=0, focus=0, diversity=0, depth=0)

    # 총 플레이 시간
    if total > 0 and total < 60:
        d["depth"] -= 10
        d["logic"] -= 5
    elif 180 <= total <= 900:  # 3~15분
        d["depth"] += 5
        d["focus"] += 5
    elif total > 1800:  # 30분 초과
        d["focus"] -= 10
        d["creativity"] -= 5

    # 턴 수
    if n_turns > 0 and n_turns < 3:
        d["diversity"] -= 8
        d["depth"] -= 6

    # 평균 턴 시간
    if avg_t > 0 and avg_t < 3:
        d["depth"] -= 12
        d["logic"] -= 6
    elif avg_t > 120:
        d["focus"] -= 8

    # 변동성
    if std_t > 45:
        d["focus"] -= 5

    # 보고서 작성 시간(있을 때만)
    if rep_t > 0:
        if 20 <= rep_t <= 180:
            d["depth"] += 3
        elif rep_t < 10:
            d["depth"] -= 5

    return {k: int(v) for k, v in d.items()}

def apply_time_adjustments(base: Dict[str, int], req: AnalyzeRequest, user_qs: List[str]) -> (Dict[str, int], Dict[str, float]):
    tf = time_features(req.timings, fallback_turns=len(user_qs))
    deltas = time_adjustments(tf)

    adjusted = dict(base)
    for k, v in deltas.items():
        adjusted[k] = clamp_0_100(adjusted.get(k, 0) + v)

    # 서브메트릭에 시간치와 델타도 남겨 디버깅 가능하게
    time_subs = {
        "t_total": tf["total"],
        "t_n_turns": tf["n_turns"],
        "t_avg_turn": tf["avg_turn"],
        "t_std_turn": tf["std_turn"],
        "t_med_turn": tf["med_turn"],
        "t_report": tf["report_duration"],
        "d_logic": deltas["logic"],
        "d_creativity": deltas["creativity"],
        "d_focus": deltas["focus"],
        "d_diversity": deltas["diversity"],
        "d_depth": deltas["depth"],
    }
    return adjusted, time_subs

# ========================
# FastAPI 앱
# ========================
app = FastAPI(title="Detective NLP Analyzer (KO-opt)")

# -------------------------------------------------------
# A) 더미 엔진 (가벼운 의사결정)
# -------------------------------------------------------
def score_dummy(req: AnalyzeRequest) -> AnalyzeResponse:
    user_qs = extract_user_questions(req.logJson)
    topic_tokens = set(tokenize_ko((req.caseTitle or "") + " " + (req.caseSummary or "")))
    facts_tokens = set(tokenize_ko(" ".join(req.facts or [])))
    base_tokens = topic_tokens | facts_tokens

    # focus
    if user_qs and base_tokens:
        sims = [jaccard(set(tokenize_ko(q)), base_tokens) for q in user_qs]
        focus_raw = float(np.mean(sims))
    else:
        focus_raw = 0.5
    focus = scale_0_100(focus_raw, lo=0.1, hi=0.7)

    # diversity
    if len(user_qs) >= 2:
        toks = [set(tokenize_ko(q)) for q in user_qs]
        pairs = [jaccard(toks[i], toks[j]) for i in range(len(toks)) for j in range(i+1, len(toks))]
        diversity_raw = 1.0 - float(np.mean(pairs))
    else:
        diversity_raw = 0.5
    diversity = scale_0_100(diversity_raw, lo=0.1, hi=0.8)

    # depth
    if user_qs:
        lens = [len(q) for q in user_qs]
        uniq_ratio = [len(set(tokenize_ko(q)))/max(1,len(tokenize_ko(q))) for q in user_qs]
        depth_raw = 0.5*np.tanh(np.mean(lens)/40.0) + 0.5*float(np.mean(uniq_ratio))
    else:
        depth_raw = 0.5
    depth = scale_0_100(depth_raw, lo=0.2, hi=0.9)

    # logic
    if user_qs:
        overlaps = [jaccard(set(tokenize_ko(q)), base_tokens) for q in user_qs] if base_tokens else [0.5]*len(user_qs)
        causal_markers = ("때문","그래서","따라서","왜냐","즉","결과")
        causal = [1.0 if any(m in q for m in causal_markers) else 0.0 for q in user_qs]
        logic_raw = 0.7*float(np.mean(overlaps)) + 0.3*float(np.mean(causal))
    else:
        logic_raw = 0.5
    logic = scale_0_100(logic_raw, lo=0.15, hi=0.75)

    # creativity
    if user_qs and base_tokens:
        novs = [1.0 - jaccard(set(tokenize_ko(q)), base_tokens) for q in user_qs]
        creativity_raw = float(np.mean(novs))
    else:
        creativity_raw = 0.5
    creativity = scale_0_100(creativity_raw, lo=0.1, hi=0.8)

    # ===== 감점 적용(난수 입력 방지) =====
    penalties = [penalize_nonsense(q) for q in user_qs]
    logic = normalize_score(logic, penalties)
    creativity = normalize_score(creativity, penalties)
    focus = normalize_score(focus, penalties)

    # ===== 시간 보정 적용 =====
    base_scores = dict(logic=logic, creativity=creativity, focus=focus, diversity=diversity, depth=depth)
    adj_scores, time_subs = apply_time_adjustments(base_scores, req, user_qs)

    sub = {
        "focus_raw": focus_raw, "diversity_raw": diversity_raw,
        "depth_raw": depth_raw, "logic_raw": logic_raw,
        "creativity_raw": creativity_raw, "n_user_turns": float(len(user_qs))
    }
    sub.update(time_subs)

    return AnalyzeResponse(
        engine="dummy",
        skills=adj_scores,
        submetrics=sub
    )

# -------------------------------------------------------
# B) HuggingFace 엔진 (한국어 최적)
# -------------------------------------------------------
import torch
from transformers import pipeline, AutoTokenizer, AutoModel
from sklearn.metrics.pairwise import cosine_similarity

_TORCH_DEVICE = torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")
DEVICE = 0 if torch.cuda.is_available() else -1  # for transformers pipeline

# 1) 한국어 NLI 제로샷 분류기
ZSC_MODEL = "Huffon/klue-roberta-base-nli"
zsc_tokenizer = AutoTokenizer.from_pretrained(ZSC_MODEL, use_fast=False)
_zsc = pipeline("zero-shot-classification", model=ZSC_MODEL, tokenizer=zsc_tokenizer, device=DEVICE)

# 2) 한국어 문장 임베딩
EMB_MODEL = "BM-K/KoSimCSE-roberta-multitask"
_emb_tok = AutoTokenizer.from_pretrained(EMB_MODEL, use_fast=False)
_emb_model = AutoModel.from_pretrained(EMB_MODEL).to(_TORCH_DEVICE)

def embed(texts: List[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, 768))
    toks = _emb_tok(texts, padding=True, truncation=True, return_tensors="pt")
    with torch.no_grad():
        toks = {k: v.to(_TORCH_DEVICE) for k, v in toks.items()}
        outs = _emb_model(**toks)
        hidden = outs.last_hidden_state  # [B, T, H]
        mask = toks["attention_mask"].unsqueeze(-1).to(hidden.device)
        vec = (hidden * mask).sum(dim=1) / mask.sum(dim=1)  # mean pooling
    return vec.cpu().numpy()

def zsc_score(texts: List[str], pos: str, neg: str) -> float:
    if not texts:
        return 0.5
    hyp = "이 문장은 {}이다."
    probs = []
    for t in texts:
        res = _zsc(t, candidate_labels=[pos, neg], hypothesis_template=hyp)
        labels, scores = res["labels"], res["scores"]
        probs.append(scores[labels.index(pos)])
    return float(np.mean(probs))

def score_hf(req: AnalyzeRequest) -> AnalyzeResponse:
    user_qs = extract_user_questions(req.logJson)
    topic = " ".join([req.caseTitle or "", req.caseSummary or ""]).strip()
    hints = (req.facts or []) + ([req.caseSummary] if req.caseSummary else [])

    # focus
    focus_z = zsc_score(user_qs, "집중됨", "산만함")
    if user_qs and (topic or hints):
        E_q = embed(user_qs)
        E_t = embed([topic + " " + " ".join(hints)])
        sims = cosine_similarity(E_q, E_t).flatten()
        focus_sim = float(np.mean(sims))
    else:
        focus_sim = 0.5
    focus_raw = 0.5 * focus_z + 0.5 * focus_sim
    focus = scale_0_100(focus_raw, lo=0.2, hi=0.8)

    # diversity
    if len(user_qs) >= 2:
        E = embed(user_qs)
        sim = cosine_similarity(E)
        tri = sim[np.triu_indices(len(user_qs), k=1)]
        diversity_raw = 1.0 - float(np.mean(tri))
    else:
        diversity_raw = 0.5
    diversity = scale_0_100(diversity_raw, lo=0.1, hi=0.8)

    # depth
    depth_z = zsc_score(user_qs, "깊이있음", "피상적")
    length_raw = float(np.tanh(np.mean([len(q) for q in user_qs]) / 40.0)) if user_qs else 0.5
    depth_raw = 0.6 * depth_z + 0.4 * length_raw
    depth = scale_0_100(depth_raw, lo=0.2, hi=0.9)

    # logic
    logic_z = zsc_score(user_qs, "논리적", "비논리적")
    if user_qs and hints:
        E_q = embed(user_qs)
        E_h = embed([" ".join(hints)])
        sims = cosine_similarity(E_q, E_h).flatten()
        logic_cons = float(np.mean(sims))
    else:
        logic_cons = 0.5
    logic_raw = 0.6 * logic_z + 0.4 * logic_cons
    logic = scale_0_100(logic_raw, lo=0.15, hi=0.85)

    # creativity
    creat_z = zsc_score(user_qs, "창의적", "평범함")
    if user_qs and hints:
        E_q = embed(user_qs)
        E_h = embed(hints)
        sims = cosine_similarity(E_q, E_h).max(axis=1)
        novelty = float(1.0 - np.mean(sims))
    else:
        novelty = 0.5
    creativity_raw = 0.6 * creat_z + 0.4 * novelty
    creativity = scale_0_100(creativity_raw, lo=0.1, hi=0.8)

    # ===== 감점 적용(난수 입력 방지) =====
    penalties = [penalize_nonsense(q) for q in user_qs]
    logic = normalize_score(logic, penalties)
    creativity = normalize_score(creativity, penalties)
    focus = normalize_score(focus, penalties)

    # ===== 시간 보정 적용 =====
    base_scores = dict(logic=logic, creativity=creativity, focus=focus, diversity=diversity, depth=depth)
    adj_scores, time_subs = apply_time_adjustments(base_scores, req, user_qs)

    sub = {
        "focus_z": focus_z, "focus_sim": focus_sim,
        "diversity_raw": diversity_raw,
        "depth_z": depth_z, "length_raw": length_raw,
        "logic_z": logic_z, "logic_cons": logic_cons,
        "creativity_z": creat_z, "novelty": novelty,
        "n_user_turns": float(len(user_qs))
    }
    sub.update(time_subs)

    return AnalyzeResponse(
        engine="hf",
        skills=adj_scores,
        submetrics=sub
    )

# ========================
# 라우트
# ========================
@app.post("/nlp/analyze", response_model=AnalyzeResponse)
def analyze(
    req: AnalyzeRequest,
    engine: Annotated[Literal["dummy","hf"], Query(description="분석 엔진 선택 (hf/dummy)")] = "hf"
):
    use_engine = engine or (req.engine or "hf")
    return score_hf(req) if use_engine == "hf" else score_dummy(req)
