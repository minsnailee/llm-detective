from fastapi import APIRouter
from pydantic import BaseModel, Field
from openai import OpenAI
import mysql.connector, json
from kiwipiepy import Kiwi

router = APIRouter(prefix="/nlp", tags=["nlp"])
client = OpenAI(api_key="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")
kiwi = Kiwi()

# -----------------------------
# 요청/응답 모델 정의
# -----------------------------

# 1) GPT 용의자 응답 요청/응답
class AskReq(BaseModel):
    session_id: int
    suspect_name: str
    user_text: str

class AskRes(BaseModel):
    answer: str
    skills: dict
    log_json: dict

# 2) NLP 점수 요청/응답
class ScoreReq(BaseModel):
    sessionId: int
    suspectName: str
    userText: str = Field(..., min_length=1)

class ScoreRes(BaseModel):
    logic: int
    creativity: int
    focus: int
    diversity: int
    depth: int
    keywords: list[str]
    evidence: list[str]

# -----------------------------
# DB 헬퍼 함수
# -----------------------------

def get_session_and_scenario(session_id: int):
    conn = mysql.connector.connect(
        host="localhost",
        user="root",
        password="000000",   # ✅ 실제 비밀번호 입력
        database="lingoguma_detective_db"
    )
    cur = conn.cursor(dictionary=True)
    cur.execute("""
        SELECT s.scen_title, s.scen_summary, s.content_json, gs.log_json
        FROM game_sessions gs
        JOIN scenarios s ON gs.scen_idx = s.scen_idx
        WHERE gs.session_id=%s
    """, (session_id,))
    row = cur.fetchone()
    conn.close()
    return row

# -----------------------------
# 1) GPT 기반 질문/답변 엔드포인트
# -----------------------------

@router.post("/ask", response_model=AskRes)
def ask(req: AskReq):
    session = get_session_and_scenario(req.session_id)
    if not session:
        return {"answer": "세션을 찾을 수 없습니다.", "skills": {}, "log_json": {}}

    content = json.loads(session["content_json"])
    log_json = json.loads(session["log_json"]) if session["log_json"] else {"logs": []}
    suspect_info = next((c for c in content["characters"] if c["name"] == req.suspect_name), None)

    # GPT 프롬프트
    prompt = f"""
    사건: {session['scen_title']}
    개요: {session['scen_summary']}
    용의자: {suspect_info['name']} ({suspect_info['personality']}, 알리바이: {suspect_info['alibi']})
    플레이어 질문: {req.user_text}
    """

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "너는 주어진 설정에 맞게 연기하는 용의자다."},
            *[
                {"role": "user" if l["speaker"]=="PLAYER" else "assistant", "content": l["message"]}
                for l in log_json["logs"]
            ],
            {"role": "user", "content": prompt}
        ]
    )
    answer = response.choices[0].message.content

    # 간단한 점수 (임시값)
    skills = {"logic":70,"creativity":75,"focus":65,"diversity":60,"depth":55}

    # 로그 업데이트
    turn = len(log_json["logs"]) // 2 + 1
    log_json["logs"].append({"turn":turn,"speaker":"PLAYER","message":req.user_text,"skills":skills})
    log_json["logs"].append({"turn":turn,"speaker":"AI","suspect":req.suspect_name,"message":answer})

    # DB 반영
    conn = mysql.connector.connect(
        host="localhost",
        user="root",
        password="000000",   # ✅ 실제 비밀번호 입력
        database="lingoguma_detective_db"
    )
    cur = conn.cursor()
    cur.execute("UPDATE game_sessions SET log_json=%s WHERE session_id=%s",
                (json.dumps(log_json, ensure_ascii=False), req.session_id))
    conn.commit()
    conn.close()

    return {"answer": answer, "skills": skills, "log_json": log_json}

# -----------------------------
# 2) NLP 점수 계산 엔드포인트
# -----------------------------

@router.post("/score", response_model=ScoreRes)
def score(req: ScoreReq):
    text = req.userText.strip()
    tokens = kiwi.analyze(text)[0][0]  # [(표면형, 품사, ...), ...]
    nouns = [t[0] for t in tokens if t[1].startswith("NN")]
    keywords = list(dict.fromkeys(nouns))[:5]

    def clip(x): return max(0, min(100, int(x)))
    length = len(text)
    logic = 60 + (10 if ("모순" in text or "알리바이" in text) else 0) - (10 if length < 6 else 0)
    focus = 65 + (5 if len(keywords) <= 3 else 0)
    diversity = 55 + (10 if any(q in text for q in ["왜", "어떻게", "언제", "어디", "무엇", "누가"]) else 0)
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
