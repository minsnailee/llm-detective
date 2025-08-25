package com.lingoguma.detective_backend.game.controller;

import com.lingoguma.detective_backend.game.dto.GameResultRequest;
import com.lingoguma.detective_backend.game.dto.GameResultResponse;
import com.lingoguma.detective_backend.game.service.GameResultService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/game")
@RequiredArgsConstructor
public class GameResultController {

    private final GameResultService gameResultService;

    @PostMapping("/result")
    public ResponseEntity<GameResultResponse> saveResult(@RequestBody GameResultRequest req) {
        return ResponseEntity.ok(gameResultService.saveResult(req));
    }
}
