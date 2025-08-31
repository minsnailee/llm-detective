import { useLocation, useNavigate } from "react-router-dom";
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

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function GameResultDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const result = location.state as any;
  if (!result) return <p>결과 데이터가 없습니다.</p>;

  const { answerJson, skillsJson, correct } = result;

  const data = {
    labels: ["논리력", "창의력", "집중력", "다양성", "깊이"],
    datasets: [
      {
        label: "플레이어 능력치",
        data: [
          skillsJson.logic,
          skillsJson.creativity,
          skillsJson.focus,
          skillsJson.diversity,
          skillsJson.depth,
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
      <h2>게임 기록 상세</h2>

      <p>범인 추리: {answerJson?.culprit}</p>
      <p>정답 여부: {correct ? "정답" : "오답"}</p>

      <div style={{ marginTop: "30px" }}>
        <h3>추리 능력 분석</h3>
        <Radar data={data} options={options} />
      </div>

      <button style={{ marginTop: "20px" }} onClick={() => navigate(-1)}>
        목록으로 돌아가기
      </button>
    </div>
  );
}
