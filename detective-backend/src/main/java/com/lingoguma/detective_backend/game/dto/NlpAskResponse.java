package com.lingoguma.detective_backend.game.dto;

import lombok.*;
import java.util.Map;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class NlpAskResponse {
    private String answer;          // GPT 답변
    private Map<String, Integer> skills; // logic, creativity 등 점수
    private Map<String, Object> log_json; // 대화 로그 전체
}
