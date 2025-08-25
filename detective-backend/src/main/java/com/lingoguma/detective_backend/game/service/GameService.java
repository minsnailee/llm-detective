package com.lingoguma.detective_backend.game.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lingoguma.detective_backend.game.dto.GameResultRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GameService {
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper(); // JSON 변환용

    // 세션 시작
    public Long startSession(Long scenIdx, Long userIdx) {
        String sql = "INSERT INTO game_sessions (scen_idx, user_idx, status, log_json) " +
                     "VALUES (?, ?, 'PLAYING', '{\"logs\":[]}')";
        jdbcTemplate.update(sql, scenIdx, userIdx);

        return jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    }

    // 게임 결과 저장
    public void saveResult(GameResultRequest req) {
        try {
            String answerJsonStr = objectMapper.writeValueAsString(req.getAnswerJson());
            String skillsJsonStr = objectMapper.writeValueAsString(req.getSkills());

            String sql = "INSERT INTO game_results (session_id, scen_idx, user_idx, answer_json, skills_json, is_correct) " +
                         "VALUES (?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?)";
            jdbcTemplate.update(sql,
                    req.getSessionId(),
                    req.getScenIdx(),
                    req.getUserIdx(),
                    answerJsonStr,
                    skillsJsonStr,
                    req.isCorrect()
            );

            jdbcTemplate.update("UPDATE game_sessions SET status='FINISHED' WHERE session_id=?",
                    req.getSessionId());
        } catch (Exception e) {
            throw new RuntimeException("결과 저장 중 오류", e);
        }
    }
}
