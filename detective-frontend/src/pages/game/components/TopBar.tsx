import { FaFeatherPointed, FaPenNib } from "react-icons/fa6";
import { ImMap, ImSearch } from "react-icons/im";
import type { EvidenceDoc } from "../gameTypes";
import { useState, useEffect } from "react";
import { BsIncognito } from "react-icons/bs";
import { FaQuestion } from "react-icons/fa6";

type Props = {
    floorplanUrl?: string;
    onToggleSummary: () => void;
    onOpenFloorplan: () => void;
    onToggleNotes: () => void;
    onEnd: () => void;
    timeLabel: string;
    collected: string[];
    evidenceById: Map<string, EvidenceDoc>;
    removeCollected: (id: string) => void;
};

export default function TopBar({
    floorplanUrl,
    onToggleSummary,
    onOpenFloorplan,
    onToggleNotes,
    onEnd,
    timeLabel,
    collected,
    evidenceById,
    removeCollected,
}: Props) {
    const [showClues, setShowClues] = useState(false);
    const [hasNew, setHasNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // 새 단서 감지 → ping 효과 표시
    useEffect(() => {
        if (collected.length > 0) {
            setHasNew(true);
        }
    }, [collected]);

    const handleToggleClues = () => {
        setShowClues((p) => !p);
        if (hasNew) setHasNew(false); // 확인 시 ping 제거
    };

    return (
        <>
            {/* 상단 좌측: 아이콘 툴바 (세로 배치) */}
            <div className="absolute top-4 left-4 flex flex-col items-center gap-5 z-20">
                {/* 사건 종료 버튼 (맨 위, 원형) */}
                <div className="flex items-center gap-2">
                    {/* 사건 종료 버튼 */}
                    <button
                        onClick={() => setShowConfirm(true)}
                        className="
        relative p-3 rounded-full
        bg-gradient-to-br from-[#CC4935] to-[#5c1810]
        text-[#fbe7d3]
        active:scale-95 transition-all
      "
                        title="사건 종료"
                    >
                        <BsIncognito className="text-4xl" />
                    </button>

                    {/* 타이머 툴팁 */}
                    <div className="noto-sans-kr-700 tracking-[.13em] absolute left-[70px] flex bg-black text-[#fbe7d3] px-4 py-1 rounded-[10px] shadow-md text-[20px]">
                        {timeLabel}
                        {/* 꼬리 (왼쪽 화살표 모양) */}
                        <div className="absolute left-1 top-1/2 -translate-y-1/2 -translate-x-full w-2 h-2 bg-black rotate-45"></div>
                    </div>
                </div>

                {/* 사건 개요 */}
                <button
                    onClick={onToggleSummary}
                    className="relative p-4 bg-black/40 rounded-full shadow hover:bg-black/55"
                    title="사건 개요 보기"
                >
                    <FaFeatherPointed className="text-2xl text-white" />
                </button>

                {/* 도면 */}
                <button
                    disabled={!floorplanUrl}
                    onClick={onOpenFloorplan}
                    className="relative p-4 bg-black/40 rounded-full shadow hover:bg-black/55 disabled:opacity-40"
                    title="도면 보기"
                >
                    <ImMap className="text-2xl text-white" />
                </button>

                {/* 수첩 */}
                <button
                    onClick={onToggleNotes}
                    className="relative p-4 bg-black/40 rounded-full shadow hover:bg-black/55"
                    title="사건 수첩"
                >
                    <FaPenNib className="text-2xl text-white" />
                </button>

                {/* 단서 버튼 */}
                <div className="relative">
                    <button
                        onClick={handleToggleClues}
                        className="relative p-4 bg-black/40 rounded-full shadow hover:bg-black/55"
                        title="수집 단서"
                    >
                        <ImSearch className="text-2xl text-white" />
                        {hasNew && (
                            <span className="absolute top-2 right-2 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                        )}
                    </button>

                    {showClues && (
                        <div className="absolute left-14 top-0 w-60 max-h-60 overflow-y-auto rounded-lg shadow-lg bg-white/95 border border-gray-200 p-3 z-30">
                            <strong className="block mb-2 text-sm">
                                수집 단서
                            </strong>
                            {collected.length === 0 && (
                                <span className="text-gray-500 text-xs">
                                    아직 없음
                                </span>
                            )}
                            {collected.map((id) => {
                                const ev = evidenceById.get(id);
                                const label = ev?.name || id;
                                return (
                                    <div
                                        key={id}
                                        className="flex items-center justify-between mb-1 text-sm bg-[#eef4ff] border border-[#cfe1ff] rounded px-2 py-1"
                                    >
                                        <span
                                            title={ev?.desc || ""}
                                            className="truncate"
                                        >
                                            {label}
                                        </span>
                                        <button
                                            onClick={() => removeCollected(id)}
                                            className="ml-2 text-red-500 font-bold"
                                            title="제거"
                                        >
                                            ×
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 게임 방법 버튼 */}
                <div className="relative">
                    <button
                        className="relative p-4 bg-black/40 rounded-full shadow hover:bg-black/55"
                        title="게임 방법"
                    >
                        <FaQuestion className="text-2xl text-white" />
                    </button>

                    {showClues && (
                        <div className="absolute left-14 top-0 w-60 max-h-60 overflow-y-auto rounded-lg shadow-lg bg-white/95 border border-gray-200 p-3 z-30">
                            <strong className="block mb-2 text-sm">
                                수집 단서
                            </strong>
                            {collected.length === 0 && (
                                <span className="text-gray-500 text-xs">
                                    아직 없음
                                </span>
                            )}
                            {collected.map((id) => {
                                const ev = evidenceById.get(id);
                                const label = ev?.name || id;
                                return (
                                    <div
                                        key={id}
                                        className="flex items-center justify-between mb-1 text-sm bg-[#eef4ff] border border-[#cfe1ff] rounded px-2 py-1"
                                    >
                                        <span
                                            title={ev?.desc || ""}
                                            className="truncate"
                                        >
                                            {label}
                                        </span>
                                        <button
                                            onClick={() => removeCollected(id)}
                                            className="ml-2 text-red-500 font-bold"
                                            title="제거"
                                        >
                                            ×
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* 종료 확인 모달 */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full text-center">
                        <h3 className="text-xl mb-4 noto-sans-kr-700">
                            사건 종료
                        </h3>
                        <p className="text-md mb-6">
                            이제 당신의 추리를 공식 보고서에 기록할 시간입니다.
                            <strong className="text-red-500"> 종료</strong>
                            버튼을 누르면 <strong>최종 보고 페이지</strong>로
                            이동합니다.
                        </p>
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={() => {
                                    setShowConfirm(false);
                                    onEnd();
                                }}
                                className="px-4 py-2 rounded-md bg-red-600 text-white font-bold hover:bg-red-700"
                            >
                                종료
                            </button>
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="px-4 py-2 rounded-md bg-gray-300 font-bold hover:bg-gray-400"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
