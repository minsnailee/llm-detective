import type { FC, ReactNode } from "react";
import { useMemo, useState } from "react";
import { api } from "../../shared/api/client";
import { useAuth } from "../../store/auth.store";

/**
 * ============================================
 * Design Notes (꼭 읽어주세요)
 * --------------------------------------------
 * • 모든 대화 가능한 NPC는 "용의자(suspect)"입니다. (role 혼란 X)
 * • 피해자/증인/동료 등은 relation_tags로 표현합니다. (다중 선택 가능)
 * • 저장되는 contentJson은 백엔드 컨트롤러가 기대하는 필드명/구조와 호환됩니다.
 *   - characters[].id = "suspect_1" ... (index 기반 일관 규칙)
 *   - evidence[].id   = "e1", "e2" ...
 *   - locations[].id  = "loc_1", "loc_2" ...
 *   - timeline[].id   = "t_1", "t_2" ...
 * • 폼 내부에서의 항목 추가/삭제로 인덱스가 바뀌어도,
 *   최종 저장 시 위 규칙으로 다시 "정규화된" ID를 부여합니다.
 *   (UI에서는 clientId로 안정적인 key를 유지)
 *
 * • 증거 카테고리는 도메인 불문 범용(Core) 카테고리 사용:
 *   time, location, person, motive, method, access, alibi,
 *   forensics_physical, forensics_digital, financial, communications, inconsistency
 *   (이전 "출입 기록"은 access로 일반화)
 *
 * • 증거는 keywords 필드를 추가 지원.
 *   - 예: ["CCTV", "출입기록", "장갑"] 처럼 별칭/동의어를 넣어두면
 *     백엔드의 트리거 탐지가 더 잘 작동합니다.
 *
 * • 이미지 업로드 정책(이번 버전):
 *   - 파일 선택 시 서버에 업로드하지 않습니다(미리보기만 blob: URL 또는 기존 URL).
 *   - 제출 버튼을 눌렀을 때만 /media/upload 로 업로드 → 받은 URL을 contentJson에 주입하여 저장합니다.
 * • “JSON 불러오기” 기능:
 *   - contentJson 전체를 붙여넣고 가져오면 폼에 역주입됩니다.
 * ============================================
 */

type Importance = "high" | "medium" | "low";

type EvidenceCategoryId =
    | "time"
    | "location"
    | "person"
    | "motive"
    | "method"
    | "access"
    | "alibi"
    | "forensics_physical"
    | "forensics_digital"
    | "financial"
    | "communications"
    | "inconsistency";

const CORE_TAGS: { id: EvidenceCategoryId; label: string }[] = [
    { id: "time", label: "시간" },
    { id: "location", label: "장소" },
    { id: "person", label: "인물/관계" },
    { id: "motive", label: "동기" },
    { id: "method", label: "수법/도구" },
    { id: "access", label: "접근/기회" },
    { id: "alibi", label: "알리바이" },
    { id: "forensics_physical", label: "물리 포렌식" },
    { id: "forensics_digital", label: "디지털 포렌식" },
    { id: "financial", label: "금융/거래" },
    { id: "communications", label: "통신/연락" },
    { id: "inconsistency", label: "모순/불일치" },
];

// ===== Characters =====
type CharacterForm = {
    clientId: string; // UI key용 안정 ID
    name: string;
    occupation: string;
    personality: string;
    alibi_where: string;
    alibi_time_range: string;
    alibi_details: string;
    mission: string;
    speech_style: string;
    truth_tendency: string; // "0.7" 형태 문자열 입력
    outfit: string;
    sample_line: string;
    relation_tags: string[]; // ["피해자"], ["증인"], ...
    image?: string; // 서버 URL(제출 시 세팅)
    age?: string;
    gender?: "남성" | "여성" | "";
};

// ===== Evidence/Clues =====
type ClueForm = {
    clientId: string; // UI key용 안정 ID
    name: string;
    description: string;
    importance: Importance;
    categories: EvidenceCategoryId[]; // 범용 카테고리
    keywords: string[]; // 별칭/동의어
};

// ===== Locations =====
type LocationForm = {
    clientId: string; // UI key용 안정 ID
    name: string;
    description: string;
};

// ===== Timeline =====
type TimelineForm = {
    clientId: string; // UI key용 안정 ID
    time: string;
    event: string;
    subjectId?: string; // 예: "suspect_1" (선택)
};

// ===== 공통 유틸: UI key용 안정 ID =====
const makeClientId = (prefix: string) =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ===== 기본 룰 & 평가템플릿 =====
const DEFAULT_RULES = [
    "범인은 스스로 정체를 밝히지 않는다.",
    "플레이어가 특정 시간/장소/증거를 제시할 때만 세부 공개.",
    "세계관/말투/성격은 끝까지 유지한다.",
];

const DEFAULT_EVALUATION = {
    logic: ["타임라인 연결 질문", "증거 기반 추론 질문"],
    creativity: ["새로운 시각에서 질문", "정황과 관계 결합"],
    focus: ["사건 핵심 관련 질문 비율"],
    diversity: ["여러 인물에게 질문", "질문 패턴 변화"],
    depth: ["인과관계·맥락 파고듦", "왜/어떻게(why/how) 질문"],
};

const RELATION_TAG_OPTIONS = [
    "피해자",
    "증인",
    "동료",
    "가족",
    "경비원",
    "이웃",
];

// ===== 이미지 업로드 Helper =====
async function uploadFileToServer(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    // api의 baseURL이 "/api" 라면 "/media/upload"로 호출하면 실제 "/api/media/upload"가 됩니다.
    const res = await api.post<string>("/media/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
    });
    // 서버는 "/uploads/xxx" 형태의 URL 문자열을 반환
    return res.data;
}

// ===== JSON Import Helpers =====
function toStr(v: any, def = ""): string {
    return typeof v === "string" ? v : def;
}
function toNum(v: any, def = 0): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
}
function toArr<T = any>(v: any): T[] {
    return Array.isArray(v) ? (v as T[]) : [];
}
function idNumFrom(pattern: RegExp, s?: string | null): number | null {
    if (!s || typeof s !== "string") return null;
    const m = s.match(pattern);
    return m && m[1] ? Number(m[1]) : null;
}

