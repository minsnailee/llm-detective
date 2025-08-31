import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { api } from "../shared/api/client";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

export default function AnalysisPage() {
  const { scenarioId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const sessionId = Number(new URLSearchParams(location.search).get("sessionId"));

  const [culprit, setCulprit] = useState<string>("");
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [skills, setSkills] = useState({
    logic: 0,
    creativity: 0,
    focus: 0,
    diversity: 0,
    depth: 0,
  });

  // 결과 불러오기
  useEffect(() => {
    const fetchResult = async () => {
      try {
        const res = await api.get(`/game/results/${sessionId}`);
        console.log("분석 결과:", res.data);

        const result = res.data;
        setCulprit(JSON.parse(result.answerJson).culprit);
        setIsCorrect(result.correct);
        setSkills(JSON.parse(result.skillsJson));
      } catch (err) {
        console.error("결과 불러오기 실패:", err);
      }
    };
    if (sessionId) fetchResult();
  }, [sessionId]);

  const data = {
    labels: ["논리력", "창의력", "집중력", "다양성", "깊이"],
    datasets: [
      {
        label: "플레이어 능력치",
        data: [
          skills.logic,
          skills.creativity,
          skills.focus,
          skills.diversity,
          skills.depth,
        ],
        backgroundColor: "rgba(34, 202, 236, 0.2)",
        borderColor: "rgba(34, 202, 236, 1)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(34, 202, 236, 1)",
      },
    ],
  };

  const options = {
    scales: {
      r: {
        angleLines: { color: "#ccc" },
        suggestedMin: 0,
        suggestedMax: 100,
        ticks: { stepSize: 20, color: "#333" },
        pointLabels: { color: "#333", font: { size: 14 } },
      },
    },
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>분석 결과</h2>

      <p>
        선택한 범인: <strong>{culprit}</strong>
      </p>
      <p>{isCorrect ? "정답입니다" : "틀렸습니다"}</p>

      <div style={{ marginTop: "30px" }}>
        <h3>추리 능력 분석</h3>
        <Radar data={data} options={options} />
      </div>

      <button
        style={{ marginTop: "20px" }}
        onClick={() => navigate("/scenarios")}
      >
        다른 시나리오 풀어보기
      </button>
    </div>
  );
}
