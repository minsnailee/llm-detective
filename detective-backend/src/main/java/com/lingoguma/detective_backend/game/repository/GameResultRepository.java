package com.lingoguma.detective_backend.game.repository;

import com.lingoguma.detective_backend.game.entity.GameResult;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameResultRepository extends JpaRepository<GameResult, Long> {
}
