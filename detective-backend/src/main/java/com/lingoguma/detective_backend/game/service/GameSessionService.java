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

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class GameSessionService {

    private final GameSessionRepository repo;
    private final ScenarioRepository scenarioRepository;
    private final UserRepository userRepository;
    private final ObjectMapper mapper;

    // 세션 시작
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

    // 세션에 연결된 시나리오 조회
    @Transactional(readOnly = true)
    public Scenario getScenario(Integer sessionId) {
        GameSession s = repo.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("세션 없음"));
        return s.getScenario();
    }

    // 세션 로그 가져오기
    @Transactional(readOnly = true)
    public String getLogJson(Integer sessionId) {
        GameSession s = repo.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("세션 없음"));
        return (s.getLogJson() == null || s.getLogJson().isBlank())
                ? "{\"logs\":[]}" : s.getLogJson();
    }

    // 세션 로그 업데이트 (질문/답변 추가)
    @Transactional
    public void appendLog(Integer sessionId, String suspectName, String userText, String aiAnswer) {
        GameSession s = repo.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("세션 없음"));

        try {
            Map<String, Object> root = mapper.readValue(
                    s.getLogJson() == null || s.getLogJson().isBlank() ? "{\"logs\":[]}" : s.getLogJson(),
                    new TypeReference<Map<String, Object>>() {}
            );

            List<Map<String, Object>> logs = mapper.convertValue(
                    root.get("logs"),
                    new TypeReference<List<Map<String, Object>>>() {}
            );

            int turn = logs.size() / 2 + 1;

            logs.add(Map.of(
                    "turn", turn,
                    "speaker", "PLAYER",
                    "message", userText
            ));

            logs.add(Map.of(
                    "turn", turn,
                    "speaker", "AI",
                    "suspect", suspectName,
                    "message", aiAnswer
            ));

            root.put("logs", logs);
            s.setLogJson(mapper.writeValueAsString(root));
            repo.save(s);

        } catch (Exception e) {
            throw new RuntimeException("세션 로그 업데이트 실패", e);
        }
    }

    // 세션 종료
    @Transactional
    public void finishSession(Integer sessionId) {
        GameSession s = repo.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("세션 없음"));
        s.setStatus(GameStatus.FINISHED);
        repo.save(s);
    }
}
