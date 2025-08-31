package com.lingoguma.detective_backend.game.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lingoguma.detective_backend.game.dto.GameFinishRequest;
import com.lingoguma.detective_backend.game.entity.GameResult;
import com.lingoguma.detective_backend.game.repository.GameResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class GameResultService {

    private final GameResultRepository repo;
    private final ObjectMapper mapper; // Bean 주입

    @Transactional
    public Integer saveResult(GameFinishRequest req, String skillsJsonStr, boolean isCorrect) {
        try {
            // answerJson → JSON 변환
            Map<String, Object> answerMap = mapper.convertValue(
                    req.getAnswerJson(),
                    new TypeReference<Map<String, Object>>() {}
            );
            String answerJsonStr = mapper.writeValueAsString(answerMap);

            GameResult gr = GameResult.builder()
                    .sessionId(req.getSessionId())
                    .scenIdx(req.getScenIdx())
                    .userIdx(req.getUserIdx())
                    .answerJson(answerJsonStr)
                    .skillsJson(skillsJsonStr)
                    .isCorrect(isCorrect) // 서버 계산 correct 반영
                    .build();

            return repo.save(gr).getResultId();
        } catch (Exception e) {
            throw new RuntimeException("결과 저장 실패", e);
        }
    }
}
