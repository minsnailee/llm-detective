package com.lingoguma.detective_backend.scenario.repository;

import com.lingoguma.detective_backend.scenario.entity.ScenStatus;
import com.lingoguma.detective_backend.scenario.entity.Scenario;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ScenarioRepository extends JpaRepository<Scenario, Integer> {
    // 상태별 조회
    List<Scenario> findByScenStatus(ScenStatus status);
    
}
