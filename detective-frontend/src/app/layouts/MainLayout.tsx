import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../store/auth.store";

export default function MainLayout() {
    const { token, user, logout } = useAuth();
    const nav = useNavigate();

    const handleLogout = () => {
        logout();
        // nav("/login"); // 로그아웃 시 로그인 페이지로 이동
    };

    return (
        <div>
            <header style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                <Link to="/">Lobby</Link> ·
                <Link to="/scenarios">Scenarios</Link> ·<Link to="/me">My</Link>{" "}
                ·
                {user ? (
                    <>
                        <span style={{ marginLeft: 8 }}>
                            {user?.nickname ?? "User"}님
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
