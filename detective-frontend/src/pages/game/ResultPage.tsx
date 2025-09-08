// src/pages/game/ResultPage.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import {
    useNavigate,
    useParams,
    useSearchParams,
    useLocation,
} from "react-router-dom";
import { api } from "../../shared/api/client";
import { useAuth } from "../../store/auth.store";
import pattern from "../../assets/textures/dust.png";

type ScenarioDetail = {
    scenIdx: number;
    scenTitle: string;
    scenSummary: string;
    scenLevel: number;
    contentJson?: string | any;
};
type EvidenceDoc = { id: string; name: string; desc?: string };

export default function ResultPage() {
    const { scenarioId } = useParams();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();

    const sessionId = Number(searchParams.get("sessionId"));
    const TIMER_KEY = sessionId
        ? `timer_session_${sessionId}`
        : "timer_session_unknown";
    const initialFromState = (
        location.state as { totalDuration?: number } | undefined
    )?.totalDuration;
    const initialFromQuery = (() => {
        const t = searchParams.get("t");
        return t && !isNaN(Number(t)) ? Number(t) : undefined;
    })();
    const initialFromStorage = (() => {
        const v = sessionStorage.getItem(TIMER_KEY);
        return v && !isNaN(Number(v)) ? Number(v) : undefined;
    })();
    const totalDuration =
        initialFromState ?? initialFromQuery ?? initialFromStorage ?? 0;

    const formatTime = (s: number) => {
        const m = String(Math.floor(s / 60)).padStart(2, "0");
        const sec = String(s % 60).padStart(2, "0");
        return `${m}:${sec}`;
    };

    const [reportSeconds, setReportSeconds] = useState(0);
    useEffect(() => {
        const id = window.setInterval(
            () => setReportSeconds((x) => x + 1),
            1000
        );
        return () => clearInterval(id);
    }, []);

    const [title, setTitle] = useState<string>("");
    const [suspects, setSuspects] = useState<string[]>([]);
    const [evidenceMap, setEvidenceMap] = useState<Map<string, EvidenceDoc>>(
        new Map()
    );
    const [collectedIds, setCollectedIds] = useState<string[]>([]);
    const NOTE_KEY = useMemo(
        () => `note_${scenarioId || "scen"}_${sessionId || "sess"}`,
        [scenarioId, sessionId]
    );
    const [memoText, setMemoText] = useState<string>("");

    const [selectedCulprit, setSelectedCulprit] = useState("");
    const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>(
        []
    );
    const [whenText, setWhenText] = useState("");
    const [howText, setHowText] = useState("");
    const [whyText, setWhyText] = useState("");
    const [confidence, setConfidence] = useState(70);

    const CLUE_KEY = useMemo(
        () => `clues_${scenarioId || "scen"}_${sessionId || "sess"}`,
        [scenarioId, sessionId]
    );

    useEffect(() => {
        const run = async () => {
            try {
                if (!scenarioId) return;
                const res = await api.get<ScenarioDetail>(
                    `/scenarios/${scenarioId}`
                );
                setTitle(res.data.scenTitle);

                let content: any = res.data.contentJson;
                if (typeof content === "string") {
                    try {
                        content = JSON.parse(content);
                    } catch {
                        content = {};
                    }
                }

                const chars: any[] = Array.isArray(content?.characters)
                    ? content.characters
                    : [];
                const names: string[] = chars
                    .map((c) => String(c?.name || ""))
                    .filter((n) => !!n);
                setSuspects(names);

                const evs: EvidenceDoc[] = Array.isArray(content?.evidence)
                    ? content.evidence
                    : [];
                const map = new Map<string, EvidenceDoc>();
                evs.forEach((e) =>
                    map.set(e.id, { id: e.id, name: e.name, desc: e.desc })
                );
                setEvidenceMap(map);

                const saved = localStorage.getItem(CLUE_KEY);
                if (saved) {
                    try {
                        const ids = JSON.parse(saved);
                        if (Array.isArray(ids)) setCollectedIds(ids);
                    } catch {}
                }
                const savedNote = localStorage.getItem(NOTE_KEY);
                setMemoText(savedNote ?? "");
                setSelectedEvidenceIds([]);
            } catch (err) {
                console.error("시나리오 불러오기 실패:", err);
            }
        };
        run();
    }, [scenarioId, CLUE_KEY, NOTE_KEY]);

    const hasBatchim = (word: string) => {
        if (!word) return false;
        const ch = word[word.length - 1];
        const code = ch.charCodeAt(0);
        if (code < 0xac00 || code > 0xd7a3) return false;
        const jong = (code - 0xac00) % 28;
        return jong !== 0;
    };
    const josaIGa = (word: string) => (hasBatchim(word) ? "이" : "가");

    const toggleEvidence = (id: string) => {
        setSelectedEvidenceIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };
    const evidenceLabel = (id: string) => evidenceMap.get(id)?.name || id;

    const narrative = useMemo(() => {
        const lines: string[] = [];
        if (title) {
            lines.push(`【사건】 ${title}`);
            lines.push("");
        }
        if (selectedCulprit) {
            const ig = josaIGa(selectedCulprit);
            lines.push(`저는 ${selectedCulprit}${ig} 범인이라고 판단합니다.`);
        } else {
            lines.push("저는 아직 최종 범인을 확정하지 않았습니다.");
        }
        const detail: string[] = [];
        if (whenText.trim()) detail.push(whenText.trim());
        if (howText.trim()) detail.push(howText.trim());
        if (whyText.trim()) detail.push(`그 이유는 ${whyText.trim()} 입니다.`);
        if (detail.length) lines.push(detail.join(" "));
        if (selectedEvidenceIds.length > 0) {
            const names = selectedEvidenceIds.map(evidenceLabel).join(", ");
            lines.push(`핵심 증거는 ${names}입니다.`);
        }
        if (confidence != null)
            lines.push(`현재 확신도는 약 ${confidence}% 입니다.`);
        lines.push("");
        lines.push(
            `플레이 시간 ${formatTime(totalDuration)}, 보고서 작성 ${formatTime(
                reportSeconds
            )}.`
        );
        return lines.join("\n");
    }, [
        title,
        selectedCulprit,
        whenText,
        howText,
        whyText,
        selectedEvidenceIds,
        confidence,
        totalDuration,
        reportSeconds,
    ]);

    const copyPreview = async () => {
        try {
            await navigator.clipboard.writeText(narrative);
            alert("미리보기 서술을 복사했습니다.");
        } catch {
            alert("복사에 실패했습니다. 선택하여 수동 복사해주세요.");
        }
    };

    const [submitting, setSubmitting] = useState(false);
    const loadingLines = [
        "증거를 정리하는 중...",
        "타임라인을 맞춰보는 중...",
        "알리바이를 대조하는 중...",
        "모순 검출 알고리즘 가동...",
        "추리 능력 점수를 계산하는 중...",
        "최종 리포트를 작성하는 중...",
    ];
    const [loadingIdx, setLoadingIdx] = useState(0);
    const loadingTimerRef = useRef<number | null>(null);
    useEffect(() => {
        if (!submitting) return;
        loadingTimerRef.current = window.setInterval(() => {
            setLoadingIdx((i) => (i + 1) % loadingLines.length);
        }, 1200) as unknown as number;
        return () => {
            if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
            loadingTimerRef.current = null;
        };
    }, [submitting]);

    const handleSubmit = async () => {
        if (!sessionId) {
            alert("세션 ID가 없습니다.");
            return;
        }
        if (!selectedCulprit) {
            alert("범인을 선택해주세요.");
            return;
        }
        const payload = {
            sessionId,
            scenIdx: Number(scenarioId),
            userIdx: user ? user.userIdx : null,
            answerJson: {
                culprit: selectedCulprit,
                when: whenText,
                how: howText,
                why: whyText,
                evidence_selected: selectedEvidenceIds,
                confidence,
                report_seconds: reportSeconds,
                report_draft: narrative,
                memo_text: memoText,
            },
            timings: {
                total_duration: totalDuration,
                per_turn: [] as number[],
            },
        };
        setSubmitting(true);
        setLoadingIdx(0);
        try {
            const { data } = await api.post("/game/result", payload);
            const resultId = data?.resultId;
            if (!resultId) {
                alert("결과 저장은 되었지만 resultId를 받지 못했습니다.");
                setSubmitting(false);
                return;
            }
            localStorage.removeItem(NOTE_KEY);
            navigate(`/play/${scenarioId}/analysis?resultId=${resultId}`);
        } catch (err) {
            console.error("결과 제출 실패:", err);
            alert("결과 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
            setSubmitting(false);
        }
    };

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
                {/* 헤더/요약 바 */}
                <div className="mb-6">
                    <h2 className="text-3xl font-extrabold special-elite-regular tracking-wider flex items-center gap-3">
                        🕵️ 탐정의 사건 수첩{" "}
                        <span className="text-white/60 text-base">
                            — 최종 보고
                        </span>
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-3">
                        <span
                            className="px-3 py-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 text-sm"
                            title="플레이 시간"
                        >
                            ⏱️ 플레이어 {formatTime(totalDuration)}
                        </span>
                        <span
                            className="px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-sm"
                            title="보고서 작성 시간"
                        >
                            보고서 {formatTime(reportSeconds)}
                        </span>
                        {title && (
                            <span className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm">
                                사건: <b className="ml-1">{title}</b>
                            </span>
                        )}
                    </div>
                </div>

                {/* 책 스프레드 레이아웃 */}
                <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 중앙 책등 */}
                    <div className="hidden md:block pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/20 to-transparent" />

                    {/* 왼쪽 페이지: 범인 지목 + 증거 */}
                    <div className="space-y-4">
                        {/* ① 범인 지목 */}
                        <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 shadow-xl shadow-black/30">
                            <div className="font-extrabold mb-3">
                                ① 범인 지목
                            </div>
                            {suspects.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {suspects.map((name) => (
                                        <label
                                            key={name}
                                            className="flex items-center gap-2 cursor-pointer"
                                        >
                                            <input
                                                type="radio"
                                                name="culprit"
                                                value={name}
                                                checked={
                                                    selectedCulprit === name
                                                }
                                                onChange={(e) =>
                                                    setSelectedCulprit(
                                                        e.target.value
                                                    )
                                                }
                                                className="accent-amber-400"
                                            />
                                            <span className="text-white/90">
                                                {name}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-white/70">
                                    용의자 목록 불러오는 중...
                                </div>
                            )}
                        </section>

                        {/* ② 핵심 증거 (수집한 단서만) */}
                        <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 shadow-xl shadow-black/30">
                            <div className="font-extrabold">
                                ② 핵심 증거 선택
                            </div>
                            <div className="text-xs text-white/60 mb-2">
                                플레이 중 수집한 단서만 보입니다.
                            </div>
                            {collectedIds.length === 0 ? (
                                <div className="text-white/70">
                                    수집한 단서가 없습니다.
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {collectedIds.map((id) => {
                                        const active =
                                            selectedEvidenceIds.includes(id);
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() =>
                                                    toggleEvidence(id)
                                                }
                                                title={
                                                    evidenceMap.get(id)?.desc ||
                                                    ""
                                                }
                                                className={`px-3 py-1.5 rounded-full border text-sm transition ${
                                                    active
                                                        ? "border-amber-300/40 bg-amber-300/10"
                                                        : "border-white/15 bg-white/5 hover:bg-white/10"
                                                }`}
                                            >
                                                {evidenceLabel(id)}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                        {/* 메모 표시 */}
                        <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 shadow-xl shadow-black/30">
                            <div className="font-extrabold mb-2">
                                사건수첩(메모)
                            </div>
                            {memoText?.trim() ? (
                                <pre className="whitespace-pre-wrap rounded-xl border border-dashed border-white/20 bg-black/30 px-3 py-3 min-h-[80px]">
                                    {memoText}
                                </pre>
                            ) : (
                                <div className="text-white/70">
                                    표시할 메모가 없습니다. (플레이 중 메모장에
                                    작성하세요)
                                </div>
                            )}
                            <div className="mt-2 text-xs text-white/60">
                                * 제출 시 메모는 자동으로 초기화됩니다.
                            </div>
                        </section>
                    </div>

                    {/* 오른쪽 페이지: 서술 + 메모 + 확신도 + 미리보기 + 제출 */}
                    <div className="space-y-4">
                        {/* ③ 사건 서술 */}
                        <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 shadow-xl shadow-black/30">
                            <div className="font-extrabold mb-3">
                                ③ 사건 서술
                            </div>
                            <label className="font-bold">언제?</label>
                            <textarea
                                placeholder="예: 오후 2시경, 열람실과 서고 사이 복도에서 일어났습니다."
                                value={whenText}
                                onChange={(e) => setWhenText(e.target.value)}
                                className="mt-1 w-full min-h-[72px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400/40"
                            />
                            <label className="font-bold mt-3 block">
                                어떻게?
                            </label>
                            <textarea
                                placeholder="예: CCTV 사각지대를 이용해 서고로 진입해 고서를 가방에 넣었습니다."
                                value={howText}
                                onChange={(e) => setHowText(e.target.value)}
                                className="mt-1 w-full min-h-[72px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400/40"
                            />
                            <label className="font-bold mt-3 block">왜?</label>
                            <textarea
                                placeholder="예: 고서를 처분해 빚을 갚기 위해서였습니다."
                                value={whyText}
                                onChange={(e) => setWhyText(e.target.value)}
                                className="mt-1 w-full min-h-[72px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400/40"
                            />
                        </section>

                        {/* 확신도 */}
                        <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 shadow-xl shadow-black/30">
                            <div className="font-extrabold mb-2">④ 확신도</div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={confidence}
                                    onChange={(e) =>
                                        setConfidence(Number(e.target.value))
                                    }
                                    className="flex-1 accent-amber-400"
                                />
                                <span className="w-14 text-right font-extrabold text-amber-300">
                                    {confidence}%
                                </span>
                            </div>
                        </section>

                        {/* 서술형 미리보기 + 제출 */}
                        <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 shadow-xl shadow-black/30">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="font-extrabold">
                                    서술형 미리보기
                                </div>
                                <button
                                    onClick={copyPreview}
                                    className="ml-auto px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-sm transition"
                                >
                                    복사
                                </button>
                            </div>
                            <pre className="whitespace-pre-wrap font-mono text-[13.5px] rounded-xl border border-dashed border-white/20 bg-black/30 px-3 py-3">
                                {narrative}
                            </pre>
                            <div className="mt-2 text-xs text-white/60">
                                * 입력에 맞춰 실시간으로 변합니다. 그대로
                                제출하셔도 됩니다.
                            </div>

                            <div className="mt-4 text-right">
                                <button
                                    onClick={handleSubmit}
                                    disabled={!selectedCulprit || submitting}
                                    className="px-4 py-2 rounded-lg border border-amber-300/40 bg-amber-300/10 hover:bg-amber-300/20 disabled:opacity-60 font-extrabold transition"
                                    title={
                                        !selectedCulprit
                                            ? "범인을 먼저 선택하세요"
                                            : "제출"
                                    }
                                >
                                    {submitting
                                        ? "제출 중..."
                                        : "최종 보고 제출"}
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            {/* 풀스크린 로딩 오버레이 */}
            {submitting && (
                <div className="fixed inset-0 grid place-items-center bg-black/60 z-[9999]">
                    <div className="w-[440px] max-w-[90vw] rounded-2xl border border-white/10 bg-[#111] text-white p-6 shadow-2xl shadow-black/60 text-center">
                        <div className="w-12 h-12 rounded-full border-4 border-amber-400 border-t-transparent mx-auto mb-3 animate-spin" />
                        <h3 className="text-lg font-extrabold mb-1">
                            분석 중입니다
                        </h3>
                        <p className="text-white/85">
                            {loadingLines[loadingIdx]}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
