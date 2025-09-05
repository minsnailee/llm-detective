import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../shared/api/client";

/* =========================
   Types (백엔드/JSON 스키마 호환)
   ========================= */
interface ScenarioDetail {
    scenIdx: number;
    scenTitle: string;
    scenSummary: string;
    scenLevel: number;
    contentJson?: string;
}

interface CharacterDoc {
    id?: string; // "suspect_1"
    name: string;
    age?: number;
    gender?: string;
    job?: string;
    personality?: string;
    speaking_style?: string;
    truth_bias?: number;
    alibi?: any;
    outfit?: string;
    sample_line?: string;
    image?: string; // 시나리오 폼에서 저장
}

interface EvidenceDoc {
    id: string; // "e1"
    name: string;
    desc?: string;
    importance?: "HIGH" | "MEDIUM" | "LOW";
    categories?: string[];
    keywords?: string[]; // 시나리오 폼에서 저장
}

interface MapDoc {
    background?: string; // 배경 이미지 URL
    floorplan?: string; // 도면 이미지 URL
}

interface ParsedContent {
    scenario?: {
        id?: string;
        title?: string;
        summary?: string;
        difficulty?: number;
        objective?: string;
        rules?: string[];
    };
    map?: MapDoc;
    characters?: CharacterDoc[];
    evidence?: EvidenceDoc[];
    locations?: { id: string; name: string; desc?: string }[];
    timeline?: {
        id: string;
        time: string;
        event: string;
        subjectId?: string;
    }[];
    answer?: {
        culprit?: string;
        motive?: string;
        method?: string;
        key_evidence?: string[];
    };
    evaluation?: any;
}

interface AskResponse {
    answer: string;
}

type ChatMsg = {
    id: string;
    ts: number; // epoch sec
    role: "player" | "npc";
    suspectName: string;
    text: string;
};

/* =========================
   안전한 엔드포인트 폴백
   ========================= */
const ASK_ENDPOINTS = ["game/ask", "/api/game/ask", "/game/ask"] as const;

// 401/403/404는 다음 후보로 폴백, 그 외 에러는 바로 throw
async function postAskSafe(payload: {
    sessionId: number;
    suspectName: string;
    userText: string;
}): Promise<string> {
    let lastErr: any = null;
    for (const ep of ASK_ENDPOINTS) {
        try {
            const res = await api.post<AskResponse>(ep, payload);
            return res.data?.answer ?? "";
        } catch (err: any) {
            const s = err?.response?.status;
            if (s === 401 || s === 403 || s === 404) {
                lastErr = err;
                continue;
            }
            throw err;
        }
    }
    throw lastErr ?? new Error("ASK endpoint not reachable");
}

/* =========================
   컴포넌트
   ========================= */
