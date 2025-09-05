package com.lingoguma.detective_backend.game.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lingoguma.detective_backend.game.entity.GameSession;
import com.lingoguma.detective_backend.game.entity.GameStatus;
import com.lingoguma.detective_backend.game.repository.GameSessionRepository;
import com.lingoguma.detective_backend.scenario.entity.Scenario;
import com.lingoguma.detective_backend.scenario.repository.ScenarioRepository;
import com.lingoguma.detective_backend.user.entity.User;
import com.lingoguma.detective_backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class GameSessionService {

    private final GameSessionRepository repo;
    private final ScenarioRepository scenarioRepository;
    private final UserRepository userRepository;
    private final ObjectMapper mapper;

    // ==============================
    // 세션 시작
    // ==============================
    @Transactional
    public Integer startSession(Integer scenIdx, Integer userIdx) {
        Scenario scenario = scenarioRepository.findById(scenIdx)
                .orElseThrow(() -> new RuntimeException("시나리오 없음"));

        User user = null;
        if (userIdx != null) {
            user = userRepository.findById(userIdx)
                    .orElseThrow(() -> new RuntimeException("유저 없음"));
        }

        GameSession session = GameSession.builder()
                .scenario(scenario)
                .user(user)
                .status(GameStatus.PLAYING)
                .logJson("{\"logs\":[]}")
                .build();

        GameSession saved = repo.save(session);
        return saved.getSessionId();
    }

    // ==============================
    // 세션에 연결된 시나리오 조회
    // ==============================
    @Transactional(readOnly = true)
    public Scenario getScenario(Integer sessionId) {
        GameSession s = repo.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("세션 없음"));
        return s.getScenario();
    }

    // ==============================
    // 세션 로그 가져오기
    // ==============================
    @Transactional(readOnly = true)
    public String getLogJson(Integer sessionId) {
        GameSession s = repo.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("세션 없음"));
        return (s.getLogJson() == null || s.getLogJson().isBlank())
                ? "{\"logs\":[]}" : s.getLogJson();
    }

    // ==============================
    // [신규] 구조화 로그 저장 (권장)
    //  - userLog / npcLog 기대 키:
    //    speaker(옵션), suspect(옵션), suspectId(옵션), message(필수), meta(옵션 Map), ts(옵션: epoch sec)
    //  - 여기서 turn/ts/meta/speaker 기본값 보강 후 저장
    // ==============================
    @Transactional
    public void appendLogRich(Integer sessionId,
                              Map<String, Object> userLog,
                              Map<String, Object> npcLog) {
        GameSession s = repo.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("세션 없음"));

        try {
            Map<String, Object> root = mapper.readValue(
                    (s.getLogJson() == null || s.getLogJson().isBlank()) ? "{\"logs\":[]}" : s.getLogJson(),
                    new TypeReference<Map<String, Object>>() {}
            );

            List<Map<String, Object>> logs = toLogList(root.get("logs"));
            int turn = (logs.size() / 2) + 1;
            long now = System.currentTimeMillis() / 1000L;

            Map<String, Object> safeUser = new java.util.HashMap<>(userLog == null ? Map.of() : userLog);
            safeUser.putIfAbsent("speaker", "PLAYER");
            safeUser.put("turn", turn);
            safeUser.putIfAbsent("ts", now);
            safeUser.putIfAbsent("meta", Map.of());
            if (!safeUser.containsKey("message") || String.valueOf(safeUser.get("message")).isBlank()) {
                throw new IllegalArgumentException("appendLogRich: userLog.message is required");
            }

            Map<String, Object> safeNpc = new java.util.HashMap<>(npcLog == null ? Map.of() : npcLog);
            safeNpc.putIfAbsent("speaker", "NPC");
            safeNpc.put("turn", turn);
            safeNpc.putIfAbsent("ts", now + 1);
            safeNpc.putIfAbsent("meta", Map.of());
            if (!safeNpc.containsKey("message") || String.valueOf(safeNpc.get("message")).isBlank()) {
                throw new IllegalArgumentException("appendLogRich: npcLog.message is required");
            }

            logs.add(safeUser);
            logs.add(safeNpc);

            root.put("logs", logs);
            s.setLogJson(mapper.writeValueAsString(root));
            repo.save(s);
        } catch (Exception e) {
            throw new RuntimeException("세션 로그 업데이트 실패(appendLogRich)", e);
        }
    }

    // ==============================
    // [호환] 기존 appendLog (인라인 메타 등으로 계속 사용 가능)
    // ==============================
    @Transactional
    public void appendLog(Integer sessionId, String suspectName, String userText, String aiAnswer) {
        GameSession s = repo.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("세션 없음"));

        try {
            Map<String, Object> root = mapper.readValue(
                    (s.getLogJson() == null || s.getLogJson().isBlank()) ? "{\"logs\":[]}" : s.getLogJson(),
                    new TypeReference<Map<String, Object>>() {}
            );

            List<Map<String, Object>> logs = toLogList(root.get("logs"));
            int turn = (logs.size() / 2) + 1;
            long now = System.currentTimeMillis() / 1000L;

            logs.add(Map.of(
                    "turn", turn,
                    "speaker", "PLAYER",
                    "suspect", suspectName,
                    "message", userText,
                    "ts", now
            ));

            logs.add(Map.of(
                    "turn", turn,
                    "speaker", "AI",
                    "suspect", suspectName,
                    "message", aiAnswer,
                    "ts", now + 1
            ));

            root.put("logs", logs);
            s.setLogJson(mapper.writeValueAsString(root));
            repo.save(s);

        } catch (Exception e) {
            throw new RuntimeException("세션 로그 업데이트 실패", e);
        }
    }

    // ==============================
    // 세션 종료
    // ==============================
    @Transactional
    public void finishSession(Integer sessionId) {
        GameSession s = repo.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("세션 없음"));
        s.setStatus(GameStatus.FINISHED);
        repo.save(s);
    }

    // ==============================
    // 내부 유틸
    // ==============================
    private List<Map<String, Object>> toLogList(Object logsObj) {
        List<Map<String, Object>> logs;
        if (logsObj == null) {
            logs = new ArrayList<>();
        } else {
            logs = mapper.convertValue(logsObj, new TypeReference<List<Map<String, Object>>>() {});
            if (logs == null) logs = new ArrayList<>();
        }
        return logs;
    }
}
