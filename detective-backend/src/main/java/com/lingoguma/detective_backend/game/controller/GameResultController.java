package com.lingoguma.detective_backend.game.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lingoguma.detective_backend.game.dto.GameResultResponse;
import com.lingoguma.detective_backend.game.entity.GameResult;
import com.lingoguma.detective_backend.game.repository.GameResultRepository;
import com.lingoguma.detective_backend.user.entity.CustomUserDetails;
import com.lingoguma.detective_backend.user.entity.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/game-results")
@RequiredArgsConstructor
public class GameResultController {

    private final GameResultRepository repo;
    private final ObjectMapper mapper; // ObjectMapper 주입

    // ==============================
    // 로그인한 사용자의 게임 기록 조회
    // ==============================
    @GetMapping("/me")
    public ResponseEntity<List<GameResultResponse>> getMyResults(
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        if (userDetails == null) {
            return ResponseEntity.status(401).build();
        }

        Integer userIdx = userDetails.getUser().getUserIdx();

        List<GameResultResponse> results = repo.findByUserIdx(userIdx).stream()
                .map(gr -> GameResultResponse.fromEntity(gr, mapper))
                .toList();

        return ResponseEntity.ok(results);
    }

    // ==============================
    // 단일 결과 조회 (본인만 / ADMIN은 다른 유저 것도 가능)
    // ==============================
    @GetMapping("/{resultId}")
    public ResponseEntity<GameResultResponse> getOneResult(
        @PathVariable Integer resultId,
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        // 게스트( userIdx=null )는 권한 체크 없이 허용
        GameResult gr = repo.findById(resultId).orElseThrow(() -> new RuntimeException("결과없음"));
        if (gr.getUserIdx() == null) {
            return ResponseEntity.ok(GameResultResponse.fromEntity(gr, mapper));
        }
        // 회원이면 본인/ADMIN만 허용
        if (userDetails == null) return ResponseEntity.status(401).build();
        if (!gr.getUserIdx().equals(userDetails.getUser().getUserIdx())
            && userDetails.getUser().getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(GameResultResponse.fromEntity(gr, mapper));
    }

    // ==============================
    // 세션 ID 기반 결과 조회 (AnalysisPage에서 사용)
    // ==============================
    @GetMapping("/session/{sessionId}")
    public ResponseEntity<GameResultResponse> getBySessionId(
            @PathVariable Integer sessionId,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        GameResult result = repo.findBySessionId(sessionId)
                .orElseThrow(() -> new RuntimeException("결과를 찾을 수 없습니다."));

        // 게스트 플레이( userIdx=null )는 로그인 필요 없음
        if (result.getUserIdx() == null) {
            return ResponseEntity.ok(GameResultResponse.fromEntity(result, mapper));
        }

        // 회원 플레이일 경우만 권한 체크
        if (userDetails == null) {
            return ResponseEntity.status(401).build();
        }
        if (!result.getUserIdx().equals(userDetails.getUser().getUserIdx())
                && userDetails.getUser().getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).build();
        }

        // return ResponseEntity.ok(GameResultResponse.fromEntity(result, mapper));
        return repo.findTopBySessionIdOrderByResultIdDesc(sessionId)
            .map(gr -> ResponseEntity.ok(GameResultResponse.fromEntity(gr, mapper)))
            .orElse(ResponseEntity.notFound().build());
    }

    // ==============================
    // 관리자 전용: 특정 유저 기록 조회
    // ==============================
    @GetMapping("/user/{userIdx}")
    public ResponseEntity<List<GameResultResponse>> getUserResults(
            @PathVariable Integer userIdx,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        if (userDetails == null || userDetails.getUser().getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).build();
        }

        List<GameResultResponse> results = repo.findByUserIdx(userIdx).stream()
                .map(gr -> GameResultResponse.fromEntity(gr, mapper))
                .toList();

        return ResponseEntity.ok(results);
    }

    // ==============================
    // 관리자 전용: 전체 게임 기록 조회
    // ==============================
    @GetMapping("/all")
    public ResponseEntity<List<GameResultResponse>> getAllResults(
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        if (userDetails == null || userDetails.getUser().getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).build();
        }

        List<GameResultResponse> results = repo.findAll().stream()
                .map(gr -> GameResultResponse.fromEntity(gr, mapper))
                .toList();

        return ResponseEntity.ok(results);
    }
}
