package com.lingoguma.detective_backend.game.service;

import com.lingoguma.detective_backend.game.dto.NlpAskRequest;
import com.lingoguma.detective_backend.game.dto.NlpAskResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
@RequiredArgsConstructor
public class NlpClient {
    private final RestTemplate restTemplate;

    @Value("${nlp.base-url}")
    private String nlpBaseUrl;

    public NlpAskResponse ask(NlpAskRequest req) {
        String url = nlpBaseUrl + "/nlp/ask";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<NlpAskRequest> entity = new HttpEntity<>(req, headers);
        ResponseEntity<NlpAskResponse> resp =
                restTemplate.exchange(url, HttpMethod.POST, entity, NlpAskResponse.class);
        return resp.getBody();
    }
}
