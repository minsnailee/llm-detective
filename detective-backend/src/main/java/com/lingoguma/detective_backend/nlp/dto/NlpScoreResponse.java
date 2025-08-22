package com.lingoguma.detective_backend.nlp.dto;

import lombok.*;
import java.util.List;

/**
 * FastAPI에서 반환하는 응답 바디와 1:1로 맞춘 모델.
 * 점수(0~100)와 키워드/근거 리스트를 받는다.
 */

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class NlpScoreResponse {
    private int logic;
    private int creativity;
    private int focus;
    private int diversity;
    private int depth;
    private List<String> keywords;
    private List<String> evidence;
}
