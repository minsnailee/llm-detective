package com.lingoguma.detective_backend.game.controller;

import com.lingoguma.detective_backend.game.dto.NlpAskRequest;
import com.lingoguma.detective_backend.game.dto.NlpAskResponse;
import com.lingoguma.detective_backend.game.dto.GameResultRequest;
import com.lingoguma.detective_backend.nlp.service.GameNlpClient;
import com.lingoguma.detective_backend.game.service.GameService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/game")
@RequiredArgsConstructor
public class GameController {

    private final GameNlpClient nlpClient;   // FastAPI 호출 (ask/score 통합)
    private final GameService gameService;   // DB 저장 서비스

    // 세션 시작
    @PostMapping("/session/start")
    public ResponseEntity<Long> startSession(@RequestParam Long scenIdx, @RequestParam Long userIdx) {
        Long sessionId = gameService.startSession(scenIdx, userIdx);
        return ResponseEntity.ok(sessionId);
    }

    // 플레이어 질문 → FastAPI /nlp/ask 호출
    @PostMapping("/ask")
    public ResponseEntity<NlpAskResponse> ask(@RequestBody NlpAskRequest req) {
        NlpAskResponse resp = nlpClient.ask(req);
        return ResponseEntity.ok(resp);
    }

    // 게임 종료 → 결과 저장
    @PostMapping("/result")
    public ResponseEntity<String> saveResult(@RequestBody GameResultRequest req) {
        gameService.saveResult(req);
        return ResponseEntity.ok("Result saved");
    }
}
