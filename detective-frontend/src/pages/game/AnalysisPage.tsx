// src/pages/game/AnalysisPage.tsx
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
import type { ChartOptions } from "chart.js";
import { api } from "../../shared/api/client";

ChartJS.register(
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
);

type Skills = {
    logic: number;
    creativity: number;
    focus: number;
    diversity: number;
    depth: number;
};

type GameResultDTO = {
    resultId: number;
    sessionId: number;
    scenIdx: number;
    userIdx: number | null;
    correct: boolean;
    answerJson: { culprit?: string; when?: string; how?: string; why?: string };
    skillsJson: Skills;
};

export default function AnalysisPage() {
    const { scenarioId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    // resultId “필수”로 받기
    const search = new URLSearchParams(location.search);
    const ridRaw = search.get("resultId");
    const resultId = ridRaw ? Number(ridRaw) : NaN;

    const [culprit, setCulprit] = useState<string>("");
    const [isCorrect, setIsCorrect] = useState<boolean>(false);
    const [skills, setSkills] = useState<Skills>({
        logic: 0,
        creativity: 0,
        focus: 0,
        diversity: 0,
        depth: 0,
    });

    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            setErrorMsg(null);

            if (!Number.isFinite(resultId) || resultId <= 0) {
                setErrorMsg(
                    "결과 ID(resultId)가 없습니다. 결과 화면에서 다시 이동해주세요."
                );
                setLoading(false);
                return;
            }

            try {
                const res = await api.get<GameResultDTO>(
                    `/game-results/${resultId}`
                );
                const data = res.data;
                const sj: any = data.skillsJson || {};

                setCulprit(data.answerJson?.culprit || "");
                setIsCorrect(Boolean(data.correct));
                setSkills({
                    logic: Number(sj.logic ?? 0),
                    creativity: Number(sj.creativity ?? 0),
                    focus: Number(sj.focus ?? 0),
                    diversity: Number(sj.diversity ?? 0),
                    depth: Number(sj.depth ?? 0),
                });
            } catch (err: any) {
                // 에러 로그를 자세히
                const status = err?.response?.status;
                const body = err?.response?.data;
                console.error("결과 불러오기 실패:", { status, body, err });

                if (status === 403)
                    setErrorMsg("이 결과를 볼 권한이 없습니다.");
                else if (status === 404)
                    setErrorMsg("결과를 찾을 수 없습니다.");
                else
                    setErrorMsg(
                        "결과 불러오기 실패. 잠시 후 다시 시도해주세요."
                    );
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [resultId]);

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

    const options: ChartOptions<"radar"> = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            r: {
                angleLines: { color: "#ccc" },
                suggestedMin: 0,
                suggestedMax: 100,
                ticks: { stepSize: 20, color: "#333" },
                pointLabels: { color: "#333", font: { size: 14 } },
                grid: { color: "#e6e6e6" },
            },
        },
        plugins: {
            legend: { position: "top" as const },
            tooltip: { enabled: true },
        },
    };

    if (loading) {
        return (
            <div style={{ padding: 20 }}>
                <h2>분석 결과</h2>
                <p>불러오는 중...</p>
            </div>
        );
    }

    if (errorMsg) {
        return (
            <div style={{ padding: 20 }}>
                <h2>분석 결과</h2>
                <p style={{ color: "crimson" }}>{errorMsg}</p>
                <button
                    style={{ marginTop: 16 }}
                    onClick={() => navigate("/scenarios")}
                >
                    시나리오 목록으로
                </button>
            </div>
        );
    }

    return (
        <div style={{ padding: 20 }}>
            <h2>분석 결과</h2>

            <p>
                선택한 범인: <strong>{culprit || "미입력"}</strong>
            </p>
            <p>{isCorrect ? "정답입니다" : "틀렸습니다"}</p>

            <div style={{ marginTop: 30, height: 380 }}>
                <h3>추리 능력 분석</h3>
                <Radar data={data} options={options} />
            </div>

            <button
                style={{ marginTop: 20 }}
                onClick={() => navigate(`/play/${scenarioId}`)}
            >
                다시 플레이하기
            </button>
            <button
                style={{ marginTop: 20, marginLeft: 8 }}
                onClick={() => navigate("/scenarios")}
            >
                시나리오 목록
            </button>
        </div>
    );
}
