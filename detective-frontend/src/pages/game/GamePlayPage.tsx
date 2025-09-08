import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../shared/api/client";
import IntroOverlay from "./components/IntroOverlay";

import TopBar from "./components/TopBar";
import Stage from "./components/Stage";
import AskPanel from "./components/AskPanel";
import ChatLogDocked from "./components/ChatLogDocked";
import ChatLogWindow from "./components/ChatLogWindow";
import { SummaryModal, FloorplanModal, NotesModal } from "./components/Modals";

import {
    toAbsoluteMediaUrl,
    type ScenarioDetail,
    type ParsedContent,
    type CharacterDoc,
    type EvidenceDoc,
    type ChatMsg,
} from "./gameTypes";
import { postAskSafe } from "./gameApi";

/* =========================
   Component
   ========================= */
export default function GamePlayPage() {
    const [showIntro, setShowIntro] = useState(true);

    const { scenarioId } = useParams();
    const [searchParams] = useSearchParams();
    const sessionId = Number(searchParams.get("sessionId"));
    const navigate = useNavigate();

    // scenario/content
    const [scenario, setScenario] = useState<ScenarioDetail | null>(null);
    const [content, setContent] = useState<ParsedContent | null>(null);

    // characters/selection
    const [characters, setCharacters] = useState<CharacterDoc[]>([]);
    const [selectedChar, setSelectedChar] = useState<CharacterDoc | null>(null);
    const [askTarget, setAskTarget] = useState<"ALL" | string>("ALL");

    // chat
    const [chat, setChat] = useState<ChatMsg[]>([]);
    const [input, setInput] = useState("");
    const [asking, setAsking] = useState(false);

    // bubble (5s) on stage (간단 버전)
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

    // log filter
    const [logFilter, setLogFilter] = useState<string>("ALL");

    // summary/notes/floorplan modals
    const [showSummary, setShowSummary] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [notes, setNotes] = useState("");
    const [showFloorplan, setShowFloorplan] = useState(false);

    // timer
    const [seconds, setSeconds] = useState(0);
    const timerRef = useRef<number | null>(null);
    const TIMER_KEY = sessionId
        ? `timer_session_${sessionId}`
        : "timer_session_unknown";

    // collected evidence
    const [collected, setCollected] = useState<string[]>([]);

    // log scroll
    const logEndRef = useRef<HTMLDivElement>(null!);

    // local storage keys
    const NOTE_KEY = useMemo(
        () => `note_${scenarioId || "scen"}_${sessionId || "sess"}`,
        [scenarioId, sessionId]
    );
    const CLUE_KEY = useMemo(
        () => `clues_${scenarioId || "scen"}_${sessionId || "sess"}`,
        [scenarioId, sessionId]
    );

    // === 대화로그 높이(3단): 접기/기본/펼치기 ===
    const [chatSize, setChatSize] = useState<"min" | "mid" | "max">("mid");
    const chatHeightsDock: Record<"min" | "mid" | "max", string> = {
        min: "8vh",
        mid: "22vh",
        max: "40vh",
    };
    const chatHeightsWin: Record<"min" | "mid" | "max", number> = {
        min: 180,
        mid: 320,
        max: 520,
    };

    // === 창모드 (떠있는 창) 토글 & 드래그 위치 / 리사이즈 ===
    const [chatWindowed, setChatWindowed] = useState(false);

    const [winPos, setWinPos] = useState<{ x: number; y: number }>({
        x: 24,
        y: 90,
    });
    const [dragging, setDragging] = useState(false);
    const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const [winSize, setWinSize] = useState<{ width: number; height: number }>({
        width: 720,
        height: chatHeightsWin["mid"],
    });
    const [resizing, setResizing] = useState(false);
    const resizeStartRef = useRef<{
        mx: number;
        my: number;
        w: number;
        h: number;
    }>({
        mx: 0,
        my: 0,
        w: 720,
        h: chatHeightsWin["mid"],
    });

    const MIN_W = 480;
    const MIN_H = 180;

    // 드래그 이동
    useEffect(() => {
        if (!dragging) return;
        const onMove = (e: MouseEvent) => {
            const nx =
                (e as unknown as globalThis.MouseEvent).clientX -
                dragOffsetRef.current.x;
            const ny =
                (e as unknown as globalThis.MouseEvent).clientY -
                dragOffsetRef.current.y;
            const maxX = window.innerWidth - winSize.width - 12;
            const maxY = window.innerHeight - 120;
            setWinPos({
                x: Math.max(12, Math.min(nx, Math.max(12, maxX))),
                y: Math.max(12, Math.min(ny, Math.max(12, maxY))),
            });
        };
        const onUp = () => setDragging(false);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [dragging, winSize.width]);

    // 리사이즈 (우하단 핸들)
    useEffect(() => {
        if (!resizing) return;
        const onMove = (e: MouseEvent) => {
            const ev = e as unknown as globalThis.MouseEvent;
            const dx = ev.clientX - resizeStartRef.current.mx;
            const dy = ev.clientY - resizeStartRef.current.my;
            let newW = resizeStartRef.current.w + dx;
            let newH = resizeStartRef.current.h + dy;
            // 경계 클램프
            const maxW = Math.max(MIN_W, window.innerWidth - winPos.x - 12);
            const maxH = Math.max(MIN_H, window.innerHeight - winPos.y - 80);
            newW = Math.max(MIN_W, Math.min(newW, maxW));
            newH = Math.max(MIN_H, Math.min(newH, maxH));
            setWinSize({ width: newW, height: newH });
        };
        const onUp = () => setResizing(false);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [resizing, winPos.x, winPos.y]);

    // 프리셋 높이 변경 시, 창모드일 땐 높이만 동기화(너비 유지)
    useEffect(() => {
        if (!chatWindowed || resizing) return;
        setWinSize((prev) => ({ ...prev, height: chatHeightsWin[chatSize] }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatSize, chatWindowed]);

    /* ========== Timer ========== */
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

    /* ========== Load Scenario ========== */
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
                        console.error("contentJson parse error:", e);
                    }
                }
                setContent(parsed);
                const chars: CharacterDoc[] = parsed?.characters || [];
                setCharacters(chars);
                const first = chars.length ? chars[0] : null;
                setSelectedChar((prev) => prev ?? first);

                // restore notes/clues
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
                console.error("load scenario failed:", err);
            }
        };
        fetchScenario();
    }, [scenarioId, NOTE_KEY, CLUE_KEY]);

    /* ========== Defaults/Effects ========== */
    useEffect(() => {
        if (!askTarget && selectedChar?.name) setAskTarget(selectedChar.name);
    }, [selectedChar, askTarget]);

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

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat, logFilter, chatSize, chatWindowed]);

    /* ========== Evidence Detection (Light) ========== */
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
            if (hit && !collected.includes(ev.id)) newlyFound.push(ev.id);
        }
        if (newlyFound.length > 0) {
            const next = [...collected, ...newlyFound];
            setCollected(next);
            localStorage.setItem(CLUE_KEY, JSON.stringify(next));
        }
    };

    /* ========== Ask ========== */
    const handleAsk = async () => {
        const question = input.trim();
        if (!question) return;

        if (!sessionId) {
            alert(
                "세션 정보가 없습니다. 시나리오 선택 화면에서 다시 시작해주세요."
            );
            return;
        }
        if (askTarget !== "ALL" && !selectedChar?.name) {
            alert("질문 대상을 선택하세요.");
            return;
        }

        const now = Math.floor(Date.now() / 1000);
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
        detectEvidenceInText(question);

        setAsking(true);
        try {
            if (askTarget === "ALL") {
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

    /* ========== Result ========== */
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

    /* ========== Derived ========== */

    // [FIX] 3명 제한 해제: 모든 용의자를 무대로 보냅니다.
    const stageChars = useMemo(() => characters || [], [characters]);

    useEffect(() => {
        if (!selectedChar) return;
        const onStage = stageChars.find((c) => c.name === selectedChar.name);
        if (!onStage && stageChars[0]) setSelectedChar(stageChars[0]);
    }, [stageChars, selectedChar]);

    const backgroundUrl = toAbsoluteMediaUrl(content?.map?.background);
    const floorplanUrl = toAbsoluteMediaUrl(content?.map?.floorplan);

    const filteredChat = useMemo(() => {
        if (logFilter === "ALL") return chat;
        return chat.filter((m) => m.suspectName === logFilter);
    }, [chat, logFilter]);

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

    const pinnedSamples = useMemo(() => {
        const list =
            logFilter === "ALL"
                ? characters
                : characters.filter((c) => c.name === logFilter);
        return list.filter((c) => c.sample_line && c.name);
    }, [characters, logFilter]);

    // === ChatWindow control helpers ===
    const onHeaderMouseDown = (e: React.MouseEvent) => {
        setDragging(true);
        dragOffsetRef.current = {
            x: (e as unknown as globalThis.MouseEvent).clientX - winPos.x,
            y: (e as unknown as globalThis.MouseEvent).clientY - winPos.y,
        };
        (e as unknown as globalThis.MouseEvent).preventDefault();
    };
    const onResizeMouseDown = (e: React.MouseEvent) => {
        setResizing(true);
        const ev = e as unknown as globalThis.MouseEvent;
        resizeStartRef.current = {
            mx: ev.clientX,
            my: ev.clientY,
            w: winSize.width,
            h: winSize.height,
        };
    };
    const applyPresetHeight = (preset: "min" | "mid" | "max") => {
        setChatSize(preset);
        setWinSize((s) => ({ ...s, height: chatHeightsWin[preset] }));
    };

    const dockHeight = chatHeightsDock[chatSize];

    return (
        <div className="relative w-screen h-screen overflow-hidden">
            <IntroOverlay
                open={!!scenario?.scenSummary && showIntro}
                summary={scenario?.scenSummary || ""}
                title={scenario?.scenTitle}
                onClose={() => setShowIntro(false)}
                bgUrl={backgroundUrl}
            />

            {/* 배경 */}
            <div
                className="absolute inset-0"
                style={{
                    background: backgroundUrl
                        ? `#000 url(${backgroundUrl}) center/cover no-repeat`
                        : "linear-gradient(180deg,#0b0b0b,#151515)",
                }}
            />

            {/* 왼쪽 그라데이션 오버레이 */}
            <div
                className="absolute inset-y-0 left-0 w-[200px] pointer-events-none"
                style={{
                    background:
                        "linear-gradient(to right, rgba(255,255,255,0.17), transparent)",
                }}
            />

            {/* 상단 바 (아이콘/단서/종료) */}
            <TopBar
                floorplanUrl={floorplanUrl}
                onToggleSummary={() => setShowSummary((p) => !p)}
                onOpenFloorplan={() => setShowFloorplan(true)}
                onToggleNotes={() => setShowNotes(true)}
                onEnd={goResult}
                timeLabel={formatTime(seconds)}
                collected={collected}
                evidenceById={evidenceById}
                removeCollected={removeCollected}
            />

            {/* 무대 */}
            <Stage
                stageChars={stageChars}
                selectedChar={selectedChar}
                askTarget={askTarget}
                bubble={bubble}
                onSelect={(c) => {
                    setSelectedChar(c);
                    setAskTarget(c.name);
                }}
            />

            {/* 하단 질문 패널 */}
            <AskPanel
                stageChars={stageChars}
                askTarget={askTarget}
                setAskTarget={setAskTarget}
                selectedChar={selectedChar}
                setSelectedChar={setSelectedChar}
                input={input}
                setInput={setInput}
                asking={asking}
                onAsk={handleAsk}
                onEnterKey={handleKeyDown}
            />

            {/* 대화로그: 창모드/도킹 */}
            {chatWindowed ? (
                <ChatLogWindow
                    winPos={winPos}
                    winSize={winSize}
                    dragging={dragging}
                    resizing={resizing}
                    logFilter={logFilter}
                    setLogFilter={setLogFilter}
                    stageNames={stageChars.map((c) => c.name)}
                    pinnedSamples={pinnedSamples}
                    messages={filteredChat}
                    onHeaderMouseDown={onHeaderMouseDown}
                    onResizeMouseDown={onResizeMouseDown}
                    applyPresetHeight={applyPresetHeight}
                    setChatWindowed={setChatWindowed}
                    logEndRef={logEndRef}
                />
            ) : (
                <ChatLogDocked
                    height={dockHeight}
                    logFilter={logFilter}
                    setLogFilter={setLogFilter}
                    stageNames={stageChars.map((c) => c.name)}
                    pinnedSamples={pinnedSamples}
                    messages={filteredChat}
                    setChatSize={setChatSize}
                    setChatWindowed={setChatWindowed}
                    logEndRef={logEndRef}
                />
            )}

            {/* 모달들 */}
            <SummaryModal
                open={showSummary}
                summary={scenario?.scenSummary}
                onClose={() => setShowSummary(false)}
            />
            <FloorplanModal
                open={showFloorplan}
                imageUrl={floorplanUrl}
                onClose={() => setShowFloorplan(false)}
            />
            <NotesModal
                open={showNotes}
                notes={notes}
                onChange={(e) => {
                    setNotes(e.target.value);
                    localStorage.setItem(NOTE_KEY, e.target.value);
                }}
                onReset={() => {
                    setNotes("");
                    localStorage.setItem(NOTE_KEY, "");
                }}
                onClose={() => setShowNotes(false)}
            />
        </div>
    );
}
