package com.lingoguma.detective_backend.scenario.repository;

import com.lingoguma.detective_backend.scenario.entity.Scenario;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScenarioRepository extends JpaRepository<Scenario, Integer> {
}
