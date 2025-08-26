package com.lingoguma.detective_backend.game.repository;

import com.lingoguma.detective_backend.game.entity.GameSession;
import com.lingoguma.detective_backend.user.entity.User;
import com.lingoguma.detective_backend.scenario.entity.Scenario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GameSessionRepository extends JpaRepository<GameSession, Integer> {

    List<GameSession> findByUser(User user);

    List<GameSession> findByScenario(Scenario scenario);

    // 특정 시나리오에 연결된 모든 세션 삭제
    void deleteByScenario_ScenIdx(Integer scenIdx);
}
