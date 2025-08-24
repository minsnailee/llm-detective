import { useState } from "react";
import { api } from "../shared/api/client";
import { useAuth } from "../store/auth.store";
import { Link, useNavigate } from "react-router-dom";

export default function LoginPage() {
    const nav = useNavigate();
    const set = useAuth((s) => s.set);
    const [id, setId] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");

    const submit = (e: any) => {
        e.preventDefault();
        setErr("");
        api.post("/users/login", {
            id,
            password,
        })
            .then(({ data }) => {
                set({ user: data }); // 지금은 세션 기반이라 token 없음
                nav("/");
            })
            .catch((e: any) => {
                setErr("아이디 또는 비밀번호가 올바르지 않습니다.");
            });
    };

    return (
        <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
            <h2>로그인</h2>
            <input
                placeholder="아이디"
                value={id}
                onChange={(e) => setId(e.target.value)}
            />
            <input
                placeholder="비밀번호"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            {err && <div style={{ color: "crimson" }}>{err}</div>}
            <button>로그인</button>
            <Link to="/signup">회원가입</Link>
        </form>
    );
}
