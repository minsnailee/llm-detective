from fastapi import APIRouter
from pydantic import BaseModel, Field
from kiwipiepy import Kiwi

router = APIRouter(prefix="/nlp", tags=["nlp"])
kiwi = Kiwi()

class ScoreReq(BaseModel):
    roomId: str
    userText: str = Field(..., min_length=1)

class ScoreRes(BaseModel):
    logic: int
    creativity: int
    focus: int
    diversity: int
    depth: int
    keywords: list[str]
    evidence: list[str]

@router.post("/score", response_model=ScoreRes)
def score(req: ScoreReq):
    text = req.userText.strip()
    tokens = kiwi.analyze(text)[0][0]  # [(표면, 품사, ...), ...]
    nouns = [t[0] for t in tokens if t[1].startswith("NN")]
    keywords = list(dict.fromkeys(nouns))[:5]

    def clip(x): return max(0, min(100, int(x)))
    length = len(text)
    logic = 60 + (10 if ("모순" in text or "알리바이" in text) else 0) - (10 if length < 6 else 0)
    focus = 65 + (5 if len(keywords) <= 3 else 0)
    diversity = 55 + (10 if any(q in text for q in ["왜","어떻게","언제","어디","무엇","누가"]) else 0)
    creativity = 55 + min(len(set(keywords)), 5)
    depth = 50 + (15 if ("왜" in text or "어떻게" in text) else 0)

    return {
        "logic": clip(logic),
        "creativity": clip(creativity),
        "focus": clip(focus),
        "diversity": clip(diversity),
        "depth": clip(depth),
        "keywords": keywords,
        "evidence": [f"키워드: {', '.join(keywords)}", f"길이: {length}"],
    }
