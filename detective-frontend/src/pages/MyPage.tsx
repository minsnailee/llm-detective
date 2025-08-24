import { useAuth } from "../store/auth.store";
import { api } from "../shared/api/client";
import { useState } from "react";

export default function MyPage() {
  const { user, set, logout } = useAuth();

  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [password, setPassword] = useState("");

  const handleLogout = () => {
    api.post("/users/logout").finally(() => {
      logout();
      window.location.href = "/login";
    });
  };

  const handleUpdateNickname = async () => {
    try {
      const { data } = await api.post("/users/update-nickname", { nickname });
      alert("닉네임 변경 성공!");
      // 서버에서 최신 유저 정보를 반환하지 않고 메시지만 주면:
      set({ user: { ...user, nickname } });
      // 만약 서버에서 UserResponse를 반환한다면:
      // set({ user: data });
    } catch (e) {
      alert("닉네임 변경 실패");
    }
  };

  const handleUpdatePassword = async () => {
    try {
      await api.post("/users/update-password", { password });
      alert("비밀번호 변경 성공!");
      setPassword("");
    } catch (e) {
      alert("비밀번호 변경 실패");
    }
  };

  if (!user) return <div>로그인이 필요합니다.</div>;

  return (
    <div>
      <h2>마이페이지</h2>

      <div>
        <p>아이디: {user.userId}</p>
        <p>닉네임: {user.nickname}</p>
        <p>권한: {user.role}</p>
      </div>

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
