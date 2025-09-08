import { useState } from "react";
import bgVideo from "../assets/bg-lobby.mp4";
import pattern from "../assets/textures/dust.png";
import DetectButton from "../shared/ui/DetectButton";
import { useRouteFade } from "../shared/ui/RouteFade";
import { FiLogIn, FiUserPlus } from "react-icons/fi";

export default function LobbyPage() {
    const { fadeTo } = useRouteFade();
    const [clicked, setClicked] = useState(false);

    const handleDetectClick = async () => {
        setClicked(true);
        await fadeTo("/scenarios"); // 원하는 경로로 이동
    };

    return (
        <div className="relative w-full h-screen overflow-hidden">
            {/* 배경 동영상 */}
            <video
                autoPlay
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover filter contrast-200 saturate-300"
                onEnded={(e) => e.currentTarget.pause()} // 끝난 뒤 멈춤 확실히
            >
                <source src={bgVideo} type="video/mp4" />
            </video>

            {/* 어두운 오버레이 */}
            <div className="absolute inset-0 bg-black/75 mix-blend-multiply" />
            <div className="absolute inset-0 bg-yellow-900/40 mix-blend-multiply"></div>

            {/* 필름 그레인 */}
            <div
                className="absolute inset-0 opacity-30"
                style={{
                    backgroundImage: `url(${pattern})`,
                    backgroundRepeat: "repeat",
                    mixBlendMode: "screen",
                }}
            />

            {/* 깜빡임 효과 */}
            <div className="absolute inset-0 bg-black/10 flicker"></div>

            {/* 로고 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                {/* <h1 className="relative text-6xl md:text-[120px] text-[#af9163] special-elite-regular">
                    THE CASE
                    <span className="cursor absolute right-[-60px] top-[10px] text-5xl md:text-[90px]">
                        _
                    </span>
                </h1> */}
                <h1 className="neon text-[130px]" data-text="THE CASE">
                    T<span className="flicker-slow">H</span>E C
                    <span className="flicker-fast">A</span>SE
                </h1>
                <div className="mt-8 flex flex-col items-center gap-4">
                    <DetectButton onClick={handleDetectClick} />

                    <div className=" px-6 py-3 rounded-2xl flex gap-3">
                        <button className="bg-black/50 flex items-center gap-2 text-white px-6 py-2 border border-[#888] rounded-full text-[18px] cutive-mono-regular hover:bg-white/10 transition">
                            <FiLogIn className="text-[20px]" />
                            Sign in
                        </button>
                        <button className="bg-black/50 flex items-center gap-2 text-white px-6 py-2 border border-[#888] rounded-full text-[18px] cutive-mono-regular hover:bg-white/10 transition">
                            <FiUserPlus className="text-[20px]" />
                            Sign up
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
