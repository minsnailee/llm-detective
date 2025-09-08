import { BsFillPlayFill } from "react-icons/bs";
import clickSound from "../../assets/sound/sound_click.wav";

interface DetectButtonProps {
    onClick?: () => void;
}

export default function DetectButton({ onClick }: DetectButtonProps) {
    const handleClick = () => {
        const audio = new Audio(clickSound);
        audio.volume = 0.5;
        audio.play();
        if (onClick) onClick();
    };

    return (
        <button
            onClick={handleClick}
            className="
        special-elite-regular relative rounded-[15px] pl-7 pr-3 py-3
        bg-gradient-to-br from-[#ffde7d] via-[#e6a93d] to-[#b86e1a]
        font-bold tracking-wider 
        text-[#fff9e6]                                
        shadow-md shadow-black/50 transition-all duration-200
        active:scale-95 hover:shadow-none
        overflow-hidden
      "
        >
            <span className="relative top-[3px] text-4xl flex items-center gap-3 relative z-10 drop-shadow-[0_0_6px_rgba(0,0,0,0.6)]">
                Detect Now
                <BsFillPlayFill className="mt-[-5px] text-5xl text-[#ffd6798c] shadow-none" />
            </span>

            <span
                className="
    absolute top-[-50%] left-[-120%]
    w-[80px] h-[200%]
    rotate-[20deg]
    animate-[shine_3s_infinite]
    pointer-events-none
  "
                style={{
                    background:
                        "linear-gradient(90deg, transparent, rgba(255,200,120,0.7), transparent)",
                }}
            ></span>
        </button>
    );
}
