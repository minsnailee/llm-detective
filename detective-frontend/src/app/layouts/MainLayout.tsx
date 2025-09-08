import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../store/auth.store";
import { useEffect, useState, useRef } from "react";
import { api } from "../../shared/api/client";
import CustomCursor from "../../shared/ui/CustomCursor";
import { RouteFadeProvider } from "../../shared/ui/RouteFade";
import { IoMdSettings } from "react-icons/io";

export default function MainLayout() {
    const { user, set, logout } = useAuth();
    const nav = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const me = async () => {
            try {
                const { data } = await api.get("/users/me");
                set({ user: data });
            } catch (e) {
                // not login
            }
        };
        me();
    }, [set]);

    const handleLogout = () => {
        api.post("/users/logout").finally(() => {
            logout();
            nav("/login");
        });
    };

    // === 외부 클릭 시 닫기 ===
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node)
            ) {
                setMenuOpen(false);
            }
        };
        if (menuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [menuOpen]);

    return (
        <div>
            <CustomCursor />

            {/* 고정 헤더 (우측 상단) */}
            <header ref={menuRef} className="fixed top-5 right-5 z-50">
                <div className="relative">
                    <button
                        onClick={() => setMenuOpen((p) => !p)}
                        className="
                          text-white/65
                          transition-transform duration-150
                          hover:scale-110 active:scale-90
                          focus:outline-none
                        "
                    >
                        <IoMdSettings size={45} />
                    </button>

                    {menuOpen && (
                        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg p-3 z-50">
                            <div className="mb-2">
                                <Link to="/" onClick={() => setMenuOpen(false)}>
                                    🏠 홈으로
                                </Link>
                            </div>

                            {user ? (
                                <>
                                    <div className="mb-2 text-sm text-gray-700">
                                        <strong>
                                            {user?.nickname ?? "User"}
                                        </strong>{" "}
                                        ({user?.userId})
                                    </div>
                                    <div className="mb-2">
                                        <Link
                                            to="/my"
                                            onClick={() => setMenuOpen(false)}
                                        >
                                            👤 마이페이지
                                        </Link>
                                    </div>
                                    <div>
                                        <button
                                            onClick={handleLogout}
                                            className="text-red-600 hover:underline"
                                        >
                                            🚪 로그아웃
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <Link
                                        to="/login"
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        로그인
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>

            <main>
                <RouteFadeProvider>
                    <Outlet />
                </RouteFadeProvider>
            </main>
        </div>
    );
}
