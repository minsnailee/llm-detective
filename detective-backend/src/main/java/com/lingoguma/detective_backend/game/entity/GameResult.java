package com.lingoguma.detective_backend.game.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "game_results")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class GameResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer resultId;    // int 기반 PK

    private Integer sessionId;   // 세션 ID (값만 저장)
    private Integer scenIdx;     // 시나리오 ID
    private Integer userIdx;     // 유저 ID

    @Column(columnDefinition = "JSON")
    private String answerJson;   // 답변 JSON 한 줄

    @Column(columnDefinition = "JSON")
    private String skillsJson;   // 스킬 점수 JSON 한 줄

    private boolean isCorrect;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
