package com.lingoguma.detective_backend.game.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lingoguma.detective_backend.game.dto.*;
import com.lingoguma.detective_backend.game.service.*;
import com.lingoguma.detective_backend.scenario.entity.Scenario;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/game")
@RequiredArgsConstructor
public class GameController {

    private final GptClient gptClient;
    private final GameSessionService sessionService;
    private final ObjectMapper mapper;
    private final GameResultService resultService;
    private final GameNlpClient nlpClient;

    // ==============================
    // 세션 시작
    // ==============================
    @PostMapping("/session/start")
    public ResponseEntity<Integer> startSession(
            @RequestParam Integer scenIdx,
            @RequestParam(required = false) Integer userIdx
    ) {
        Integer sessionId = sessionService.startSession(scenIdx, userIdx);
        return ResponseEntity.ok(sessionId);
    }

    // ==============================
    // 질문하기 (GPT 호출 + 로그 저장)
    // ==============================
    @PostMapping("/ask")
    public ResponseEntity<NlpAskResponse> ask(@RequestBody NlpAskRequest req) {
        // 1. 직전 로그 불러오기
        Map<String, Object> logMap;
        try {
            logMap = mapper.readValue(
                    sessionService.getLogJson(req.getSessionId()),
                    new TypeReference<Map<String, Object>>() {}
            );
        } catch (Exception e) {
            logMap = Map.of("logs", List.of());
        }

        // 2. 시나리오 content_json 읽기
        Scenario scenario = sessionService.getScenario(req.getSessionId());
        Map<String, Object> content;
        try {
            content = mapper.readValue(
                    scenario.getContentJson(),
                    new TypeReference<Map<String, Object>>() {}
            );
        } catch (Exception e) {
            content = Map.of();
        }

        // prompt + characters 안전 추출
        @SuppressWarnings("unchecked")
        Map<String, Object> promptConfig = (Map<String, Object>) content.getOrDefault("prompt", Map.of());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> characters = (List<Map<String, Object>>) content.getOrDefault("characters", List.of());

        // 캐릭터 찾기
        Map<String, Object> suspect = characters.stream()
                .filter(c -> req.getSuspectName().equals(c.get("name")))
                .findFirst()
                .orElse(Map.of());

        // system 프롬프트 구성
        String mission = (String) promptConfig.getOrDefault("mission", "너는 사건 속 등장인물 중 하나다.");
        @SuppressWarnings("unchecked")
        List<String> rules = (List<String>) promptConfig.getOrDefault("rules", List.of());

        StringBuilder systemPrompt = new StringBuilder();
        systemPrompt.append(mission).append("\n");

        if (!rules.isEmpty()) {
            systemPrompt.append("규칙:\n");
            for (String r : rules) {
                systemPrompt.append("- ").append(r).append("\n");
            }
        }

        // 캐릭터 상세 정보
        systemPrompt.append("\n### 너의 캐릭터 정보 ###\n");
        systemPrompt.append("이름: ").append(suspect.getOrDefault("name", "알 수 없는 인물")).append("\n");
        systemPrompt.append("직업: ").append(suspect.getOrDefault("job", "알 수 없음")).append("\n");
        systemPrompt.append("나이: ").append(suspect.getOrDefault("age", "알 수 없음")).append("\n");
        systemPrompt.append("성별: ").append(suspect.getOrDefault("gender", "알 수 없음")).append("\n");
        systemPrompt.append("성격: ").append(suspect.getOrDefault("personality", "알 수 없음")).append("\n");
        systemPrompt.append("말투: ").append(suspect.getOrDefault("speaking_style", "알 수 없음")).append("\n");
        systemPrompt.append("옷차림: ").append(suspect.getOrDefault("outfit", "알 수 없음")).append("\n");
        systemPrompt.append("알리바이: ").append(
                suspect.containsKey("alibi") ? suspect.get("alibi").toString() : "알 수 없음"
        ).append("\n");
        systemPrompt.append("임무: ").append(suspect.getOrDefault("mission", "알 수 없음")).append("\n");
        systemPrompt.append("샘플 대사: ").append(suspect.getOrDefault("sample_line", "없음")).append("\n");

        systemPrompt.append("\n반드시 위 캐릭터 설정과 말투를 유지해서 대답하라.\n");

        List<Map<String, String>> messages = new java.util.ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt.toString()));

        // 3. 이전 로그 이어붙임
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> logs = (List<Map<String, Object>>) logMap.getOrDefault("logs", List.of());
        for (Map<String, Object> l : logs) {
            String role = "PLAYER".equals(l.get("speaker")) ? "user" : "assistant";
            String contentMsg = (String) l.getOrDefault("message", "");
            if (contentMsg != null && !contentMsg.isBlank()) {
                messages.add(Map.of("role", role, "content", contentMsg));
            }
        }

        // 4. 현재 질문 추가
        messages.add(Map.of(
                "role", "user",
                "content", "[용의자:" + req.getSuspectName() + "] 플레이어 질문: " + req.getUserText()
        ));

        // 5. GPT 호출
        String answer = gptClient.chat(messages);

        // 6. DB 로그 저장
        sessionService.appendLog(req.getSessionId(), req.getSuspectName(), req.getUserText(), answer);

        // 7. 응답 반환
        NlpAskResponse resp = new NlpAskResponse();
        resp.setAnswer(answer);
        return ResponseEntity.ok(resp);
    }

    // ==============================
    // 사건 종료 → NLP 분석 + 결과 저장
    // ==============================
    @PostMapping("/result")
    public ResponseEntity<Map<String, Integer>> finish(@RequestBody GameFinishRequest req) {
        try {
            // 회원만 저장하고 싶을 때 주석 해제
            // if (req.getUserIdx() == null) {
            //     return ResponseEntity.ok("게스트 플레이 결과 (DB 저장 안 함)");
            // }

            // 1. 세션 로그 불러오기
            String logJsonStr = sessionService.getLogJson(req.getSessionId());

            // 2. NLP 요청 DTO 준비
            NlpAnalyzeRequest analyzeReq = new NlpAnalyzeRequest();
            analyzeReq.setSessionId(req.getSessionId());
            analyzeReq.setLogJson(safeToMap(logJsonStr));

            // 2-1. 시나리오 메타 및 단서 추출
            Scenario scenario = sessionService.getScenario(req.getSessionId());
            Map<String, Object> content = mapper.readValue(
                    scenario.getContentJson(),
                    new TypeReference<Map<String, Object>>() {}
            );

            @SuppressWarnings("unchecked")
            Map<String, Object> scenMeta = (Map<String, Object>) content.getOrDefault("scenario", Map.of());
            String caseTitle = (String) scenMeta.getOrDefault("title", scenario.getScenTitle());
            String caseSummary = (String) scenMeta.getOrDefault("summary", scenario.getScenSummary());

            java.util.List<String> facts = new java.util.ArrayList<>();

            // characters[].alibi
            @SuppressWarnings("unchecked")
            java.util.List<Map<String, Object>> characters =
                    (java.util.List<Map<String, Object>>) content.getOrDefault("characters", java.util.List.of());
            for (Map<String, Object> ch : characters) {
                Object alibi = ch.get("alibi");
                if (alibi != null) {
                    facts.add(ch.getOrDefault("name", "") + " 알리바이: " + alibi.toString());
                }
            }

            // evidence[]
            @SuppressWarnings("unchecked")
            java.util.List<Map<String, Object>> evidence =
                    (java.util.List<Map<String, Object>>) content.getOrDefault("evidence", java.util.List.of());
            for (Map<String, Object> ev : evidence) {
                String name = String.valueOf(ev.getOrDefault("name", ""));
                String desc = String.valueOf(ev.getOrDefault("desc", ""));
                if (!name.isBlank()) {
                    facts.add("증거: " + name + (desc.isBlank() ? "" : " - " + desc));
                }
            }

            // timeline[]
            @SuppressWarnings("unchecked")
            java.util.List<Map<String, Object>> timeline =
                    (java.util.List<Map<String, Object>>) content.getOrDefault("timeline", java.util.List.of());
            for (Map<String, Object> t : timeline) {
                String time = String.valueOf(t.getOrDefault("time", ""));
                String event = String.valueOf(t.getOrDefault("event", ""));
                if (!time.isBlank() && !event.isBlank()) {
                    facts.add("타임라인 " + time + ": " + event);
                }
            }

            // 너무 길면 상위 N개만
            int MAX_FACTS = 12;
            if (facts.size() > MAX_FACTS) {
                facts = facts.subList(0, MAX_FACTS);
            }

            analyzeReq.setCaseTitle(caseTitle);
            analyzeReq.setCaseSummary(caseSummary);
            analyzeReq.setFacts(facts);
            analyzeReq.setFinalAnswer(req.getAnswerJson());
            analyzeReq.setTimings(req.getTimings());   // 프론트에서 보낸 타이머 데이터
            analyzeReq.setEngine("hf");

            // 3. FastAPI 호출
            NlpAnalyzeResponse analyzeResp = null;
            try {
                analyzeResp = nlpClient.analyze(analyzeReq);
            } catch (Exception e) {
                System.err.println("NLP 분석 서버 호출 실패: " + e.getMessage());
            }

            // 4. skills 결정 (프론트 skills > NLP 결과 > 빈값)
            Map<String, Object> skillsToSave;
            if (req.getSkills() != null) {
                skillsToSave = new java.util.HashMap<>(req.getSkills());
            } else if (analyzeResp != null && analyzeResp.getSkills() != null) {
                skillsToSave = new java.util.HashMap<>(analyzeResp.getSkills());
            } else {
                skillsToSave = Map.of();
            }

            String skillsJsonStr = toJson(skillsToSave);

            // 5. 정답 여부 계산
            boolean isCorrect = checkCorrect(req);

            // 6. DB 저장
            Integer resultId = resultService.saveResult(req, skillsJsonStr, isCorrect);

            // 7. 세션 종료
            sessionService.finishSession(req.getSessionId());

            // return ResponseEntity.ok("Result saved: " + resultId);
            return ResponseEntity.ok(Map.of("resultId", resultId)); // 성공 시 (예) { "resultId": 10 }

        } catch (Exception e) {
            e.printStackTrace();

            // 실패 시 { "error": -1 } 같은 JSON 반환
            return ResponseEntity.status(500).body(Map.of("error", -1));
        }
    }

    private boolean checkCorrect(GameFinishRequest req) {
        try {
            Scenario scenario = sessionService.getScenario(req.getSessionId());
            Map<String, Object> content = mapper.readValue(
                    scenario.getContentJson(),
                    new TypeReference<Map<String, Object>>() {}
            );

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> characters = (List<Map<String, Object>>) content.get("characters");

            String realCulprit = characters.stream()
                    .filter(c -> "범인".equals(c.get("role")))
                    .map(c -> (String) c.get("name"))
                    .findFirst()
                    .orElse(null);

            if (realCulprit != null && req.getAnswerJson() != null) {
                String chosen = (String) req.getAnswerJson().get("culprit");
                return realCulprit.equals(chosen);
            }
        } catch (Exception e) {
            System.err.println("정답 검증 중 오류: " + e.getMessage());
        }
        return false;
    }

    // ==============================
    // util
    // ==============================
    private Map<String, Object> safeToMap(String json) {
        try {
            return mapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Map.of("logs", List.of());
        }
    }

    private String toJson(Object o) {
        try {
            return mapper.writeValueAsString(o);
        } catch (Exception e) {
            return "{}";
        }
    }
}
