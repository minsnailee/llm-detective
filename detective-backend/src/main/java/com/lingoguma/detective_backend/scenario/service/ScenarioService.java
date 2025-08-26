package com.lingoguma.detective_backend.scenario.service;

import com.lingoguma.detective_backend.scenario.dto.ScenarioRequest;
import com.lingoguma.detective_backend.scenario.dto.ScenarioResponse;
import com.lingoguma.detective_backend.scenario.entity.ScenStatus;
import com.lingoguma.detective_backend.scenario.entity.Scenario;
import com.lingoguma.detective_backend.scenario.repository.ScenarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ScenarioService {

    private final ScenarioRepository scenarioRepository;

    // 모든 시나리오 조회
    public List<ScenarioResponse> getAllScenarios() {
        return scenarioRepository.findAll().stream()
                .map(ScenarioResponse::fromEntity)
                .collect(Collectors.toList());
    }

    // 단일 시나리오 조회
    public ScenarioResponse getScenarioById(Integer id) {
        return scenarioRepository.findById(id)
                .map(ScenarioResponse::fromEntity)
                .orElseThrow(() -> new RuntimeException("Scenario not found: " + id));
    }
    
    // 승인된 시나리오만 조회
    public List<ScenarioResponse> getPublishedScenarios() {
        return scenarioRepository.findByScenStatus(ScenStatus.PUBLISHED).stream()
                .map(ScenarioResponse::fromEntity)
                .collect(Collectors.toList());
    }

    // 전문가/관리자: 시나리오 작성
    @Transactional
    public ScenarioResponse createScenario(ScenarioRequest request, Integer userIdx) {
        Scenario scenario = Scenario.builder()
                .scenTitle(request.getScenTitle())
                .scenSummary(request.getScenSummary())
                .scenLevel(request.getScenLevel())
                .scenAccess(request.getScenAccess())
                .scenStatus(ScenStatus.DRAFT) // 기본은 DRAFT
                .contentJson(request.getContentJson())
                .createdBy(userIdx.intValue())
                .build();

        return ScenarioResponse.fromEntity(scenarioRepository.save(scenario));
    }
}
