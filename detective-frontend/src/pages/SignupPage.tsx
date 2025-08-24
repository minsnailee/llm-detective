import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { api } from "../shared/api/client";

export default function SignupPage() {
    const nav = useNavigate();
    const [f, setF] = useState({ id: "", email: "", password: "", passwordConfirm: "", nickname: "" });
    const [msg, setMsg] = useState<string>("");

    const submit = (e: any) => {
        e.preventDefault();
        setMsg("");

        if (f.password !== f.passwordConfirm) {
            setMsg("비밀번호가 일치하지 않습니다.");
            return;
        }

        api.post("/users/signup", {
            id: f.id,
            email: f.email,
            password: f.password,
            nickname: f.nickname
        })
            .then(() => {
                nav('/signup/complete', { state: { id: f.id, nickname: f.nickname } });
            })
            .catch((e: any) => {
                if (e.response && e.response.data) {
                    setMsg(e.response.data);
                } else {
                    setMsg("오류가 발생했습니다.");
                }
            });
    };

    return (
        <form onSubmit={submit} style={{ display: "grid", gap: 8, width: 300, margin: "auto" }}>
            <h2>회원가입</h2>
            <input
                placeholder="아이디"
                value={f.id}
                onChange={(e) => setF({ ...f, id: e.target.value })}
            />
            <input
                placeholder="이메일"
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })}
            />
            <input
                placeholder="닉네임"
                value={f.nickname}
                onChange={(e) => setF({ ...f, nickname: e.target.value })}
            />
            <input
                placeholder="비밀번호"
                type="password"
                value={f.password}
                onChange={(e) => setF({ ...f, password: e.target.value })}
            />
            <input
                placeholder="비밀번호 확인"
                type="password"
                value={f.passwordConfirm}
                onChange={(e) => setF({ ...f, passwordConfirm: e.target.value })}
            />
            {msg && <div style={{ color: msg.includes("완료") ? "blue" : "red" }}>{msg}</div>}
            <button>가입</button>
        </form>
    );
}
