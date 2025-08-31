import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../shared/api/client";

export default function ResultPage() {
  const { scenarioId } = useParams();
  const navigate = useNavigate();

  const [selectedCulprit, setSelectedCulprit] = useState("");
  const [whenText, setWhenText] = useState("");
  const [howText, setHowText] = useState("");
  const [whyText, setWhyText] = useState("");

  // 예시: 실제 로그인 연동되면 userId 가져오기
  const userId = 1;
  // 예시: 세션 ID도 /game/session/start 호출 후 받아와야 함
  const sessionId = 1;

  const handleSubmit = async () => {
    const payload = {
      sessionId,                  // 세션 ID
      scenIdx: Number(scenarioId), // DB 칼럼명에 맞춤 (scenIdx)
      userIdx: userId,            // DB 칼럼명에 맞춤 (userIdx)
      answerJson: {               // JSON.stringify 제거
        culprit: selectedCulprit,
        when: whenText,
        how: howText,
        why: whyText,
      },
      skills: {                   // NLP 점수 (임시 하드코딩, 나중에 교체)
        logic: 70,
        creativity: 75,
        focus: 65,
        diversity: 60,
        depth: 55,
      },
      isCorrect: selectedCulprit === "AI 용의자 2", // 정답 여부 예시
    };

    console.log("추리 결과 제출 payload:", payload);

    try {
      await api.post("/game/result", payload);
      alert("결과가 저장되었습니다!");
      navigate(`/play/${scenarioId}/analysis`, {
        state: {
          culprit: selectedCulprit,
          isCorrect: payload.isCorrect,
          skills: payload.skills,
        },
      });
    } catch (err) {
      console.error("결과 제출 실패:", err);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>추리 결과 제출</h2>

      <div>
        <p>범인을 선택하세요:</p>
        <label>
          <input
            type="radio"
            name="culprit"
            value="AI 용의자 1"
            onChange={(e) => setSelectedCulprit(e.target.value)}
          />
          AI 용의자 1
        </label>
        <label>
          <input
            type="radio"
            name="culprit"
            value="AI 용의자 2"
            onChange={(e) => setSelectedCulprit(e.target.value)}
          />
          AI 용의자 2
        </label>
        <label>
          <input
            type="radio"
            name="culprit"
            value="AI 용의자 3"
            onChange={(e) => setSelectedCulprit(e.target.value)}
          />
          AI 용의자 3
        </label>
      </div>

      <div style={{ marginTop: "20px" }}>
        <textarea
          placeholder="언제?"
          value={whenText}
          onChange={(e) => setWhenText(e.target.value)}
          style={{ display: "block", width: "100%", marginBottom: "10px" }}
        />
        <textarea
          placeholder="어떻게?"
          value={howText}
          onChange={(e) => setHowText(e.target.value)}
          style={{ display: "block", width: "100%", marginBottom: "10px" }}
        />
        <textarea
          placeholder="왜?"
          value={whyText}
          onChange={(e) => setWhyText(e.target.value)}
          style={{ display: "block", width: "100%", marginBottom: "10px" }}
        />
      </div>

      <button
        style={{ marginTop: "20px", padding: "10px 20px" }}
        onClick={handleSubmit}
      >
        추리 결과 제출
      </button>
    </div>
  );
}
