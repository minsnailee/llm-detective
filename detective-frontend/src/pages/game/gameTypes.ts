// 공통 타입 & 유틸 (미디어 URL, 상수)
// 다른 컴포넌트에서 전부 import 해서 사용합니다.

export interface ScenarioDetail {
    scenIdx: number;
    scenTitle: string;
    scenSummary: string;
    scenLevel: number;
    contentJson?: string;
}

export interface CharacterDoc {
    id?: string;
    name: string;
    age?: number;
    gender?: string;
    job?: string;
    personality?: string;
    speaking_style?: string;
    truth_bias?: number;
    alibi?: any;
    outfit?: string;
    sample_line?: string;
    image?: string;
}

export interface EvidenceDoc {
    id: string;
    name: string;
    desc?: string;
    importance?: "HIGH" | "MEDIUM" | "LOW";
    categories?: string[];
    keywords?: string[];
}

export interface MapDoc {
    background?: string;
    floorplan?: string;
}

export interface ParsedContent {
    scenario?: {
        id?: string;
        title?: string;
        summary?: string;
        difficulty?: number;
        objective?: string;
        rules?: string[];
    };
    map?: MapDoc;
    characters?: CharacterDoc[];
    evidence?: EvidenceDoc[];
    locations?: { id: string; name: string; desc?: string }[];
    timeline?: {
        id: string;
        time: string;
        event: string;
        subjectId?: string;
    }[];
    answer?: {
        culprit?: string;
        motive?: string;
        method?: string;
        key_evidence?: string[];
    };
    evaluation?: any;
}

export interface AskResponse {
    answer: string;
}

export type ChatMsg = {
    id: string;
    ts: number;
    role: "player" | "npc";
    suspectName: string;
    text: string;
};

// ===== 정적 리소스 베이스 도출 & URL 유틸 =====
import { api } from "../../shared/api/client";

// API base에서 '/api' 떼고 정적 리소스 베이스 도출
export const API_BASE = (api.defaults.baseURL || "").replace(/\/+$/, "");
export const ASSET_BASE = API_BASE.replace(/\/api$/, ""); // ex) http://localhost:8090

export function toAbsoluteMediaUrl(raw?: string): string {
    const u = (raw || "").trim();
    if (!u) return "";
    // 이미 절대/데이터 URL이면 그대로
    if (/^(https?:)?\/\//i.test(u) || /^data:|^blob:/i.test(u)) return u;
    // '/uploads/...' 혹은 'uploads/...'
    if (u.startsWith("/uploads/")) return `${ASSET_BASE}${u}`;
    if (u.startsWith("uploads/")) return `${ASSET_BASE}/${u}`;
    // 그 외는 그대로 사용 (컨텐츠가 절대경로를 넣어줄 수도 있음)
    return u;
}