export default function ExpertScenarioPage() {
    const { user } = useAuth();

    // ===== 상수 =====
    const SUMMARY_MAX = 300; // 리스트/검색용 문장
    const CASE_SUMMARY_MAX = 300; // LLM 프롬프트용 짧은 요약
    const CASE_SUMMARY_WARN = 100;

    // ===== Meta =====
    const [title, setTitle] = useState("");
    const [summary, setSummary] = useState("");
    const [level, setLevel] = useState(1);
    const [caseSummary, setCaseSummary] = useState("");
    const [objective, setObjective] = useState(
        "범인, 동기, 수법을 특정하고 핵심 증거를 제시하라."
    );
    const [rules, setRules] = useState<string[]>([...DEFAULT_RULES]);
    const [scenAccess, setScenAccess] = useState<"FREE" | "MEMBER">("FREE");

    // ===== Characters =====
    const [characters, setCharacters] = useState<CharacterForm[]>([
        {
            clientId: makeClientId("char"),
            name: "",
            occupation: "",
            personality: "",
            alibi_where: "",
            alibi_time_range: "",
            alibi_details: "",
            mission: "",
            speech_style: "",
            truth_tendency: "0.7",
            outfit: "",
            sample_line: "",
            relation_tags: [],
        },
        {
            clientId: makeClientId("char"),
            name: "",
            occupation: "",
            personality: "",
            alibi_where: "",
            alibi_time_range: "",
            alibi_details: "",
            mission: "",
            speech_style: "",
            truth_tendency: "0.7",
            outfit: "",
            sample_line: "",
            relation_tags: [],
        },
    ]);
    const canAddCharacter = characters.length < 5;

    // 캐릭터 이미지: 파일 선택만 하고 제출 시 업로드
    const [pendingCharImages, setPendingCharImages] = useState<
        Record<string, { file?: File; preview: string }>
    >({});

    // ===== Evidence / Locations / Timeline =====
    const [clues, setClues] = useState<ClueForm[]>([
        {
            clientId: makeClientId("clue"),
            name: "",
            description: "",
            importance: "medium",
            categories: [],
            keywords: [],
        },
    ]);

    const [locations, setLocations] = useState<LocationForm[]>([
        { clientId: makeClientId("loc"), name: "", description: "" },
    ]);

    const [timeline, setTimeline] = useState<TimelineForm[]>([
        {
            clientId: makeClientId("time"),
            time: "",
            event: "",
            subjectId: undefined,
        },
    ]);

    // ===== Answer =====
    const [culpritIndex, setCulpritIndex] = useState<number>(0);
    const [answerMotive, setAnswerMotive] = useState("");
    const [answerMethod, setAnswerMethod] = useState("");
    const [answerKeyEvidenceIds, setAnswerKeyEvidenceIds] = useState<string[]>(
        []
    );

    // ===== Map Images (배경/도면) - 파일 선택만, 제출 시 업로드 =====
    const [pendingMapBg, setPendingMapBg] = useState<{
        file?: File;
        preview: string;
    } | null>(null);
    const [pendingFloorplan, setPendingFloorplan] = useState<{
        file?: File;
        preview: string;
    } | null>(null);

    // ===== Characters - handlers =====
    const addCharacter = () => {
        if (!canAddCharacter) return;
        setCharacters((prev) => [
            ...prev,
            {
                clientId: makeClientId("char"),
                name: "",
                occupation: "",
                personality: "",
                alibi_where: "",
                alibi_time_range: "",
                alibi_details: "",
                mission: "",
                speech_style: "",
                truth_tendency: "0.7",
                outfit: "",
                sample_line: "",
                relation_tags: [],
            },
        ]);
    };

    const updateCharacter = (
        index: number,
        field: keyof CharacterForm,
        value: string | string[]
    ) => {
        const updated = [...characters];
        (updated[index] as any)[field] = value;
        setCharacters(updated);
    };

    const removeCharacter = (index: number) => {
        if (characters.length <= 2) {
            alert("용의자는 최소 2명이어야 합니다.");
            return;
        }
        const removed = characters[index];
        // 해당 캐릭터의 pending 이미지도 제거
        setPendingCharImages((prev) => {
            const next = { ...prev };
            delete next[removed.clientId];
            return next;
        });

        const updated = characters.filter((_, i) => i !== index);
        setCharacters(updated);
        if (culpritIndex >= updated.length)
            setCulpritIndex(Math.max(0, updated.length - 1));
    };

    const toggleRelationTag = (index: number, tag: string) => {
        const updated = [...characters];
        const tags = new Set(updated[index].relation_tags);
        if (tags.has(tag)) tags.delete(tag);
        else tags.add(tag);
        updated[index].relation_tags = Array.from(tags);
        setCharacters(updated);
    };

    // 캐릭터 이미지: 파일 선택 시 서버 업로드 하지 않고, 임시 저장만
    const handleCharacterFilePick = (i: number, file: File) => {
        const preview = URL.createObjectURL(file);
        const cid = characters[i].clientId;
        setPendingCharImages((prev) => ({ ...prev, [cid]: { file, preview } }));
    };

    // ===== Clues - handlers =====
    const addClue = () => {
        setClues((prev) => [
            ...prev,
            {
                clientId: makeClientId("clue"),
                name: "",
                description: "",
                importance: "medium",
                categories: [],
                keywords: [],
            },
        ]);
    };

    const updateClue = (index: number, field: keyof ClueForm, value: any) => {
        const updated = [...clues];
        (updated[index] as any)[field] = value;
        setClues(updated);
    };

    const toggleClueCategory = (index: number, cat: EvidenceCategoryId) => {
        const updated = [...clues];
        const set = new Set(updated[index].categories);
        if (set.has(cat)) set.delete(cat);
        else set.add(cat);
        updated[index].categories = Array.from(set);
        setClues(updated);
    };

    const updateClueKeywordsText = (index: number, text: string) => {
        const parts = text
            .split(/[,|\n]/g)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        updateClue(index, "keywords", parts);
    };

    const removeClue = (index: number) => {
        const updated = clues.filter((_, i) => i !== index);
        setClues(updated);
        const remainingIds = updated.map((_, i2) => `e${i2 + 1}`);
        setAnswerKeyEvidenceIds((prev) =>
            prev.filter((id) => remainingIds.includes(id))
        );
    };

    // ===== Locations - handlers =====
    const addLocation = () => {
        setLocations((prev) => [
            ...prev,
            { clientId: makeClientId("loc"), name: "", description: "" },
        ]);
    };

    const updateLocation = (
        index: number,
        field: keyof LocationForm,
        value: string
    ) => {
        const updated = [...locations];
        (updated[index] as any)[field] = value;
        setLocations(updated);
    };

    const removeLocation = (index: number) => {
        setLocations(locations.filter((_, i) => i !== index));
    };

    // ===== Timeline - handlers =====
    const addTimeline = () => {
        setTimeline((prev) => [
            ...prev,
            {
                clientId: makeClientId("time"),
                time: "",
                event: "",
                subjectId: undefined,
            },
        ]);
    };

    const updateTimeline = (
        index: number,
        field: keyof TimelineForm,
        value: string
    ) => {
        const updated = [...timeline];
        (updated[index] as any)[field] = value;
        setTimeline(updated);
    };

    const removeTimeline = (index: number) => {
        setTimeline(timeline.filter((_, i) => i !== index));
    };

    // ===== Rules - handlers =====
    const addRule = () => setRules([...rules, ""]);
    const updateRule = (i: number, v: string) => {
        const list = [...rules];
        list[i] = v;
        setRules(list);
    };
    const removeRule = (i: number) =>
        setRules(rules.filter((_, idx) => idx !== i));

    // ===== Build contentJson (미리보기용: blob/URL 프리뷰 반영) =====
    const culpritId = useMemo(
        () => `suspect_${culpritIndex + 1}`,
        [culpritIndex]
    );

    const contentObj = useMemo(() => {
        const characterDocs = characters.map((c, i) => {
            const pending = pendingCharImages[c.clientId];
            return {
                id: `suspect_${i + 1}`,
                npc_kind: "suspect",
                name: c.name,
                age: c.age ? Number(c.age) : undefined,
                gender: c.gender || undefined,
                job: c.occupation,
                personality: c.personality,
                speaking_style: c.speech_style,
                truth_bias: Number(c.truth_tendency) || 0.7,
                relation_tags: c.relation_tags,
                alibi: {
                    where: c.alibi_where,
                    time_range: c.alibi_time_range,
                    details: c.alibi_details,
                },
                mission: c.mission || "자신의 무고함을 주장하라",
                outfit: c.outfit || "",
                sample_line: c.sample_line || "",
                // 미리보기엔 blob: 프리뷰 또는 기존 URL을 넣고, 제출 시 실제 URL로 치환됩니다.
                image: pending?.preview || c.image || undefined,
            };
        });

        const evidenceDocs = clues.map((cl, i) => ({
            id: `e${i + 1}`,
            name: cl.name || `단서 ${i + 1}`,
            desc: cl.description,
            importance: cl.importance.toUpperCase(),
            categories: cl.categories,
            keywords: cl.keywords,
        }));

        const locationDocs = locations.map((loc, i) => ({
            id: `loc_${i + 1}`,
            name: loc.name,
            desc: loc.description,
        }));

        const timelineDocs = timeline.map((t, i) => ({
            id: `t_${i + 1}`,
            time: t.time,
            event: t.event,
            subjectId:
                t.subjectId && t.subjectId.trim() !== ""
                    ? t.subjectId
                    : undefined,
        }));

        return {
            scenario: {
                id: `scen_${Date.now()}`,
                title,
                summary: caseSummary || summary,
                difficulty: level,
                objective,
                rules: rules.filter((r) => r && r.trim() !== ""),
            },
            // 지도/도면: 미리보기엔 blob/URL 프리뷰를, 제출 시 서버 URL로 치환
            map: {
                background: pendingMapBg?.preview || undefined,
                floorplan: pendingFloorplan?.preview || undefined,
            },
            locations: locationDocs,
            timeline: timelineDocs,
            characters: characterDocs,
            evidence: evidenceDocs,
            answer: {
                culprit: culpritId,
                motive: answerMotive,
                method: answerMethod,
                key_evidence: answerKeyEvidenceIds,
            },
            evaluation: { ...DEFAULT_EVALUATION },
        };
    }, [
        characters,
        clues,
        locations,
        timeline,
        title,
        summary,
        caseSummary,
        level,
        objective,
        rules,
        culpritId,
        answerMotive,
        answerMethod,
        answerKeyEvidenceIds,
        pendingCharImages,
        pendingMapBg,
        pendingFloorplan,
    ]);

    const contentJsonPretty = useMemo(
        () => JSON.stringify(contentObj, null, 2),
        [contentObj]
    );

    // ===== Validation =====
    const validationErrors = useMemo(() => {
        const errs: string[] = [];
        if (!title.trim()) errs.push("제목을 입력하세요.");
        if (characters.length < 2) errs.push("용의자는 최소 2명이어야 합니다.");
        if (characters.some((c) => !c.name.trim()))
            errs.push("모든 캐릭터의 이름을 입력하세요.");
        if (clues.length < 1) errs.push("단서는 최소 1개 이상이어야 합니다.");
        if (timeline.length < 1)
            errs.push("타임라인은 최소 1개 이상이어야 합니다.");
        if (!answerMotive.trim()) errs.push("정답 동기를 입력하세요.");
        if (!answerMethod.trim()) errs.push("정답 수법을 입력하세요.");
        return errs;
    }, [title, characters, clues, timeline, answerMotive, answerMethod]);

    const canSubmit = validationErrors.length === 0;

    // ===== Submit (여기서만 실제 업로드 수행) =====
    const handleCreateScenario = async () => {
        if (!canSubmit) {
            alert("입력값을 확인해주세요.\n- " + validationErrors.join("\n- "));
            return;
        }
        try {
            // 1) 캐릭터 이미지 업로드
            const charactersCopy = [...characters];
            for (let i = 0; i < charactersCopy.length; i++) {
                const c = charactersCopy[i];
                const pending = pendingCharImages[c.clientId];
                if (pending?.file) {
                    const url = await uploadFileToServer(pending.file); // "/uploads/xxx"
                    charactersCopy[i] = { ...c, image: url };
                }
            }

            // 2) 지도/도면 업로드
            let mapBgUrl: string | undefined = undefined;
            let floorplanUrl: string | undefined = undefined;
            if (pendingMapBg?.file) {
                mapBgUrl = await uploadFileToServer(pendingMapBg.file);
            }
            if (pendingFloorplan?.file) {
                floorplanUrl = await uploadFileToServer(pendingFloorplan.file);
            }

            // 3) 최종 contentJson 재구성 (실제 URL 반영)
            const finalContent = (() => {
                // characters
                const characterDocs = charactersCopy.map((c, i) => ({
                    id: `suspect_${i + 1}`,
                    npc_kind: "suspect",
                    name: c.name,
                    age: c.age ? Number(c.age) : undefined,
                    gender: c.gender || undefined,
                    job: c.occupation,
                    personality: c.personality,
                    speaking_style: c.speech_style,
                    truth_bias: Number(c.truth_tendency) || 0.7,
                    relation_tags: c.relation_tags,
                    alibi: {
                        where: c.alibi_where,
                        time_range: c.alibi_time_range,
                        details: c.alibi_details,
                    },
                    mission: c.mission || "자신의 무고함을 주장하라",
                    outfit: c.outfit || "",
                    sample_line: c.sample_line || "",
                    image: c.image, // 업로드된 서버 URL
                }));

                const evidenceDocs = clues.map((cl, i) => ({
                    id: `e${i + 1}`,
                    name: cl.name || `단서 ${i + 1}`,
                    desc: cl.description,
                    importance: cl.importance.toUpperCase(),
                    categories: cl.categories,
                    keywords: cl.keywords,
                }));

                const locationDocs = locations.map((loc, i) => ({
                    id: `loc_${i + 1}`,
                    name: loc.name,
                    desc: loc.description,
                }));

                const timelineDocs = timeline.map((t, i) => ({
                    id: `t_${i + 1}`,
                    time: t.time,
                    event: t.event,
                    subjectId:
                        t.subjectId && t.subjectId.trim() !== ""
                            ? t.subjectId
                            : undefined,
                }));

                return {
                    scenario: {
                        id: `scen_${Date.now()}`,
                        title,
                        summary: caseSummary || summary,
                        difficulty: level,
                        objective,
                        rules: rules.filter((r) => r && r.trim() !== ""),
                    },
                    map: {
                        background: mapBgUrl,
                        floorplan: floorplanUrl,
                    },
                    locations: locationDocs,
                    timeline: timelineDocs,
                    characters: characterDocs,
                    evidence: evidenceDocs,
                    answer: {
                        culprit: `suspect_${culpritIndex + 1}`,
                        motive: answerMotive,
                        method: answerMethod,
                        key_evidence: answerKeyEvidenceIds,
                    },
                    evaluation: { ...DEFAULT_EVALUATION },
                };
            })();

            // 4) 시나리오 저장
            await api.post("/scenarios/create", {
                scenTitle: title,
                scenSummary: summary,
                scenLevel: level,
                scenAccess: scenAccess, // FREE or MEMBER
                contentJson: JSON.stringify(finalContent),
            });

            alert("시나리오 작성 성공!");

            // (선택) 임시 상태 초기화
            // setPendingCharImages({});
            // setPendingMapBg(null);
            // setPendingFloorplan(null);
        } catch (e) {
            console.error(e);
            alert("시나리오 작성 실패");
        }
    };

    // ===== JSON Import UI & Logic =====
    const [importText, setImportText] = useState("");
    const [importError, setImportError] = useState<string | null>(null);

    function loadContentJson(obj: any) {
        try {
            setImportError(null);

            // ---- scenario/meta ----
            const sc = obj?.scenario ?? {};
            setTitle(toStr(sc.title));
            setSummary(toStr(sc.summary));
            setLevel(toNum(sc.difficulty, 1));
            setObjective(
                toStr(
                    sc.objective,
                    "범인, 동기, 수법을 특정하고 핵심 증거를 제시하라."
                )
            );
            setRules(
                toArr<string>(sc.rules).filter((r) => toStr(r).trim() !== "")
            );

            // ---- map(images) : URL을 미리보기로 바로 사용 ----
            const map = obj?.map ?? {};
            if (map.background) {
                setPendingMapBg({ preview: String(map.background) });
            } else {
                setPendingMapBg(null);
            }
            if (map.floorplan) {
                setPendingFloorplan({ preview: String(map.floorplan) });
            } else {
                setPendingFloorplan(null);
            }

            // ---- locations ----
            const locs = toArr<any>(obj?.locations).map((loc: any) => ({
                clientId: makeClientId("loc"),
                name: toStr(loc.name),
                description: toStr(loc.desc),
            }));
            setLocations(
                locs.length
                    ? locs
                    : [
                          {
                              clientId: makeClientId("loc"),
                              name: "",
                              description: "",
                          },
                      ]
            );

            // ---- timeline ----
            const tls = toArr<any>(obj?.timeline).map((t: any) => ({
                clientId: makeClientId("time"),
                time: toStr(t.time),
                event: toStr(t.event),
                subjectId: toStr(t.subjectId) || undefined,
            }));
            setTimeline(
                tls.length
                    ? tls
                    : [
                          {
                              clientId: makeClientId("time"),
                              time: "",
                              event: "",
                              subjectId: undefined,
                          },
                      ]
            );

            // ---- characters ----
            const chars = toArr<any>(obj?.characters);
            const charForms: CharacterForm[] = chars.map((c: any) => ({
                clientId: makeClientId("char"),
                name: toStr(c.name),
                occupation: toStr(c.job),
                personality: toStr(c.personality),
                alibi_where: toStr(c?.alibi?.where),
                alibi_time_range: toStr(c?.alibi?.time_range),
                alibi_details: toStr(c?.alibi?.details),
                mission: toStr(c.mission),
                speech_style: toStr(c.speaking_style),
                truth_tendency: String(
                    Number.isFinite(Number(c.truth_bias))
                        ? Number(c.truth_bias)
                        : 0.7
                ),
                outfit: toStr(c.outfit),
                sample_line: toStr(c.sample_line),
                relation_tags: toArr<string>(c.relation_tags),
                image: c.image ? String(c.image) : undefined,
                age:
                    typeof c.age === "number"
                        ? String(c.age)
                        : toStr(c.age || ""),
                gender: ((): "남성" | "여성" | "" => {
                    const g = toStr(c.gender);
                    if (g === "남성" || g.toLowerCase() === "male")
                        return "남성";
                    if (g === "여성" || g.toLowerCase() === "female")
                        return "여성";
                    return "";
                })(),
            }));

            // 최소 2명 유지
            setCharacters(
                charForms.length >= 2
                    ? charForms
                    : [
                          {
                              clientId: makeClientId("char"),
                              name: "",
                              occupation: "",
                              personality: "",
                              alibi_where: "",
                              alibi_time_range: "",
                              alibi_details: "",
                              mission: "",
                              speech_style: "",
                              truth_tendency: "0.7",
                              outfit: "",
                              sample_line: "",
                              relation_tags: [],
                          },
                          {
                              clientId: makeClientId("char"),
                              name: "",
                              occupation: "",
                              personality: "",
                              alibi_where: "",
                              alibi_time_range: "",
                              alibi_details: "",
                              mission: "",
                              speech_style: "",
                              truth_tendency: "0.7",
                              outfit: "",
                              sample_line: "",
                              relation_tags: [],
                          },
                      ]
            );

            // ---- evidence/clues ----
            const evs = toArr<any>(obj?.evidence).map((e: any, i: number) => {
                const imp = toStr(e.importance).toLowerCase() as Importance;
                const normalized: Importance = [
                    "high",
                    "medium",
                    "low",
                ].includes(imp)
                    ? imp
                    : "medium";
                return {
                    clientId: makeClientId("clue"),
                    name: toStr(e.name) || `단서 ${i + 1}`,
                    description: toStr(e.desc),
                    importance: normalized,
                    categories: toArr<string>(
                        e.categories
                    ) as EvidenceCategoryId[],
                    keywords: toArr<string>(e.keywords),
                } as ClueForm;
            });
            setClues(
                evs.length
                    ? evs
                    : [
                          {
                              clientId: makeClientId("clue"),
                              name: "",
                              description: "",
                              importance: "medium",
                              categories: [],
                              keywords: [],
                          },
                      ]
            );

            // ---- answer (범인/동기/수법/핵심증거) ----
            const ans = obj?.answer ?? {};
            const culpritIdStr = toStr(ans.culprit);
            // culprit 형식 "suspect_3" → index 2
            const cIdx = ((): number => {
                const n = idNumFrom(/^suspect_(\d+)$/i, culpritIdStr);
                return n && n > 0 ? n - 1 : 0;
            })();
            setCulpritIndex(cIdx);
            setAnswerMotive(toStr(ans.motive));
            setAnswerMethod(toStr(ans.method));
            setAnswerKeyEvidenceIds(toArr<string>(ans.key_evidence));

            // 캐릭터 미리보기 이미지 pending 초기화 (URL은 CharacterForm.image로 이미 반영했으니 비움)
            setPendingCharImages({});
        } catch (e: any) {
            console.error(e);
            setImportError(
                "JSON을 해석하는 중 오류가 발생했습니다. 형식을 확인해주세요."
            );
        }
    }

    function handleImportJson() {
        try {
            const obj = JSON.parse(importText);
            loadContentJson(obj);
            alert("JSON 가져오기 완료! 폼에 반영되었습니다.");
        } catch (e: any) {
            console.error(e);
            setImportError("JSON 파싱 실패: 올바른 JSON인지 확인해주세요.");
        }
    }

    // ===== Render helper =====
    const Label: FC<{ children: ReactNode; tip?: string }> = ({
        children,
        tip,
    }) => (
        <label style={{ display: "block", marginTop: 8 }}>
            {children}
            {tip && (
                <span
                    title={tip}
                    aria-label="도움말"
                    style={{ marginLeft: 6, cursor: "help", fontWeight: 700 }}
                >
                    ❓
                </span>
            )}
        </label>
    );

    // ===== Guard =====
    if (!user || (user.role !== "EXPERT" && user.role !== "ADMIN")) {
        return <div>전문가 권한이 필요한 메뉴입니다.</div>;
    }

    // ===== UI =====
    return (
        <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
            <h2>시나리오 작성</h2>

            <div style={{ display: "grid", gap: 8 }}>
                <Label tip="카드/목록에 표시되는 간단한 설명입니다.">
                    제목
                </Label>
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="예: 사라진 고서"
                />

                <Label tip="검색/리스트 용 개요입니다. 1~2문장 권장.">
                    사건 개요
                </Label>
                <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="예: 도서관에서 귀중한 고서 한 권이 사라졌다."
                    maxLength={SUMMARY_MAX}
                />
                <small>
                    {summary.length}/{SUMMARY_MAX}자
                </small>

                <Label>난이도</Label>
                <select
                    value={level}
                    onChange={(e) => setLevel(Number(e.target.value))}
                >
                    <option value={1}>쉬움</option>
                    <option value={2}>보통</option>
                    <option value={3}>어려움</option>
                </select>

                <Label tip="LLM 프롬프트용 핵심 요약입니다. 사실관계 위주로 짧게.">
                    사건 요약
                </Label>
                <textarea
                    value={caseSummary}
                    onChange={(e) => setCaseSummary(e.target.value)}
                    placeholder="예: 2025년 1월 12일, 도서관에서 귀중한 고서가 사라졌다."
                    maxLength={CASE_SUMMARY_MAX}
                    style={{
                        borderColor:
                            caseSummary.length > CASE_SUMMARY_WARN
                                ? "orange"
                                : undefined,
                    }}
                />
                <small>
                    {caseSummary.length}/{CASE_SUMMARY_MAX}자
                </small>

                <Label tip="플레이어 목표와 성공 조건을 명확히 적어주세요.">
                    목표(Objective)
                </Label>
                <input
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    placeholder="예: 범인, 동기, 수법을 특정하고 핵심 증거를 제시하라."
                />

                <Label tip="대화 중 AI 캐릭터가 반드시 지켜야 할 세계관 규칙입니다.">
                    규칙(Rules)
                </Label>
                {rules.map((r, i) => (
                    <div
                        key={i}
                        style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                        }}
                    >
                        <input
                            value={r}
                            onChange={(e) => updateRule(i, e.target.value)}
                            placeholder={`규칙 ${i + 1}`}
                            style={{ flex: 1 }}
                        />
                        <button onClick={() => removeRule(i)}>삭제</button>
                    </div>
                ))}
                <button onClick={addRule}>규칙 추가</button>

                <Label>접근(Access)</Label>
                <select
                    value={scenAccess}
                    onChange={(e) =>
                        setScenAccess(e.target.value as "FREE" | "MEMBER")
                    }
                >
                    <option value="FREE">FREE</option>
                    <option value="MEMBER">MEMBER</option>
                </select>

                {/* 배경/도면 업로드 (미리보기만, 제출 시 서버 업로드) */}
                <h3 style={{ marginTop: 16 }}>무대 배경 / 지도(도면) 이미지</h3>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                        alignItems: "start",
                    }}
                >
                    <div
                        style={{
                            border: "1px solid #ddd",
                            borderRadius: 8,
                            padding: 10,
                        }}
                    >
                        <Label>무대 배경 이미지</Label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f)
                                    setPendingMapBg({
                                        file: f,
                                        preview: URL.createObjectURL(f),
                                    });
                            }}
                        />
                        {pendingMapBg?.preview && (
                            <img
                                src={pendingMapBg.preview}
                                alt="배경 미리보기"
                                style={{
                                    maxWidth: "100%",
                                    marginTop: 8,
                                    borderRadius: 6,
                                }}
                            />
                        )}
                        {!pendingMapBg?.preview && (
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "#888",
                                    marginTop: 6,
                                }}
                            >
                                아직 선택된 배경 이미지가 없습니다.
                            </div>
                        )}
                    </div>

                    <div
                        style={{
                            border: "1px solid #ddd",
                            borderRadius: 8,
                            padding: 10,
                        }}
                    >
                        <Label>지도/도면 이미지</Label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f)
                                    setPendingFloorplan({
                                        file: f,
                                        preview: URL.createObjectURL(f),
                                    });
                            }}
                        />
                        {pendingFloorplan?.preview && (
                            <img
                                src={pendingFloorplan.preview}
                                alt="도면 미리보기"
                                style={{
                                    maxWidth: "100%",
                                    marginTop: 8,
                                    borderRadius: 6,
                                }}
                            />
                        )}
                        {!pendingFloorplan?.preview && (
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "#888",
                                    marginTop: 6,
                                }}
                            >
                                아직 선택된 도면 이미지가 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <h3 style={{ marginTop: 24 }}>등장인물 (모두 용의자)</h3>
            {characters.map((c, i) => {
                const pending = pendingCharImages[c.clientId];
                const preview = pending?.preview || c.image;
                return (
                    <div
                        key={c.clientId}
                        style={{
                            border: "1px solid #ccc",
                            margin: 8,
                            padding: 12,
                            borderRadius: 8,
                        }}
                    >
                        <Label>이미지</Label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleCharacterFilePick(i, f);
                            }}
                        />
                        {preview && (
                            <img
                                src={preview}
                                alt="캐릭터 이미지"
                                style={{
                                    maxWidth: "120px",
                                    marginTop: 6,
                                    borderRadius: 6,
                                }}
                            />
                        )}

                        <Label>이름</Label>
                        <input
                            value={c.name}
                            onChange={(e) =>
                                updateCharacter(i, "name", e.target.value)
                            }
                            placeholder="예: 홍길동"
                        />

                        <Label>직업</Label>
                        <input
                            value={c.occupation}
                            onChange={(e) =>
                                updateCharacter(i, "occupation", e.target.value)
                            }
                            placeholder="예: 사서"
                        />

                        <Label>나이</Label>
                        <input
                            type="number"
                            value={c.age || ""}
                            onChange={(e) =>
                                updateCharacter(i, "age", e.target.value)
                            }
                            placeholder="예: 20"
                        />

                        <Label>성별</Label>
                        <select
                            value={c.gender || ""}
                            onChange={(e) =>
                                updateCharacter(
                                    i,
                                    "gender",
                                    e.target.value as any
                                )
                            }
                        >
                            <option value="">선택</option>
                            <option value="남성">남성</option>
                            <option value="여성">여성</option>
                        </select>

                        <Label tip="성격 키워드를 쉼표로 구분해도 좋습니다.">
                            성격
                        </Label>
                        <input
                            value={c.personality}
                            onChange={(e) =>
                                updateCharacter(
                                    i,
                                    "personality",
                                    e.target.value
                                )
                            }
                            placeholder="예: 침착함, 예민함"
                        />

                        <Label tip="장소/시간/세부 상황을 분리해서 입력하면 평가와 프롬프트 모두에 유리합니다.">
                            알리바이
                        </Label>
                        <input
                            value={c.alibi_where}
                            onChange={(e) =>
                                updateCharacter(
                                    i,
                                    "alibi_where",
                                    e.target.value
                                )
                            }
                            placeholder="장소: 예) 도서관 2층 서가"
                        />
                        <input
                            value={c.alibi_time_range}
                            onChange={(e) =>
                                updateCharacter(
                                    i,
                                    "alibi_time_range",
                                    e.target.value
                                )
                            }
                            placeholder="시간: 예) 14:10~14:20"
                        />
                        <input
                            value={c.alibi_details}
                            onChange={(e) =>
                                updateCharacter(
                                    i,
                                    "alibi_details",
                                    e.target.value
                                )
                            }
                            placeholder="세부: 예) 자료 검색 중이었다"
                        />

                        <Label>옷차림</Label>
                        <input
                            value={c.outfit}
                            onChange={(e) =>
                                updateCharacter(i, "outfit", e.target.value)
                            }
                            placeholder="예: 흰 셔츠에 검은 안경"
                        />

                        <Label>임무</Label>
                        <input
                            value={c.mission}
                            onChange={(e) =>
                                updateCharacter(i, "mission", e.target.value)
                            }
                            placeholder="예: 자신의 무고함을 주장한다"
                        />

                        <Label>말투</Label>
                        <input
                            value={c.speech_style}
                            onChange={(e) =>
                                updateCharacter(
                                    i,
                                    "speech_style",
                                    e.target.value
                                )
                            }
                            placeholder="예: 반말, 존댓말, 짧게 대답"
                        />

                        <Label tip="0에 가까울수록 거짓말 경향, 1에 가까울수록 진실 경향">
                            진실 성향 (0~1)
                        </Label>
                        <input
                            value={c.truth_tendency}
                            onChange={(e) =>
                                updateCharacter(
                                    i,
                                    "truth_tendency",
                                    e.target.value
                                )
                            }
                            placeholder="예: 0.6"
                        />

                        <Label>샘플 대사</Label>
                        <input
                            value={c.sample_line}
                            onChange={(e) =>
                                updateCharacter(
                                    i,
                                    "sample_line",
                                    e.target.value
                                )
                            }
                            placeholder="예: 저는 진짜 책만 찾고 있었어요. 왜 의심하죠?"
                        />

                        <Label tip="해당 인물의 사건 내 관계를 태그로 표시 (중복 선택 가능)">
                            관계 태그
                        </Label>
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 12,
                            }}
                        >
                            {RELATION_TAG_OPTIONS.map((tag) => (
                                <label key={tag}>
                                    <input
                                        type="checkbox"
                                        checked={c.relation_tags.includes(tag)}
                                        onChange={() =>
                                            toggleRelationTag(i, tag)
                                        }
                                    />{" "}
                                    {tag}
                                </label>
                            ))}
                        </div>

                        <div style={{ marginTop: 8 }}>
                            <button onClick={() => removeCharacter(i)}>
                                캐릭터 삭제
                            </button>
                        </div>
                    </div>
                );
            })}
            <button onClick={addCharacter} disabled={!canAddCharacter}>
                캐릭터 추가 (최대 5)
            </button>

            <h3 style={{ marginTop: 24 }}>단서 / 증거</h3>
            {clues.map((cl, i) => (
                <div
                    key={cl.clientId}
                    style={{
                        border: "1px solid #ccc",
                        margin: 8,
                        padding: 12,
                        borderRadius: 8,
                    }}
                >
                    <Label>단서 이름</Label>
                    <input
                        value={cl.name}
                        onChange={(e) => updateClue(i, "name", e.target.value)}
                        placeholder="예: 떨어진 열쇠"
                    />

                    <Label>설명</Label>
                    <input
                        value={cl.description}
                        onChange={(e) =>
                            updateClue(i, "description", e.target.value)
                        }
                        placeholder="예: 범행장소 근처에서 발견된 열쇠"
                    />

                    <Label>중요도</Label>
                    <select
                        value={cl.importance}
                        onChange={(e) =>
                            updateClue(
                                i,
                                "importance",
                                e.target.value as Importance
                            )
                        }
                    >
                        <option value="high">높음</option>
                        <option value="medium">보통</option>
                        <option value="low">낮음</option>
                    </select>

                    <Label tip="해당 단서의 성격을 범용 카테고리로 태깅합니다. (여러 개 선택 가능)">
                        카테고리
                    </Label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                        {CORE_TAGS.map((t) => (
                            <label key={t.id}>
                                <input
                                    type="checkbox"
                                    checked={cl.categories.includes(t.id)}
                                    onChange={() => toggleClueCategory(i, t.id)}
                                />{" "}
                                {t.label}
                            </label>
                        ))}
                    </div>

                    <Label tip="콤마(,) 또는 줄바꿈으로 구분하여 별칭/동의어를 입력하세요. 예: CCTV, 출입기록, 장갑">
                        키워드(별칭)
                    </Label>
                    <textarea
                        value={cl.keywords.join(", ")}
                        onChange={(e) =>
                            updateClueKeywordsText(i, e.target.value)
                        }
                        placeholder="예: CCTV, 출입기록, 장갑"
                    />

                    <button
                        onClick={() => removeClue(i)}
                        style={{ marginTop: 8 }}
                    >
                        단서 삭제
                    </button>
                </div>
            ))}
            <button onClick={addClue}>단서 추가</button>

            <h3 style={{ marginTop: 24 }}>장소</h3>
            {locations.map((loc, i) => (
                <div
                    key={loc.clientId}
                    style={{
                        border: "1px solid #ccc",
                        margin: 8,
                        padding: 12,
                        borderRadius: 8,
                    }}
                >
                    <Label>장소 이름</Label>
                    <input
                        value={loc.name}
                        onChange={(e) =>
                            updateLocation(i, "name", e.target.value)
                        }
                        placeholder="예: 열람실"
                    />
                    <Label>설명</Label>
                    <input
                        value={loc.description}
                        onChange={(e) =>
                            updateLocation(i, "description", e.target.value)
                        }
                        placeholder="예: 도서관 2층 중앙에 위치"
                    />
                    <button
                        onClick={() => removeLocation(i)}
                        style={{ marginTop: 8 }}
                    >
                        장소 삭제
                    </button>
                </div>
            ))}
            <button onClick={addLocation}>장소 추가</button>

            <h3 style={{ marginTop: 24 }}>타임라인</h3>
            <p style={{ marginTop: -8, color: "#666" }}>
                각 이벤트에 인물(선택)을 연결할 수 있습니다. 인물을 선택하지
                않으면 글로벌 사건으로 처리됩니다.
            </p>
            {timeline.map((t, i) => (
                <div
                    key={t.clientId}
                    style={{
                        border: "1px solid #ccc",
                        margin: 8,
                        padding: 12,
                        borderRadius: 8,
                    }}
                >
                    <Label>시간</Label>
                    <input
                        value={t.time}
                        onChange={(e) =>
                            updateTimeline(i, "time", e.target.value)
                        }
                        placeholder="예: 14:00"
                    />
                    <Label>사건</Label>
                    <input
                        value={t.event}
                        onChange={(e) =>
                            updateTimeline(i, "event", e.target.value)
                        }
                        placeholder="예: 홍길동이 서가에 들어감"
                    />
                    <Label tip="해당 사건의 주체 인물을 선택 (선택사항)">
                        주체(인물)
                    </Label>
                    <select
                        value={t.subjectId || ""}
                        onChange={(e) =>
                            updateTimeline(i, "subjectId", e.target.value)
                        }
                    >
                        <option value="">(선택 안 함)</option>
                        {characters.map((c, idx) => (
                            <option
                                key={c.clientId}
                                value={`suspect_${idx + 1}`}
                            >
                                {c.name || `suspect_${idx + 1}`}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => removeTimeline(i)}
                        style={{ marginTop: 8 }}
                    >
                        타임라인 삭제
                    </button>
                </div>
            ))}
            <button onClick={addTimeline}>타임라인 추가</button>

            <h3 style={{ marginTop: 24 }}>정답 설정</h3>
            <Label>범인</Label>
            <select
                value={culpritIndex}
                onChange={(e) => setCulpritIndex(Number(e.target.value))}
            >
                {characters.map((c, i) => (
                    <option value={i} key={c.clientId}>
                        {c.name || `suspect_${i + 1}`}
                    </option>
                ))}
            </select>

            <Label>동기</Label>
            <input
                value={answerMotive}
                onChange={(e) => setAnswerMotive(e.target.value)}
                placeholder="예: 금전적 이익"
            />

            <Label>수법</Label>
            <input
                value={answerMethod}
                onChange={(e) => setAnswerMethod(e.target.value)}
                placeholder="예: 열쇠를 사용해 침입"
            />

            <div style={{ marginTop: 8 }}>
                <strong>핵심 증거:</strong>
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 12,
                        marginTop: 8,
                    }}
                >
                    {clues.map((cl, i) => (
                        <label key={cl.clientId}>
                            <input
                                type="checkbox"
                                checked={answerKeyEvidenceIds.includes(
                                    `e${i + 1}`
                                )}
                                onChange={() =>
                                    setAnswerKeyEvidenceIds((prev) =>
                                        prev.includes(`e${i + 1}`)
                                            ? prev.filter(
                                                  (x) => x !== `e${i + 1}`
                                              )
                                            : [...prev, `e${i + 1}`]
                                    )
                                }
                            />{" "}
                            {cl.name || `단서 ${i + 1}`}
                        </label>
                    ))}
                </div>
            </div>

            {/* JSON Preview */}
            <h3 style={{ marginTop: 24 }}>JSON 미리보기</h3>
            <div
                style={{
                    background: "#0b1020",
                    color: "#d7e6ff",
                    padding: 12,
                    borderRadius: 8,
                    overflow: "auto",
                    maxHeight: 360,
                }}
            >
                <pre
                    style={{
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                    }}
                >
                    {contentJsonPretty}
                </pre>
            </div>

            {/* JSON Import */}
            <h3 style={{ marginTop: 24 }}>JSON 불러오기</h3>
            <p style={{ color: "#666", marginTop: -8 }}>
                아래 입력창에 <code>contentJson</code> 전체(JSON)를 붙여넣고
                “가져오기”를 누르면 폼이 채워집니다.
            </p>
            <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='{"scenario":{...},"characters":[...],"evidence":[...],...}'
                style={{
                    width: "100%",
                    minHeight: 140,
                    fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                }}
            />
            <div
                style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginTop: 8,
                }}
            >
                <button onClick={handleImportJson}>가져오기</button>
                {importError && (
                    <span style={{ color: "#b00020" }}>{importError}</span>
                )}
            </div>

            {/* Validation */}
            {validationErrors.length > 0 && (
                <div style={{ marginTop: 12, color: "#b00020" }}>
                    <strong>제출 불가:</strong>
                    <ul>
                        {validationErrors.map((e, i) => (
                            <li key={i}>{e}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div style={{ marginTop: 16 }}>
                <button onClick={handleCreateScenario} disabled={!canSubmit}>
                    시나리오 제출
                </button>
            </div>

            <hr style={{ margin: "32px 0" }} />
            <details>
                <summary style={{ cursor: "pointer" }}>
                    평가 기준(Evaluation) 기본 템플릿
                </summary>
                <p style={{ color: "#666" }}>
                    평가지표 템플릿은 contentJson에 자동 포함되어 FastAPI 분석
                    서버가 활용합니다. 세부 수정이 필요하면 코드의
                    DEFAULT_EVALUATION 상수를 조정하세요.
                </p>
                <div
                    style={{
                        background: "#fafafa",
                        border: "1px solid #eee",
                        padding: 12,
                        borderRadius: 8,
                    }}
                >
                    {JSON.stringify(DEFAULT_EVALUATION, null, 2)}
                </div>
            </details>
        </div>
    );
}
