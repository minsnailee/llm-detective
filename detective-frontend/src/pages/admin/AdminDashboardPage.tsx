import { useEffect, useState } from "react";
import { api } from "../../shared/api/client";
import { useAuth } from "../../store/auth.store";

// ================================
// 타입 정의
// ================================
interface User {
  userIdx: number;
  userId: string;
  nickname: string;
  role: "MEMBER" | "EXPERT" | "ADMIN";
  expertRequested?: boolean;
}

interface Scenario {
  scenIdx: number;
  scenTitle: string;
  scenSummary: string;
  scenLevel: number;
  scenAccess: "FREE" | "MEMBER";
  scenStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

// ================================
// 관리자 대시보드 컴포넌트
// ================================
export default function AdminDashboardPage() {
  const { user } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingScenarios, setLoadingScenarios] = useState(false);

  // 상태 필터
  const [filter, setFilter] = useState<"ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED">("ALL");

  // ------------------------------
  // 데이터 가져오기
  // ------------------------------
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const { data } = await api.get<User[]>("/admin/users");
      setUsers(data);
    } catch (e) {
      console.error("유저 목록 불러오기 실패:", e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchScenarios = async (status?: string) => {
    try {
      setLoadingScenarios(true);
      const url =
        status && status !== "ALL"
          ? `/admin/scenarios/status/${status}`
          : `/admin/scenarios`;
      const { data } = await api.get<Scenario[]>(url);
      setScenarios(data);
    } catch (e) {
      console.error("시나리오 목록 불러오기 실패:", e);
    } finally {
      setLoadingScenarios(false);
    }
  };

  useEffect(() => {
    if (user?.role === "ADMIN") {
      fetchUsers();
      fetchScenarios(filter);
    }
  }, [user, filter]);

  // ------------------------------
  // 유저 관련 액션
  // ------------------------------
  const handleApproveExpert = async (userId: number) => {
    try {
      await api.post(`/users/approve-expert/${userId}`);
      alert("전문가 권한 승인 완료");
      setUsers((prev) =>
        prev.map((u) =>
          u.userIdx === userId ? { ...u, role: "EXPERT", expertRequested: false } : u
        )
      );
    } catch (e) {
      alert("승인 실패");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.userIdx !== userId));
    } catch (e) {
      alert("삭제 실패");
    }
  };

  // ------------------------------
  // 시나리오 관련 액션
  // ------------------------------
  const handleApproveScenario = async (id: number) => {
    try {
      await api.post(`/admin/scenarios/${id}/approve`);
      alert("시나리오 승인 완료");
      setScenarios((prev) =>
        prev.map((s) =>
          s.scenIdx === id ? { ...s, scenStatus: "PUBLISHED" } : s
        )
      );
    } catch (e) {
      alert("승인 실패");
    }
  };

  const handleRejectScenario = async (id: number) => {
    try {
      await api.post(`/admin/scenarios/${id}/reject`);
      alert("시나리오 반려 완료");
      setScenarios((prev) =>
        prev.map((s) =>
          s.scenIdx === id ? { ...s, scenStatus: "ARCHIVED" } : s
        )
      );
    } catch (e) {
      alert("반려 실패");
    }
  };

  const handleDeleteScenario = async (id: number) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    try {
      await api.delete(`/admin/scenarios/${id}`);
      setScenarios((prev) => prev.filter((s) => s.scenIdx !== id));
    } catch (e) {
      alert("삭제 실패");
    }
  };

  // ------------------------------
  // 렌더링
  // ------------------------------
  if (!user || user.role !== "ADMIN") {
    return <div>관리자 권한이 필요합니다.</div>;
  }

  return (
    <div>
      <h2>관리자 대시보드</h2>

      {/* 유저 관리 섹션 */}
      <section>
        <h3>유저 관리</h3>
        {loadingUsers && <p>유저 로딩 중...</p>}
        <table border={1} cellPadding={8}>
          <thead>
            <tr>
              <th>ID</th>
              <th>닉네임</th>
              <th>권한</th>
              <th>전문가 신청 여부</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userIdx}>
                <td>{u.userId}</td>
                <td>{u.nickname}</td>
                <td>{u.role}</td>
                <td>{u.expertRequested ? "신청함" : "-"}</td>
                <td>
                  {u.expertRequested && u.role === "MEMBER" && (
                    <button onClick={() => handleApproveExpert(u.userIdx)}>
                      전문가 승인
                    </button>
                  )}
                  <button onClick={() => handleDeleteUser(u.userIdx)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 시나리오 관리 섹션 */}
      <section style={{ marginTop: 24 }}>
        <h3>시나리오 관리</h3>
        {loadingScenarios && <p>시나리오 로딩 중...</p>}

        {/* 상태 필터 */}
        <div style={{ marginBottom: 12 }}>
          <label>상태 필터: </label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="ALL">전체</option>
            <option value="DRAFT">DRAFT (대기)</option>
            <option value="PUBLISHED">PUBLISHED (승인됨)</option>
            <option value="ARCHIVED">ARCHIVED (반려됨)</option>
          </select>
        </div>

        <table border={1} cellPadding={8}>
          <thead>
            <tr>
              <th>ID</th>
              <th>제목</th>
              <th>상태</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={s.scenIdx}>
                <td>{s.scenIdx}</td>
                <td>{s.scenTitle}</td>
                <td>{s.scenStatus}</td>
                <td>
                  {s.scenStatus === "DRAFT" && (
                    <>
                      <button onClick={() => handleApproveScenario(s.scenIdx)}>
                        승인
                      </button>
                      <button onClick={() => handleRejectScenario(s.scenIdx)}>
                        반려
                      </button>
                    </>
                  )}
                  <button onClick={() => handleDeleteScenario(s.scenIdx)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
