// src/pages/game/AnalysisPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../shared/api/client";

// chart.js
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

ChartJS.register(
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
);

// ===== Types =====
type Skills = {
    logic: number;
    creativity: number;
    focus: number;
    diversity: number;
    depth: number;
};

type AnswerJson = {
    culprit?: string;
    when?: string;
    how?: string;
    why?: string;
    evidence_selected?: string[]; // 플레이어가 고른 핵심 증거 id 리스트
    confidence?: number;
    report_seconds?: number;
    report_draft?: string; // 결과 페이지의 서술 미리보기 전체 문장
    memo_text?: string;
};

type GameResultDTO = {
    resultId: number;
    sessionId: number;
    scenIdx: number;
    userIdx: number | null;
    correct: boolean;
    answerJson: AnswerJson;
    skillsJson: Skills; // 저장된 점수
    submetrics?: Record<string, number>; // (선택) 서버가 준다면 표시
    engine?: string; // (선택) "hf"/"dummy"
};

type ScenarioDetail = {
    scenIdx: number;
    scenTitle: string;
    scenSummary: string;
    scenLevel: number;
    contentJson?: string | any;
};

type EvidenceDoc = {
    id: string;
    name: string;
    desc?: string;
};

export default function AnalysisPage() {
    const { scenarioId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    // resultId “필수”로 받기
    const search = new URLSearchParams(location.search);
    const ridRaw = search.get("resultId");
    const resultId = ridRaw ? Number(ridRaw) : NaN;

    // UI state
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Scenario + Evidence map
    const [title, setTitle] = useState<string>("");
    const [evidenceMap, setEvidenceMap] = useState<Map<string, EvidenceDoc>>(
        new Map()
    );

    // Result
    const [isCorrect, setIsCorrect] = useState<boolean>(false);
    const [skills, setSkills] = useState<Skills>({
        logic: 0,
        creativity: 0,
        focus: 0,
        diversity: 0,
        depth: 0,
    });
    const [answer, setAnswer] = useState<AnswerJson>({
        culprit: "",
        when: "",
        how: "",
        why: "",
        evidence_selected: [],
        confidence: undefined,
        report_seconds: undefined,
        report_draft: "",
        memo_text: "",
    });
    const [submetrics, setSubmetrics] = useState<Record<string, number> | null>(
        null
    );
    const [engine, setEngine] = useState<string | undefined>(undefined);

    // Data loaders
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
                // 1) 결과 로드
                const res = await api.get<GameResultDTO>(
                    `/game-results/${resultId}`
                );
                const data = res.data;

                setIsCorrect(Boolean(data.correct));
                setSkills({
                    logic: Number(data.skillsJson?.logic ?? 0),
                    creativity: Number(data.skillsJson?.creativity ?? 0),
                    focus: Number(data.skillsJson?.focus ?? 0),
                    diversity: Number(data.skillsJson?.diversity ?? 0),
                    depth: Number(data.skillsJson?.depth ?? 0),
                });
                setAnswer(data.answerJson ?? {});
                setSubmetrics(data.submetrics ?? null);
                setEngine(data.engine);

                // 2) 시나리오 로드 → 증거 id→name 매핑
                if (scenarioId) {
                    const scen = await api.get<ScenarioDetail>(
                        `/scenarios/${scenarioId}`
                    );
                    setTitle(scen.data?.scenTitle ?? "");

                    let content: any = scen.data?.contentJson;
                    if (typeof content === "string") {
                        try {
                            content = JSON.parse(content);
                        } catch {
                            content = {};
                        }
                    }

                    const evs: EvidenceDoc[] = Array.isArray(content?.evidence)
                        ? content.evidence
                        : [];
                    const map = new Map<string, EvidenceDoc>();
                    evs.forEach((e) =>
                        map.set(e.id, { id: e.id, name: e.name, desc: e.desc })
                    );
                    setEvidenceMap(map);
                }
            } catch (err: any) {
                const status = err?.response?.status;
                const body = err?.response?.data;
                console.error("결과/시나리오 불러오기 실패:", {
                    status,
                    body,
                    err,
                });

                if (status === 401) {
                    setErrorMsg("로그인이 필요합니다. (401)");
                } else if (status === 403) {
                    setErrorMsg("이 결과를 볼 권한이 없습니다. (403)");
                } else if (status === 404) {
                    setErrorMsg("결과를 찾을 수 없습니다. (404)");
                } else {
                    setErrorMsg(
                        "결과 불러오기 실패. 잠시 후 다시 시도해주세요."
                    );
                }
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [resultId, scenarioId]);

    // helpers
    const evidenceNames = useMemo(() => {
        const ids = answer?.evidence_selected || [];
        return ids.map((id) => evidenceMap.get(id)?.name || id);
    }, [answer?.evidence_selected, evidenceMap]);

    const formatTime = (s?: number) => {
        if (s == null || Number.isNaN(s)) return "00:00";
        const m = String(Math.floor(s / 60)).padStart(2, "0");
        const sec = String(s % 60).padStart(2, "0");
        return `${m}:${sec}`;
    };

    // chart data
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

    // UI — Loading / Error
    if (loading) {
        return (
            <div style={{ padding: 20 }}>
                <h2>분석 결과</h2>
                <div
                    style={{
                        marginTop: 8,
                        padding: 16,
                        borderRadius: 12,
                        border: "1px solid #eee",
                        background: "#f9fbff",
                    }}
                >
                    <b>결과를 불러오는 중...</b>
                    <div style={{ marginTop: 6, fontSize: 14, color: "#555" }}>
                        • 플레이 로그를 정리하고 있어요
                        <br />
                        • 핵심 단서와 질문 흐름을 분석 중이에요
                        <br />• 능력치 점수를 계산하고 있어요
                    </div>
                </div>
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

    // ===== 요약 해석 카드 (skills만으로도 동작) =====
    const summaryInsights = (() => {
        const out: string[] = [];
        if (skills.focus >= 70)
            out.push("집중력: 사건 맥락과 단서에 잘 맞춰 질문했습니다.");
        else if (skills.focus <= 35)
            out.push(
                "집중력: 사건과 무관한 질문이 많았어요. 핵심 사실(시간·장소·증거)에 더 밀착해 보세요."
            );

        if (skills.logic >= 70)
            out.push("논리력: 근거 기반으로 차근차근 추론했습니다.");
        else if (skills.logic <= 35)
            out.push(
                "논리력: 단서 연결이 약했습니다. 모순 지점(알리바이 vs 증거)을 직접 대면시키세요."
            );

        if (skills.depth >= 70)
            out.push("깊이: 한 주제를 충분히 파고들었습니다.");
        else if (skills.depth <= 35)
            out.push(
                "깊이: 질문 길이나 2차 추궁이 부족했습니다. 이전 답변을 근거로 추가 추궁을 시도해 보세요."
            );

        if (skills.diversity >= 70)
            out.push("다양성: 여러 가능성을 탐색했습니다.");
        else if (skills.diversity <= 35)
            out.push(
                "다양성: 한 주제에 치우쳤습니다. 다른 인물/시간대/장소도 교차 질문하세요."
            );

        if (skills.creativity >= 70)
            out.push("창의력: 새로운 관점의 질문을 잘 던졌습니다.");
        else if (skills.creativity <= 35)
            out.push(
                "창의력: 기존 단서를 변주해 '만약 ~라면?' 식의 가설 질문도 활용해 보세요."
            );

        return out;
    })();

    // UI — Main
    return (
        <div style={{ padding: 20, maxWidth: 980, margin: "0 auto" }}>
            <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                🔎 분석 결과
                {title && (
                    <span style={{ fontSize: 14, color: "#666" }}>
                        — {title}
                    </span>
                )}
            </h2>

            {/* Verdict */}
            <section
                style={{
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    padding: 14,
                    background: "#fff",
                    marginTop: 8,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                        style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: "1px solid",
                            borderColor: isCorrect ? "#16a34a" : "#ef4444",
                            color: isCorrect ? "#16a34a" : "#ef4444",
                            background: isCorrect ? "#ecfdf5" : "#fef2f2",
                            fontWeight: 700,
                            fontSize: 13,
                        }}
                    >
                        {isCorrect ? "정답" : "오답"}
                    </div>
                    <div style={{ fontSize: 16 }}>
                        선택한 범인: <b>{answer?.culprit || "미입력"}</b>
                    </div>
                    {engine && (
                        <span
                            style={{
                                marginLeft: "auto",
                                fontSize: 12,
                                color: "#666",
                            }}
                        >
                            엔진: {engine}
                        </span>
                    )}
                </div>
            </section>

            {/* Evidence selected by the player */}
            <section
                style={{
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    padding: 14,
                    background: "#fff",
                    marginTop: 12,
                }}
            >
                <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    플레이어가 고른 핵심 증거
                </div>
                {answer?.evidence_selected &&
                answer.evidence_selected.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {answer.evidence_selected.map((id) => {
                            const name = evidenceMap.get(id)?.name || id;
                            const desc = evidenceMap.get(id)?.desc || "";
                            return (
                                <li key={id} style={{ marginBottom: 6 }}>
                                    <b>{name}</b>
                                    {desc ? (
                                        <span style={{ color: "#666" }}>
                                            {" "}
                                            — {desc}
                                        </span>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div style={{ color: "#777" }}>
                        선택한 핵심 증거가 없습니다.
                    </div>
                )}
                <div style={{ marginTop: 8, fontSize: 12, color: "#777" }}>
                    * 정답의 공식 증거는 표시하지 않습니다. (재플레이 스포일러
                    방지)
                </div>
            </section>

            {/* Player narrative & details */}
            <section
                style={{
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    padding: 14,
                    background: "#fff",
                    marginTop: 12,
                }}
            >
                <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    플레이어 서술 초안
                </div>
                {answer?.report_draft?.trim() ? (
                    <div
                        style={{
                            whiteSpace: "pre-wrap",
                            border: "1px dashed #c7c7c7",
                            borderRadius: 8,
                            padding: 12,
                            background: "#fcfcff",
                            minHeight: 80,
                            fontFamily:
                                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono','Courier New', monospace",
                        }}
                    >
                        {answer.report_draft}
                    </div>
                ) : (
                    <div style={{ color: "#777" }}>
                        제출한 서술 초안이 없습니다. (결과 페이지에서 자동
                        생성된 미리보기를 제출하면 이곳에 표시됩니다)
                    </div>
                )}

                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                    <div>
                        <b>언제?</b>
                        <div style={{ marginTop: 4 }}>
                            {answer?.when || "—"}
                        </div>
                    </div>
                    <div>
                        <b>어떻게?</b>
                        <div style={{ marginTop: 4 }}>{answer?.how || "—"}</div>
                    </div>
                    <div>
                        <b>왜?</b>
                        <div style={{ marginTop: 4 }}>{answer?.why || "—"}</div>
                    </div>
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginTop: 12,
                        fontSize: 13,
                    }}
                >
                    {"confidence" in (answer || {}) &&
                        typeof answer?.confidence === "number" && (
                            <span
                                style={{
                                    padding: "4px 10px",
                                    borderRadius: 999,
                                    border: "1px solid #e5e7eb",
                                    background: "#f8fafc",
                                }}
                            >
                                확신도: <b>{answer?.confidence}%</b>
                            </span>
                        )}
                    {"report_seconds" in (answer || {}) &&
                        typeof answer?.report_seconds === "number" && (
                            <span
                                style={{
                                    padding: "4px 10px",
                                    borderRadius: 999,
                                    border: "1px solid #e5e7eb",
                                    background: "#f8fafc",
                                }}
                            >
                                보고서 작성:{" "}
                                <b>{formatTime(answer?.report_seconds)}</b>
                            </span>
                        )}
                </div>
            </section>

            {/* Skills Radar */}
            <section
                style={{
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    padding: 14,
                    background: "#fff",
                    marginTop: 12,
                }}
            >
                <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    추리 능력 분석
                </div>
                <div style={{ height: 380 }}>
                    <Radar data={data} options={options} />
                </div>
            </section>

            {/* 🔍 진단 리포트 (요약 해석 + 세부 지표) */}
            <section
                style={{
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    padding: 14,
                    background: "#fff",
                    marginTop: 12,
                }}
            >
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                    진단 리포트
                </div>

                {/* 요약 해석 카드 — 항상 표시 */}
                {summaryInsights.length > 0 ? (
                    <ul style={{ margin: "4px 0 8px 18px", color: "#444" }}>
                        {summaryInsights.map((s, i) => (
                            <li key={i}>{s}</li>
                        ))}
                    </ul>
                ) : (
                    <div style={{ color: "#777" }}>
                        점수 해석 정보가 없습니다.
                    </div>
                )}

                {/* 서버가 submetrics를 줄 경우 세부 수치 표시 */}
                {submetrics && (
                    <>
                        <div
                            style={{
                                marginTop: 10,
                                fontWeight: 700,
                                color: "#333",
                            }}
                        >
                            세부 지표
                        </div>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "repeat(auto-fit, minmax(220px, 1fr))",
                                gap: 8,
                                marginTop: 8,
                            }}
                        >
                            {Object.entries(submetrics).map(([k, v]) => (
                                <div
                                    key={k}
                                    style={{
                                        border: "1px solid #eee",
                                        borderRadius: 10,
                                        padding: 10,
                                        background: "#fafafa",
                                        fontSize: 13,
                                    }}
                                >
                                    <div style={{ color: "#666" }}>{k}</div>
                                    <div style={{ fontWeight: 800 }}>
                                        {typeof v === "number"
                                            ? v.toFixed(3)
                                            : String(v)}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div
                            style={{
                                marginTop: 8,
                                fontSize: 12,
                                color: "#777",
                            }}
                        >
                            * focus_sim/novelty 등은 문장 임베딩 기반
                            유사도(0~1), avg_len은 평균 질문 길이(문자
                            수)입니다.
                        </div>
                    </>
                )}
            </section>

            {/* Actions */}
            <div style={{ marginTop: 16 }}>
                <button onClick={() => navigate(`/play/${scenarioId}`)}>
                    다시 플레이하기
                </button>
                <button
                    style={{ marginLeft: 8 }}
                    onClick={() => navigate("/scenarios")}
                >
                    시나리오 목록
                </button>
            </div>
        </div>
    );
}
