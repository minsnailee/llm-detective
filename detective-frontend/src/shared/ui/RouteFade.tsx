import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { useNavigate } from "react-router-dom";

type Phase = "idle" | "fade-out" | "fade-in";

type RouteFadeContextType = {
    /** 페이드-아웃 후 네비게이트 → 페이드-인 */
    fadeTo: (
        to: string,
        opts?: { replace?: boolean; durationMs?: number }
    ) => Promise<void>;
    /** 수동으로 페이드-아웃/인만 쓰고 싶을 때 */
    fadeOutIn: (durationMs?: number) => Promise<void>;
};

const RouteFadeContext = createContext<RouteFadeContextType | null>(null);

export function useRouteFade() {
    const ctx = useContext(RouteFadeContext);
    if (!ctx)
        throw new Error("useRouteFade must be used within <RouteFadeProvider>");
    return ctx;
}

/** 앱 최상단(레이아웃/Router 내부)에 감싸주세요 */
export function RouteFadeProvider({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate();
    const [phase, setPhase] = useState<Phase>("fade-in"); // 첫 진입시 살짝 페이드-인
    const [duration, setDuration] = useState<number>(450);
    const timer = useRef<number | null>(null);

    useEffect(() => {
        // 첫 진입 페이드-인 종료
        timer.current = window.setTimeout(() => setPhase("idle"), duration);
        return () => {
            if (timer.current) clearTimeout(timer.current);
        };
    }, [duration]);

    const wait = (ms: number) =>
        new Promise<void>((res) => setTimeout(res, ms));

    const fadeOutIn = async (durationMs = 450) => {
        setDuration(durationMs);
        setPhase("fade-out");
        await wait(durationMs);
        setPhase("fade-in");
        await wait(durationMs);
        setPhase("idle");
    };

    const fadeTo = async (
        to: string,
        opts?: { replace?: boolean; durationMs?: number }
    ) => {
        const d = opts?.durationMs ?? 450;
        setDuration(d);
        setPhase("fade-out");
        await wait(d);
        if (opts?.replace) navigate(to, { replace: true });
        else navigate(to);
        // 다음 프레임에 페이드-인 시작
        requestAnimationFrame(async () => {
            setPhase("fade-in");
            await wait(d);
            setPhase("idle");
        });
    };

    const ctxValue: RouteFadeContextType = { fadeTo, fadeOutIn };

    const opacity = phase === "fade-out" ? 1 : phase === "fade-in" ? 0 : 0;

    const pointerEvents = phase === "idle" ? "none" : "auto";

    return (
        <RouteFadeContext.Provider value={ctxValue}>
            {children}
            {/* 전역 오버레이 */}
            <div
                className={`fixed inset-0 z-[9999] bg-black transition-opacity ease-in-out`}
                style={{
                    opacity,
                    transitionDuration: `${duration}ms`,
                    pointerEvents,
                    willChange: "opacity",
                }}
            />
        </RouteFadeContext.Provider>
    );
}
