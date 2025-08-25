import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../shared/api/client";

interface Scenario {
  scenIdx: number;
  scenTitle: string;
  scenLevel: number;
}

export default function ScenarioSelectPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const navigate = useNavigate();

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

  return (
    <div style={{ padding: "20px" }}>
      <h2>시나리오 선택</h2>
      <p>플레이할 사건을 선택하세요:</p>
      <div style={{ display: "grid", gap: "16px", marginTop: "20px" }}>
        {scenarios.map((s) => (
          <div
            key={s.scenIdx}
            // ✅ 수정: 클릭 시 세션을 시작하고 sessionId를 쿼리스트링으로 넘겨줌
            onClick={async () => {
              try {
                const res = await api.post<number>(
                  `/game/session/start?scenIdx=${s.scenIdx}&userIdx=1` // 임시 userIdx=1
                );
                const sessionId = res.data;
                navigate(`/play/${s.scenIdx}?sessionId=${sessionId}`);
              } catch (err) {
                console.error("세션 시작 실패:", err);
              }
            }}
            style={{
              border: "1px solid #ccc",
              padding: "16px",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            <h3>{s.scenTitle}</h3>
            <small>난이도: {s.scenLevel}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
