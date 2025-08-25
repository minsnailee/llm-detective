import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../shared/api/client";

export default function ResultPage() {
    const { scenarioId } = useParams();
    const navigate = useNavigate();

    const [selectedCulprit, setSelectedCulprit] = useState<string | null>(null);
    const [when, setWhen] = useState("");
    const [how, setHow] = useState("");
    const [why, setWhy] = useState("");

    const handleSubmit = async () => {
        if (!selectedCulprit || !when || !how || !why) {
            alert("모든 항목을 입력해주세요.");
            return;
        }

        const payload = {
            scenarioId: Number(scenarioId),
            userId: 1, // TODO: 로그인 연동 후 대체
            answerJson: JSON.stringify({
                culprit: selectedCulprit,
                when,
                how,
                why,
            }),
            // 지금은 더미 점수
            skills: {
                logic: 70,
                creativity: 80,
                focus: 65,
                diversity: 60,
                depth: 55,
            },
            isCorrect: selectedCulprit === "AI 용의자 2", // 정답 하드코딩
        };

        // 콘솔 로그 확인
        console.log("추리 결과 제출 payload:", payload);

        try {
            await api.post("/game/result", payload);
            navigate(`/play/${scenarioId}/analysis`, { state: payload });
        } catch (err) {
            console.error("결과 제출 실패:", err);
            alert("제출 중 오류가 발생했습니다.");
        }
    };

    return (
        <div style={{ padding: "20px" }}>
            <h2>추리 결과 입력</h2>

            <div style={{ marginBottom: "20px" }}>
                <h3>범인 선택</h3>
                {["AI 용의자 1", "AI 용의자 2", "AI 용의자 3"].map(
                    (name, idx) => (
                        <label
                            key={idx}
                            style={{ display: "block", margin: "5px 0" }}
                        >
                            <input
                                type="radio"
                                name="culprit"
                                value={name}
                                checked={selectedCulprit === name}
                                onChange={(e) =>
                                    setSelectedCulprit(e.target.value)
                                }
                            />
                            {name}
                        </label>
                    )
                )}
            </div>

            <div>
                <h3>언제?</h3>
                <textarea
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                    rows={2}
                    style={{ width: "100%", marginBottom: "10px" }}
                />
            </div>
            <div>
                <h3>어떻게?</h3>
                <textarea
                    value={how}
                    onChange={(e) => setHow(e.target.value)}
                    rows={2}
                    style={{ width: "100%", marginBottom: "10px" }}
                />
            </div>
            <div>
                <h3>왜?</h3>
                <textarea
                    value={why}
                    onChange={(e) => setWhy(e.target.value)}
                    rows={2}
                    style={{ width: "100%", marginBottom: "10px" }}
                />
            </div>

            <button onClick={handleSubmit}>추리 결과 제출</button>
        </div>
    );
}
