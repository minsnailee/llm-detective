package com.lingoguma.detective_backend.nlp.service;

import com.lingoguma.detective_backend.game.dto.NlpAskRequest;
import com.lingoguma.detective_backend.game.dto.NlpAskResponse;
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
public class GameNlpClient {

    private final RestTemplate restTemplate;

    // application.properties에서 주입
    @Value("${nlp.base-url}")
    private String nlpBaseUrl;

    // GPT 응답 (/nlp/ask)
    public NlpAskResponse ask(NlpAskRequest req) {
        String url = nlpBaseUrl + "/nlp/ask";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<NlpAskRequest> entity = new HttpEntity<>(req, headers);

        ResponseEntity<NlpAskResponse> resp = restTemplate.exchange(
                url, HttpMethod.POST, entity, NlpAskResponse.class
        );
        return resp.getBody();
    }

    // NLP 점수 (/nlp/score)
    public NlpScoreResponse score(NlpScoreRequest req) {
        String url = nlpBaseUrl + "/nlp/score";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<NlpScoreRequest> entity = new HttpEntity<>(req, headers);

        ResponseEntity<NlpScoreResponse> resp = restTemplate.exchange(
                url, HttpMethod.POST, entity, NlpScoreResponse.class
        );
        return resp.getBody();
    }
}
