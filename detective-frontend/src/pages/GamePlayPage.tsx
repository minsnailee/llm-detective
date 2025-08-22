import { useParams } from "react-router-dom";
import { useState } from "react";
import { api } from "../shared/api/client";

export default function GamePlayPage() {
    const { scenarioId } = useParams(); // URL 파라미터 사용 (예: /play/123)
    const [text, setText] = useState("");
    const [res, setRes] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const ask = () => {
        if (!text.trim()) return;
        setLoading(true);
        api.post("/nlp/score", {
            roomId: scenarioId ?? "dev-room",
            userText: text,
        })
            .then(({ data }) => {
                console.log("NLP 응답:", data); // 콘솔 확인
                setRes(data); // 화면에서도 확인
            })
            .catch((e) => {
                console.error(e);
                alert("NLP 호출 실패");
            })
            .finally(() => {
                setLoading(false);
            });
    };

    return (
        <div style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
            <h2>Game Play (Scenario #{scenarioId})</h2>

            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="용의자에게 물어볼 질문을 입력하세요"
                rows={4}
                style={{ width: "100%", marginBottom: 8 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
                <button onClick={ask} disabled={loading}>
                    {loading ? "분석 중..." : "질문 보내기"}
                </button>
                <button onClick={() => setText("")}>지우기</button>
            </div>

            {res && (
                <div style={{ marginTop: 16 }}>
                    <h3>분석 결과</h3>
                    <pre style={{ background: "#f7f7f7", padding: 8 }}>
                        {JSON.stringify(res, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
