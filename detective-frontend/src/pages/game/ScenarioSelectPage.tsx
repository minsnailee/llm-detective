import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../shared/api/client";
import { useAuth } from "../../store/auth.store";
import paperTex from "../../assets/textures/paper2.png";
import lockIcon from "../../assets/icon-lock.png";
import { GoStar, GoStarFill } from "react-icons/go";
import bgScenSelect from "../../assets/bg-scenselect.png";
import { useRouteFade } from "../../shared/ui/RouteFade";

// 공통 타입/유틸 가져오기
import { toAbsoluteMediaUrl } from "./gameTypes";
import type { ParsedContent } from "./gameTypes";

// 목록 응답 전용(필요 필드만)
interface ScenarioListItem {
    scenIdx: number;
    scenTitle: string;
    scenLevel: number; // 1~3
    scenAccess: "FREE" | "MEMBER";
    scenImage?: string; // 서버가 목록에 썸네일을 내려주는 경우
    createdAt?: string; // 최신 정렬용
}

// 상세 응답(썸네일 프리패치를 위해 사용)
interface ScenarioDetailDTO {
    scenIdx: number;
    scenTitle: string;
    scenSummary: string;
    scenLevel: number;
    contentJson?: string | any;
}

interface Line {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export default function ScenarioSelectPage() {
    const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
    // scenIdx → 절대 URL로 변환된 배경 썸네일
    const [bgMap, setBgMap] = useState<Record<number, string>>({});
    const [lines, setLines] = useState<Line[]>([]);
    const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
    const navigate = useNavigate();
    const { user } = useAuth();
    const { fadeTo } = useRouteFade();

    useEffect(() => {
        const fetchScenarios = async () => {
            try {
                const res = await api.get<ScenarioListItem[]>("/scenarios");

                // 최신순 정렬: createdAt(desc) → 없으면 scenIdx(desc)
                const key = (s: ScenarioListItem) =>
                    s.createdAt ? new Date(s.createdAt).getTime() : s.scenIdx;
                const sorted = [...res.data].sort((a, b) => key(b) - key(a));
                setScenarios(sorted);

                // 카드 별 배경 준비:
                // 1) 목록 scenImage 우선
                // 2) 없으면 상세 프리패치하여 content.map.background 사용
                const entries = await Promise.all(
                    sorted.map(async (s) => {
                        const fromList = toAbsoluteMediaUrl(s.scenImage);
                        if (fromList) return [s.scenIdx, fromList] as const;

                        try {
                            const d = await api.get<ScenarioDetailDTO>(
                                `/scenarios/${s.scenIdx}`
                            );
                            let content: ParsedContent | null = null;
                            if (d.data.contentJson) {
                                content =
                                    typeof d.data.contentJson === "string"
                                        ? JSON.parse(d.data.contentJson)
                                        : (d.data.contentJson as ParsedContent);
                            }
                            const raw =
                                content?.map?.background ||
                                (content as any)?.scenario?.cover;
                            const abs = toAbsoluteMediaUrl(raw);
                            return [s.scenIdx, abs || ""] as const;
                        } catch {
                            return [s.scenIdx, ""] as const;
                        }
                    })
                );

                const map: Record<number, string> = {};
                for (const [id, url] of entries) {
                    if (url) map[id] = url;
                }
                setBgMap(map);
            } catch (err) {
                console.error("시나리오 목록 불러오기 실패:", err);
            }
        };
        fetchScenarios();
    }, []);

    const handleStart = async (s: ScenarioListItem) => {
        try {
            if (s.scenAccess === "MEMBER" && !user?.userIdx) {
                alert("로그인이 필요한 시나리오입니다.");
                return;
            }
            const res = await api.post<number>("/game/session/start", null, {
                params: { scenIdx: s.scenIdx, userIdx: user?.userIdx },
            });
            const sessionId = res.data;
            await fadeTo(`/play/${s.scenIdx}?sessionId=${sessionId}`, {
                durationMs: 600,
            });
        } catch (err) {
            console.error("세션 시작 실패:", err);
        }
    };

    const updateLines = () => {
        const newLines: Line[] = [];
        for (let i = 0; i < cardRefs.current.length - 1; i++) {
            const a = cardRefs.current[i],
                b = cardRefs.current[i + 1];
            if (!a || !b) continue;
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();
            const pinAx = ra.left + 15 + window.scrollX;
            const pinAy = ra.top + 15 + window.scrollY;
            const pinBx = rb.left + 15 + window.scrollX;
            const pinBy = rb.top + 15 + window.scrollY;
            newLines.push({ x1: pinAx, y1: pinAy, x2: pinBx, y2: pinBy });
        }
        setLines(newLines);
    };

    useEffect(() => {
        updateLines();
        window.addEventListener("resize", updateLines);
        window.addEventListener("scroll", updateLines);
        return () => {
            window.removeEventListener("resize", updateLines);
            window.removeEventListener("scroll", updateLines);
        };
    }, [scenarios]);

    const renderStars = (level: number) => (
        <div className="flex justify-center gap-1 mt-1">
            {[1, 2, 3].map((n) =>
                n <= level ? (
                    <GoStarFill
                        key={n}
                        className="text-yellow-300 drop-shadow-[1px_1px_3px_rgba(0,0,0,0.3)]"
                    />
                ) : (
                    <GoStar key={n} className="text-stone-500" />
                )
            )}
        </div>
    );

