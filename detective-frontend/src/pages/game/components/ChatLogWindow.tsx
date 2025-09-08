import { useState } from "react";
import { GoChevronDown, GoChevronUp } from "react-icons/go";
import type { RefObject, MouseEvent } from "react";
import type { CharacterDoc, ChatMsg } from "../gameTypes";

type Props = {
    winPos: { x: number; y: number };
    winSize: { width: number; height: number };
    dragging: boolean;
    resizing: boolean;
    logFilter: string;
    setLogFilter: (v: string) => void;
    stageNames: string[];
    pinnedSamples: CharacterDoc[];
    messages: ChatMsg[];
    onHeaderMouseDown: (e: MouseEvent) => void;
    onResizeMouseDown: (e: MouseEvent) => void;
    applyPresetHeight: (preset: "min" | "mid" | "max") => void;
    setChatWindowed: (v: boolean) => void;
    logEndRef: RefObject<HTMLDivElement>;
};

export default function ChatLogWindow({
    winPos,
    winSize,
    dragging,
    resizing,
    logFilter,
    setLogFilter,
    stageNames,
    pinnedSamples,
    messages,
    onHeaderMouseDown,
    onResizeMouseDown,
    applyPresetHeight,
    setChatWindowed,
    logEndRef,
}: Props) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div
            className="absolute z-30 rounded-2xl border shadow-lg text-white overflow-hidden"
            style={{
                top: winPos.y,
                left: winPos.x,
                width: winSize.width,
                height: winSize.height,
                background: "rgba(0,0,0,0.58)",
                borderColor: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(2px)",
                userSelect: dragging || resizing ? "none" : "auto",
            }}
        >
            {/* 헤더(드래그 이동) */}
            <div
                className="flex items-center justify-between px-3 h-9 border-b cursor-move select-none"
                style={{ borderColor: "rgba(255,255,255,0.12)" }}
                onMouseDown={onHeaderMouseDown}
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm/none opacity-90">대화 로그</span>
                    <div className="hidden sm:flex items-center gap-1 ml-2">
                        {["ALL", ...stageNames].map((label) => {
                            const active = logFilter === label;
                            return (
                                <button
                                    key={label}
                                    onClick={(ev) => {
                                        ev.stopPropagation();
                                        setLogFilter(label);
                                    }}
                                    className={`px-2 py-0.5 rounded-full text-xs border ${
                                        active
                                            ? "bg-white text-black"
                                            : "bg-transparent text-white"
                                    }`}
                                    style={{
                                        borderColor: "rgba(255,255,255,0.2)",
                                    }}
                                >
                                    {label === "ALL" ? "전체" : label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {/* 모든 버튼 높이/폭 통일: h-7 px-2 text-xs */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            applyPresetHeight("min");
                            setCollapsed(true);
                        }}
                        className="h-7 px-2 text-xs rounded text-white border flex items-center"
                        style={{ borderColor: "rgba(255,255,255,0.25)" }}
                        title="접기"
                    >
                        <GoChevronDown />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            applyPresetHeight("mid");
                            setCollapsed(false);
                        }}
                        className="h-7 px-2 text-xs rounded bg-white text-black border flex items-center"
                        style={{ borderColor: "rgba(255,255,255,0.25)" }}
                        title="기본"
                    >
                        기본
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            applyPresetHeight("max");
                            setCollapsed(false);
                        }}
                        className="h-7 px-2 text-xs rounded text-white border flex items-center"
                        style={{ borderColor: "rgba(255,255,255,0.25)" }}
                        title="펼치기"
                    >
                        <GoChevronUp />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setChatWindowed(false);
                        }}
                        className="ml-1 h-7 px-2 text-xs rounded bg-white text-black border flex items-center"
                        style={{ borderColor: "rgba(255,255,255,0.25)" }}
                        title="고정"
                    >
                        고정
                    </button>
                </div>
            </div>

            {/* 내용 — 접히면 height:0, padding 제거, overflow 숨김 / 14px 통일 */}
            <div
                style={{ height: collapsed ? 0 : `calc(100% - 36px)` }}
                className={`px-3 transition-[height] duration-200 text-[14px] nice-scroll ${
                    collapsed ? "py-0 overflow-hidden" : "py-2 overflow-y-auto"
                }`}
            >
                {pinnedSamples.length > 0 && (
                    <div className="mb-2 text-white/70">
                        {pinnedSamples.map((c) => (
                            <div key={`pinned_${c.name}`} className="mb-1">
                                <span
                                    className="inline-block px-2 py-1 rounded border text-white/90"
                                    style={{
                                        borderColor: "rgba(255,255,255,0.18)",
                                        background: "rgba(255,255,255,0.05)",
                                    }}
                                >
                                    <b>{c.name}</b>: {c.sample_line}
                                </span>
                            </div>
                        ))}
                        <hr
                            className="border-0 border-t border-dashed"
                            style={{ borderColor: "rgba(255,255,255,0.12)" }}
                        />
                    </div>
                )}

                {messages.map((m) => {
                    const isPlayer = m.role === "player";
                    return (
                        <div
                            key={m.id}
                            className={`mb-2 flex flex-col ${
                                isPlayer ? "items-end" : "items-start"
                            }`}
                        >
                            <div
                                className={`text-white/60 ${
                                    isPlayer ? "text-right" : ""
                                }`}
                            >
                                {new Date(m.ts * 1000).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                                {" · "}
                                {m.suspectName}
                            </div>
                            <div
                                className={`inline-block max-w-[640px] px-3 py-2 rounded-lg border text-[14px] ${
                                    isPlayer
                                        ? "bg-white/10 border-white/25 text-right text-amber-300"
                                        : "bg-white/5 border-white/20"
                                }`}
                            >
                                <b>{isPlayer ? "탐정" : m.suspectName}</b>:{" "}
                                {m.text}
                            </div>
                        </div>
                    );
                })}
                <div ref={logEndRef} />
            </div>

            {/* 리사이즈 핸들 (우하단) */}
            <div
                title="크기 조절"
                onMouseDown={onResizeMouseDown}
                className="absolute right-0 bottom-0 w-4 h-4"
                style={{
                    cursor: "nwse-resize",
                    background:
                        "linear-gradient(135deg, transparent 0 50%, rgba(255,255,255,0.35) 50% 100%)",
                }}
            />
        </div>
    );
}
