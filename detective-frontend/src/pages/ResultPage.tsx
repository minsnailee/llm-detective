import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../shared/api/client";
import { useAuth } from "../store/auth.store";

export default function ResultPage() {
  const { scenarioId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();   // 로그인된 사용자 정보

  const sessionId = Number(searchParams.get("sessionId"));

  const [selectedCulprit, setSelectedCulprit] = useState("");
  const [whenText, setWhenText] = useState("");
  const [howText, setHowText] = useState("");
  const [whyText, setWhyText] = useState("");

  const handleSubmit = async () => {
    if (!sessionId) {
      alert("세션 ID가 없습니다.");
      return;
    }

    const payload = {
      sessionId,
      scenIdx: Number(scenarioId),
      userIdx: user ? user.userIdx : null,   // 로그인 시에는 userIdx, 비회원이면 null
      answerJson: {
        culprit: selectedCulprit,
        when: whenText,
        how: howText,
        why: whyText,
      },
      skills: {
        logic: 70,
        creativity: 75,
        focus: 65,
        diversity: 60,
        depth: 55,
      },
      isCorrect: selectedCulprit === "홍길이", // 실제 정답 캐릭터 기준
    };

    try {
      await api.post("/game/result", payload);
      navigate(`/play/${scenarioId}/analysis?sessionId=${sessionId}`, {
        state: {
          culprit: selectedCulprit,
          isCorrect: payload.isCorrect,
          skills: payload.skills,
        },
      });
    } catch (err) {
      console.error("결과 제출 실패:", err);
      alert("결과 저장에 실패했습니다.");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>추리 결과 제출</h2>

      <div>
        <p>범인을 선택하세요:</p>
        {/* 시나리오 contentJson의 characters를 불러와 동적으로 표시해도 OK */}
        {["홍길동", "홍길순", "홍길이"].map((c) => (
          <label key={c} style={{ display: "block" }}>
            <input
              type="radio"
              name="culprit"
              value={c}
              onChange={(e) => setSelectedCulprit(e.target.value)}
            />
            {c}
          </label>
        ))}
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
        disabled={!selectedCulprit}
      >
        추리 결과 제출
      </button>
    </div>
  );
}
