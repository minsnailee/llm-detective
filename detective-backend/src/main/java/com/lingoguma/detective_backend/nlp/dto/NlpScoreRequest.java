package com.lingoguma.detective_backend.nlp.dto;

import lombok.*;

/**
 * FastAPI에 보낼 요청 바디.
 * - roomId: 어떤 게임 룸/세션인지 식별(지금은 임시값으로도 OK)
 * - userText: 플레이어가 입력한 질문 텍스트
 */

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class NlpScoreRequest {
    private String roomId;
    private String userText;
}