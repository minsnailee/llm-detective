package com.lingoguma.detective_backend.nlp.service;

import com.lingoguma.detective_backend.nlp.dto.NlpScoreRequest;
import com.lingoguma.detective_backend.nlp.dto.NlpScoreResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * 스프링 → FastAPI로 HTTP 요청을 보내는 클라이언트.
 * - /nlp/score 엔드포인트에 POST로 요청을 보낸다.
 */
@Service
@RequiredArgsConstructor
public class NlpClient {

    private final RestTemplate restTemplate;

    // application.properties에서 주입
    @Value("${nlp.base-url}")
    private String nlpBaseUrl;

    /**
     * 플레이어 질문(userText)을 FastAPI에 전달하고, 점수/키워드를 받아온다.
     */
    public NlpScoreResponse score(NlpScoreRequest req) {
        String url = nlpBaseUrl + "/nlp/score";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<NlpScoreRequest> entity = new HttpEntity<>(req, headers);

        // FastAPI 응답을 NlpScoreResponse로 역직렬화
        ResponseEntity<NlpScoreResponse> resp = restTemplate.exchange(
                url, HttpMethod.POST, entity, NlpScoreResponse.class
        );

        // 실제 서비스라면 null 체크/예외처리를 더 다듬자
        return resp.getBody();
    }
}
