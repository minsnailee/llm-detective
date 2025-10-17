# LLM·NLP 기반 인터랙티브 추리게임 (LLM Detective)

AI 용의자와 대화하며 단서를 모으고 범인을 추리하는 웹 서비스.

플레이 로그를 NLP로 분석해 **논리 · 집중 · 창의 · 다양성 · 깊이**(0~100) 지표를 산출하고 레이더 차트로 시각화합니다.

---

## 핵심 기능 

- **AI 심문 플레이**: 자유 질문 → AI 용의자 응답 → 단서 수집
- **시나리오 기반 추리**: 사건/용의자/증거를 JSON으로 구조화·관리
- **평가·시각화**: NLP 분석으로 5개 지표 산출 → 레이더 차트 표시
- **회원/권한**: MEMBER / EXPERT / ADMIN 역할 구분
- **확장성**: FastAPI 기반 로컬 NLP → 모델 교체/튜닝 용이

---

## 시스템 구성

```
[React (Vite+TS)]  <—>  [Spring Boot API]  <—>  [MySQL]
                                        │
                                        └── [FastAPI NLP] ─ KoSimCSE/SBERT + NLI

```

- 프론트엔드: React + Vite + TypeScript + Tailwind, Chart.js
- 백엔드: Spring Boot + JPA, 시나리오/세션/결과 REST API
- NLP: FastAPI, 한국어 임베딩(KoSimCSE/Ko-SBERT) + NLI 기반 점수화

---

## 프로젝트 구조

```
.
├─ detective-frontend/        # React + Vite + TS (UI, 플레이)
├─ detective-backend/         # Spring Boot (REST API, JPA)
└─ detective-nlp/             # FastAPI (임베딩/평가)

```

---

## 빠른 시작(로컬)

1. **DB 준비 (MySQL 8+)**
- 스키마 생성: `CREATE DATABASE detective CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`
- 사용자/권한 부여(예): `CREATE USER 'detective'@'%' IDENTIFIED BY 'detective_pass'; GRANT ALL ON detective.* TO 'detective'@'%'; FLUSH PRIVILEGES;`
1. **각 서비스 환경파일 작성**
- 백엔드: `detective-backend/src/main/resources/application-dev.properties`
- 프론트: `detective-frontend/.env`

1. **서비스 실행 순서(권장)**
- **MySQL → Backend → NLP → Frontend**

---

## 서비스별 실행 방법

### Backend (Spring Boot)

```bash
cd detective-backend
# (처음만) mvnw 실행 권한 부여 (macOS/Linux)
chmod +x mvnw

# 개발 프로필로 실행
./mvnw spring-boot:run

```
---

### Frontend (React + Vite + TS)

```bash
cd detective-frontend
cp .env.example .env      # 필요 시 수정
npm install
npm run dev

```

- 개발 서버: `http://localhost:5173` (Vite 기본)
- API 베이스: `.env`의 `VITE_API_BASE` 사용(예: `http://localhost:8090/api`)

---

### NLP (FastAPI)

```bash
cd detective-nlp
python -m venv venv
# macOS/Linux
source venv/bin/activate
# Windows
# venv\Scripts\activate

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000

```

- 헬스체크: `GET http://localhost:8000/health` (엔드포인트가 `/nlp/health`라면 거기에 맞춰 수정)
- 분석 API: `POST /analyze` (또는 `/nlp/analyze` — 실제 경로에 맞춰 사용)


## 주요 API 요약

### Backend

#### 시나리오 / 게임

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/scenarios` | 시나리오 목록 |
| GET | `/api/scenarios/{id}` | 시나리오 상세 |
| POST | `/api/scenarios/create` | 시나리오 생성 |
| POST | `/api/game/session/start` | 게임 세션 시작 |
| POST | `/api/game/ask` | 질문(심문) 요청 |
| POST | `/api/game/result` | 최종 결과 제출 |
| POST | `/api/media/upload` | 미디어 업로드 |

#### 게임 결과

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/game-results/{resultId}` | 결과 단건 조회 |
| GET | `/api/game-results/all` | 전체 결과(관리/리뷰용) |
| GET | `/api/game-results/me` | 내 결과 목록 |
| GET | `/api/game-results/session/{sessionId}` | 세션별 결과 |
| GET | `/api/game-results/user/{userId}` | 사용자별 결과 |

#### 사용자

| Method | Path | 설명 |
| --- | --- | --- |
| POST | `/api/users/signup` | 회원가입 |
| POST | `/api/users/login` | 로그인 |
| POST | `/api/users/logout` | 로그아웃 |
| GET | `/api/users/me` | 내 정보 |
| POST | `/api/users/update-nickname` | 닉네임 변경 |
| POST | `/api/users/update-password` | 비밀번호 변경 |
| POST | `/api/users/request-expert` | 전문가 권한 요청 |
| POST | `/api/users/approve-expert/{userId}` | 전문가 승인(관리) |

#### 관리자

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/admin/users` | 사용자 목록 |
| DELETE | `/api/admin/users/{userId}` | 사용자 삭제 |
| GET | `/api/admin/scenarios` | 시나리오 목록(관리) |
| DELETE | `/api/admin/scenarios/{id}` | 시나리오 삭제 |
| POST | `/api/admin/scenarios/{id}/approve` | 시나리오 승인 |
| POST | `/api/admin/scenarios/{id}/reject` | 시나리오 반려 |

### NLP

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/health` | NLP 서비스 상태 |
| POST | `/analyze` | 플레이 로그 분석 → `{engine, skills, submetrics}` |


## 평가 지표 개요

- **Logic(논리)**: 팩트/알리바이와의 일치·모순 탐지
- **Focus(집중)**: 사건 핵심 요소 대비 집중도
- **Creativity(창의)**: 새로운 가설·추론 시도
- **Diversity(다양성)**: 질문 패턴/주제 분포 다양성
- **Depth(깊이)**: 후속 질문, 원인→결과 연결

> 내부적으로 한국어 임베딩(예: BM-K/KoSimCSE-roberta-multitask, jhgan/ko-sroberta-multitask)과 NLI(Huffon/klue-roberta-base-nli) 신호를 조합합니다.

## 예정 항목(Planned)

- 시나리오 저작 도구 고도화
- 질문 패턴 분석 고도화(다양성/깊이 개선)
- 난이도 개인화 및 추천 시나리오
- 분석 리포트 PDF/이미지 내보내기
- 배포 레포와 CI/CD·모니터링·MLOps 연계
