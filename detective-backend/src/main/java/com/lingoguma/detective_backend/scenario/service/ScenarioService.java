package com.lingoguma.detective_backend.scenario.service;

import com.lingoguma.detective_backend.scenario.dto.ScenarioRequest;
import com.lingoguma.detective_backend.scenario.dto.ScenarioResponse;
import com.lingoguma.detective_backend.scenario.entity.ScenStatus;
import com.lingoguma.detective_backend.scenario.entity.Scenario;
import com.lingoguma.detective_backend.scenario.repository.ScenarioRepository;
import com.lingoguma.detective_backend.user.entity.CustomUserDetails;
import com.lingoguma.detective_backend.user.entity.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ScenarioService {

    private final ScenarioRepository scenarioRepository;

    // 모든 시나리오 조회 (관리/내부용)
    public List<ScenarioResponse> getAllScenarios() {
        return scenarioRepository.findAll().stream()
                .map(ScenarioResponse::fromEntity)
                .collect(Collectors.toList());
    }

    // 승인된 시나리오만 조회 (공개 목록)
    public List<ScenarioResponse> getPublishedScenarios() {
        return scenarioRepository.findByScenStatus(ScenStatus.PUBLISHED).stream()
                .map(ScenarioResponse::fromEntity)
                .collect(Collectors.toList());
    }

    // 단일 시나리오 조회 (preview 지원)
    @Transactional(readOnly = true)
    public ScenarioResponse getScenarioForRead(Integer id, boolean preview, CustomUserDetails principal) {
        Scenario s = scenarioRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Scenario not found: " + id));

        // 이미 공개(PUBLISHED)면 누구나 조회 가능
        if (s.getScenStatus() == ScenStatus.PUBLISHED) {
            return ScenarioResponse.fromEntity(s);
        }

        // 미리보기(preview=true)인 경우: 관리자/전문가 또는 작성자만 접근 허용
        if (preview && principal != null) {
            Role role = principal.getUser().getRole();
            Integer requesterIdx = principal.getUser().getUserIdx();
            boolean isAdminOrExpert = (role == Role.ADMIN || role == Role.EXPERT);
            boolean isOwner = (s.getCreatedBy() != null && Objects.equals(s.getCreatedBy(), requesterIdx));

            if (isAdminOrExpert || isOwner) {
                return ScenarioResponse.fromEntity(s);
            }
        }

        // 그 외에는 403
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This scenario is not published.");
    }

    // 전문가/관리자: 시나리오 작성
    @Transactional
    public ScenarioResponse createScenario(ScenarioRequest request, Integer userIdx) {
        // 프론트에서 contentJson 문자열에 map/characters.image 등이 모두 포함되어 들어옵니다.
        Scenario scenario = Scenario.builder()
                .scenTitle(request.getScenTitle())
                .scenSummary(request.getScenSummary())
                .scenLevel(request.getScenLevel())
                .scenAccess(request.getScenAccess())
                .scenStatus(ScenStatus.DRAFT) // 기본 DRAFT
                .contentJson(request.getContentJson())
                .createdBy(userIdx)
                .build();

        return ScenarioResponse.fromEntity(scenarioRepository.save(scenario));
    }
}
