package com.lingoguma.detective_backend.nlp.controller;

import com.lingoguma.detective_backend.nlp.dto.NlpScoreRequest;
import com.lingoguma.detective_backend.nlp.dto.NlpScoreResponse;
import com.lingoguma.detective_backend.nlp.service.NlpClient;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 프론트엔드가 호출하는 API 엔드포인트.
 * - POST /api/nlp/score
 * - 바디에 { roomId, userText }를 받아서 FastAPI로 중계하고, 응답을 그대로 반환
 */
@RestController
@RequestMapping("/api/nlp")
@RequiredArgsConstructor
public class NlpController {

    private final NlpClient nlpClient;

    @PostMapping("/score")
    public ResponseEntity<NlpScoreResponse> score(@RequestBody NlpScoreRequest req) {
        NlpScoreResponse result = nlpClient.score(req);
        return ResponseEntity.ok(result);
    }
}
