package com.lingoguma.detective_backend.game.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class GptClient {

    private final RestTemplate restTemplate;

    @Value("${openai.api.key}")
    private String openaiApiKey;

    public String chat(List<Map<String, String>> messages) {
        String url = "https://api.openai.com/v1/chat/completions";

        Map<String, Object> body = Map.of(
                "model", "gpt-4o-mini",
                "messages", messages,
                "temperature", 0.7
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(openaiApiKey);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        // Map<String,Object>로 타입 지정
        Map<String, Object> resp = restTemplate.postForObject(url, entity, Map.class);

        if (resp == null) {
            throw new RuntimeException("GPT 응답이 null입니다.");
        }

        // 제네릭 타입 안전하게 캐스팅
        List<Map<String, Object>> choices = (List<Map<String, Object>>) resp.get("choices");
        if (choices == null || choices.isEmpty()) {
            throw new RuntimeException("GPT 응답에 choices가 없습니다: " + resp);
        }

        Map<String, Object> first = choices.get(0);
        Map<String, Object> msg = (Map<String, Object>) first.get("message");

        return (String) msg.get("content");
    }
}
