import { useState } from "react";
import { toAbsoluteMediaUrl } from "../gameTypes";
import type { CharacterDoc } from "../gameTypes";
import { TiInfoLarge } from "react-icons/ti";

type Bubble = {
    text: string;
    suspectName: string | null;
    showing: boolean;
};

type Props = {
    stageChars: CharacterDoc[];
    selectedChar: CharacterDoc | null;
    askTarget: "ALL" | string;
    bubble: Bubble;
    onSelect: (c: CharacterDoc) => void;
};

export default function Stage({
    stageChars,
    selectedChar,
    askTarget,
    bubble,
    onSelect,
}: Props) {
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    const [infoOpen, setInfoOpen] = useState<Record<string, boolean>>({});

    if (stageChars.length === 0) {
        return (
            <div className="absolute inset-0 flex items-center justify-center px-8">
                <div className="text-gray-300">용의자가 없습니다.</div>
            </div>
        );
    }

    const BUBBLE_OFFSET = 28;

    // 말풍선: 기본은 캐릭터 위에 띄우고(꼬리 ↓), 화면 상단에 닿으면 자동으로 아래로 뒤집음(꼬리 ↑)
    const BubbleFor = ({ c }: { c: CharacterDoc }) => {
        const showTarget =
            bubble.showing &&
            !!bubble.text &&
            (bubble.suspectName === c.name ||
                bubble.suspectName === String(c.id ?? ""));

        if (!showTarget) return null;

        return (
            <div
                className="absolute z-50"
                style={{
                    bottom: `calc(100% + ${BUBBLE_OFFSET}px)`,
                    left: "50%",
                    transform: "translateX(-50%)",
                    pointerEvents: "none",
                }}
            >
                {/* 본체 */}
                <div
                    style={{
                        width: "min(350px, 90vw)",
                        background: "rgba(255, 255, 255, 0.75)",
                        borderRadius: 12,
                        padding: "14px 16px",
                        boxShadow: "0 10px 22px rgba(0,0,0,0.28)",
                        color: "#111",
                    }}
                >
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>
                        {c.name ?? "용의자"}
                    </div>
                    <div
                        style={{
                            fontSize: 15,
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            overflowWrap: "anywhere",
                        }}
                    >
                        {bubble.text}
                    </div>
                </div>

                {/* 꼬리 — 아래로 향해 캐릭터를 가리킵니다 */}
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        top: "100%",
                        left: "calc(50% - 12px)",
                        width: 0,
                        height: 0,
                        borderLeft: "12px solid transparent",
                        borderRight: "12px solid transparent",
                        borderTop: "14px solid rgba(255, 255, 255, 0.75)", // ↓
                        filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.18))",
                    }}
                />
            </div>
        );
    };

    return (
        // 오버플로우로 잘리는 걸 방지: overflow-visible
        <div className="absolute inset-0 flex flex-wrap items-end justify-center gap-20 px-8 overflow-hidden pb-0">
            {stageChars.map((c, idx) => {
                const isSel =
                    askTarget !== "ALL" && selectedChar?.name === c.name;
                const isHover = hoverIdx === idx;
                const hasSelection =
                    askTarget !== "ALL" && !!selectedChar?.name;
                const isDimmed =
                    hasSelection && !(selectedChar?.name === c.name); // 선택 외 나머지

                const outlineColor = isSel
                    ? "#0000004d"
                    : isHover
                    ? "#00000015"
                    : "transparent";

                const charKey = String(c.id ?? c.name ?? idx);
                const isInfoOpen = !!infoOpen[charKey];

                return (
                    <div
                        key={charKey}
                        onClick={() => onSelect(c)}
                        onMouseEnter={() => setHoverIdx(idx)}
                        onMouseLeave={() => setHoverIdx(null)}
                        title={c.sample_line || ""}
                        className={`relative self-end cursor-pointer flex flex-col items-center rounded-2xl transition ${
                            isSel ? "scale-105" : ""
                        }`}
                    >
                        {/* 캐릭터별 말풍선 */}
                        <BubbleFor c={c} />

                        {/* 아바타 */}
                        {c.image ? (
                            <div
                                className="relative"
                                style={{
                                    width: 280,
                                    height: 650,
                                    overflow: "hidden",
                                }}
                            >
                                {/* 정보 토글 아이콘 */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setInfoOpen((prev) => ({
                                            ...prev,
                                            [charKey]: !prev[charKey],
                                        }));
                                    }}
                                    title={
                                        isInfoOpen ? "정보 숨기기" : "정보 보기"
                                    }
                                    className="absolute top-2 right-6 z-30 w-6 h-6 border border-2 border-white/30 rounded-[6px] flex items-center justify-center bg-black/50 text-white hover:bg-black/70 hover:border-white/50 focus:outline-none"
                                >
                                    <TiInfoLarge className="text-lg text-white/50" />
                                </button>

                                {/* 컬러 윤곽(마스크) 레이어 */}
                                <div
                                    aria-hidden
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        WebkitMaskImage: `url(${toAbsoluteMediaUrl(
                                            c.image
                                        )})`,
                                        maskImage: `url(${toAbsoluteMediaUrl(
                                            c.image
                                        )})`,
                                        WebkitMaskRepeat: "no-repeat",
                                        maskRepeat: "no-repeat",
                                        WebkitMaskPosition: "5px 15px",
                                        maskPosition: "5px 15px",
                                        WebkitMaskSize: "cover",
                                        maskSize: "cover",
                                        backgroundColor: outlineColor,
                                        transform: isSel
                                            ? "scale(1.07)"
                                            : isHover
                                            ? "scale(1.06)"
                                            : "scale(1.04)",
                                        transition:
                                            "transform 120ms ease, background-color 120ms ease",
                                        pointerEvents: "none",
                                        zIndex: 1,
                                    }}
                                />

                                {/* 실제 이미지 */}
                                <img
                                    src={toAbsoluteMediaUrl(c.image)}
                                    alt={c.name}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        objectPosition: "center top",
                                        display: "block",
                                        position: "relative",
                                        zIndex: 2,
                                        userSelect: "none",
                                        // filter:
                                        //     outlineColor !== "transparent"
                                        //         ? `drop-shadow(0 0 0 ${outlineColor}) drop-shadow(0 0 6px ${outlineColor})`
                                        //         : undefined,
                                        filter: isDimmed
                                            ? "grayscale(0.25) brightness(0.72) blur(2px)"
                                            : "none",
                                        transition: "filter 160ms ease",
                                        willChange: "filter",
                                    }}
                                    draggable={false}
                                />

                                {/* 정보 오버레이 */}
                                {isInfoOpen && (
                                    <>
                                        <div
                                            aria-hidden
                                            className="absolute inset-x-0 top-[180px] rounded-full"
                                            style={{
                                                height: 120,
                                                background:
                                                    "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 35%, rgba(0,0,0,0.5) 100%)",
                                                zIndex: 3,
                                                pointerEvents: "none",
                                            }}
                                        />
                                        <div
                                            className="absolute inset-x-0 top-[200px] px-7 select-none"
                                            style={{
                                                color: "#fff",
                                                textShadow:
                                                    "0 1px 2px rgba(0,0,0,0.7)",
                                                zIndex: 4,
                                                pointerEvents: "none",
                                            }}
                                        >
                                            <div className="font-extrabold text-base leading-tight">
                                                {c.name || `용의자 ${idx + 1}`}
                                            </div>
                                            <div>
                                                {c.age ? `${c.age}세, ` : ""}
                                                {c.gender || ""}
                                                {c.gender ? ", " : ""}
                                                {c.job || ""}
                                            </div>
                                            {c.outfit && (
                                                <div>옷차림: {c.outfit}</div>
                                            )}
                                            {c.speaking_style && (
                                                <div>
                                                    말투: {c.speaking_style}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="w-28 h-28 rounded-full flex items-center justify-center bg-gray-200 text-4xl shadow">
                                🙂
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
