import { useMemo, useState } from "react";
import { api } from "../../shared/api/client";
import { useAuth } from "../../store/auth.store";

type Importance = "high" | "medium" | "low";

type CharacterForm = {
  name: string;
  occupation: string;
  personality: string;
  alibi: string;
  mission: string;
  speech_style: string;
  truth_tendency: string;
  outfit: string;
  sample_line: string;
  age?: string;     // 숫자 입력
  gender?: "남성" | "여성" | ""; // 셀렉트박스
};


type ClueForm = {
  id: number;
  name: string;
  description: string;
  importance: Importance;
  attributes: string[]; // "시간 관련", "출입 기록" 등
};

type LocationForm = {
  id: number;
  name: string;
  description: string;
};

type TimelineForm = {
  id: number;
  time: string;
  event: string;
};

export default function ExpertScenarioPage() {
  const { user } = useAuth();

  const SUMMARY_MAX = 200; // 사건 개요 (리스트/검색용)
  const CASE_SUMMARY_MAX = 120; // 사건 요약 (프롬프트용)
  const CASE_SUMMARY_WARN = 100;

  // 메타
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [level, setLevel] = useState(1);
  const [caseSummary, setCaseSummary] = useState("");

  // 캐릭터
  const [characters, setCharacters] = useState<CharacterForm[]>([
    {
      name: "",
      occupation: "",
      personality: "",
      alibi: "",
      mission: "",
      speech_style: "",
      truth_tendency: "0.7",
      outfit: "",
      sample_line: "",
    },
    {
      name: "",
      occupation: "",
      personality: "",
      alibi: "",
      mission: "",
      speech_style: "",
      truth_tendency: "0.7",
      outfit: "",
      sample_line: "",
    },
  ]);
  const canAddCharacter = characters.length < 5;

  // 단서
  const [clues, setClues] = useState<ClueForm[]>([
    { id: 1, name: "", description: "", importance: "medium", attributes: [] },
  ]);

  // 장소
  const [locations, setLocations] = useState<LocationForm[]>([
    { id: 1, name: "", description: "" },
  ]);

  // 타임라인
  const [timeline, setTimeline] = useState<TimelineForm[]>([
    { id: 1, time: "", event: "" },
  ]);

  // 정답
  const [culpritIndex, setCulpritIndex] = useState<number>(0);
  const [answerMotive, setAnswerMotive] = useState("");
  const [answerMethod, setAnswerMethod] = useState("");
  const [answerKeyEvidenceIds, setAnswerKeyEvidenceIds] = useState<string[]>([]);

  // ------------------------------
  // 캐릭터 핸들러
  // ------------------------------
  const addCharacter = () => {
    if (!canAddCharacter) return;
    setCharacters([
      ...characters,
      {
        name: "",
        occupation: "",
        personality: "",
        alibi: "",
        mission: "",
        speech_style: "",
        truth_tendency: "0.7",
        outfit: "",
        sample_line: "",
      },
    ]);
  };
  const updateCharacter = (index: number, field: keyof CharacterForm, value: string) => {
    const updated = [...characters];
    (updated[index] as any)[field] = value;
    setCharacters(updated);
  };
  const removeCharacter = (index: number) => {
    if (characters.length <= 2) {
      alert("용의자는 최소 2명이어야 합니다.");
      return;
    }
    const updated = characters.filter((_, i) => i !== index);
    setCharacters(updated);
    if (culpritIndex >= updated.length) setCulpritIndex(Math.max(0, updated.length - 1));
  };

  // ------------------------------
  // 단서 핸들러
  // ------------------------------
  const addClue = () => {
    setClues([
      ...clues,
      { id: clues.length + 1, name: "", description: "", importance: "medium", attributes: [] },
    ]);
  };
  const updateClue = (index: number, field: keyof ClueForm, value: any) => {
    const updated = [...clues];
    (updated[index] as any)[field] = value;
    setClues(updated);
  };
  const toggleClueAttr = (index: number, attr: string) => {
    const updated = [...clues];
    const attrs = updated[index].attributes;
    updated[index].attributes = attrs.includes(attr)
      ? attrs.filter((a) => a !== attr)
      : [...attrs, attr];
    setClues(updated);
  };
  const removeClue = (index: number) => {
    const updated = clues.filter((_, i) => i !== index);
    setClues(updated);
    const remainingIds = updated.map((_, i) => `e${i + 1}`);
    setAnswerKeyEvidenceIds((prev) => prev.filter((id) => remainingIds.includes(id)));
  };

  // ------------------------------
  // 장소 핸들러
  // ------------------------------
  const addLocation = () => {
    setLocations([...locations, { id: locations.length + 1, name: "", description: "" }]);
  };
  const updateLocation = (index: number, field: keyof LocationForm, value: string) => {
    const updated = [...locations];
    (updated[index] as any)[field] = value;
    setLocations(updated);
  };
  const removeLocation = (index: number) => {
    setLocations(locations.filter((_, i) => i !== index));
  };

  // ------------------------------
  // 타임라인 핸들러
  // ------------------------------
  const addTimeline = () => {
    setTimeline([...timeline, { id: timeline.length + 1, time: "", event: "" }]);
  };
  const updateTimeline = (index: number, field: keyof TimelineForm, value: string) => {
    const updated = [...timeline];
    (updated[index] as any)[field] = value;
    setTimeline(updated);
  };
  const removeTimeline = (index: number) => {
    setTimeline(timeline.filter((_, i) => i !== index));
  };

  // ------------------------------
  // contentJson 조립
  // ------------------------------
  const buildContentJson = () => {
    const characterDocs = characters.map((c, i) => ({
      id: `suspect_${i + 1}`,
      name: c.name,
      role: "용의자",
      job: c.occupation,
      personality: c.personality,
      speaking_style: c.speech_style,
      truth_bias: Number(c.truth_tendency) || 0.7,
      alibi: { where: c.alibi, time_range: "", details: "" },
      mission: c.mission ?? "",
      outfit: c.outfit ?? "",
      sample_line: c.sample_line ?? "",
    }));

    const evidenceDocs = clues.map((cl, i) => ({
      id: `e${i + 1}`,
      name: cl.name || `단서 ${i + 1}`,
      desc: cl.description,
      importance: cl.importance.toUpperCase(),
      attributes: cl.attributes,
    }));

    const locationDocs = locations.map((loc) => ({
      id: `loc_${loc.id}`,
      name: loc.name,
      desc: loc.description,
    }));

    const timelineDocs = timeline.map((t) => ({
      id: `t_${t.id}`,
      time: t.time,
      event: t.event,
    }));

    const culpritId = `suspect_${culpritIndex + 1}`;

    const content = {
      scenario: {
        id: `scen_${Date.now()}`,
        title,
        summary: caseSummary || summary,
        difficulty: level,
        objective: "범인, 동기, 수법을 특정하고 핵심 증거를 제시하라.",
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
    };

    return JSON.stringify(content);
  };

  const handleCreateScenario = async () => {
    const contentJson = buildContentJson();
    try {
      await api.post("/scenarios/create", {
        scenTitle: title,
        scenSummary: summary,
        scenLevel: level,
        scenAccess: "FREE", // 임시 기본값 → 관리자 승인 시 조정
        contentJson,
      });
      alert("시나리오 작성 성공!");
    } catch {
      alert("시나리오 작성 실패");
    }
  };

  // ------------------------------
  // 렌더링
  // ------------------------------
  if (!user || (user.role !== "EXPERT" && user.role !== "ADMIN")) {
    return <div>전문가 권한이 필요한 메뉴입니다.</div>;
  }

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: 16 }}>
      <h2>시나리오 작성</h2>

      <label>제목</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="예: 사라진 고서"
      />

      <label>사건 개요 (리스트/검색용, 카드에 표시될 문장)</label>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="예: 도서관에서 귀중한 고서 한 권이 사라졌다."
        maxLength={SUMMARY_MAX}
      />
      <small>{summary.length}/{SUMMARY_MAX}자</small>

      <label>난이도</label>
      <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
        <option value={1}>쉬움</option>
        <option value={2}>보통</option>
        <option value={3}>어려움</option>
      </select>

      <label>사건 요약 (LLM 프롬프트용, 핵심 정보만)</label>
      <textarea
        value={caseSummary}
        onChange={(e) => setCaseSummary(e.target.value)}
        placeholder="예: 2025년 1월 12일, 도서관에서 귀중한 고서가 사라졌다."
        maxLength={CASE_SUMMARY_MAX}
        style={{
          borderColor: caseSummary.length > CASE_SUMMARY_WARN ? "orange" : undefined,
        }}
      />
      <small>{caseSummary.length}/{CASE_SUMMARY_MAX}자</small>

      <h3>등장인물</h3>
      {characters.map((c, i) => (
        <div key={i} style={{ border: "1px solid #ccc", margin: 8, padding: 8 }}>
          <label>이름</label>
          <input
            value={c.name}
            onChange={(e) => updateCharacter(i, "name", e.target.value)}
            placeholder="예: 홍길동"
          />

          <label>직업</label>
          <input
            value={c.occupation}
            onChange={(e) => updateCharacter(i, "occupation", e.target.value)}
            placeholder="예: 사서"
          />

          <label>나이</label>
          <input
            type="number"
            value={c.age || ""}
            onChange={(e) => updateCharacter(i, "age", e.target.value)}
            placeholder="예: 20"
          />

          <label>성별</label>
          <select
            value={c.gender || ""}
            onChange={(e) => updateCharacter(i, "gender", e.target.value as "남성" | "여성" | "")}
          >
            <option value="">선택</option>
            <option value="남성">남성</option>
            <option value="여성">여성</option>
          </select>

          <label>성격</label>
          <input
            value={c.personality}
            onChange={(e) => updateCharacter(i, "personality", e.target.value)}
            placeholder="예: 침착함, 예민함"
          />

          <label>알리바이 (간단 설명)</label>
          <input
            value={c.alibi}
            onChange={(e) => updateCharacter(i, "alibi", e.target.value)}
            placeholder="예: 14:10~14:20 2층 서고에서 자료 검색"
          />

          <label>옷차림</label>
          <input
            value={c.outfit}
            onChange={(e) => updateCharacter(i, "outfit", e.target.value)}
            placeholder="예: 흰 셔츠에 검은 안경"
          />

          <label>임무</label>
          <input
            value={c.mission}
            onChange={(e) => updateCharacter(i, "mission", e.target.value)}
            placeholder="예: 논문 자료를 최대한 빨리 찾는다"
          />

          <label>말투</label>
          <input
            value={c.speech_style}
            onChange={(e) => updateCharacter(i, "speech_style", e.target.value)}
            placeholder="예: 반말, 존댓말, 짧게 대답"
          />

          <label>진실 성향 (0~1)</label>
          <input
            value={c.truth_tendency}
            onChange={(e) => updateCharacter(i, "truth_tendency", e.target.value)}
            placeholder="예: 0.6 (낮을수록 거짓말 경향)"
          />

          <label>샘플 대사</label>
          <input
            value={c.sample_line}
            onChange={(e) => updateCharacter(i, "sample_line", e.target.value)}
            placeholder="예: 저는 진짜 책만 찾고 있었어요. 왜 자꾸 의심하는 거예요?"
          />

          <button onClick={() => removeCharacter(i)}>삭제</button>
        </div>


      ))}
      <button onClick={addCharacter} disabled={!canAddCharacter}>
        캐릭터 추가
      </button>

      <h3>단서 / 증거</h3>
      {clues.map((cl, i) => (
        <div key={cl.id} style={{ border: "1px solid #ccc", margin: 8, padding: 8 }}>
          <label>단서 이름</label>
          <input
            value={cl.name}
            onChange={(e) => updateClue(i, "name", e.target.value)}
            placeholder="예: 떨어진 열쇠"
          />
          <label>설명</label>
          <input
            value={cl.description}
            onChange={(e) => updateClue(i, "description", e.target.value)}
            placeholder="예: 범행장소 근처에서 발견된 열쇠"
          />
          <label>중요도</label>
          <select
            value={cl.importance}
            onChange={(e) => updateClue(i, "importance", e.target.value as Importance)}
          >
            <option value="high">높음</option>
            <option value="medium">보통</option>
            <option value="low">낮음</option>
          </select>
          <label>관련 속성</label>
          <div>
            {["시간 관련", "출입 기록", "동기 관련", "수법 관련"].map((attr) => (
              <label key={attr} style={{ marginRight: 12 }}>
                <input
                  type="checkbox"
                  checked={cl.attributes.includes(attr)}
                  onChange={() => toggleClueAttr(i, attr)}
                />
                {attr}
              </label>
            ))}
          </div>
          <button onClick={() => removeClue(i)}>삭제</button>
        </div>
      ))}
      <button onClick={addClue}>단서 추가</button>

      <h3>장소</h3>
      {locations.map((loc, i) => (
        <div key={loc.id} style={{ border: "1px solid #ccc", margin: 8, padding: 8 }}>
          <label>장소 이름</label>
          <input
            value={loc.name}
            onChange={(e) => updateLocation(i, "name", e.target.value)}
            placeholder="예: 열람실"
          />
          <label>설명</label>
          <input
            value={loc.description}
            onChange={(e) => updateLocation(i, "description", e.target.value)}
            placeholder="예: 도서관 2층 중앙에 위치"
          />
          <button onClick={() => removeLocation(i)}>삭제</button>
        </div>
      ))}
      <button onClick={addLocation}>장소 추가</button>

      <h3>타임라인</h3>
      {timeline.map((t, i) => (
        <div key={t.id} style={{ border: "1px solid #ccc", margin: 8, padding: 8 }}>
          <label>시간</label>
          <input
            value={t.time}
            onChange={(e) => updateTimeline(i, "time", e.target.value)}
            placeholder="예: 14:00"
          />
          <label>사건</label>
          <input
            value={t.event}
            onChange={(e) => updateTimeline(i, "event", e.target.value)}
            placeholder="예: 홍길동이 서가에 들어감"
          />
          <button onClick={() => removeTimeline(i)}>삭제</button>
        </div>
      ))}
      <button onClick={addTimeline}>타임라인 추가</button>

      <h3>정답 설정</h3>
      <label>범인</label>
      <select value={culpritIndex} onChange={(e) => setCulpritIndex(Number(e.target.value))}>
        {characters.map((c, i) => (
          <option value={i} key={i}>
            {c.name || `suspect_${i + 1}`}
          </option>
        ))}
      </select>
      <label>동기</label>
      <input
        value={answerMotive}
        onChange={(e) => setAnswerMotive(e.target.value)}
        placeholder="예: 금전적 이익"
      />
      <label>수법</label>
      <input
        value={answerMethod}
        onChange={(e) => setAnswerMethod(e.target.value)}
        placeholder="예: 열쇠를 사용해 침입"
      />

      <div>
        핵심 증거:
        {clues.map((cl, i) => (
          <label key={cl.id}>
            <input
              type="checkbox"
              checked={answerKeyEvidenceIds.includes(`e${i + 1}`)}
              onChange={() =>
                setAnswerKeyEvidenceIds((prev) =>
                  prev.includes(`e${i + 1}`) ? prev.filter((x) => x !== `e${i + 1}`) : [...prev, `e${i + 1}`]
                )
              }
            />
            {cl.name || `단서 ${i + 1}`}
          </label>
        ))}
      </div>

      <button onClick={handleCreateScenario}>시나리오 제출</button>
    </div>
  );
}
