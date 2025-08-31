import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { api } from "../../shared/api/client";
import { useAuth } from "../../store/auth.store";

type ScenarioDetail = {
  scenIdx: number;
  scenTitle: string;
  scenSummary: string;
  scenLevel: number;
  contentJson?: string | any;
};

export default function ResultPage() {
  const { scenarioId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const sessionId = Number(searchParams.get("sessionId"));

  const [suspects, setSuspects] = useState<string[]>([]);
  const [selectedCulprit, setSelectedCulprit] = useState("");
  const [whenText, setWhenText] = useState("");
  const [howText, setHowText] = useState("");
  const [whyText, setWhyText] = useState("");

  // ─────────────────────────────────────────────
  // ① 총 플레이 시간: GamePlay에서 받아온 값을 '표시만' (증가 X)
  //    - state.totalDuration 우선, 없으면 ?t=초, 없으면 sessionStorage
  // ─────────────────────────────────────────────
  const TIMER_KEY = sessionId ? `timer_session_${sessionId}` : "timer_session_unknown";
  const initialFromState =
    (location.state as any)?.totalDuration as number | undefined;

  const initialFromQuery = (() => {
    const t = searchParams.get("t");
    return t && !isNaN(Number(t)) ? Number(t) : undefined;
  })();

  const initialFromStorage = (() => {
    const v = sessionStorage.getItem(TIMER_KEY);
    return v && !isNaN(Number(v)) ? Number(v) : undefined;
  })();

  const totalDuration =
    initialFromState ?? initialFromQuery ?? initialFromStorage ?? 0;

  const formatTime = (s: number) => {
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  };

  // ─────────────────────────────────────────────
  // ② 보고서 작성 시간: 결과 페이지에서 새로 측정 시작
  // ─────────────────────────────────────────────
  const [reportSeconds, setReportSeconds] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setReportSeconds((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // 시나리오 characters 불러오기 → 용의자/범인만 선택지로 표시
  useEffect(() => {
    const fetchScenario = async () => {
      try {
        if (!scenarioId) return;
        const res = await api.get<ScenarioDetail>(`/scenarios/${scenarioId}`);

        let content: any = res.data.contentJson;
        if (typeof content === "string") {
          try {
            content = JSON.parse(content);
          } catch {
            content = {};
          }
        }

        const chars = Array.isArray(content?.characters) ? content.characters : [];
        const names = chars
          .filter((c: any) => ["용의자", "범인"].includes(c?.role))
          .map((c: any) => String(c?.name || ""))
          .filter(Boolean);

        setSuspects(names);
      } catch (err) {
        console.error("시나리오 불러오기 실패:", err);
      }
    };
    fetchScenario();
  }, [scenarioId]);

  // 제출
const handleSubmit = async () => {
  if (!sessionId) {
    alert("세션 ID가 없습니다.");
    return;
  }

  const payload = {
    sessionId,
    scenIdx: Number(scenarioId),
    userIdx: user ? user.userIdx : null,
    answerJson: {
      culprit: selectedCulprit,
      when: whenText,
      how: howText,
      why: whyText,
    },
    timings: {
      total_duration: totalDuration,
      per_turn: [], // 필요하면 채우기
    },
  };

  try {
    // 1) 결과 저장 + resultId 바로 받기
    const { data } = await api.post("/game/result", payload);
    const resultId = data?.resultId;

    if (!resultId) {
      console.error("결과 저장 응답에 resultId가 없습니다:", data);
      alert("결과 저장은 되었지만 resultId를 받지 못했습니다.");
      return;
    }

    // 2) 바로 분석 페이지로 이동 (더 이상 session으로 재조회 X)
    navigate(`/play/${scenarioId}/analysis?resultId=${resultId}`);
  } catch (err: any) {
    console.error("결과 제출 실패:", err?.response || err);
    alert("결과 저장에 실패했습니다.");
  }
};

  return (
    <div style={{ padding: "20px" }}>
      <h2>추리 결과 제출</h2>

      <p style={{ opacity: 0.8, marginTop: 4 }}>
        총 플레이 시간: <strong>{formatTime(totalDuration)}</strong>
        {"  "}·{"  "}
        보고서 작성: <strong>{formatTime(reportSeconds)}</strong>
      </p>

      {/* 범인 선택 */}
      <div style={{ marginTop: 16 }}>
        <label><strong>범인 선택</strong></label>
        {suspects.length > 0 ? (
          suspects.map((c) => (
            <label key={c} style={{ display: "block", marginTop: 6 }}>
              <input
                type="radio"
                name="culprit"
                value={c}
                checked={selectedCulprit === c}
                onChange={(e) => setSelectedCulprit(e.target.value)}
              />
              <span style={{ marginLeft: 8 }}>{c}</span>
            </label>
          ))
        ) : (
          <p>용의자 목록 불러오는 중...</p>
        )}
      </div>

      {/* 추가 설명 입력 */}
      <div style={{ marginTop: 20 }}>
        <label><strong>언제?</strong></label>
        <textarea
          placeholder="예: 오후 2시쯤, 도서관 서고에서"
          value={whenText}
          onChange={(e) => setWhenText(e.target.value)}
          style={{ display: "block", width: "100%", marginBottom: 10 }}
        />

        <label><strong>어떻게?</strong></label>
        <textarea
          placeholder="예: 창문을 통해 몰래 들어가 고서를 가방에 넣음"
          value={howText}
          onChange={(e) => setHowText(e.target.value)}
          style={{ display: "block", width: "100%", marginBottom: 10 }}
        />

        <label><strong>왜?</strong></label>
        <textarea
          placeholder="예: 비싼 고서를 팔아 돈을 벌기 위해"
          value={whyText}
          onChange={(e) => setWhyText(e.target.value)}
          style={{ display: "block", width: "100%", marginBottom: 10 }}
        />
      </div>

      {/* 제출 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={!selectedCulprit}
        style={{ marginTop: 20, padding: "10px 20px" }}
      >
        추리 결과 제출
      </button>
    </div>
  );
}
