import {
    useState,
    useEffect,
    useMemo,
    useRef,
    type CSSProperties,
} from "react";
import {
    useNavigate,
    useParams,
    useSearchParams,
    useLocation,
} from "react-router-dom";
import { api } from "../../shared/api/client";
import { useAuth } from "../../store/auth.store";

type ScenarioDetail = {
    scenIdx: number;
    scenTitle: string;
    scenSummary: string;
    scenLevel: number;
    contentJson?: string | any;
};

type EvidenceDoc = {
    id: string; // "e1"
    name: string;
    desc?: string;
};

export default function ResultPage() {
    const { scenarioId } = useParams();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();

    // ─────────────────────────────────────────────
    // 세션/타이머 (플레이 총 소요시간은 표시만)
    // ─────────────────────────────────────────────
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

    // 결과 작성 시간(이 페이지에서만 카운트)
    const [reportSeconds, setReportSeconds] = useState(0);
    useEffect(() => {
        const id = window.setInterval(
            () => setReportSeconds((x) => x + 1),
            1000
        );
        return () => clearInterval(id);
    }, []);

    // ─────────────────────────────────────────────
    // 시나리오/용의자/증거 + 플레이 중 수집 단서 + 메모
    // ─────────────────────────────────────────────
    const [title, setTitle] = useState<string>("");
    const [suspects, setSuspects] = useState<string[]>([]);
    const [evidenceMap, setEvidenceMap] = useState<Map<string, EvidenceDoc>>(
        new Map()
    );

    // 플레이 중 "수집한" 단서 id (스포 방지: 이 목록만 노출)
    const [collectedIds, setCollectedIds] = useState<string[]>([]);

    // 사건수첩(메모) 표시용
    const NOTE_KEY = useMemo(
        () => `note_${scenarioId || "scen"}_${sessionId || "sess"}`,
        [scenarioId, sessionId]
    );
    const [memoText, setMemoText] = useState<string>("");

    // 선택값
    const [selectedCulprit, setSelectedCulprit] = useState("");
    const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>(
        []
    );
    const [whenText, setWhenText] = useState("");
    const [howText, setHowText] = useState("");
    const [whyText, setWhyText] = useState("");

    // 확신도(선택)
    const [confidence, setConfidence] = useState(70);

    // GamePlay에서 쓰던 로컬키 재사용(수집 단서)
    const CLUE_KEY = useMemo(
        () => `clues_${scenarioId || "scen"}_${sessionId || "sess"}`,
        [scenarioId, sessionId]
    );

    // 시나리오 불러오기 + 수집 단서/메모 로드
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

                // 등장인물(전원 용의자로 간주)
                const chars: any[] = Array.isArray(content?.characters)
                    ? content.characters
                    : [];
                const names: string[] = chars
                    .map((c) => String(c?.name || ""))
                    .filter((n) => !!n);
                setSuspects(names);

                // 전체 증거 맵(표기용)
                const evs: EvidenceDoc[] = Array.isArray(content?.evidence)
                    ? content.evidence
                    : [];
                const map = new Map<string, EvidenceDoc>();
                evs.forEach((e) =>
                    map.set(e.id, { id: e.id, name: e.name, desc: e.desc })
                );
                setEvidenceMap(map);

                // 플레이 중 수집한 단서만 로드
                const saved = localStorage.getItem(CLUE_KEY);
                if (saved) {
                    try {
                        const ids = JSON.parse(saved);
                        if (Array.isArray(ids)) setCollectedIds(ids);
                    } catch {}
                }

                // 사건수첩(메모) 로드
                const savedNote = localStorage.getItem(NOTE_KEY);
                setMemoText(savedNote ?? "");
                // 핵심 증거 선택은 초기 비어있게
                setSelectedEvidenceIds([]);
            } catch (err) {
                console.error("시나리오 불러오기 실패:", err);
            }
        };
        run();
    }, [scenarioId, CLUE_KEY, NOTE_KEY]);

    // ─────────────────────────────────────────────
    // 한국어 조사 간단 처리 (이/가, 을/를)
    // ─────────────────────────────────────────────
    const hasBatchim = (word: string) => {
        if (!word) return false;
        const ch = word[word.length - 1];
        const code = ch.charCodeAt(0);
        if (code < 0xac00 || code > 0xd7a3) return false; // 한글 완성형만
        const jong = (code - 0xac00) % 28;
        return jong !== 0;
    };
    const josaIGa = (word: string) => (hasBatchim(word) ? "이" : "가");
    // const josaEulReul = (word: string) => (hasBatchim(word) ? "을" : "를"); // 필요 시 사용

    // 칩 토글
    const toggleEvidence = (id: string) => {
        setSelectedEvidenceIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const evidenceLabel = (id: string) => evidenceMap.get(id)?.name || id;

    // ─────────────────────────────────────────────
    // 서술형 미리보기 (입력값을 자연스럽게 엮어 보여줌)
    // ─────────────────────────────────────────────
    const narrative = useMemo(() => {
        const lines: string[] = [];

        // 제목(있으면 표시)
        if (title) {
            lines.push(`【사건】 ${title}`);
            lines.push("");
        }

        // 범인 문장
        if (selectedCulprit) {
            const ig = josaIGa(selectedCulprit);
            lines.push(`저는 ${selectedCulprit}${ig} 범인이라고 판단합니다.`);
        } else {
            lines.push("저는 아직 최종 범인을 확정하지 않았습니다.");
        }

        // 언제/어떻게/왜를 자연스럽게 한 단락으로
        const detailParts: string[] = [];
        if (whenText.trim()) detailParts.push(whenText.trim());
        if (howText.trim()) detailParts.push(howText.trim());
        if (whyText.trim())
            detailParts.push(`그 이유는 ${whyText.trim()} 입니다.`);
        if (detailParts.length) {
            lines.push(detailParts.join(" "));
        }

        // 증거 문장
        if (selectedEvidenceIds.length > 0) {
            const names = selectedEvidenceIds.map(evidenceLabel).join(", ");
            lines.push(`핵심 증거는 ${names}입니다.`);
        }

        // 확신도 (선택)
        if (confidence != null) {
            lines.push(`현재 확신도는 약 ${confidence}% 입니다.`);
        }

        // 시간 요약
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

    // ─────────────────────────────────────────────
    // 제출 + 로딩 오버레이(문구 순환)
    // ─────────────────────────────────────────────
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
                evidence_selected: selectedEvidenceIds, // 플레이어가 고른 핵심 증거만
                confidence,
                report_seconds: reportSeconds,
                report_draft: narrative, // 서술형 미리보기 전체 저장
                memo_text: memoText, // (선택) 플레이 메모 저장
            },
            timings: {
                total_duration: totalDuration,
                per_turn: [] as number[], // 필요 시 채우세요
            },
        };

        setSubmitting(true);
        setLoadingIdx(0);

        try {
            const { data } = await api.post("/game/result", payload);
            const resultId = data?.resultId;
            if (!resultId) {
                console.error("결과 저장 응답에 resultId가 없습니다:", data);
                alert("결과 저장은 되었지만 resultId를 받지 못했습니다.");
                setSubmitting(false);
                return;
            }

            // 제출 성공 시 메모 초기화
            localStorage.removeItem(NOTE_KEY);

            // 분석 페이지로 이동 (로딩 오버레이는 언마운트되며 자동 종료)
            navigate(`/play/${scenarioId}/analysis?resultId=${resultId}`);
        } catch (err: unknown) {
            console.error("결과 제출 실패:", err);
            alert("결과 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
            setSubmitting(false);
        }
    };

    // ────────── 스타일 공통 ──────────
    const card: CSSProperties = {
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 14,
        background: "#fff",
    };

    return (
        <div style={{ padding: 20, maxWidth: 980, margin: "0 auto" }}>
            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                🕵️ 탐정의 사건 수첩
                <span style={{ fontSize: 14, color: "#666" }}>— 최종 보고</span>
            </h2>

            {/* 상단 요약 바 */}
            <div
                style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    marginTop: 8,
                }}
            >
                <span
                    style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid #d0e1ff",
                        background: "#eef4ff",
                        fontSize: 13,
                    }}
                    title="플레이 단계에서 사용한 시간"
                >
                    ⏱️ 플레이어 시간 {formatTime(totalDuration)}
                </span>
                <span
                    style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid #d7d7d7",
                        background: "#f7f7f7",
                        fontSize: 13,
                    }}
                    title="보고서 작성에 소요 중"
                >
                    보고서 {formatTime(reportSeconds)}
                </span>
                {title && (
                    <span
                        style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            border: "1px solid #eee",
                            background: "#fafafa",
                            fontSize: 13,
                        }}
                    >
                        사건: <b>{title}</b>
                    </span>
                )}
            </div>

            {/* STEP 1: 범인 선택 */}
            <section style={{ ...card, marginTop: 16 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    ① 범인 지목
                </div>
                {suspects.length > 0 ? (
                    suspects.map((name) => (
                        <label
                            key={name}
                            style={{ display: "block", marginTop: 6 }}
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
                            <span style={{ marginLeft: 8 }}>{name}</span>
                        </label>
                    ))
                ) : (
                    <p style={{ color: "#666", margin: 0 }}>
                        용의자 목록 불러오는 중...
                    </p>
                )}
            </section>

            {/* STEP 2: 핵심 증거 (⚠️ 수집한 단서만 표시) */}
            <section style={{ ...card, marginTop: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    ② 핵심 증거 선택
                </div>
                <div style={{ fontSize: 12, color: "#777", marginBottom: 6 }}>
                    플레이 중 수집한 단서만 보입니다.
                </div>
                {collectedIds.length === 0 ? (
                    <div style={{ color: "#777" }}>수집한 단서가 없습니다.</div>
                ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {collectedIds.map((id) => {
                            const active = selectedEvidenceIds.includes(id);
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => toggleEvidence(id)}
                                    title={evidenceMap.get(id)?.desc || ""}
                                    style={{
                                        padding: "6px 12px",
                                        borderRadius: 999,
                                        border: active
                                            ? "1px solid #4674ff"
                                            : "1px solid #ddd",
                                        background: active
                                            ? "#eef4ff"
                                            : "#fafafa",
                                        cursor: "pointer",
                                    }}
                                >
                                    {evidenceLabel(id)}
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* STEP 3: 사건 서술 (언제/어떻게/왜) */}
            <section style={{ ...card, marginTop: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    ③ 사건 서술
                </div>

                <label
                    style={{ display: "block", fontWeight: 700, marginTop: 4 }}
                >
                    언제?
                </label>
                <textarea
                    placeholder="예: 오후 2시경, 열람실과 서고 사이 복도에서 일어났습니다."
                    value={whenText}
                    onChange={(e) => setWhenText(e.target.value)}
                    style={{
                        display: "block",
                        width: "100%",
                        minHeight: 60,
                        marginTop: 6,
                    }}
                />

                <label
                    style={{ display: "block", fontWeight: 700, marginTop: 12 }}
                >
                    어떻게?
                </label>
                <textarea
                    placeholder="예: CCTV 사각지대를 이용해 서고로 진입해 고서를 가방에 넣었습니다."
                    value={howText}
                    onChange={(e) => setHowText(e.target.value)}
                    style={{
                        display: "block",
                        width: "100%",
                        minHeight: 60,
                        marginTop: 6,
                    }}
                />

                <label
                    style={{ display: "block", fontWeight: 700, marginTop: 12 }}
                >
                    왜?
                </label>
                <textarea
                    placeholder="예: 고서를 처분해 빚을 갚기 위해서였습니다."
                    value={whyText}
                    onChange={(e) => setWhyText(e.target.value)}
                    style={{
                        display: "block",
                        width: "100%",
                        minHeight: 60,
                        marginTop: 6,
                    }}
                />
            </section>

            {/* 💡 NEW: 사건수첩(메모) 표시 */}
            <section style={{ ...card, marginTop: 12 }}>
                <div
                    style={{
                        fontWeight: 800,
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    사건수첩(메모) — 플레이 중 작성
                </div>
                {memoText?.trim() ? (
                    <div
                        style={{
                            whiteSpace: "pre-wrap",
                            border: "1px dashed #c7c7c7",
                            borderRadius: 8,
                            padding: 12,
                            background: "#fcfcff",
                            minHeight: 80,
                        }}
                    >
                        {memoText}
                    </div>
                ) : (
                    <div style={{ color: "#777" }}>
                        표시할 메모가 없습니다. (플레이 중 메모장에 작성하세요)
                    </div>
                )}
                <div style={{ marginTop: 6, fontSize: 12, color: "#777" }}>
                    * 제출 시 메모는 자동으로 초기화됩니다.
                </div>
            </section>

            {/* 선택: 확신도 */}
            <section style={{ ...card, marginTop: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>④ 확신도</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={confidence}
                        onChange={(e) => setConfidence(Number(e.target.value))}
                        style={{ flex: 1 }}
                    />
                    <span style={{ width: 48, textAlign: "right" }}>
                        {confidence}%
                    </span>
                </div>
            </section>

            {/* 서술형 미리보기 (실시간) */}
            <section style={{ ...card, marginTop: 12 }}>
                <div
                    style={{
                        fontWeight: 800,
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    서술형 미리보기
                    <button
                        onClick={copyPreview}
                        style={{ marginLeft: "auto" }}
                    >
                        복사
                    </button>
                </div>
                <div
                    style={{
                        whiteSpace: "pre-wrap",
                        fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono','Courier New', monospace",
                        border: "1px dashed #c7c7c7",
                        borderRadius: 8,
                        padding: 12,
                        background: "#fcfcff",
                    }}
                >
                    {narrative}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "#777" }}>
                    * 위 미리보기는 입력에 맞춰 실시간으로 변합니다. 따로
                    붙여넣을 필요 없이 그대로 제출하셔도 됩니다.
                </div>
            </section>

            {/* 제출 */}
            <div style={{ marginTop: 16, textAlign: "right" }}>
                <button
                    onClick={handleSubmit}
                    disabled={!selectedCulprit || submitting}
                    style={{ padding: "10px 20px", fontWeight: 800 }}
                    title={!selectedCulprit ? "범인을 먼저 선택하세요" : "제출"}
                >
                    {submitting ? "제출 중..." : "최종 보고 제출"}
                </button>
            </div>

            {/* 풀스크린 로딩 오버레이 */}
            {submitting && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.6)",
                        display: "grid",
                        placeItems: "center",
                        zIndex: 9999,
                    }}
                >
                    <div
                        style={{
                            width: 440,
                            maxWidth: "90vw",
                            background: "#111",
                            color: "#fff",
                            borderRadius: 16,
                            padding: "22px 20px",
                            border: "1px solid #333",
                            boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
                            textAlign: "center",
                        }}
                    >
                        <div
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: "50%",
                                border: "4px solid #3b82f6",
                                borderTopColor: "transparent",
                                margin: "0 auto 12px",
                                animation: "spin 1s linear infinite",
                            }}
                        />
                        <h3 style={{ margin: "6px 0 8px" }}>분석 중입니다</h3>
                        <p style={{ margin: 0, opacity: 0.85 }}>
                            {loadingLines[loadingIdx]}
                        </p>

                        <style>
                            {`@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}`}
                        </style>
                    </div>
                </div>
            )}
        </div>
    );
}
