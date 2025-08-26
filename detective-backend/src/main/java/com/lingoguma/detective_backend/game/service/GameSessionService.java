package com.lingoguma.detective_backend.game.service;

import com.lingoguma.detective_backend.game.entity.GameSession;
import com.lingoguma.detective_backend.game.entity.GameStatus;
import com.lingoguma.detective_backend.game.repository.GameSessionRepository;
import com.lingoguma.detective_backend.scenario.entity.Scenario;
import com.lingoguma.detective_backend.scenario.repository.ScenarioRepository;
import com.lingoguma.detective_backend.user.entity.User;
import com.lingoguma.detective_backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class GameSessionService {

    private final GameSessionRepository gameSessionRepository;
    private final ScenarioRepository scenarioRepository;
    private final UserRepository userRepository;

    // 세션 시작
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

        GameSession saved = gameSessionRepository.save(session);
        return saved.getSessionId();
    }

    // 세션 종료
    public void finishSession(Integer sessionId) {
        GameSession session = gameSessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("세션 없음"));
        session.setStatus(GameStatus.FINISHED);
        gameSessionRepository.save(session);
    }
}
