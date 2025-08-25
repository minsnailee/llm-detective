package com.lingoguma.detective_backend.game.service;

import com.lingoguma.detective_backend.game.dto.GameResultRequest;
import com.lingoguma.detective_backend.game.dto.GameResultResponse;
import com.lingoguma.detective_backend.game.entity.GameResult;
import com.lingoguma.detective_backend.game.repository.GameResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GameResultService {

    private final GameResultRepository gameResultRepository;

    public GameResultResponse saveResult(GameResultRequest req) {
        GameResult entity = GameResult.builder()
                .scenIdx(req.getScenarioId())
                .userId(req.getUserId())
                .answerJson(req.getAnswerJson())
                .skillsJson(req.getSkillsJson())
                .build();
        return GameResultResponse.fromEntity(gameResultRepository.save(entity));
    }
}
