import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../store/auth.store";
import { useEffect } from "react";
import { api } from "../../shared/api/client";

export default function AdminLayout() {
  const { user, set, logout } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    const me = async () => {
      try {
        const { data } = await api.get("/users/me");
        set({ user: data });
      } catch {
        // 세션 만료 시 로그인 페이지로 보내기
        logout();
        nav("/login");
      }
    };
    if (!user) me();
  }, [user, set, logout, nav]);

  return (
    <div style={{ padding: 16 }}>
      <h2>Admin</h2>
      <Outlet />
    </div>
  );
}
