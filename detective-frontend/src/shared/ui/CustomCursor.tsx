import { useEffect, useState } from "react";
import PenCursor from "../../assets/custom_cursor.png";
import PenCursorHover from "../../assets/custom_cursor_hover.png";

export default function CustomCursor() {
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [hovering, setHovering] = useState(false);

    useEffect(() => {
        const move = (e: MouseEvent) => {
            setPos({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener("mousemove", move);

        // hover 감지 (a, button 위일 때)
        const enter = () => setHovering(true);
        const leave = () => setHovering(false);
        document.querySelectorAll("button, a").forEach((el) => {
            el.addEventListener("mouseenter", enter);
            el.addEventListener("mouseleave", leave);
        });

        return () => {
            window.removeEventListener("mousemove", move);
            document.querySelectorAll("button, a").forEach((el) => {
                el.removeEventListener("mouseenter", enter);
                el.removeEventListener("mouseleave", leave);
            });
        };
    }, []);

    return (
        <img
            src={hovering ? PenCursorHover : PenCursor}
            alt="cursor"
            className="custom-cursor"
            style={{ top: pos.y, left: pos.x }}
        />
    );
}
