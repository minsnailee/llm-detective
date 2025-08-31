package com.lingoguma.detective_backend.game.dto;

import lombok.Data;
import java.util.Map;
import java.util.List;

/**
 * FastAPI로 넘길 분석 요청 DTO
 * - 기존 sessionId, logJson에 더해
 * - caseTitle/caseSummary/facts/finalAnswer/engine를 전달해 정확도 향상
 */
@Data
public class NlpAnalyzeRequest {
    private Integer sessionId;
    private Map<String, Object> logJson;

    // [ADD] 맥락+정답요약 전달 필드
    private String caseTitle;                 // 시나리오 제목
    private String caseSummary;               // 시나리오 요약
    private List<String> facts;               // 핵심 단서(알리바이/증거/타임라인 등) 문장 리스트
    private Map<String, Object> finalAnswer;  // 사용자가 제출한 범인/언제/어떻게/왜... 요약

    // [ADD] 엔진 고정(“hf” or “dummy”), 미설정 시 서버 기본값 사용
    private String engine;

    private Map<String,Object> timings;        // 타이머 정보
}
