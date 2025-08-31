package com.lingoguma.detective_backend.game.repository;

import com.lingoguma.detective_backend.game.entity.GameResult;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GameResultRepository extends JpaRepository<GameResult, Integer> {
    // 특정 유저의 모든 게임 조회
    List<GameResult> findByUserIdx(Integer userIdx);
}
