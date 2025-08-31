package com.lingoguma.detective_backend.game.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lingoguma.detective_backend.game.dto.*;
import com.lingoguma.detective_backend.game.entity.GameResult;
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
        systemPrompt.append("너는 '").append(suspect.getOrDefault("name", "알 수 없는 인물")).append("'이라는 캐릭터다.\n")
                .append("직업: ").append(suspect.getOrDefault("job", "알 수 없음")).append("\n")
                .append("성격: ").append(suspect.getOrDefault("personality", "알 수 없음")).append("\n")
                .append("알리바이: ").append(suspect.getOrDefault("alibi", "알 수 없음"));

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
    public ResponseEntity<String> finish(@RequestBody GameFinishRequest req) {
        try {
            // 회원만 저장하고 싶을 때 주석 해제
            // if (req.getUserIdx() == null) {
            //     return ResponseEntity.ok("게스트 플레이 결과 (DB 저장 안 함)");
            // }

            // 1. 세션 로그 불러오기
            String logJsonStr = sessionService.getLogJson(req.getSessionId());

            // 2. FastAPI 분석 요청
            NlpAnalyzeRequest analyzeReq = new NlpAnalyzeRequest();
            analyzeReq.setSessionId(req.getSessionId());
            analyzeReq.setLogJson(safeToMap(logJsonStr));

            NlpAnalyzeResponse analyzeResp = null;
            try {
                analyzeResp = nlpClient.analyze(analyzeReq);
            } catch (Exception e) {
                System.err.println("⚠ NLP 분석 서버 호출 실패: " + e.getMessage());
            }

            // 3. skills 결정
            Map<String, Object> skillsToSave;
            if (req.getSkills() != null) {
                skillsToSave = new java.util.HashMap<>(req.getSkills());
            } else if (analyzeResp != null && analyzeResp.getSkills() != null) {
                skillsToSave = new java.util.HashMap<>(analyzeResp.getSkills());
            } else {
                skillsToSave = Map.of();
            }

            String skillsJsonStr = toJson(skillsToSave);

            // 4. 정답 여부 계산 (메서드 분리)
            boolean isCorrect = checkCorrect(req);

            // 5. DB 저장 (Service에 isCorrect 전달)
            Integer resultId = resultService.saveResult(req, skillsJsonStr, isCorrect);

            // 6. 세션 종료
            sessionService.finishSession(req.getSessionId());

            return ResponseEntity.ok("Result saved: " + resultId);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("결과 저장 실패: " + e.getMessage());
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
            System.err.println("⚠ 정답 검증 중 오류: " + e.getMessage());
        }
        return false; // 실패 시 기본값은 false
    }

    // ==============================
    // util
    // ==============================
    // JSON 문자열 → Map 안전 변환
    private Map<String, Object> safeToMap(String json) {
        try {
            return mapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Map.of("logs", List.of());
        }
    }

    // 객체 → JSON 문자열 변환
    private String toJson(Object o) {
        try {
            return mapper.writeValueAsString(o);
        } catch (Exception e) {
            return "{}";
        }
    }
}
