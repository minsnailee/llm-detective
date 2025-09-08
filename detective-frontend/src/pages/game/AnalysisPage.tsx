// src/pages/game/AnalysisPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../shared/api/client";

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

import pattern from "../../assets/textures/dust.png";

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
type AnswerJson = {
    culprit?: string;
    when?: string;
    how?: string;
    why?: string;
    evidence_selected?: string[];
    confidence?: number;
    report_seconds?: number;
    report_draft?: string;
    memo_text?: string;
};
type GameResultDTO = {
    resultId: number;
    sessionId: number;
    scenIdx: number;
    userIdx: number | null;
    correct: boolean;
    answerJson: AnswerJson;
    skillsJson: Skills;
    submetrics?: Record<string, number>;
    engine?: string;
};
type ScenarioDetail = {
    scenIdx: number;
    scenTitle: string;
    scenSummary: string;
    scenLevel: number;
    contentJson?: string | any;
};
type EvidenceDoc = { id: string; name: string; desc?: string };

export default function AnalysisPage() {
    const { scenarioId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const search = new URLSearchParams(location.search);
    const ridRaw = search.get("resultId");
    const resultId = ridRaw ? Number(ridRaw) : NaN;

    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [title, setTitle] = useState<string>("");
    const [evidenceMap, setEvidenceMap] = useState<Map<string, EvidenceDoc>>(
        new Map()
    );

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
                if (status === 401) setErrorMsg("로그인이 필요합니다. (401)");
                else if (status === 403)
                    setErrorMsg("이 결과를 볼 권한이 없습니다. (403)");
                else if (status === 404)
                    setErrorMsg("결과를 찾을 수 없습니다. (404)");
                else
                    setErrorMsg(
                        "결과 불러오기 실패. 잠시 후 다시 시도해주세요."
                    );
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [resultId, scenarioId]);

    const formatTime = (s?: number) => {
        if (s == null || Number.isNaN(s)) return "00:00";
        const m = String(Math.floor(s / 60)).padStart(2, "0");
        const sec = String(s % 60).padStart(2, "0");
        return `${m}:${sec}`;
    };

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
                backgroundColor: "rgba(251, 191, 36, 0.20)",
                borderColor: "rgba(251, 191, 36, 0.95)",
                borderWidth: 2,
                pointBackgroundColor: "rgba(251, 191, 36, 1)",
                pointBorderColor: "rgba(0,0,0,0.35)",
                pointHoverBackgroundColor: "rgba(0,0,0,0.7)",
                pointHoverBorderColor: "rgba(251, 191, 36, 1)",
            },
        ],
    };

    const options: ChartOptions<"radar"> = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            r: {
                angleLines: { color: "rgba(255,255,255,0.18)" },
                suggestedMin: 0,
                suggestedMax: 100,
                ticks: {
                    stepSize: 20,
                    color: "rgba(255,255,255,0.7)",
                    backdropColor: "transparent",
                },
                pointLabels: {
                    color: "rgba(255,255,255,0.85)",
                    font: { size: 13 },
                },
                grid: { color: "rgba(255,255,255,0.15)" },
            },
        },
        plugins: {
            legend: {
                position: "top",
                labels: { color: "rgba(255,255,255,0.85)" },
            },
            tooltip: {
                enabled: true,
                titleColor: "#111",
                bodyColor: "#111",
                backgroundColor: "rgba(255,255,255,0.95)",
                borderColor: "rgba(0,0,0,0.1)",
                borderWidth: 1,
            },
        },
    };

    const summaryInsights = useMemo(() => {
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
    }, [skills]);

    if (loading) {
        return (
            <div className="relative min-h-screen w-full bg-[#0b0b0b] text-white grid place-items-center">
                <div className="absolute inset-0 bg-gradient-to-b from-[#0b0b0b] via-[#121212] to-[#1a1a1a]" />
                <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
                <div className="relative w-[520px] max-w-[92vw] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 shadow-2xl shadow-black/50">
                    <h2 className="text-xl font-extrabold mb-3">분석 결과</h2>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
                        <div>
                            <div className="font-bold">
                                결과를 불러오는 중...
                            </div>
                            <div className="text-sm text-white/80">
                                플레이 로그 정리 · 단서 분석 · 능력치 계산
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    if (errorMsg) {
        return (
            <div className="relative min-h-screen w-full bg-[#0b0b0b] text-white">
                <div className="absolute inset-0 bg-gradient-to-b from-[#0b0b0b] via-[#121212] to-[#1a1a1a]" />
                <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
                <div className="relative mx-auto max-w-[1200px] px-6 py-10">
                    <h2 className="text-2xl font-extrabold mb-4">분석 결과</h2>
                    <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4">
                        <p className="text-rose-200">{errorMsg}</p>
                        <button
                            className="mt-4 px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 transition"
                            onClick={() => navigate("/scenarios")}
                        >
                            시나리오 목록으로
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen w-full bg-[#0b0b0b] text-white">
            {/* 배경/텍스처 */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0b0b0b] via-[#121212] to-[#1a1a1a]" />
            <div
                className="absolute inset-0 opacity-30 mix-blend-screen pointer-events-none"
                style={{
                    backgroundImage: `url(${pattern})`,
                    backgroundRepeat: "repeat",
                }}
            />
            <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />

            <div className="relative mx-auto max-w-[1200px] px-6 py-8">
                {/* 헤더 */}
                <div className="flex items-baseline gap-3 mb-6">
                    <h2 className="text-3xl font-extrabold special-elite-regular tracking-wider">
                        🔎 분석 결과
                    </h2>
                    {title && <span className="text-white/70">— {title}</span>}
                </div>

                {/* 책 스프레드 레이아웃 */}
                <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 중앙 책등 */}
                    <div className="hidden md:block pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/20 to-transparent" />

                    {/* 왼쪽 페이지 */}
                    <div className="space-y-4">
                        {/* Verdict */}
                        <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 shadow-xl shadow-black/30">
                            <div className="flex flex-wrap items-center gap-3">
                                <span
                                    className={`inline-flex items-center px-3 py-1.5 rounded-full border text-sm font-bold ${
                                        isCorrect
                                            ? "border-emerald-400/40 text-emerald-200 bg-emerald-400/10"
                                            : "border-rose-400/40 text-rose-200 bg-rose-400/10"
                                    }`}
                                >
                                    {isCorrect ? "정답" : "오답"}
                                </span>
                                <div className="text-base">
                                    선택한 범인:{" "}
                                    <b className="text-white">
                                        {answer?.culprit || "미입력"}
                                    </b>
                                </div>
                                {engine && (
                                    <span className="ml-auto text-xs text-white/60">
                                        엔진: {engine}
                                    </span>
                                )}
                            </div>
                        </section>

                        {/* 증거 목록 */}
                        <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 shadow-xl shadow-black/30">
                            <div className="font-extrabold mb-2">
                                플레이어가 고른 핵심 증거
                            </div>
                            {answer?.evidence_selected &&
                            answer.evidence_selected.length > 0 ? (
                                <ul className="list-disc pl-5 space-y-1">
                                    {answer.evidence_selected.map((id) => {
                                        const e = evidenceMap.get(id);
                                        return (
                                            <li
                                                key={id}
                                                className="text-white/90"
                                            >
                                                <b className="text-white">
                                                    {e?.name || id}
                                                </b>
                                                {e?.desc ? (
                                                    <span className="text-white/70">
                                                        {" "}
                                                        — {e.desc}
                                                    </span>
                                                ) : null}
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <div className="text-white/70">
                                    선택한 핵심 증거가 없습니다.
                                </div>
                            )}
                            <div className="mt-2 text-xs text-white/60">
                                * 스포 방지를 위해 정답 공식 증거는 노출하지
                                않습니다.
                            </div>
                        </section>

                        {/* 서술 초안/세부 */}
                        <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 shadow-xl shadow-black/30">
                            <div className="font-extrabold mb-2">
                                플레이어 서술 초안
                            </div>
                            {answer?.report_draft?.trim() ? (
                                <pre className="whitespace-pre-wrap font-mono text-[13.5px] rounded-xl border border-dashed border-white/20 bg-black/30 px-3 py-3">
                                    {answer.report_draft}
                                </pre>
                            ) : (
                                <div className="text-white/70">
                                    제출한 서술 초안이 없습니다.
                                </div>
                            )}
                            <div className="grid gap-3 mt-4">
                                <div>
                                    <b>언제?</b>
                                    <div className="mt-1 text-white/90">
                                        {answer?.when || "—"}
                                    </div>
                                </div>
                                <div>
                                    <b>어떻게?</b>
                                    <div className="mt-1 text-white/90">
                                        {answer?.how || "—"}
                                    </div>
                                </div>
                                <div>
                                    <b>왜?</b>
                                    <div className="mt-1 text-white/90">
                                        {answer?.why || "—"}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-4 text-sm">
                                {"confidence" in (answer || {}) &&
                                    typeof answer?.confidence === "number" && (
                                        <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-white/15 bg-white/5">
                                            확신도:{" "}
                                            <b className="ml-1 text-amber-300">
                                                {answer?.confidence}%
                                            </b>
                                        </span>
                                    )}
                                {"report_seconds" in (answer || {}) &&
                                    typeof answer?.report_seconds ===
                                        "number" && (
                                        <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-white/15 bg-white/5">
                                            보고서 작성:{" "}
                                            <b className="ml-1 text-white">
                                                {formatTime(
                                                    answer?.report_seconds
                                                )}
                                            </b>
                                        </span>
                                    )}
                            </div>
                        </section>
                    </div>

                    {/* 오른쪽 페이지 */}
                    <div className="space-y-4">
                        {/* 레이더 */}
                        <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 shadow-xl shadow-black/30">
                            <div className="font-extrabold mb-2">
                                추리 능력 분석
                            </div>
                            <button className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 transition">
                                이전 제출 비교
                            </button>
                            <div className="h-[380px]">
                                <Radar data={data} options={options} />
                            </div>
                        </section>

                        {/* 진단 리포트 + 세부 지표 */}
                        <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 shadow-xl shadow-black/30">
                            <div className="font-extrabold mb-2">
                                진단 리포트
                            </div>
                            {summaryInsights.length > 0 ? (
                                <ul className="list-disc pl-5 space-y-1 text-white/90">
                                    {summaryInsights.map((s, i) => (
                                        <li key={i}>{s}</li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-white/70">
                                    점수 해석 정보가 없습니다.
                                </div>
                            )}

                            {submetrics && (
                                <>
                                    <div className="mt-3 font-bold text-white/90">
                                        세부 지표
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                        {Object.entries(submetrics).map(
                                            ([k, v]) => (
                                                <div
                                                    key={k}
                                                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                                                >
                                                    <div className="text-white/70">
                                                        {k}
                                                    </div>
                                                    <div className="font-extrabold text-white">
                                                        {typeof v === "number"
                                                            ? v.toFixed(3)
                                                            : String(v)}
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                    <div className="mt-2 text-xs text-white/60">
                                        * focus_sim/novelty 등은 임베딩
                                        유사도(0~1), avg_len은 평균 질문
                                        길이입니다.
                                    </div>
                                </>
                            )}
                        </section>

                        {/* 액션 */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => navigate(`/play/${scenarioId}`)}
                                className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 transition"
                            >
                                다시 플레이하기
                            </button>
                            <button
                                onClick={() => navigate("/scenarios")}
                                className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 transition"
                            >
                                시나리오 목록
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
