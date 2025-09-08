// ASK API 안전 호출 래퍼
import { api } from "../../shared/api/client";
import type { AskResponse } from "./gameTypes";

export const ASK_ENDPOINTS = [
    "game/ask",
    "/api/game/ask",
    "/game/ask",
] as const;

export async function postAskSafe(payload: {
    sessionId: number;
    suspectName: string;
    userText: string;
}): Promise<string> {
    let lastErr: any = null;
    for (const ep of ASK_ENDPOINTS) {
        try {
            const res = await api.post<AskResponse>(ep, payload);
            return res.data?.answer ?? "";
        } catch (err: any) {
            const s = err?.response?.status;
            if (s === 401 || s === 403 || s === 404) {
                lastErr = err;
                continue;
            }
            throw err;
        }
    }
    throw lastErr ?? new Error("ASK endpoint not reachable");
}
