import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../shared/api/client";

interface ScenarioDetail {
  scenIdx: number;
  scenTitle: string;
  scenSummary: string;
  scenLevel: number;
  contentJson?: string;
}

interface Character {
  name: string;
  role: string;
  personality: string;
  alibi: string;
}

interface AskResponse {
  answer: string;
  skills: {
    logic: number;
    creativity: number;
    focus: number;
    diversity: number;
    depth: number;
  };
  log_json: any;
}

export default function GamePlayPage() {
  const { scenarioId } = useParams();
  const [scenario, setScenario] = useState<ScenarioDetail | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const navigate = useNavigate();

  // 타이머
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const formatTime = (s: number) => {
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  };

  // 시나리오 불러오기
  useEffect(() => {
    const fetchScenario = async () => {
      try {
        const res = await api.get<ScenarioDetail>(`/scenarios/${scenarioId}`);
        console.log("시나리오 상세:", res.data);
        setScenario(res.data);

        // contentJson 안전 파싱
        if (res.data.contentJson) {
          try {
            const parsed = JSON.parse(res.data.contentJson);
            setCharacters(parsed.characters || []);
          } catch (e) {
            console.error("contentJson 파싱 실패:", e);
          }
        }
      } catch (err) {
        console.error("시나리오 불러오기 실패:", err);
      }
    };
    fetchScenario();
  }, [scenarioId]);

  // 질문하기 → FastAPI /nlp/ask 호출
  const handleAsk = async () => {
    if (!selectedChar || !input.trim()) return;

    try {
      const res = await api.post<AskResponse>("/game/ask", {
        session_id: 1, // 현재 세션 ID (백엔드 세션 시작 API랑 연동 필요)
        suspect_name: selectedChar.name,
        user_text: input,
      });

      console.log("AI 응답:", res.data);
      setAnswer(res.data.answer); // GPT 응답 표시
      setInput("");
    } catch (err) {
      console.error("질문 처리 실패:", err);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      {/* 개요 다시보기 */}
      <button onClick={() => setShowSummary((prev) => !prev)}>
        개요 다시보기
      </button>
      {showSummary && scenario && (
        <div
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            marginTop: "10px",
          }}
        >
          <h3>{scenario.scenTitle}</h3>
          <p style={{ whiteSpace: "pre-line" }}>{scenario.scenSummary}</p>
        </div>
      )}

      {/* 용의자 캐릭터 */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "40px",
          margin: "40px 0",
        }}
      >
        {characters.slice(0, 3).map((c, idx) => (
          <div
            key={idx}
            onClick={() => setSelectedChar(c)}
            style={{
              textAlign: "center",
              cursor: "pointer",
              border:
                selectedChar?.name === c.name
                  ? "2px solid blue"
                  : "1px solid #ccc",
              padding: "10px",
              borderRadius: "8px",
              width: "120px",
            }}
          >
            <div style={{ fontSize: "40px" }}>🙂</div>
            <p>{c.name || `AI 용의자 ${idx + 1}`}</p>
          </div>
        ))}
      </div>

      {/* 선택된 용의자의 답변 */}
      {selectedChar && answer && (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div
            style={{
              display: "inline-block",
              padding: "10px 15px",
              border: "1px solid #000",
              borderRadius: "15px",
            }}
          >
            {selectedChar.name}: {answer}
          </div>
        </div>
      )}

      {/* 질문 입력 영역 */}
      <div style={{ textAlign: "center" }}>
        <p>질문할 용의자를 클릭 후 질문해주세요.</p>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요"
          style={{ width: "300px", marginRight: "10px" }}
        />
        <button onClick={handleAsk}>질문하기</button>
        <button onClick={() => navigate(`/play/${scenarioId}/result`)}>
          사건 종료 ({formatTime(seconds)})
        </button>
      </div>
    </div>
  );
}
