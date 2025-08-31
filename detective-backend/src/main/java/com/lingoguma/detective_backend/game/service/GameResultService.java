package com.lingoguma.detective_backend.game.service;

import com.google.gson.Gson;
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
        Gson gson = new Gson();

        GameResult entity = GameResult.builder()
                .sessionId(req.getSessionId())
                .scenIdx(req.getScenIdx())
                .userIdx(req.getUserIdx())
                .answerJson(gson.toJson(req.getAnswerJson())) // Map → JSON
                .skillsJson(gson.toJson(req.getSkills()))     // req.getSkills()로 수정
                .isCorrect(req.isCorrect())
                .build();
                

        return GameResultResponse.fromEntity(gameResultRepository.save(entity));
    }
}
