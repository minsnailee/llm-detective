import { useState } from "react";
import { useAuth } from "../../store/auth.store";
import { api } from "../../shared/api/client";

export default function AccountInfoPage() {
  const { user, set, logout } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [password, setPassword] = useState("");

  const handleUpdateNickname = async () => {
    try {
      await api.post("/users/update-nickname", { nickname });
      alert("닉네임 변경 성공!");
      set({ user: { ...user, nickname } });
    } catch {
      alert("닉네임 변경 실패");
    }
  };

  const handleUpdatePassword = async () => {
    try {
      await api.post("/users/update-password", { password });
      alert("비밀번호 변경 성공!");
      setPassword("");
    } catch {
      alert("비밀번호 변경 실패");
    }
  };

  const handleLogout = () => {
    api.post("/users/logout").finally(() => {
      logout();
      window.location.href = "/login";
    });
  };

  return (
    <div>
      <p>아이디: {user?.userId}</p>
      <p>닉네임: {user?.nickname}</p>
      <p>권한: {user?.role}</p>

      <div style={{ marginTop: 16 }}>
        <label>
          닉네임 변경:
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </label>
        <button onClick={handleUpdateNickname}>변경</button>
      </div>

      <div style={{ marginTop: 16 }}>
        <label>
          비밀번호 변경:
          <input
            type="password"
            value={password}
            placeholder="새 비밀번호 입력"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button onClick={handleUpdatePassword}>변경</button>
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={handleLogout}>로그아웃</button>
      </div>
    </div>
  );
}
