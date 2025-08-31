package com.lingoguma.detective_backend.game.dto;

import lombok.Data;
import java.util.Map;

/**
 * FastAPI의 분석 응답 DTO
 * - skills: 최종 점수(0~100)
 * - submetrics: 설명/디버깅용 보조 지표(선택 저장)
 * - engine: 어떤 엔진 사용했는지(hf/dummy)
 */
@Data
public class NlpAnalyzeResponse {
    private Map<String, Integer> skills;     // logic, creativity, focus, diversity, depth

    // [ADD] 아래 두 필드는 선택이지만 디버깅/분석 추적에 유용
    private Map<String, Double> submetrics;  // e.g. focus_sim, logic_z, novelty...
    private String engine;                   // "hf" or "dummy"
}
