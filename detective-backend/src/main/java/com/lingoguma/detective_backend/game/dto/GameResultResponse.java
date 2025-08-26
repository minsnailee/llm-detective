package com.lingoguma.detective_backend.game.dto;

import com.lingoguma.detective_backend.game.entity.GameResult;
import lombok.*;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class GameResultResponse {
    private Integer resultId;
    private Integer sessionId;
    private Integer scenIdx;
    private Integer userIdx;
    private String answerJson;
    private String skillsJson;

    public static GameResultResponse fromEntity(GameResult entity) {
        return GameResultResponse.builder()
                .resultId(entity.getResultId())
                .sessionId(entity.getSessionId())
                .scenIdx(entity.getScenIdx())
                .userIdx(entity.getUserIdx())
                .answerJson(entity.getAnswerJson())
                .skillsJson(entity.getSkillsJson())
                .build();
    }
}
