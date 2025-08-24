import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../store/auth.store";
import { useEffect } from "react";
import { api } from "../../shared/api/client";

export default function MainLayout() {
    const { user, set, logout } = useAuth();
    const nav = useNavigate();

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

    return (
        <div>
            <header style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                <Link to="/">Lobby</Link> ·
                <Link to="/scenarios">Scenarios</Link> ·                <Link to="/my">My</Link>
                ·
                {user ? (
                    <>
                        <span style={{ marginLeft: 8 }}>
                            {user?.nickname ?? "User"}({user?.userId})
                        </span>
                        <button
                            onClick={handleLogout}
                            style={{
                                marginLeft: 8,
                                border: "none",
                                background: "transparent",
                                color: "blue",
                                cursor: "pointer",
                            }}
                        >
                            Logout
                        </button>
                    </>
                ) : (
                    <Link to="/login">Login</Link>
                )}
            </header>
            <main style={{ padding: 16 }}>
                <Outlet />
            </main>
        </div>
    );
}
