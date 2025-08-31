import { useEffect, useState } from "react";
import { api } from "../../shared/api/client";
import { useAuth } from "../../store/auth.store";
import { useNavigate } from "react-router-dom";

interface GameResult {
  resultId: number;
  scenIdx: number;
  answerJson: any;
  skillsJson: {
    logic: number;
    creativity: number;
    focus: number;
    diversity: number;
    depth: number;
  };
  correct: boolean;
}

export default function GameHistoryPage() {
  const { user } = useAuth();
  const [results, setResults] = useState<GameResult[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await api.get<GameResult[]>("/game-results/me");
        setResults(res.data);
      } catch (err) {
        console.error("게임 기록 불러오기 실패:", err);
      }
    };
    if (user) fetchResults();
  }, [user]);

  if (!user) return <p>로그인이 필요합니다.</p>;

  return (
    <div>
      <h3>내 게임 기록</h3>
      {results.length === 0 ? (
        <p>게임 기록이 없습니다.</p>
      ) : (
        <ul>
          {results.map((r) => (
            <li
              key={r.resultId}
              style={{ border: "1px solid #ccc", margin: 8, padding: 8, cursor: "pointer" }}
              onClick={() => navigate(`/my/game-result/${r.resultId}`, { state: r })}
            >
              <p>시나리오 ID: {r.scenIdx}</p>
              <p>정답 여부: {r.correct ? "정답" : "오답"}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
