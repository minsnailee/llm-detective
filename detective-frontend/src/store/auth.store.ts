import { create } from "zustand";

type User = { id?: number; email?: string; nickname?: string; role?: string };

type AuthState = {
    token?: string | null; // 세션 기반이면 없어도 되는 값
    user?: User | null;
    set: (patch: Partial<AuthState>) => void; // 부분 업데이트 허용
    logout: () => void;
};

export const useAuth = create<AuthState>((set) => ({
    token: undefined,
    user: undefined,
    set: (patch) => set((s) => ({ ...s, ...patch })), // merge
    logout: () => set({ token: undefined, user: undefined }),
}));
