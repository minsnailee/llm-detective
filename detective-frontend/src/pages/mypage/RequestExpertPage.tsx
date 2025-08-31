import { useAuth } from "../../store/auth.store";
import { api } from "../../shared/api/client";

export default function RequestExpertPage() {
  const { user, set } = useAuth();

  const handleRequestExpert = async () => {
    try {
      await api.post("/users/request-expert");
      alert("전문가 권한 신청 완료!");
      set({ user: { ...user, expertRequested: true } as any });
    } catch {
      alert("전문가 신청 실패");
    }
  };

  if (!user) return null;

  return (
    <div>
      <p>전문가 권한을 신청하면 관리자의 승인이 필요합니다.</p>
      {user.expertRequested ? (
        <p>이미 신청 완료</p>
      ) : (
        <button onClick={handleRequestExpert}>전문가 권한 신청</button>
      )}
    </div>
  );
}
