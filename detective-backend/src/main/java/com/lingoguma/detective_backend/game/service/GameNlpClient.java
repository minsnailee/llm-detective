package com.lingoguma.detective_backend.game.service;

import com.lingoguma.detective_backend.game.dto.NlpAnalyzeRequest;
import com.lingoguma.detective_backend.game.dto.NlpAnalyzeResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
@RequiredArgsConstructor
public class GameNlpClient {

    private final RestTemplate restTemplate;

    @Value("${nlp.base-url}")
    private String nlpBaseUrl;

    public NlpAnalyzeResponse analyze(NlpAnalyzeRequest req) {
        String url = nlpBaseUrl + "/nlp/analyze";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<NlpAnalyzeRequest> entity = new HttpEntity<>(req, headers);
        return restTemplate.exchange(url, HttpMethod.POST, entity, NlpAnalyzeResponse.class).getBody();
    }
}
