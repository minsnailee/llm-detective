package com.lingoguma.detective_backend.game.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "game_results")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class GameResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long resultId;

    private Long sessionId;
    private Long scenIdx;
    private Long userIdx;

    @Column(columnDefinition = "JSON")
    private String answerJson;

    @Column(columnDefinition = "JSON")
    private String skillsJson;

    private boolean isCorrect;

    @Column(updatable = false, insertable = false,
            columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private java.sql.Timestamp createdAt;

    @Column(updatable = false, insertable = false,
            columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private java.sql.Timestamp updatedAt;
}

    // @Column(columnDefinition = "JSON")
    // private String answerJson;   // 범인, 언제, 어떻게, 왜

    // @Column(columnDefinition = "JSON")
    // private String skillsJson;   // NLP 점수 등

    // private LocalDateTime createdAt;
    // private LocalDateTime updatedAt;

    // @PrePersist
    // protected void onCreate() {
    //     createdAt = LocalDateTime.now();
    //     updatedAt = LocalDateTime.now();
    // }

    // @PreUpdate
    // protected void onUpdate() {
    //     updatedAt = LocalDateTime.now();
    // }