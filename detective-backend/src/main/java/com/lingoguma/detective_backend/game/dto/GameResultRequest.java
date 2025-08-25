package com.lingoguma.detective_backend.game.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GameResultRequest {
    private Integer scenarioId;
    private Long userId; // 임시, 나중엔 SecurityContext에서 가져오기
    private String answerJson;  // 범인/언제/어떻게/왜 JSON 문자열
    private String skillsJson;  // NLP 점수 JSON (선택)
}
