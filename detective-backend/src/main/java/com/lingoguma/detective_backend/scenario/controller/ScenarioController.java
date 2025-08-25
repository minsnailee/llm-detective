package com.lingoguma.detective_backend.scenario.controller;

import com.lingoguma.detective_backend.scenario.dto.ScenarioResponse;
import com.lingoguma.detective_backend.scenario.service.ScenarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/scenarios")
@RequiredArgsConstructor
public class ScenarioController {

    private final ScenarioService scenarioService;

    @GetMapping
    public ResponseEntity<List<ScenarioResponse>> getAll() {
        return ResponseEntity.ok(scenarioService.getAllScenarios());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ScenarioResponse> getOne(@PathVariable Integer id) {
        return ResponseEntity.ok(scenarioService.getScenarioById(id));
    }
}
