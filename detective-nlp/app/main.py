from fastapi import FastAPI, APIRouter
from pydantic import BaseModel
from typing import Dict, Any, List

app = FastAPI()
router = APIRouter(prefix="/nlp", tags=["nlp"])

class AnalyzeReq(BaseModel):
    session_id: int
    log_json: Dict[str, Any]

class AnalyzeRes(BaseModel):
    skills: Dict[str, int]

@router.get("/health")
def health():
    return {"ok": True}

@router.post("/analyze", response_model=AnalyzeRes)
def analyze(req: AnalyzeReq):
    logs: List[Dict[str, Any]] = req.log_json.get("logs", [])
    qs = [l for l in logs if l.get("speaker") == "PLAYER"]
    text = " ".join([l.get("message", "") for l in qs])

    wh = sum(w in text for w in ["왜","어떻게","언제","어디","무엇","누가"])
    qn = len(qs)
    uniq = len(set(text.split()))
    clip = lambda x: max(0, min(100, int(x)))

    skills = {
        "logic":     clip(55 + wh*5),
        "creativity":clip(55 + min(uniq//20, 10)),
        "focus":     clip(60 + (5 if qn <= 8 else -5)),
        "diversity": clip(50 + min(wh*6, 20)),
        "depth":     clip(50 + min(qn, 10)),
    }
    return AnalyzeRes(skills=skills)

app.include_router(router)
