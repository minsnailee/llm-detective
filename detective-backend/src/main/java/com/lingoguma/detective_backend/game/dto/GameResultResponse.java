package com.lingoguma.detective_backend.game.dto;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lingoguma.detective_backend.game.entity.GameResult;
import lombok.Data;

import java.util.Map;

@Data
public class GameResultResponse {
    private Integer resultId;
    private Integer sessionId;
    private Integer scenIdx;
    private Integer userIdx;
    private Map<String, Object> answerJson;  // JSON -> Map
    private Map<String, Object> skillsJson;  // JSON -> Map
    private boolean correct;                 // boolean은 isCorrect 대신 correct로

    public static GameResultResponse fromEntity(GameResult entity, ObjectMapper mapper) {
        GameResultResponse dto = new GameResultResponse();
        dto.setResultId(entity.getResultId());
        dto.setSessionId(entity.getSessionId());
        dto.setScenIdx(entity.getScenIdx());
        dto.setUserIdx(entity.getUserIdx());
        dto.setCorrect(entity.isCorrect());

        try {
            if (entity.getAnswerJson() != null) {
                dto.setAnswerJson(mapper.readValue(
                        entity.getAnswerJson(),
                        new TypeReference<Map<String, Object>>() {}
                ));
            }
            if (entity.getSkillsJson() != null) {
                dto.setSkillsJson(mapper.readValue(
                        entity.getSkillsJson(),
                        new TypeReference<Map<String, Object>>() {}
                ));
            }
        } catch (Exception e) {
            throw new RuntimeException("JSON 변환 실패", e);
        }

        return dto;
    }
}