    const FALLBACK_THUMB = "/assets/placeholder.png";

    return (
        <div
            className="relative min-h-screen bg-[#1c1c1c] p-10"
            style={{ backgroundImage: `url(${bgScenSelect})` }}
        >
            <div className="absolute inset-0 bg-black/65 z-0"></div>
            <div className="absolute inset-0 bg-white/90 mix-blend-overlay animate-flicker"></div>

            <h2 className="neon text-center text-[90px] mb-12 special-elite-regular z-1 relative">
                WHO?
            </h2>

            <div className="relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-12 place-items-center z-10">
                {scenarios.map((s, i) => {
                    const locked = s.scenAccess === "MEMBER" && !user?.userIdx;
                    const cardImg =
                        bgMap[s.scenIdx] ||
                        toAbsoluteMediaUrl(s.scenImage) ||
                        FALLBACK_THUMB;

                    return (
                        <div
                            key={s.scenIdx}
                            ref={(el) => {
                                cardRefs.current[i] = el;
                            }}
                            onClick={() => handleStart(s)}
                            className={`
                flex flex-col gap-3 relative w-[320px] h-[280px] bg-[#e5d3b3] border border-[#c2a98f]
                shadow-lg cursor-pointer transition-transform
                hover:scale-105 hover:shadow-2xl
                ${i % 2 === 0 ? "rotate-[-6deg]" : "rotate-[4deg]"}
              `}
                        >
                            {/* 종이 텍스처 */}
                            <img
                                src={paperTex}
                                alt="paper texture"
                                className="absolute inset-0 w-full h-full object-cover opacity-65 mix-blend-multiply pointer-events-none"
                            />

                            {/* 카드 썸네일: 배경 이미지 우선 */}
                            <div
                                className="w-[94%] h-[160px] mx-auto mt-2 flex items-center justify-center border border-black/40"
                                style={{
                                    background: cardImg
                                        ? `#000 url(${cardImg}) center/cover no-repeat`
                                        : "#000",
                                }}
                            >
                                {/* 404 시 대비 onError 폴백 */}
                                <img
                                    src={cardImg}
                                    alt={s.scenTitle}
                                    className="max-w-full max-h-full object-contain opacity-0"
                                    onError={(e) => {
                                        (
                                            e.currentTarget as HTMLImageElement
                                        ).src = FALLBACK_THUMB;
                                        e.currentTarget.parentElement?.setAttribute(
                                            "style",
                                            `background:#000 url(${FALLBACK_THUMB}) center/cover no-repeat`
                                        );
                                    }}
                                />
                            </div>

                            {/* 제목/난이도 */}
                            <div className="text-stone-600 flex flex-col gap-1 text-center bg-[#e5d3b3] east-sea-dokdo-regular text-[40px] leading-tight">
                                {s.scenTitle}
                                <span className="text-[20px] block">
                                    {renderStars(s.scenLevel)}
                                </span>
                            </div>

                            {/* 핀 */}
                            <svg
                                className="absolute top-0 left-0 w-[30px] h-[30px] z-30 drop-shadow-md"
                                viewBox="0 0 50 50"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <defs>
                                    <radialGradient
                                        id="redPinGradient"
                                        cx="30%"
                                        cy="30%"
                                        r="50%"
                                    >
                                        <stop
                                            offset="0%"
                                            stopColor="#dd8484ff"
                                        />
                                        <stop
                                            offset="100%"
                                            stopColor="#880000ff"
                                        />
                                    </radialGradient>
                                </defs>
                                <circle
                                    cx="25"
                                    cy="25"
                                    r="20"
                                    fill="url(#redPinGradient)"
                                    stroke="#970707ff"
                                    strokeWidth="2"
                                />
                            </svg>

                            {/* 잠금 오버레이 */}
                            {locked && (
                                <div className="absolute -top-1 -left-1 -right-1 -bottom-1 bg-black/60 flex items-center justify-center z-20">
                                    <img
                                        src={lockIcon}
                                        alt="locked"
                                        className="w-10 h-10 object-contain"
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 카드 연결 선(연출) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                <defs>
                    <filter
                        id="innerShadow"
                        x="-50%"
                        y="-50%"
                        width="200%"
                        height="200%"
                    >
                        <feOffset dx="2" dy="2" />
                        <feGaussianBlur stdDeviation="2" result="offset-blur" />
                        <feComposite
                            operator="out"
                            in="SourceGraphic"
                            in2="offset-blur"
                            result="inverse"
                        />
                        <feFlood floodColor="rgba(0,0,0,0.8)" result="color" />
                        <feComposite
                            operator="in"
                            in="color"
                            in2="inverse"
                            result="shadow"
                        />
                        <feComposite
                            operator="over"
                            in="shadow"
                            in2="SourceGraphic"
                        />
                    </filter>
                </defs>

                {lines.map((line, i) => {
                    const midX = (line.x1 + line.x2) / 2;
                    const midY = Math.max(line.y1, line.y2) + 60;
                    const d = `M ${line.x1},${line.y1 + 20} Q ${midX},${
                        midY + 20
                    } ${line.x2},${line.y2 + 20}`;
                    return (
                        <path
                            key={i}
                            d={d}
                            fill="none"
                            stroke="#85000fff"
                            strokeWidth="4"
                            filter="url(#innerShadow)"
                        />
                    );
                })}
            </svg>
        </div>
    );
}
