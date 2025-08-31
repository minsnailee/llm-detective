import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../shared/api/client";
import { useAuth } from "../store/auth.store"; // zustand store import

interface Scenario {
  scenIdx: number;
  scenTitle: string;
  scenLevel: number;
  scenAccess: "FREE" | "MEMBER"; // 추가
}

export default function ScenarioSelectPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth(); // zustand store에서 user 가져오기

  useEffect(() => {
    const fetchScenarios = async () => {
      try {
        const res = await api.get<Scenario[]>("/scenarios");
        console.log("시나리오 응답:", res.data);
        setScenarios(res.data);
      } catch (err) {
        console.error("시나리오 목록 불러오기 실패:", err);
      }
    };
    fetchScenarios();
  }, []);

  const handleStart = async (s: Scenario) => {
    try {
      // MEMBER인데 로그인 안 한 경우
      if (s.scenAccess === "MEMBER" && !user?.userIdx) {
        alert("로그인이 필요한 시나리오입니다.");
        return;
      }

      // 요청 URL 구성
      let url = `/game/session/start?scenIdx=${s.scenIdx}`;
      if (user?.userIdx) {
        url += `&userIdx=${user.userIdx}`;
      }

      const res = await api.post<number>(url);
      const sessionId = res.data;
      navigate(`/play/${s.scenIdx}?sessionId=${sessionId}`);
    } catch (err) {
      console.error("세션 시작 실패:", err);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>시나리오 선택</h2>
      <p>플레이할 사건을 선택하세요:</p>
      <div style={{ display: "grid", gap: "16px", marginTop: "20px" }}>
        {scenarios.map((s) => (
          <div
            key={s.scenIdx}
            onClick={() => handleStart(s)}
            style={{
              border: "1px solid #ccc",
              padding: "16px",
              borderRadius: "8px",
              cursor: "pointer",
              opacity: s.scenAccess === "MEMBER" && !user?.userIdx ? 0.6 : 1, // 잠금효과
            }}
          >
            <h3>
              {s.scenTitle}
              {s.scenAccess === "MEMBER" && !user?.userIdx && " 🔒"}
            </h3>
            <small>난이도: {s.scenLevel}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
