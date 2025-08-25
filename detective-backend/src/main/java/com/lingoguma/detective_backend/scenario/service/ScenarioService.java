package com.lingoguma.detective_backend.scenario.service;

import com.lingoguma.detective_backend.scenario.dto.ScenarioResponse;
import com.lingoguma.detective_backend.scenario.repository.ScenarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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
}
