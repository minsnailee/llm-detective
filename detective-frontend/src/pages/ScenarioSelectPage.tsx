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
            onClick={() => navigate(`/play/${s.scenIdx}`)}
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
