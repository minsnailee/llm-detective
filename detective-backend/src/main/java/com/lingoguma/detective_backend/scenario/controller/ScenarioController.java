package com.lingoguma.detective_backend.scenario.controller;

import com.lingoguma.detective_backend.scenario.dto.ScenarioRequest;
import com.lingoguma.detective_backend.scenario.dto.ScenarioResponse;
import com.lingoguma.detective_backend.scenario.service.ScenarioService;
import com.lingoguma.detective_backend.user.entity.CustomUserDetails;
import com.lingoguma.detective_backend.user.entity.Role;
import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/scenarios")
@RequiredArgsConstructor
public class ScenarioController {

    private final ScenarioService scenarioService;

    /**
     * 승인된 시나리오만 조회 (비로그인, 회원, 전문가 전부 공통)
     */
    @GetMapping
    public ResponseEntity<List<ScenarioResponse>> getPublishedScenarios() {
        return ResponseEntity.ok(scenarioService.getPublishedScenarios());
    }

    // 모든 시나리오 조회
    // @GetMapping
    // public ResponseEntity<List<ScenarioResponse>> getAll() {
    //     return ResponseEntity.ok(scenarioService.getAllScenarios());
    // }

    // 단일 시나리오 조회
    @GetMapping("/{id}")
    public ResponseEntity<ScenarioResponse> getOne(@PathVariable Integer id) {
        ScenarioResponse scenario = scenarioService.getScenarioById(id);

        // 승인 안 된 시나리오는 일반 API에서 막음
        if (!scenario.getScenStatus().equals("PUBLISHED")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return ResponseEntity.ok(scenario);
    }

    // 전문가/관리자 전용: 시나리오 작성
    @PostMapping("/create")
    public ResponseEntity<?> createScenario(
            @RequestBody ScenarioRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body("로그인이 필요합니다.");
        }
        if (userDetails.getUser().getRole() != Role.EXPERT &&
            userDetails.getUser().getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body("전문가 또는 관리자 권한이 필요합니다.");
        }

        ScenarioResponse saved = scenarioService.createScenario(request, userDetails.getUser().getUserIdx());
        return ResponseEntity.ok(saved);
    }
}
