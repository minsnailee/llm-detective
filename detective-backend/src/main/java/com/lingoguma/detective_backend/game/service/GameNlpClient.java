package com.lingoguma.detective_backend.game.service;

import com.lingoguma.detective_backend.game.dto.NlpAnalyzeRequest;
import com.lingoguma.detective_backend.game.dto.NlpAnalyzeResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

/**
 * FastAPI /nlp/analyze 호출 클라이언트
 * - 기본적으로 HuggingFace 엔진(engine=hf)으로 호출 (application.properties에서 변경 가능)
 * - 요청 DTO에 engine이 세팅되어 있으면 그 값이 우선
 * - fromHttpUrl(String) (Deprecated in Spring 6.2) 대신 fromUriString().path() 사용
 */
@Component
@RequiredArgsConstructor
public class GameNlpClient {

    private final RestTemplate restTemplate;

    @Value("${nlp.base-url}")
    private String nlpBaseUrl;          // 예: http://localhost:8000

    @Value("${nlp.engine:hf}")
    private String defaultEngine;       // 예: hf 또는 dummy (기본 hf)

    public NlpAnalyzeResponse analyze(NlpAnalyzeRequest req) {
        // 1) 사용할 엔진 결정: 요청 값 > 기본값
        final String engine = (req.getEngine() != null && !req.getEngine().isBlank())
                ? req.getEngine() : defaultEngine;

        // 2) URL 구성 (Deprecated API 회피)
        //    - fromUriString(base).path("/nlp/analyze").queryParam("engine", ...) 사용
        //    - base에 슬래시 유무와 상관없이 안전하게 결합됨
        URI uri = UriComponentsBuilder
                .fromUriString(nlpBaseUrl)   // e.g. "http://localhost:8000"
                .path("/nlp/analyze")        // 최종 경로
                .queryParam("engine", engine) // 쿼리로 엔진 고정
                .build(true)                 // encoding 유지
                .toUri();

        // 대안) fromUri 사용 예:
        // URI base = URI.create(nlpBaseUrl + "/nlp/analyze");
        // URI uri = UriComponentsBuilder.fromUri(base)
        //         .queryParam("engine", engine).build(true).toUri();

        // 3) 헤더/엔티티
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        // 서버는 쿼리 파라미터의 engine을 읽으므로, 바디의 engine 필드는 필수가 아님(있어도 무방)
        HttpEntity<NlpAnalyzeRequest> entity = new HttpEntity<>(req, headers);

        try {
            ResponseEntity<NlpAnalyzeResponse> resp = restTemplate.exchange(
                    uri, HttpMethod.POST, entity, NlpAnalyzeResponse.class
            );
            return resp.getBody();
        } catch (RestClientException e) {
            // 호출 실패 시 상위에서 처리할 수 있게 런타임 예외로 래핑하거나 null 반환
            // 여기서는 런타임 예외로 재던짐 (finish()에서 try-catch로 이미 감쌌으니 로그만 깔끔)
            throw new RuntimeException("NLP 서버 호출 실패: " + e.getMessage(), e);
        }
    }
}
