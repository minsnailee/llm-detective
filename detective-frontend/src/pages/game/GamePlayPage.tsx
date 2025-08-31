import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../shared/api/client";

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
  age?: number;
  gender?: string;
  job?: string;
  personality?: string;
  alibi?: string;
  outfit: string;
  sample_line: string;
}

interface AskResponse {
  answer: string; // 백엔드 NlpAskResponse와 1:1 매칭
}

export default function GamePlayPage() {
  const { scenarioId } = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = Number(searchParams.get("sessionId")); // 세션ID 쿼리에서 읽기
  const navigate = useNavigate();

  const [scenario, setScenario] = useState<ScenarioDetail | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);

  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const [showSummary, setShowSummary] = useState(false);

  // ─────────────────────────────────────────────
  // 메인 타이머: 이 페이지에서만 동작. 종료 버튼 누르면 즉시 멈춤.
  // ─────────────────────────────────────────────
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);
  const TIMER_KEY = sessionId ? `timer_session_${sessionId}` : "timer_session_unknown";

  useEffect(() => {
    // 시작
    timerRef.current = window.setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        sessionStorage.setItem(TIMER_KEY, String(next)); // 새로고침 대비 저장
        return next;
      });
    }, 1000);

    // 종료(언마운트)
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, [TIMER_KEY]);

  const formatTime = (s: number) => {
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  };

  // 시나리오 불러오기
  useEffect(() => {
    const fetchScenario = async () => {
      try {
        if (!scenarioId) return;
        const res = await api.get<ScenarioDetail>(`/scenarios/${scenarioId}`);
        setScenario(res.data);

        // contentJson 안전 파싱
        if (res.data.contentJson) {
          try {
            const parsed =
              typeof res.data.contentJson === "string"
                ? JSON.parse(res.data.contentJson)
                : (res.data.contentJson as any);
            setCharacters(parsed?.characters || []);
          } catch (e) {
            console.error("contentJson 파싱 실패:", e);
            setCharacters([]);
          }
        } else {
          setCharacters([]);
        }
      } catch (err) {
        console.error("시나리오 불러오기 실패:", err);
      }
    };
    fetchScenario();
  }, [scenarioId]);

  // 질문하기 → Spring `/api/game/ask` (여기서는 네비게이트 하지 않음!)
  const handleAsk = async () => {
    if (!selectedChar || !input.trim()) return;
    if (!sessionId) {
      alert("세션 정보가 없습니다. 시나리오 선택 화면에서 다시 시작해주세요.");
      return;
    }

    try {
      setAsking(true);
      const res = await api.post<AskResponse>("/game/ask", {
        sessionId: sessionId,
        suspectName: selectedChar.name,
        userText: input,
      });

      setAnswer(res.data.answer);
      setInput("");
    } catch (err) {
      console.error("질문 처리 실패:", err);
      alert("질문 처리에 실패했습니다. (네트워크/권한 설정을 확인해주세요)");
    } finally {
      setAsking(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") handleAsk();
  };

  // 사건 종료 → 결과 페이지로 이동
  // - 여기서 메인 타이머를 '즉시' 멈추고, 플레이 시간 값을 함께 전달
  const goResult = () => {
    if (!sessionId) {
      alert("세션 정보가 없습니다. 시나리오 선택 화면에서 다시 시작해주세요.");
      return;
    }

    // 타이머 즉시 멈춤
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const playDuration = seconds;
    sessionStorage.setItem(TIMER_KEY, String(playDuration)); // 안전하게 저장

    navigate(`/play/${scenarioId}/result?sessionId=${sessionId}&t=${playDuration}`, {
      state: { totalDuration: playDuration }, // state에도 전달
    });
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
                selectedChar?.name === c.name ? "2px solid blue" : "1px solid #ccc",
              padding: "12px",
              borderRadius: "8px",
              width: "180px",
              userSelect: "none",
            }}
          >
            <div style={{ fontSize: "40px" }}>🙂</div>
            <p style={{ margin: "8px 0 4px", fontWeight: "bold" }}>{c.name}</p>
            <small style={{ color: "#666" }}>
              {c.age}세, {c.gender}, {c.job}
            </small>

            {c.outfit && (
              <p style={{ fontSize: "12px", margin: "6px 0", color: "#444" }}>
                옷차림: {c.outfit}
              </p>
            )}

            {c.sample_line && (
              <p style={{ fontSize: "12px", fontStyle: "italic", color: "#555" }}>
                “{c.sample_line}”
              </p>
            )}
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
              maxWidth: 600,
            }}
          >
            <b>{selectedChar.name}</b>: {answer}
          </div>
        </div>
      )}

      {/* 질문 입력 영역 */}
      <div style={{ textAlign: "center" }}>
        <p>질문할 용의자를 클릭 후 질문해주세요.</p>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="질문을 입력하세요"
          style={{ width: "360px", marginRight: "10px" }}
          disabled={!selectedChar || asking}
        />
        <button onClick={handleAsk} disabled={!selectedChar || !input.trim() || asking}>
          {asking ? "질문 중..." : "질문하기"}
        </button>

        <button onClick={goResult} style={{ marginLeft: 12 }}>
          사건 종료 ({formatTime(seconds)})
        </button>
      </div>
    </div>
  );
}
