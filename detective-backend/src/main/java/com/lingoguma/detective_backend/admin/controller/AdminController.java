package com.lingoguma.detective_backend.admin.controller;

import com.lingoguma.detective_backend.user.entity.CustomUserDetails;
import com.lingoguma.detective_backend.user.entity.Role;
import com.lingoguma.detective_backend.user.entity.User;
import com.lingoguma.detective_backend.user.repository.UserRepository;

import jakarta.transaction.Transactional;

import com.lingoguma.detective_backend.scenario.entity.Scenario;
import com.lingoguma.detective_backend.game.repository.GameSessionRepository;
import com.lingoguma.detective_backend.scenario.dto.ScenarioResponse;
import com.lingoguma.detective_backend.scenario.entity.ScenStatus;
import com.lingoguma.detective_backend.scenario.repository.ScenarioRepository;
import com.lingoguma.detective_backend.scenario.service.ScenarioService;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin") // 관리자 전용 API
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;
    private final ScenarioRepository scenarioRepository;
    private final GameSessionRepository gameSessionRepository;

    // ==============================
    // 1. 유저 관리
    // ==============================

    /**
     * 전체 유저 목록 조회
     * - 관리자(Admin) 권한만 가능
     */
    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers(@AuthenticationPrincipal CustomUserDetails adminDetails) {
        if (adminDetails == null || adminDetails.getUser().getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body("관리자 권한이 필요합니다.");
        }
        List<User> users = userRepository.findAll();
        return ResponseEntity.ok(users);
    }

    /**
     * 특정 유저 삭제
     * - 관리자(Admin) 권한만 가능
     */
    @DeleteMapping("/users/{userId}")
    public ResponseEntity<?> deleteUser(@PathVariable Integer userId,
                                        @AuthenticationPrincipal CustomUserDetails adminDetails) {
        if (adminDetails == null || adminDetails.getUser().getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body("관리자 권한이 필요합니다.");
        }
        userRepository.deleteById(userId);
        return ResponseEntity.ok("유저 삭제 완료");
    }

    // ==============================
    // 2. 시나리오 관리
    // ==============================

    /**
     * 모든 시나리오 조회 (관리자 전용)
     */
    @GetMapping("/scenarios")
    public ResponseEntity<?> getAllScenarios(@AuthenticationPrincipal CustomUserDetails adminDetails) {
        if (adminDetails == null || adminDetails.getUser().getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body("관리자 권한이 필요합니다.");
        }

        List<ScenarioResponse> scenarios = scenarioRepository.findAll()
                .stream()
                .map(ScenarioResponse::fromEntity)
                .collect(Collectors.toList());

        return ResponseEntity.ok(scenarios);
    }

    /**
     * 시나리오 승인 (DRAFT → PUBLISHED)
     */
    @PostMapping("/scenarios/{id}/approve")
    @Transactional
    public ResponseEntity<?> approveScenario(
            @AuthenticationPrincipal CustomUserDetails adminDetails,
            @PathVariable Integer id
    ) {
        if (adminDetails == null || adminDetails.getUser().getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body("관리자 권한이 필요합니다.");
        }

        Scenario scenario = scenarioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("시나리오 없음"));
        scenario.setScenStatus(ScenStatus.PUBLISHED);
        scenarioRepository.save(scenario);

        return ResponseEntity.ok("시나리오 승인 완료");
    }

    /**
     * 시나리오 반려 (DRAFT → ARCHIVED)
     */
    @PostMapping("/scenarios/{id}/reject")
    @Transactional
    public ResponseEntity<?> rejectScenario(
            @AuthenticationPrincipal CustomUserDetails adminDetails,
            @PathVariable Integer id
    ) {
        if (adminDetails == null || adminDetails.getUser().getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body("관리자 권한이 필요합니다.");
        }

        Scenario scenario = scenarioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("시나리오 없음"));
        scenario.setScenStatus(ScenStatus.ARCHIVED);
        scenarioRepository.save(scenario);

        return ResponseEntity.ok("시나리오 반려 완료");
    }

    /**
     * 시나리오 삭제 (연관 세션이 있으면 먼저 삭제 필요)
     */
    @DeleteMapping("/scenarios/{id}")
    @Transactional
    public ResponseEntity<?> deleteScenario(
            @AuthenticationPrincipal CustomUserDetails adminDetails,
            @PathVariable Integer id
    ) {
        if (adminDetails == null || adminDetails.getUser().getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body("관리자 권한이 필요합니다.");
        }

        try {
            // 1. 해당 시나리오와 연결된 모든 세션 삭제
            gameSessionRepository.deleteByScenario_ScenIdx(id);

            // 2. 시나리오 삭제
            scenarioRepository.deleteById(id);

            return ResponseEntity.ok("시나리오 및 관련 세션 삭제 완료");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("삭제 실패: " + e.getMessage());
        }
    }
}
