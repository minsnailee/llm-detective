import { NavLink, Outlet } from "react-router-dom";

export default function MyPageLayout() {
  return (
    <div style={{ padding: 20 }}>
      <h2>마이페이지</h2>
      <nav style={{ marginBottom: 20 }}>
        <NavLink to="/my/account" style={{ marginRight: 16 }}>계정 정보</NavLink>
        <NavLink to="/my/history" style={{ marginRight: 16 }}>게임 기록</NavLink>
        <NavLink to="/my/request-expert" style={{ marginRight: 16 }}>전문가 권한 신청</NavLink>
        <NavLink to="/my/expert-scenario">시나리오 작성</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
