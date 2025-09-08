import React from "react";
import type { CharacterDoc } from "../gameTypes";
import { toAbsoluteMediaUrl } from "../gameTypes";

type Props = {
    stageChars: CharacterDoc[];
    askTarget: "ALL" | string;
    setAskTarget: (v: "ALL" | string) => void;
    selectedChar: CharacterDoc | null;
    setSelectedChar: (c: CharacterDoc | null) => void;
    input: string;
    setInput: (v: string) => void;
    asking: boolean;
    onAsk: () => void;
    onEnterKey: React.KeyboardEventHandler<HTMLInputElement>;
};

export default function AskPanel({
    stageChars,
    askTarget,
    setAskTarget,
    selectedChar,
    setSelectedChar,
    input,
    setInput,
    asking,
    onAsk,
    onEnterKey,
}: Props) {
    const AVATAR = 45;
    const IMG_ZOOM = 1.4;
    const handleSelectAll = () => {
        setAskTarget("ALL");
        setSelectedChar(null);
    };

    const handleSelectChar = (c: CharacterDoc) => {
        setAskTarget(c.name);
        setSelectedChar(c);
    };

    return (
        <div className="absolute left-0 right-0 bottom-0 z-20 px-6 pb-4 pointer-events-none">
            {/* 데스크탑 한 줄 / 모바일 두 줄 */}
            <div className="mx-auto w-full max-w-[960px] pointer-events-auto flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                {/* 질문 대상 영역 */}
                <div className="w-full sm:w-auto">
                    <fieldset className="flex items-center gap-2 m-0 p-0 border-0">
                        {/* 타이틀과 옵션을 같은 행에 배치 */}
                        <legend className="hidden shrink-0 text-xs text-gray-500 mr-2">
                            질문 대상
                        </legend>

                        {/* 옵션 리스트: 가로 스크롤 */}
                        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pr-1">
                            {/* 전체 (텍스트 pill) */}
                            <label
                                className={`inline-flex items-center gap-2 h-11 w-11 justify-center rounded-full border border-[2px] text-sm noto-sans-kr-700 cursor-pointer select-none ${
                                    askTarget === "ALL"
                                        ? "bg-[#bb834498] text-white/80"
                                        : "bg-[#00000063] text-white/80"
                                }`}
                                style={{
                                    borderColor:
                                        askTarget === "ALL"
                                            ? "#ffffff54"
                                            : "#ffffff63",
                                }}
                                title="전체"
                            >
                                <input
                                    type="radio"
                                    name="askTarget"
                                    value="ALL"
                                    checked={askTarget === "ALL"}
                                    onChange={handleSelectAll}
                                    className="sr-only"
                                />
                                ALL
                            </label>

                            {/* 용의자들 (원형 이미지 버튼) */}
                            {stageChars.map((c, idx) => {
                                const active = askTarget === c.name;
                                const img = toAbsoluteMediaUrl(c.image);
                                return (
                                    <label
                                        key={idx}
                                        className="relative w-11 h-11 rounded-full overflow-hidden  cursor-pointer select-none shrink-0"
                                        style={{
                                            backgroundColor: active
                                                ? "#bb834498"
                                                : "#00000063",
                                            width: AVATAR,
                                            height: AVATAR,
                                        }}
                                        title={c.name}
                                    >
                                        <input
                                            type="radio"
                                            name="askTarget"
                                            value={c.name}
                                            checked={active}
                                            onChange={() => handleSelectChar(c)}
                                            className="sr-only"
                                            aria-label={c.name}
                                        />
                                        {/* 아바타 이미지 */}
                                        {img ? (
                                            <img
                                                src={img}
                                                alt={c.name}
                                                className="w-full h-full object-cover object-top"
                                                style={{
                                                    transform: `scale(${IMG_ZOOM})`,
                                                    transformOrigin: "50% -30%", // 가운데-위쪽을 기준으로 확대
                                                    willChange: "transform",
                                                    backfaceVisibility:
                                                        "hidden",
                                                }}
                                                draggable={false}
                                            />
                                        ) : (
                                            <div className="w-full h-full grid place-items-center bg-gray-200 text-base">
                                                🙂
                                            </div>
                                        )}
                                        {/* 선택 표시용 얇은 그라데이션 오버레이(선택시만 은은하게) */}
                                        {active && (
                                            <div
                                                aria-hidden
                                                className="absolute inset-0"
                                                style={{
                                                    background:
                                                        "radial-gradient(closest-side, rgba(255, 255, 255, 0.18), transparent 70%)",
                                                }}
                                            />
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>
                </div>

                {/* 질문 입력 영역 */}
                <div className="w-full flex items-center gap-2">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={onEnterKey}
                        placeholder={
                            askTarget === "ALL"
                                ? "모든 용의자에게 물어봅니다"
                                : selectedChar
                                ? `${selectedChar.name}에게 질문을 입력하세요`
                                : "먼저 질문 대상을 선택하세요"
                        }
                        className="flex-1 px-4 py-3 rounded-xl border"
                        style={{ borderColor: "#ccc" }}
                        disabled={
                            (askTarget !== "ALL" && !selectedChar) || asking
                        }
                    />
                    <button
                        onClick={onAsk}
                        disabled={
                            !input.trim() ||
                            (askTarget !== "ALL" && !selectedChar) ||
                            asking
                        }
                        className="px-4 py-3 rounded-xl text-white font-bold shadow disabled:opacity-50"
                        style={{ background: "#1f2937" }}
                    >
                        {asking ? "질문 중..." : "질문하기"}
                    </button>
                </div>
            </div>
        </div>
    );
}
