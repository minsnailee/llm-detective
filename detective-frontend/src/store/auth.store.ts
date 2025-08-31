import { create } from "zustand";

export type User = {
  userIdx?: number;
  userId?: string;
  email?: string;
  nickname?: string;
  role?: "MEMBER" | "EXPERT" | "ADMIN"; // 권한 Enum 값 반영
  expertRequested?: boolean;
};

type AuthState = {
  user?: User | null;
  set: (patch: Partial<AuthState>) => void; // 부분 업데이트 허용
  logout: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  user: undefined,
  set: (patch) => set((s) => ({ ...s, ...patch })), // merge
  logout: () => set({ user: undefined }),
}));
