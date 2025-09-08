import { useEffect, useRef, useState } from "react";
import bgScenSelect from "../../../assets/bg-scenselect.png";

type IntroOverlayProps = {
    open: boolean; // 표시 여부
    summary: string; // 사건 개요 텍스트 (타이핑 대상)
    onClose: () => void; // fade-out 종료 후 호출
    title?: string; // (선택) 사건 제목
    typingSpeedMs?: number; // (선택) 타이핑 속도 (기본 28ms)
    bgUrl?: string; // (선택) 배경 이미지 URL (시나리오 배경 전달용)
};

export default function IntroOverlay({
    open,
    summary,
    onClose,
    title = "사건 개요",
    typingSpeedMs = 28,
    bgUrl, // 추가
}: IntroOverlayProps) {
    const [typed, setTyped] = useState("");
    const [done, setDone] = useState(false); // 타이핑 완료 여부
    const [fading, setFading] = useState(false); // fade-out 중 여부
    const timerRef = useRef<number | null>(null);

    // open될 때마다 타이핑 초기화
    useEffect(() => {
        if (!open) return;
        setTyped("");
        setDone(false);
        setFading(false);

        let i = 0;
        const id = window.setInterval(() => {
            i++;
            if (i >= summary.length) {
                setTyped(summary);
                setDone(true);
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = null;
            } else {
                setTyped(summary.slice(0, i));
            }
        }, typingSpeedMs);
        timerRef.current = id;

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
        };
    }, [open, summary, typingSpeedMs]);

    if (!open && !fading) return null;

    const skipTyping = () => {
        if (!done) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            setTyped(summary);
            setDone(true);
        }
    };

    const startInvestigation = () => {
        skipTyping(); // 전체 문장 보이도록 보장 후
        setFading(true); // fade-out 시작
        window.setTimeout(() => {
            onClose();
            setFading(false);
        }, 700); // Tailwind transition 시간과 맞춤
    };

    // 배경: 시나리오 배경(bgUrl) → 없으면 기본 이미지(bgScenSelect)
    const bg = bgUrl || bgScenSelect;

    return (
        <div
            role="dialog"
            aria-modal
            className={`fixed inset-0 z-[50] flex items-center justify-center transition-opacity duration-700 ${
                fading ? "opacity-0" : "opacity-100"
            }`}
        >
            {/* 배경 레이어 */}
            <div
                className="absolute inset-0 z-10 bg-center bg-cover bg-no-repeat"
                style={{ backgroundImage: `url(${bg})` }}
            />
            {/* 어두운 오버레이 */}
            <div className="absolute inset-0 z-20 bg-black/50" />
            {/* 깜빡이는 형광등 오버레이 (가벼운 연출) */}
            <div className="absolute inset-0 z-30 bg-white/90 mix-blend-overlay animate-flicker pointer-events-none" />

            {/* 콘텐츠 카드 */}
            <div className="relative z-40 w-[min(880px,92vw)] max-h-[86vh] text-white px-6 py-7 rounded-2xl border border-white/10 shadow-xl bg-black/20 backdrop-blur-sm">
                <div className="mb-4">
                    <h2 className="relative text-[90px] east-sea-dokdo-regular">
                        {title}
                    </h2>
                    <p className="text-xs opacity-70 mt-0.5">
                        조사 시작 전에 사건 개요를 확인하세요.
                    </p>
                </div>

                <div
                    className="font-mono text-[18px] leading-15 whitespace-pre-line overflow-auto pr-1 noto-sans-kr-400"
                    style={{ maxHeight: "56vh" }}
                    aria-live="polite"
                >
                    {typed}
                    {!done && (
                        <span className="inline-block w-2 h-5 align-[-3px] bg-white ml-1 animate-pulse" />
                    )}
                </div>

                <div className="mt-6 flex gap-2 justify-end">
                    <button
                        onClick={skipTyping}
                        className="px-4 py-2 rounded-md border border-white/25 hover:bg-white/10"
                        title="타이핑을 건너뛰고 전체 텍스트를 즉시 표시"
                    >
                        스킵
                    </button>
                    <button
                        onClick={startInvestigation}
                        className="px-5 py-2 rounded-md font-bold text-black bg-white hover:bg-white/90"
                        title="조사 시작"
                    >
                        조사 시작
                    </button>
                </div>
            </div>
        </div>
    );
}
