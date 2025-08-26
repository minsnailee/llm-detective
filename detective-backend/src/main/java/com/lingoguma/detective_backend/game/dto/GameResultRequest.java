package com.lingoguma.detective_backend.game.dto;

import lombok.*;
import java.util.Map;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class GameResultRequest {
    private Integer sessionId;                 // ✅ game_results.session_id
    private Integer scenIdx;                   // ✅ game_results.scen_idx
    private Integer userIdx;                   // ✅ game_results.user_idx
    private Map<String, Object> answerJson; // JSON 그대로 받음
    private Map<String, Integer> skills;    // NLP 점수 JSON
    private boolean isCorrect;              // 정답 여부 (추가 컬럼)
}



// package com.lingoguma.detective_backend.game.dto;

// import lombok.*;

// @Getter
// @Setter
// @NoArgsConstructor
// @AllArgsConstructor
// @Builder
// public class GameResultRequest {
//     private Integer scenarioId;
//     private Long userId; // 임시, 나중엔 SecurityContext에서 가져오기
//     private String answerJson;  // 범인/언제/어떻게/왜 JSON 문자열
//     private String skillsJson;  // NLP 점수 JSON (선택)
// }
