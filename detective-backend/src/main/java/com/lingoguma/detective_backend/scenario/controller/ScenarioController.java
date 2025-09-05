package com.lingoguma.detective_backend.scenario.controller;

import com.lingoguma.detective_backend.scenario.dto.ScenarioRequest;
import com.lingoguma.detective_backend.scenario.dto.ScenarioResponse;
import com.lingoguma.detective_backend.scenario.service.ScenarioService;
import com.lingoguma.detective_backend.user.entity.CustomUserDetails;
import com.lingoguma.detective_backend.user.entity.Role;
import lombok.RequiredArgsConstructor;

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

    /**
     * 단일 시나리오 조회
     * - 기본: PUBLISHED만 누구나 조회 가능
     * - preview=true: 관리자/전문가 또는 작성자만 조회 가능
     */
    @GetMapping("/{id}")
    public ResponseEntity<ScenarioResponse> getOne(
            @PathVariable Integer id,
            @RequestParam(name = "preview", defaultValue = "false") boolean preview,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        ScenarioResponse scenario = scenarioService.getScenarioForRead(id, preview, user);
        return ResponseEntity.ok(scenario);
    }

    /**
     * 전문가/관리자 전용: 시나리오 작성
     * (contentJson 안에 map/background, map/floorplan, characters[].image 등이 모두 포함되어 전송됨)
     */
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

        ScenarioResponse saved = scenarioService.createScenario(
                request,
                userDetails.getUser().getUserIdx()
        );
        return ResponseEntity.ok(saved);
    }
}
