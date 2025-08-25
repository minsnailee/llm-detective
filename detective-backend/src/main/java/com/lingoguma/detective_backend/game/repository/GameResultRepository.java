package com.lingoguma.detective_backend.game.repository;

import com.lingoguma.detective_backend.game.entity.GameResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GameResultRepository extends JpaRepository<GameResult, Long> {
    
}
