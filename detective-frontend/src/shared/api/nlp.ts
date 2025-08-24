import { api } from "./client";

// 요청 타입
export interface NlpScoreRequest {
  roomId: string;
  userText: string;
}

// 응답 타입 (Spring → FastAPI → Spring → 프론트)
export interface NlpScoreResponse {
  logic: number;
  creativity: number;
  focus: number;
  diversity: number;
  depth: number;
  keywords: string[];
  evidence: string[];
}

// POST /api/nlp/score 호출
export const postNlpScore = async (data: NlpScoreRequest) => {
  const res = await api.post<NlpScoreResponse>("/api/nlp/score", data);
  return res.data;
};