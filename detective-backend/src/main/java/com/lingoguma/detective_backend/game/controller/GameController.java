package com.lingoguma.detective_backend.game.controller;

import com.lingoguma.detective_backend.game.dto.NlpAskRequest;
import com.lingoguma.detective_backend.game.dto.NlpAskResponse;
import com.lingoguma.detective_backend.game.dto.GameResultRequest;
import com.lingoguma.detective_backend.nlp.service.GameNlpClient;
import com.lingoguma.detective_backend.game.service.GameResultService;
import com.lingoguma.detective_backend.game.service.GameSessionService;
import com.lingoguma.detective_backend.scenario.entity.ScenAccess;
import com.lingoguma.detective_backend.scenario.entity.Scenario;
import com.lingoguma.detective_backend.scenario.repository.ScenarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/game")
@RequiredArgsConstructor
public class GameController {

    private final GameNlpClient nlpClient;              // FastAPI 호출 (ask/score 통합)
    private final GameSessionService gameSessionService; // ✅ JPA 기반 세션 관리 서비스
    private final GameResultService gameResultService;   // 게임 결과 저장 서비스
    private final ScenarioRepository scenarioRepository; // 시나리오 접근 권한 확인

    /**
     * 세션 시작
     * - FREE: 비로그인(userIdx 없어도 OK)
     * - MEMBER: 로그인(userIdx 필수)
     */
    @PostMapping("/session/start")
    public ResponseEntity<Integer> startSession(
            @RequestParam Integer scenIdx,
            @RequestParam(required = false) Integer userIdx
    ) {
        Scenario scenario = scenarioRepository.findById(scenIdx.intValue())
                .orElseThrow(() -> new RuntimeException("시나리오 없음"));

        // scenAccess 체크
        if (scenario.getScenAccess() == ScenAccess.MEMBER && userIdx == null) {
            throw new RuntimeException("로그인이 필요한 시나리오입니다.");
        }

        Integer sessionId = gameSessionService.startSession(scenIdx, userIdx);
        return ResponseEntity.ok(sessionId);
    }

    /**
     * 세션 종료
     */
    @PostMapping("/session/finish")
    public ResponseEntity<String> finishSession(@RequestParam Integer sessionId) {
        gameSessionService.finishSession(sessionId);
        return ResponseEntity.ok("Session finished");
    }

    /**
     * 플레이어 질문 → FastAPI /nlp/ask 호출
     */
    @PostMapping("/ask")
    public ResponseEntity<NlpAskResponse> ask(@RequestBody NlpAskRequest req) {
        NlpAskResponse resp = nlpClient.ask(req);
        return ResponseEntity.ok(resp);
    }

    /**
     * 게임 종료 → 결과 저장
     */
    @PostMapping("/result")
    public ResponseEntity<String> saveResult(@RequestBody GameResultRequest req) {
        gameResultService.saveResult(req);
        return ResponseEntity.ok("Result saved");
    }
}
