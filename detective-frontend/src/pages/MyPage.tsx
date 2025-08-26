import { useAuth } from "../store/auth.store";
import { api } from "../shared/api/client";
import { useState } from "react";

export default function MyPage() {
  const { user, set, logout } = useAuth();

  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [password, setPassword] = useState("");

  const handleLogout = () => {
    api.post("/users/logout").finally(() => {
      logout();
      window.location.href = "/login";
    });
  };

  // ==============================
  // 시나리오 작성 관련 상태
  // ==============================
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [level, setLevel] = useState(1);
  const [access, setAccess] = useState<"FREE" | "MEMBER">("FREE");

  const [caseSummary, setCaseSummary] = useState("");
  const [characters, setCharacters] = useState([
    {
      name: "",
      role: "용의자",
      occupation: "",
      personality: "",
      alibi: "",
      mission: "",
      speech_style: "",
      truth_tendency: "",
    },
  ]);
  const [clues, setClues] = useState([
    { id: 1, description: "", importance: "medium" },
  ]);
  const [solution, setSolution] = useState("");

  // ------------------------------
  // 유저 관련 액션
  // ------------------------------
  const handleUpdateNickname = async () => {
    try {
      const { data } = await api.post("/users/update-nickname", { nickname });
      alert("닉네임 변경 성공!");
      set({ user: { ...user, nickname } });
    } catch (e) {
      alert("닉네임 변경 실패");
    }
  };

  const handleUpdatePassword = async () => {
    try {
      await api.post("/users/update-password", { password });
      alert("비밀번호 변경 성공!");
      setPassword("");
    } catch (e) {
      alert("비밀번호 변경 실패");
    }
  };

  const handleRequestExpert = async () => {
    try {
      await api.post("/users/request-expert");
      alert("전문가 권한 신청 완료. 관리자의 승인을 기다려주세요.");
      set({ user: { ...user, expertRequested: true } as any });
    } catch (e) {
      alert("전문가 신청 실패");
    }
  };

  // ------------------------------
  // 캐릭터/단서 관련 액션
  // ------------------------------
  const addCharacter = () => {
    setCharacters([
      ...characters,
      {
        name: "",
        role: "용의자",
        occupation: "",
        personality: "",
        alibi: "",
        mission: "",
        speech_style: "",
        truth_tendency: "",
      },
    ]);
  };

  const updateCharacter = (index: number, field: string, value: string) => {
    const updated = [...characters];
    (updated[index] as any)[field] = value;
    setCharacters(updated);
  };

  const addClue = () => {
    setClues([
      ...clues,
      { id: clues.length + 1, description: "", importance: "medium" },
    ]);
  };

  const updateClue = (index: number, field: string, value: string) => {
    const updated = [...clues];
    (updated[index] as any)[field] = value;
    setClues(updated);
  };

  // ------------------------------
  // 시나리오 작성 요청
  // ------------------------------
  const handleCreateScenario = async () => {
    try {
      const contentJson = JSON.stringify(
        {
          case_summary: caseSummary,
          characters,
          clues,
          solution,
        },
        null,
        2
      );

      const res = await api.post("/scenarios/create", {
        scenTitle: title,
        scenSummary: summary,
        scenLevel: level,
        scenAccess: access,
        contentJson,
      });

      alert("시나리오 작성 성공! 관리자 검토를 기다려주세요.");
      console.log("Created:", res.data);

      // 폼 초기화
      setTitle("");
      setSummary("");
      setCaseSummary("");
      setCharacters([
        {
          name: "",
          role: "용의자",
          occupation: "",
          personality: "",
          alibi: "",
          mission: "",
          speech_style: "",
          truth_tendency: "",
        },
      ]);
      setClues([{ id: 1, description: "", importance: "medium" }]);
      setSolution("");
    } catch (e) {
      alert("시나리오 작성 실패");
    }
  };

  // ==============================
  // 렌더링
  // ==============================
  if (!user) return <div>로그인이 필요합니다.</div>;

  return (
    <div>
      <h2>마이페이지</h2>

      <div>
        <p>아이디: {user.userId}</p>
        <p>닉네임: {user.nickname}</p>
        <p>권한: {user.role}</p>
      </div>

      <div style={{ marginTop: 16 }}>
        <label>
          닉네임 변경:
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </label>
        <button onClick={handleUpdateNickname}>변경</button>
      </div>

      <div style={{ marginTop: 16 }}>
        <label>
          비밀번호 변경:
          <input
            type="password"
            value={password}
            placeholder="새 비밀번호 입력"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button onClick={handleUpdatePassword}>변경</button>
      </div>

      {/* 전문가 신청 버튼 */}
      {user.role === "MEMBER" && (
        <div style={{ marginTop: 16 }}>
          <button onClick={handleRequestExpert}>전문가 권한 신청</button>
        </div>
      )}

      {/* 전문가 전용 시나리오 작성 */}
      {user.role === "EXPERT" && (
        <div style={{ marginTop: 24 }}>
          <h3>시나리오 작성 (전문가 전용)</h3>

          <div>
            <label>제목: </label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label>요약: </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
          <div>
            <label>난이도: </label>
            <select
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>
          <div>
            <label>접근 권한: </label>
            <select
              value={access}
              onChange={(e) => setAccess(e.target.value as any)}
            >
              <option value="FREE">FREE</option>
              <option value="MEMBER">MEMBER</option>
            </select>
          </div>
          <div>
            <label>사건 요약: </label>
            <textarea
              value={caseSummary}
              onChange={(e) => setCaseSummary(e.target.value)}
            />
          </div>

          <h4>등장인물</h4>
          {characters.map((c, i) => (
            <div
              key={i}
              style={{ border: "1px solid #ccc", margin: 8, padding: 8 }}
            >
              <label>이름: </label>
              <input
                value={c.name}
                onChange={(e) => updateCharacter(i, "name", e.target.value)}
              />
              <br />
              <label>역할: </label>
              <select
                value={c.role}
                onChange={(e) => updateCharacter(i, "role", e.target.value)}
              >
                <option value="용의자">용의자</option>
                <option value="범인">범인</option>
              </select>
              <br />
              <label>직업: </label>
              <input
                value={c.occupation}
                onChange={(e) =>
                  updateCharacter(i, "occupation", e.target.value)
                }
              />
              <br />
              <label>성격: </label>
              <input
                value={c.personality}
                onChange={(e) =>
                  updateCharacter(i, "personality", e.target.value)
                }
              />
              <br />
              <label>알리바이: </label>
              <input
                value={c.alibi}
                onChange={(e) => updateCharacter(i, "alibi", e.target.value)}
              />
              <br />
              <label>임무: </label>
              <input
                value={c.mission}
                onChange={(e) => updateCharacter(i, "mission", e.target.value)}
              />
              <br />
              <label>말투: </label>
              <input
                value={c.speech_style}
                onChange={(e) =>
                  updateCharacter(i, "speech_style", e.target.value)
                }
              />
              <br />
              <label>진실 성향: </label>
              <input
                value={c.truth_tendency}
                onChange={(e) =>
                  updateCharacter(i, "truth_tendency", e.target.value)
                }
              />
            </div>
          ))}
          <button onClick={addCharacter}>등장인물 추가</button>

          <h4>단서 (Clues)</h4>
          {clues.map((clue, i) => (
            <div
              key={clue.id}
              style={{ border: "1px solid #ccc", margin: 8, padding: 8 }}
            >
              <label>설명: </label>
              <input
                value={clue.description}
                onChange={(e) =>
                  updateClue(i, "description", e.target.value)
                }
              />
              <br />
              <label>중요도: </label>
              <select
                value={clue.importance}
                onChange={(e) =>
                  updateClue(i, "importance", e.target.value)
                }
              >
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </div>
          ))}
          <button onClick={addClue}>단서 추가</button>

          <div style={{ marginTop: 16 }}>
            <label>정답 (Solution): </label>
            <input
              type="text"
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              placeholder="예: 홍길이가 고서를 훔쳤다"
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <button onClick={handleCreateScenario}>시나리오 제출</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button onClick={handleLogout}>로그아웃</button>
      </div>
    </div>
  );
}
