package com.lingoguma.detective_backend.game.dto;

import lombok.Data;
import java.util.Map;

@Data
public class GameFinishRequest {
    private Integer sessionId;
    private Integer scenIdx;
    private Integer userIdx;                // 비로그인일 경우 null
    private boolean correct;                // 정답 여부
    private Map<String, Object> answerJson; // 최종 답변/근거
    private Map<String, Object> skills;     // nlp 점수
}
