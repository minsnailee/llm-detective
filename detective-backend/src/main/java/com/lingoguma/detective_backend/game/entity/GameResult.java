package com.lingoguma.detective_backend.game.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "game_results")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GameResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long resultId;

    private Integer scenIdx; // FK: scenarios.scen_idx

    private Long userId;     // FK: users.id (로그인 유저)

    @Column(columnDefinition = "JSON")
    private String answerJson;   // 범인, 언제, 어떻게, 왜

    @Column(columnDefinition = "JSON")
    private String skillsJson;   // NLP 점수 등

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