export default function GamePlayPage() {
    const { scenarioId } = useParams();
    const [searchParams] = useSearchParams();
    const sessionId = Number(searchParams.get("sessionId"));
    const navigate = useNavigate();

    // 시나리오/컨텐츠
    const [scenario, setScenario] = useState<ScenarioDetail | null>(null);
    const [content, setContent] = useState<ParsedContent | null>(null);

    // 캐릭터/선택
    const [characters, setCharacters] = useState<CharacterDoc[]>([]);
    const [selectedChar, setSelectedChar] = useState<CharacterDoc | null>(null);

    // 질문 대상 상태: 'ALL' 또는 특정 용의자 이름
    const [askTarget, setAskTarget] = useState<"ALL" | string>("");

    // 채팅/입력/로딩
    const [chat, setChat] = useState<ChatMsg[]>([]);
    const [input, setInput] = useState("");
    const [asking, setAsking] = useState(false);

    // 말풍선(5초 표시)
    const [bubble, setBubble] = useState<{
        text: string;
        suspectName: string | null;
        showing: boolean;
    }>({
        text: "",
        suspectName: null,
        showing: false,
    });
    const bubbleTimerRef = useRef<number | null>(null);

    // 로그 필터 (전체 / 용의자별)
    const [logFilter, setLogFilter] = useState<string>("ALL");

    // 개요 토글
    const [showSummary, setShowSummary] = useState(false);

    // 메모(사건수첩) 모달
    const [showNotes, setShowNotes] = useState(false);
    const [notes, setNotes] = useState("");

    // 플로어플랜(지도) 모달
    const [showFloorplan, setShowFloorplan] = useState(false);

    // 메인 타이머
    const [seconds, setSeconds] = useState(0);
    const timerRef = useRef<number | null>(null);
    const TIMER_KEY = sessionId
        ? `timer_session_${sessionId}`
        : "timer_session_unknown";

    // 수집한 단서 (evidence.id[])
    const [collected, setCollected] = useState<string[]>([]);

    // 로그 스크롤
    const logEndRef = useRef<HTMLDivElement | null>(null);

    /* =========================
     LocalStorage Keys
     ========================= */
    const NOTE_KEY = useMemo(
        () => `note_${scenarioId || "scen"}_${sessionId || "sess"}`,
        [scenarioId, sessionId]
    );
    const CLUE_KEY = useMemo(
        () => `clues_${scenarioId || "scen"}_${sessionId || "sess"}`,
        [scenarioId, sessionId]
    );

    /* =========================
     타이머 시작/정지
     ========================= */
    useEffect(() => {
        timerRef.current = window.setInterval(() => {
            setSeconds((s) => {
                const next = s + 1;
                sessionStorage.setItem(TIMER_KEY, String(next));
                return next;
            });
        }, 1000);
        return () => {
            if (timerRef.current !== null) clearInterval(timerRef.current);
        };
    }, [TIMER_KEY]);

    const formatTime = (s: number) => {
        const m = String(Math.floor(s / 60)).padStart(2, "0");
        const sec = String(s % 60).padStart(2, "0");
        return `${m}:${sec}`;
    };

    /* =========================
     시나리오 로딩
     ========================= */
    useEffect(() => {
        const fetchScenario = async () => {
            try {
                if (!scenarioId) return;
                const res = await api.get<ScenarioDetail>(
                    `/scenarios/${scenarioId}`
                );
                setScenario(res.data);

                let parsed: ParsedContent | null = null;
                if (res.data.contentJson) {
                    try {
                        parsed =
                            typeof res.data.contentJson === "string"
                                ? JSON.parse(res.data.contentJson)
                                : (res.data.contentJson as any);
                    } catch (e) {
                        console.error("contentJson 파싱 실패:", e);
                    }
                }
                setContent(parsed);
                const chars: CharacterDoc[] = parsed?.characters || [];
                setCharacters(chars);
                const first = chars.length ? chars[0] : null;
                setSelectedChar((prev) => prev ?? first);

                // 메모/수집 단서 불러오기
                const savedNote = localStorage.getItem(NOTE_KEY);
                if (savedNote != null) setNotes(savedNote);
                const savedClues = localStorage.getItem(CLUE_KEY);
                if (savedClues) {
                    try {
                        const arr = JSON.parse(savedClues);
                        if (Array.isArray(arr)) setCollected(arr);
                    } catch {}
                }
            } catch (err) {
                console.error("시나리오 불러오기 실패:", err);
            }
        };
        fetchScenario();
    }, [scenarioId, NOTE_KEY, CLUE_KEY]);

    // selectedChar가 정해졌고 askTarget이 비어있다면, 기본 질문 대상을 그 인물로 세팅
    useEffect(() => {
        if (!askTarget && selectedChar?.name) {
            setAskTarget(selectedChar.name);
        }
    }, [selectedChar, askTarget]);

    /* =========================
     말풍선 5초 표시 관리
     ========================= */
    const showBubble = (suspectName: string, text: string) => {
        if (bubbleTimerRef.current !== null) {
            clearTimeout(bubbleTimerRef.current);
            bubbleTimerRef.current = null;
        }
        setBubble({ suspectName, text, showing: true });
        bubbleTimerRef.current = window.setTimeout(() => {
            setBubble((b) => ({ ...b, showing: false }));
            bubbleTimerRef.current = null;
        }, 5000) as unknown as number;
    };

    /* =========================
     로그 자동 스크롤
     ========================= */
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat, logFilter]);

    /* =========================
     증거 자동 탐지(프론트 간이판)
     ========================= */
    const detectEvidenceInText = (text: string) => {
        if (!content?.evidence || !text) return;
        const lower = text.toLowerCase();
        const newlyFound: string[] = [];
        for (const ev of content.evidence) {
            const terms: string[] = [
                ev.name ?? "",
                ...(Array.isArray(ev.keywords) ? ev.keywords : []),
            ]
                .filter(Boolean)
                .map((t) => t.toLowerCase());
            if (!terms.length) continue;
            const hit = terms.some((t) => t && lower.includes(t));
            if (hit && !collected.includes(ev.id)) {
                newlyFound.push(ev.id);
            }
        }
        if (newlyFound.length > 0) {
            const next = [...collected, ...newlyFound];
            setCollected(next);
            localStorage.setItem(CLUE_KEY, JSON.stringify(next));
        }
    };

    /* =========================
     질문하기 (개별/전체)
     ========================= */
    const handleAsk = async () => {
        const question = input.trim();
        if (!question) return;

        if (!sessionId) {
            alert(
                "세션 정보가 없습니다. 시나리오 선택 화면에서 다시 시작해주세요."
            );
            return;
        }

        // 대상 유효성 체크
        if (askTarget !== "ALL" && !selectedChar?.name) {
            alert("질문 대상을 선택하세요.");
            return;
        }

        const now = Math.floor(Date.now() / 1000);

        // 플레이어 로그 (전체 여부 표시)
        setChat((prev) => [
            ...prev,
            {
                id: `msg_${now}_${prev.length + 1}_u`,
                ts: now,
                role: "player",
                suspectName:
                    askTarget === "ALL" ? "[전체]" : selectedChar!.name,
                text: question,
            },
        ]);

        // 질문에서도 단서 자동 탐지
        detectEvidenceInText(question);

        setAsking(true);
        try {
            if (askTarget === "ALL") {
                // 무대 3인에게 "순차" 호출 (403/레이트리밋 회피)
                const targets = stageChars.filter((t) => t?.name?.trim());
                if (targets.length === 0)
                    throw new Error("질문할 대상이 없습니다.");

                for (let i = 0; i < targets.length; i++) {
                    const t = targets[i];
                    try {
                        const ans = await postAskSafe({
                            sessionId,
                            suspectName: t.name,
                            userText: question,
                        });

                        const ts = Math.floor(Date.now() / 1000);
                        setChat((prev) => [
                            ...prev,
                            {
                                id: `msg_${ts}_${prev.length + 1}_a_${t.name}`,
                                ts,
                                role: "npc",
                                suspectName: t.name,
                                text: ans,
                            },
                        ]);

                        if (ans) showBubble(t.name, ans);
                        detectEvidenceInText(ans);
                    } catch (err: any) {
                        const ts = Math.floor(Date.now() / 1000);
                        const status = err?.response?.status;
                        const msg =
                            status === 403
                                ? "(접근 권한이 없거나 세션이 만료되었습니다)"
                                : "(응답 실패)";
                        setChat((prev) => [
                            ...prev,
                            {
                                id: `msg_${ts}_${prev.length + 1}_a_err_${
                                    t.name
                                }`,
                                ts,
                                role: "npc",
                                suspectName: t.name,
                                text: msg,
                            },
                        ]);
                    }
                }
            } else {
                // 단일 대상
                const targetName = selectedChar!.name;
                if (!targetName?.trim()) {
                    alert("질문 대상을 선택하세요.");
                    return;
                }

                const answerText = await postAskSafe({
                    sessionId,
                    suspectName: targetName,
                    userText: question,
                });

                const ts2 = Math.floor(Date.now() / 1000);
                setChat((prev) => [
                    ...prev,
                    {
                        id: `msg_${ts2}_${prev.length + 1}_a`,
                        ts: ts2,
                        role: "npc",
                        suspectName: targetName,
                        text: answerText,
                    },
                ]);

                showBubble(targetName, answerText);
                detectEvidenceInText(answerText);
            }

            setInput("");
        } catch (err: any) {
            const s = err?.response?.status;
            if (s === 403) {
                alert(
                    "접근이 거부되었습니다. (403)\n- 로그인 상태/시나리오 접근 권한/세션 유효성을 확인하세요."
                );
            } else {
                console.error("질문 처리 실패:", err);
                alert("질문 처리에 실패했습니다. (네트워크/서버 설정 확인)");
            }
        } finally {
            setAsking(false);
        }
    };

    const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (e.key === "Enter") handleAsk();
    };

    /* =========================
     결과 페이지로 이동
     ========================= */
    const goResult = () => {
        if (!sessionId) {
            alert(
                "세션 정보가 없습니다. 시나리오 선택 화면에서 다시 시작해주세요."
            );
            return;
        }
        if (timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        const playDuration = seconds;
        sessionStorage.setItem(TIMER_KEY, String(playDuration));
        navigate(
            `/play/${scenarioId}/result?sessionId=${sessionId}&t=${playDuration}`,
            {
                state: { totalDuration: playDuration },
            }
        );
    };

    /* =========================
     로그 필터링
     ========================= */
    const filteredChat = useMemo(() => {
        if (logFilter === "ALL") return chat;
        return chat.filter((m) => m.suspectName === logFilter);
    }, [chat, logFilter]);

    /* =========================
     수집 단서 유틸
     ========================= */
    const evidenceById = useMemo(() => {
        const map = new Map<string, EvidenceDoc>();
        (content?.evidence || []).forEach((e) => map.set(e.id, e));
        return map;
    }, [content?.evidence]);

    const removeCollected = (id: string) => {
        const next = collected.filter((x) => x !== id);
        setCollected(next);
        localStorage.setItem(CLUE_KEY, JSON.stringify(next));
    };

    const addCollectedManually = (id: string) => {
        if (!collected.includes(id)) {
            const next = [...collected, id];
            setCollected(next);
            localStorage.setItem(CLUE_KEY, JSON.stringify(next));
        }
    };

    /* =========================
     무대에 동시에 보여줄 3인
     ========================= */
    const stageChars = useMemo(
        () => (characters || []).slice(0, 3),
        [characters]
    );

    // 선택된 인물이 무대 3인에 없다면 첫 번째로 보정
    useEffect(() => {
        if (!selectedChar) return;
        const onStage = stageChars.find((c) => c.name === selectedChar.name);
        if (!onStage && stageChars[0]) {
            setSelectedChar(stageChars[0]);
        }
    }, [stageChars, selectedChar]);

    /* =========================
     UI
     ========================= */
    const backgroundUrl = content?.map?.background;
    const floorplanUrl = content?.map?.floorplan;

    // 대화로그 상단 고정 샘플대사(필터 적용)
    const pinnedSamples = useMemo(() => {
        const list =
            logFilter === "ALL"
                ? characters
                : characters.filter((c) => c.name === logFilter);
        return list.filter((c) => c.sample_line && c.name);
    }, [characters, logFilter]);

    return (
        <div
            style={{
                padding: 12,
                display: "grid",
                gridTemplateColumns: "280px 1fr 420px",
                gap: 12,
                height: "100vh",
                boxSizing: "border-box",
            }}
        >
            {/* =========== 좌측: 사건 컨트롤 =========== */}
            <aside
                style={{
                    display: "grid",
                    gridTemplateRows: "auto auto auto auto auto 1fr",
                    gap: 12,
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    padding: 12,
                    background: "#fff",
                }}
            >
                {/* 사건 제목 */}
                <div>
                    <h3 style={{ margin: "4px 0" }}>
                        {scenario?.scenTitle || "사건"}
                    </h3>
                    <div style={{ fontSize: 12, color: "#777" }}>
                        난이도: {scenario?.scenLevel ?? "-"}
                    </div>
                </div>

                {/* 사건 종료 버튼 (타이머 포함) */}
                <button
                    onClick={goResult}
                    style={{
                        padding: "12px 10px",
                        borderRadius: 10,
                        border: "1px solid #333",
                        background: "#111",
                        color: "#fff",
                        fontWeight: 700,
                    }}
                >
                    사건 종료 · {formatTime(seconds)}
                </button>

                {/* 개요 다시보기 */}
                <div>
                    <button
                        onClick={() => setShowSummary((p) => !p)}
                        style={{ width: "100%" }}
                    >
                        {showSummary ? "개요 닫기" : "개요 다시보기"}
                    </button>
                    {showSummary && (
                        <div
                            style={{
                                border: "1px solid #ddd",
                                borderRadius: 8,
                                padding: 10,
                                marginTop: 8,
                                whiteSpace: "pre-line",
                                background: "#fafafa",
                            }}
                        >
                            {scenario?.scenSummary}
                        </div>
                    )}
                </div>

                {/* 지도/도면 보기 */}
                <div>
                    <button
                        disabled={!floorplanUrl}
                        onClick={() => setShowFloorplan(true)}
                        style={{
                            width: "100%",
                            opacity: floorplanUrl ? 1 : 0.5,
                        }}
                        title={
                            floorplanUrl
                                ? "도면/지도 보기"
                                : "도면 이미지가 없습니다"
                        }
                    >
                        지도 / 도면 보기
                    </button>
                    {showFloorplan && floorplanUrl && (
                        <div
                            role="dialog"
                            aria-modal
                            style={{
                                position: "fixed",
                                inset: 0,
                                background: "rgba(0,0,0,0.5)",
                                display: "grid",
                                placeItems: "center",
                                zIndex: 90,
                            }}
                            onClick={() => setShowFloorplan(false)}
                        >
                            <div
                                style={{
                                    maxWidth: "90vw",
                                    maxHeight: "90vh",
                                    background: "#fff",
                                    borderRadius: 12,
                                    border: "1px solid #222",
                                    overflow: "hidden",
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        padding: "6px 10px",
                                        borderBottom: "1px solid #ddd",
                                        background: "#f7f7f7",
                                    }}
                                >
                                    <strong>도면/지도</strong>
                                    <button
                                        style={{ marginLeft: "auto" }}
                                        onClick={() => setShowFloorplan(false)}
                                    >
                                        닫기
                                    </button>
                                </div>
                                <div
                                    style={{
                                        padding: 8,
                                        overflow: "auto",
                                        display: "grid",
                                        placeItems: "center",
                                        background: "#000",
                                    }}
                                >
                                    <img
                                        src={floorplanUrl}
                                        alt="floorplan"
                                        style={{
                                            maxWidth: "100%",
                                            maxHeight: "85vh",
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 사건수첩(메모장) */}
                <div>
                    <button
                        style={{ width: "100%" }}
                        onClick={() => setShowNotes(true)}
                    >
                        사건수첩(메모장)
                    </button>
                    {showNotes && (
                        <div
                            role="dialog"
                            aria-modal
                            style={{
                                position: "fixed",
                                inset: 0,
                                background: "rgba(0,0,0,0.45)",
                                display: "grid",
                                placeItems: "center",
                                zIndex: 99,
                            }}
                            onClick={() => setShowNotes(false)}
                        >
                            <div
                                style={{
                                    width: 560,
                                    maxWidth: "90vw",
                                    background: "#fff",
                                    borderRadius: 12,
                                    padding: 12,
                                    border: "1px solid #222",
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    <h4 style={{ margin: 0 }}>사건수첩</h4>
                                    <div style={{ marginLeft: "auto" }}>
                                        {/* 💡 changed: 저장 → 초기화 */}
                                        <button
                                            onClick={() => {
                                                setNotes("");
                                                localStorage.setItem(
                                                    NOTE_KEY,
                                                    ""
                                                ); // 💡 changed: 즉시 초기화 저장
                                            }}
                                            title="메모 내용을 전부 비웁니다."
                                        >
                                            초기화
                                        </button>
                                        <button
                                            style={{ marginLeft: 8 }}
                                            onClick={() => setShowNotes(false)}
                                        >
                                            닫기
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    value={notes}
                                    onChange={(e) => {
                                        // 💡 changed: 타이핑할 때 자동 저장
                                        setNotes(e.target.value);
                                        localStorage.setItem(
                                            NOTE_KEY,
                                            e.target.value
                                        );
                                    }}
                                    placeholder="중요한 단서/의심 포인트를 메모하세요. (자동 저장)"
                                    style={{
                                        marginTop: 8,
                                        width: "100%",
                                        minHeight: 260,
                                        borderRadius: 8,
                                        border: "1px solid #ccc",
                                        padding: 10,
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* 가이드/여백 */}
                <div style={{ fontSize: 12, color: "#888" }}>
                    왼쪽은 사건 제어, 오른쪽은 대화 로그입니다. 가운데 무대에서
                    3명의 용의자를 동시에 확인하고, 라디오 버튼이나 카드를 눌러
                    질문 대상을 선택하세요.
                </div>
            </aside>

            {/* =========== 중앙: 수집 단서 + 무대(3인 동시) + 라디오 + 입력 =========== */}
            <main
                style={{
                    display: "grid",
                    gridTemplateRows: "auto 1fr auto",
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "#fff",
                }}
            >
                {/* 상단: 수집한 단서 */}
                <div
                    style={{
                        borderBottom: "1px solid #eee",
                        padding: "8px 10px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "#f9fbff",
                    }}
                >
                    <strong style={{ marginRight: 8 }}>수집한 단서</strong>
                    <div
                        style={{
                            display: "flex",
                            gap: 6,
                            overflowX: "auto",
                            flex: 1,
                        }}
                    >
                        {collected.length === 0 && (
                            <span style={{ color: "#888", fontSize: 12 }}>
                                아직 없음
                            </span>
                        )}
                        {collected.map((id) => {
                            const ev = evidenceById.get(id);
                            const label = ev?.name || id;
                            return (
                                <span
                                    key={id}
                                    title={ev?.desc || ""}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "4px 8px",
                                        borderRadius: 999,
                                        border: "1px solid #cfe1ff",
                                        background: "#eef4ff",
                                        fontSize: 12,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {label}
                                    <button
                                        onClick={() => removeCollected(id)}
                                        title="목록에서 제거"
                                        style={{
                                            border: "none",
                                            background: "transparent",
                                            cursor: "pointer",
                                            fontWeight: 700,
                                        }}
                                    >
                                        ×
                                    </button>
                                </span>
                            );
                        })}
                    </div>
                </div>

                {/* 무대: 3명 동시 표시 */}
                <div
                    style={{
                        position: "relative",
                        background: backgroundUrl
                            ? `#000 url(${backgroundUrl}) center/cover no-repeat`
                            : "linear-gradient(180deg,#f8faff,#ffffff)",
                        minHeight: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 28,
                        padding: "12px 12px 8px",
                    }}
                >
                    {stageChars.length === 0 ? (
                        <div style={{ color: "#666" }}>용의자가 없습니다.</div>
                    ) : (
                        stageChars.map((c, idx) => {
                            // 전체 모드에서는 액티브 효과 제거
                            const isSel =
                                askTarget !== "ALL" &&
                                selectedChar?.name === c.name;
                            return (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        setSelectedChar(c);
                                        setAskTarget(c.name); // 카드 클릭 시 질문 대상 동기화
                                    }}
                                    title={c.sample_line || ""}
                                    style={{
                                        position: "relative",
                                        cursor: "pointer",
                                        display: "grid",
                                        placeItems: "center",
                                        gap: 8,
                                        padding: 10,
                                        borderRadius: 16,
                                        border: isSel
                                            ? "3px solid #5b8cff"
                                            : "2px solid rgba(255,255,255,0.8)",
                                        background: "rgba(255,255,255,0.8)",
                                        transform: isSel
                                            ? "scale(1.03)"
                                            : "scale(1)",
                                        transition: "transform .15s ease",
                                        width: 220,
                                    }}
                                >
                                    {/* 말풍선: 해당 카드 위에만 표시 */}
                                    {bubble.showing &&
                                        bubble.suspectName === c.name &&
                                        bubble.text && (
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    bottom: "110%",
                                                    left: "50%",
                                                    transform:
                                                        "translateX(-50%)",
                                                    background: "#ffffff",
                                                    border: "2px solid #111",
                                                    borderRadius: 16,
                                                    padding: "8px 12px",
                                                    boxShadow:
                                                        "0 8px 18px rgba(0,0,0,0.18)",
                                                    maxWidth: 360,
                                                    zIndex: 2,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontWeight: 700,
                                                        marginBottom: 2,
                                                    }}
                                                >
                                                    {c.name}
                                                </div>
                                                <div style={{ fontSize: 14 }}>
                                                    {bubble.text}
                                                </div>
                                            </div>
                                        )}

                                    {/* 아바타 */}
                                    {c.image ? (
                                        <img
                                            src={c.image}
                                            alt={c.name}
                                            style={{
                                                width: 120,
                                                height: 120,
                                                borderRadius: "50%",
                                                objectFit: "cover",
                                                boxShadow:
                                                    "0 8px 22px rgba(0,0,0,0.25)",
                                                border: "3px solid rgba(255,255,255,0.9)",
                                                background: "#fff",
                                            }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                width: 120,
                                                height: 120,
                                                borderRadius: "50%",
                                                display: "grid",
                                                placeItems: "center",
                                                background: "#fff",
                                                boxShadow:
                                                    "0 8px 22px rgba(0,0,0,0.25)",
                                                border: "3px solid rgba(255,255,255,0.9)",
                                                fontSize: 52,
                                            }}
                                        >
                                            🙂
                                        </div>
                                    )}

                                    {/* 이름/메타 */}
                                    <div style={{ textAlign: "center" }}>
                                        <div
                                            style={{
                                                fontSize: 16,
                                                fontWeight: 800,
                                            }}
                                        >
                                            {c.name || `용의자 ${idx + 1}`}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: "#333",
                                            }}
                                        >
                                            {c.age ? `${c.age}세, ` : ""}
                                            {c.gender || ""}
                                            {c.gender ? ", " : ""}
                                            {c.job || ""}
                                        </div>
                                        {c.outfit && (
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    color: "#333",
                                                    marginTop: 4,
                                                }}
                                            >
                                                옷차림: {c.outfit}
                                            </div>
                                        )}
                                        {c.sample_line && (
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    color: "#333",
                                                    marginTop: 4,
                                                }}
                                            >
                                                {c.sample_line}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* ===== 라디오: 질문 대상 선택 (무대와 동기화) ===== */}
                <div
                    style={{
                        padding: "6px 10px 0",
                        borderTop: "1px solid #eee",
                        background: "#fff",
                    }}
                >
                    <fieldset
                        style={{
                            border: "none",
                            margin: 0,
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            flexWrap: "wrap",
                        }}
                    >
                        <legend style={{ fontSize: 12, color: "#666" }}>
                            질문 대상
                        </legend>

                        {/* 전체 라디오 */}
                        <label
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 8px",
                                borderRadius: 999,
                                border: "1px solid #ddd",
                                background:
                                    askTarget === "ALL" ? "#eef4ff" : "#fafafa",
                            }}
                        >
                            <input
                                type="radio"
                                name="askTarget"
                                value="ALL"
                                checked={askTarget === "ALL"}
                                onChange={() => setAskTarget("ALL")}
                            />
                            전체
                        </label>

                        {stageChars.map((c, idx) => (
                            <label
                                key={idx}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    padding: "4px 8px",
                                    borderRadius: 999,
                                    border: "1px solid #ddd",
                                    background:
                                        askTarget === c.name
                                            ? "#eef4ff"
                                            : "#fafafa",
                                }}
                            >
                                <input
                                    type="radio"
                                    name="askTarget"
                                    value={c.name}
                                    checked={askTarget === c.name}
                                    onChange={() => {
                                        setAskTarget(c.name);
                                        setSelectedChar(c); // 라디오 -> 무대 선택 동기화
                                    }}
                                />
                                {c.name}
                            </label>
                        ))}
                    </fieldset>
                </div>

                {/* 입력바 */}
                <div
                    style={{
                        borderTop: "1px solid #eee",
                        padding: 10,
                        background: "#fff",
                    }}
                >
                    <div style={{ display: "flex", gap: 8 }}>
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                askTarget === "ALL"
                                    ? "모든 용의자에게 물어봅니다"
                                    : selectedChar
                                    ? `${selectedChar.name}에게 질문을 입력하세요`
                                    : "먼저 질문 대상을 선택하세요"
                            }
                            style={{
                                flex: 1,
                                padding: "12px 14px",
                                borderRadius: 10,
                                border: "1px solid #ccc",
                            }}
                            disabled={
                                (askTarget !== "ALL" && !selectedChar) || asking
                            }
                        />
                        <button
                            onClick={handleAsk}
                            disabled={
                                !input.trim() ||
                                (askTarget !== "ALL" && !selectedChar) ||
                                asking
                            }
                        >
                            {asking ? "질문 중..." : "질문하기"}
                        </button>
                    </div>

                    {/* 수동 단서 추가(선택) */}
                    {content?.evidence && content.evidence.length > 0 && (
                        <div
                            style={{
                                marginTop: 6,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <span style={{ fontSize: 12, color: "#666" }}>
                                단서 수동 추가:
                            </span>
                            <select
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val) {
                                        addCollectedManually(val);
                                        e.currentTarget.value = "";
                                    }
                                }}
                                defaultValue=""
                            >
                                <option value="">선택</option>
                                {content.evidence
                                    .filter((ev) => !collected.includes(ev.id))
                                    .map((ev) => (
                                        <option key={ev.id} value={ev.id}>
                                            {ev.name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    )}
                </div>
            </main>

            {/* =========== 우측: 대화로그 =========== */}
            <aside
                style={{
                    display: "grid",
                    gridTemplateRows: "auto auto 1fr",
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    background: "#fff",
                    overflow: "hidden",
                }}
            >
                {/* 헤더 */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderBottom: "1px solid #eee",
                        background: "#f8f8f8",
                    }}
                >
                    <h4 style={{ margin: 0 }}>대화 로그</h4>
                </div>

                {/* 필터: 세그먼트 버튼 */}
                <div
                    style={{
                        padding: 8,
                        borderBottom: "1px solid #eee",
                        background: "#fafbff",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                            background: "#eff3ff",
                            padding: 4,
                            borderRadius: 999,
                        }}
                    >
                        {["ALL", ...characters.map((c) => c.name)].map(
                            (label) => {
                                const active = logFilter === label;
                                return (
                                    <button
                                        key={label}
                                        onClick={() => setLogFilter(label)}
                                        style={{
                                            padding: "6px 12px",
                                            borderRadius: 999,
                                            border: active
                                                ? "1px solid #4674ff"
                                                : "1px solid transparent",
                                            background: active
                                                ? "#fff"
                                                : "transparent",
                                            fontWeight: active ? 700 : 500,
                                            cursor: "pointer",
                                        }}
                                    >
                                        {label === "ALL" ? "전체" : label}
                                    </button>
                                );
                            }
                        )}
                    </div>
                </div>

                {/* 로그 목록 */}
                <div style={{ padding: 12, overflowY: "auto" }}>
                    {/* 고정: 샘플대사(첫번째 말풍선 역할, 필터 적용) */}
                    {pinnedSamples.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                            {pinnedSamples.map((c) => (
                                <div
                                    key={`pinned_${c.name}`}
                                    style={{ marginBottom: 10 }}
                                >
                                    <div
                                        style={{ fontSize: 11, color: "#999" }}
                                    >
                                        · {c.name} (샘플)
                                    </div>
                                    <div
                                        style={{
                                            display: "inline-block",
                                            maxWidth: 640,
                                            padding: "8px 12px",
                                            borderRadius: 10,
                                            border: "1px solid #ddd",
                                            background: "#fafafa",
                                        }}
                                    >
                                        <b>{c.name}</b>: {c.sample_line}
                                    </div>
                                </div>
                            ))}
                            <hr
                                style={{
                                    border: "none",
                                    borderTop: "1px dashed #e5e7eb",
                                    margin: "8px 0 4px",
                                }}
                            />
                        </div>
                    )}

                    {/* 일반 로그 렌더링 */}
                    {filteredChat.map((m) => (
                        <div key={m.id} style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: "#999" }}>
                                {new Date(m.ts * 1000).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}{" "}
                                · {m.suspectName}
                            </div>

                            <div
                                style={{
                                    display: "inline-block",
                                    maxWidth: 640,
                                    padding: "8px 12px",
                                    borderRadius: 10,
                                    border: "1px solid #ddd",
                                    background:
                                        m.role === "player"
                                            ? "#eef4ff"
                                            : "#fafafa",
                                }}
                            >
                                <b>
                                    {m.role === "player"
                                        ? "탐정"
                                        : m.suspectName}
                                </b>
                                : {m.text}
                            </div>
                        </div>
                    ))}
                    <div ref={logEndRef} />
                </div>
            </aside>
        </div>
    );
}
