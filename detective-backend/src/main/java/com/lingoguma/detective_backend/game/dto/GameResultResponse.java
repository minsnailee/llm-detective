package com.lingoguma.detective_backend.game.dto;

import com.lingoguma.detective_backend.game.entity.GameResult;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GameResultResponse {
    private Long resultId;
    private Integer scenIdx;
    private Long userId;
    private String answerJson;
    private String skillsJson;

    public static GameResultResponse fromEntity(GameResult entity) {
        return GameResultResponse.builder()
                .resultId(entity.getResultId())
                .scenIdx(entity.getScenIdx())
                .userId(entity.getUserId())
                .answerJson(entity.getAnswerJson())
                .skillsJson(entity.getSkillsJson())
                .build();
    }
}
