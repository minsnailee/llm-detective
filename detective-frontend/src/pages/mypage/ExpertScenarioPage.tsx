import { useMemo, useState } from "react";
import { api } from "../../shared/api/client";
import { useAuth } from "../../store/auth.store";

type Access = "FREE" | "MEMBER";
type Importance = "high" | "medium" | "low";

type CharacterForm = {
  name: string;
  occupation: string;     // job
  personality: string;
  alibi: string;          // 간단 입력 (where/time_range는 서버에서 가공 가능)
  mission: string;        // (선택)
  speech_style: string;   // speaking_style
  truth_tendency: string; // "0.7" 처럼 문자열 입력 -> 제출 시 number로 변환
};

type ClueForm = {
  id: number; // UI용 일련번호
  name: string;
  description: string;
  importance: Importance;
  tags?: string; // 콤마 구분 문자열 -> 제출 시 배열로 변환
};

export default function ExpertScenarioPage() {
  const { user } = useAuth();
  const SUMMARY_MAX = 200;        // UI 목록용 상한
  const CASE_SUMMARY_MAX = 70;   // LLM 사건요약 상한
  const CASE_SUMMARY_RECO = 69;  // 권장선(넘으면 색 바뀌게)

  // 메타
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [level, setLevel] = useState(1);
  const [access, setAccess] = useState<Access>("FREE");
  const [caseSummary, setCaseSummary] = useState(""); // scenario.summary로 들어감

  // 캐릭터 (최소 2명, 최대 5명)
  const [characters, setCharacters] = useState<CharacterForm[]>([
    {
      name: "",
      occupation: "",
      personality: "",
      alibi: "",
      mission: "",
      speech_style: "",
      truth_tendency: "0.7",
    },
    {
      name: "",
      occupation: "",
      personality: "",
      alibi: "",
      mission: "",
      speech_style: "",
      truth_tendency: "0.7",
    },
  ]);
  const canAddCharacter = characters.length < 5;

  // 단서(증거)
  const [clues, setClues] = useState<ClueForm[]>([
    { id: 1, name: "", description: "", importance: "medium", tags: "" },
  ]);

  // 정답(판정용)
  const [culpritIndex, setCulpritIndex] = useState<number>(0); // characters 인덱스
  const [answerMotive, setAnswerMotive] = useState("");
  const [answerMethod, setAnswerMethod] = useState("");
  const [answerKeyEvidenceIds, setAnswerKeyEvidenceIds] = useState<string[]>([]); // ["e1","e2"]

  // 캐릭터 UI 핸들러
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
    // 범인 인덱스 보정
    if (culpritIndex >= updated.length) setCulpritIndex(Math.max(0, updated.length - 1));
  };

  // 단서 UI 핸들러
  const addClue = () => {
    setClues([
      ...clues,
      { id: clues.length + 1, name: "", description: "", importance: "medium", tags: "" },
    ]);
  };
  const updateClue = (index: number, field: keyof ClueForm, value: string) => {
    const updated = [...clues];
    (updated[index] as any)[field] = value;
    setClues(updated);
  };
  const removeClue = (index: number) => {
    const updated = clues.filter((_, i) => i !== index);
    setClues(updated);
    // 핵심증거 선택값 보정
    const remainingIds = updated.map((_, i) => `e${i + 1}`);
    setAnswerKeyEvidenceIds((prev) => prev.filter((id) => remainingIds.includes(id)));
  };

  // 제출 전 간단 검증 (최소 2명)
  const validate = () => {
    if (!title.trim()) return "제목을 입력하세요.";
    if (!summary.trim()) return "요약(리스트/검색용)을 입력하세요.";
    if (characters.length < 2) return "용의자는 최소 2명 이상이어야 합니다.";
    if (!characters[culpritIndex]?.name.trim()) return "정답의 범인으로 선택된 캐릭터의 이름을 입력하세요.";
    if (!answerMotive.trim()) return "정답의 동기를 입력하세요.";
    if (!answerMethod.trim()) return "정답의 수법을 입력하세요.";
    if (answerKeyEvidenceIds.length === 0) return "핵심 증거를 1개 이상 선택하세요.";
    return null;
  };

  // contentJson 조립
  const buildContentJson = () => {
    // 캐릭터 ID/evidence ID 부여
    const characterDocs = characters.map((c, i) => ({
      id: `suspect_${i + 1}`,
      name: c.name,
      role: "용의자",
      job: c.occupation,
      personality: c.personality,
      speaking_style: c.speech_style,
      truth_bias: Number.isFinite(Number(c.truth_tendency)) ? Number(c.truth_tendency) : 0.7,
      alibi: { where: c.alibi, time_range: "", details: "" },
      mission: c.mission ?? "",
      knowledge: { public: [], private: [], forbidden: ["정답 직접 발설 금지"] },
      triggers: []
    }));

    const evidenceDocs = clues.map((cl, i) => ({
      id: `e${i + 1}`,
      name: cl.name || `단서 ${i + 1}`,
      desc: cl.description,
      importance: cl.importance.toUpperCase(), // HIGH/MEDIUM/LOW
      found_at: "",
      tags: cl.tags
        ? cl.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
      unlock_conditions: {} // 초기엔 비워둠
    }));

    const culpritId = `suspect_${culpritIndex + 1}`;

    const content = {
      scenario: {
        id: `scen_${Date.now()}`,
        title,
        summary: caseSummary || summary, // 프롬프트용 사실 요약 (비면 목록용 요약으로 대체)
        difficulty: level,
        access,
        setting: { date: "", time_window: "", location: "" },
        objective: "범인, 동기, 수법을 특정하고 핵심 증거를 제시하라.",
        win_condition: { culprit: culpritId, must_present_evidence: answerKeyEvidenceIds },
        fail_condition: { max_turns: 15 },
        hint_policy: { auto_hint_after_idle_turns: 3, max_hints: 2 }
      },
      locations: [],          // 필요 시 이후 폼 확장
      timeline: [],           // 필요 시 이후 폼 확장
      characters: characterDocs,
      evidence: evidenceDocs,
      red_herrings: [],
      answer: {
        culprit: culpritId,
        motive: answerMotive,
        method: answerMethod,
        key_evidence: answerKeyEvidenceIds
      },
      dialogue_policy: {
        no_spoilers_before_turn: 8,
        deny_rules: ["외부 지식 금지", "근거 제시 전 정답 직답 금지"],
        style_notes: "인물별 말투 유지, 모르면 모른다고 답"
      },
      consistency_rules: [],
      scoring_rubric: {
        logic: { weight: 0.3, must_reference_any: answerKeyEvidenceIds },
        creativity: { weight: 0.2, signals: [] },
        focus: { weight: 0.2, signals: [] },
        diversity: { weight: 0.15, signals: [] },
        depth: { weight: 0.15, signals: [] }
      }
    };

    return JSON.stringify(content);
  };

  const handleCreateScenario = async () => {
    const err = validate();
    if (err) {
      alert(err);
      return;
    }

    try {
      const contentJson = buildContentJson();

      const res = await api.post("/scenarios/create", {
        scenTitle: title,
        scenSummary: summary,
        scenLevel: level,
        scenAccess: access,
        contentJson, // 서버에서 그대로 JSON으로 저장
      });

      alert("시나리오 작성 성공! 관리자 검토를 기다려주세요.");
      console.log("Created:", res.data);

      // 초기화 (최소 2명 유지)
      setTitle("");
      setSummary("");
      setLevel(1);
      setAccess("FREE");
      setCaseSummary("");
      setCharacters([
        {
          name: "",
          occupation: "",
          personality: "",
          alibi: "",
          mission: "",
          speech_style: "",
          truth_tendency: "0.7",
        },
        {
          name: "",
          occupation: "",
          personality: "",
          alibi: "",
          mission: "",
          speech_style: "",
          truth_tendency: "0.7",
        },
      ]);
      setClues([{ id: 1, name: "", description: "", importance: "medium", tags: "" }]);
      setCulpritIndex(0);
      setAnswerMotive("");
      setAnswerMethod("");
      setAnswerKeyEvidenceIds([]);
    } catch (e) {
      alert("시나리오 작성 실패");
    }
  };

  // 핵심증거 체크박스 렌더
  const evidenceIdList = useMemo(() => clues.map((_, i) => `e${i + 1}`), [clues]);
  const toggleKeyEvidence = (id: string) => {
    setAnswerKeyEvidenceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (!user || (user.role !== "EXPERT" && user.role !== "ADMIN")) {
    return <div>전문가 권한이 필요한 메뉴입니다.</div>;
  }

  return (
    <div style={{ marginTop: 24, maxWidth: 880 }}>
      <h3>시나리오 작성 (전문가 전용)</h3>

      <div>
        <label>제목: </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예) 사라진 고서"
        />
      </div>

<div>
  <label>사건 개요: </label>
  <textarea
    value={summary}
    onChange={(e) => setSummary(e.target.value)}
    placeholder="카드에 보일 사건 개요"
    maxLength={SUMMARY_MAX}
    aria-describedby="summaryHelp"
  />
  <div style={{display:"flex",justifyContent:"space-between"}}>
    <small id="summaryHelp">예: 사건 소개, 흥미 유발 문장 환영</small>
    <small>{summary.length}/{SUMMARY_MAX}</small>
  </div>
</div>

      <div>
        <label>난이도: </label>
        <select
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
        >
          <option value={1}>1 (쉬움)</option>
          <option value={2}>2 (보통)</option>
          <option value={3}>3 (어려움)</option>
        </select>
      </div>

      <div>
        <label>접근 권한: </label>
        <select
          value={access}
          onChange={(e) => setAccess(e.target.value as Access)}
        >
          <option value="FREE">FREE</option>
          <option value="MEMBER">MEMBER</option>
        </select>
      </div>

<div>
  <label>사건 요약(LLM에 전달될 사실 요약): </label>
  <textarea
    value={caseSummary}
    onChange={(e) => setCaseSummary(e.target.value)}
    placeholder="날짜/장소/시간/핵심 상황"
    maxLength={CASE_SUMMARY_MAX}
    aria-describedby="caseSummaryHelp"
    style={{
      borderColor: caseSummary.length > CASE_SUMMARY_RECO ? "#f39c12" : undefined
    }}
  />
  <div style={{display:"flex",justifyContent:"space-between"}}>
    <small id="caseSummaryHelp">권장 120~300자, 상한 {CASE_SUMMARY_MAX}자</small>
    <small style={{color: caseSummary.length > CASE_SUMMARY_RECO ? "#f39c12" : undefined}}>
      {caseSummary.length}/{CASE_SUMMARY_MAX}
    </small>
  </div>
</div>

      <h4 style={{ marginTop: 16 }}>등장인물 (용의자, 최소 2명 ~ 최대 5명)</h4>
      {characters.map((c, i) => (
        <div key={i} style={{ border: "1px solid #ccc", margin: 8, padding: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <strong>suspect_{i + 1}</strong>
            {characters.length > 2 && (
              <button onClick={() => removeCharacter(i)} style={{ marginLeft: "auto" }}>
                삭제
              </button>
            )}
          </div>
          <label>이름: </label>
          <input
            value={c.name}
            onChange={(e) => updateCharacter(i, "name", e.target.value)}
            placeholder="예) 김도현"
          />
          <br />
          <label>직업: </label>
          <input
            value={c.occupation}
            onChange={(e) => updateCharacter(i, "occupation", e.target.value)}
            placeholder="예) 고서 수집가"
          />
          <br />
          <label>성격: </label>
          <input
            value={c.personality}
            onChange={(e) => updateCharacter(i, "personality", e.target.value)}
            placeholder="예) 예의 바르나 회피적"
          />
          <br />
          <label>알리바이(간단): </label>
          <input
            value={c.alibi}
            onChange={(e) => updateCharacter(i, "alibi", e.target.value)}
            placeholder="예) 14:00~15:00 카페에 있었다"
          />
          <br />
          <label>말투: </label>
          <input
            value={c.speech_style}
            onChange={(e) => updateCharacter(i, "speech_style", e.target.value)}
            placeholder="예) 존댓말, 돌려 말함"
          />
          <br />
          <label>진실 성향(0~1): </label>
          <input
            value={c.truth_tendency}
            onChange={(e) => updateCharacter(i, "truth_tendency", e.target.value)}
            placeholder="예) 0.4 (낮을수록 회피/거짓 경향)"
          />
          <br />
          <label>임무(선택): </label>
          <input
            value={c.mission}
            onChange={(e) => updateCharacter(i, "mission", e.target.value)}
            placeholder="예) 기증 상담을 가장해 접근"
          />
        </div>
      ))}
      <button onClick={addCharacter} disabled={!canAddCharacter}>
        {canAddCharacter ? "등장인물 추가" : "용의자는 최대 5명까지입니다"}
      </button>

      <h4 style={{ marginTop: 16 }}>단서 / 증거</h4>
      {clues.map((clue, i) => (
        <div key={clue.id} style={{ border: "1px solid #ccc", margin: 8, padding: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <strong>e{i + 1}</strong>
            {clues.length > 1 && (
              <button onClick={() => removeClue(i)} style={{ marginLeft: "auto" }}>
                삭제
              </button>
            )}
          </div>
          <label>이름: </label>
          <input
            value={clue.name}
            onChange={(e) => updateClue(i, "name", e.target.value)}
            placeholder="예) 보관실 출입기록"
          />
          <br />
          <label>설명: </label>
          <input
            value={clue.description}
            onChange={(e) => updateClue(i, "description", e.target.value)}
            placeholder="예) 14:25 게스트 패스로 단독 재입장 기록"
          />
          <br />
          <label>중요도: </label>
          <select
            value={clue.importance}
            onChange={(e) => updateClue(i, "importance", e.target.value as Importance)}
          >
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
          <br />
          <label>태그(콤마로 구분): </label>
          <input
            value={clue.tags ?? ""}
            onChange={(e) => updateClue(i, "tags", e.target.value)}
            placeholder="예) timeline, access"
          />
        </div>
      ))}
      <button onClick={addClue}>단서 추가</button>

      <h4 style={{ marginTop: 16 }}>정답 (판정 기준)</h4>
      <div style={{ border: "1px solid #ccc", padding: 8 }}>
        <div>
          <label>범인(캐릭터 선택): </label>
          <select
            value={culpritIndex}
            onChange={(e) => setCulpritIndex(Number(e.target.value))}
          >
            {characters.map((c, i) => (
              <option value={i} key={i}>
                suspect_{i + 1} — {c.name || "(이름 미입력)"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>동기(Motive): </label>
          <input
            value={answerMotive}
            onChange={(e) => setAnswerMotive(e.target.value)}
            placeholder="예) 고가 매각을 위한 절도"
          />
        </div>
        <div>
          <label>수법(Method): </label>
          <input
            value={answerMethod}
            onChange={(e) => setAnswerMethod(e.target.value)}
            placeholder="예) 투어 직후 임시패스 만료 전 재입장하여 반출"
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <div>핵심 증거(Key Evidence):</div>
          {evidenceIdList.map((id, i) => (
            <label key={id} style={{ display: "inline-block", marginRight: 12 }}>
              <input
                type="checkbox"
                checked={answerKeyEvidenceIds.includes(id)}
                onChange={() => toggleKeyEvidence(id)}
              />
              {id} — {clues[i]?.name || "(이름 미입력)"}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={handleCreateScenario}>시나리오 제출</button>
      </div>
    </div>
  );
}
