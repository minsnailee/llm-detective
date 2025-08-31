package com.lingoguma.detective_backend.game.entity;

import com.lingoguma.detective_backend.scenario.entity.Scenario;
import com.lingoguma.detective_backend.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "game_sessions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class GameSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer sessionId;   // int 기반 PK

    @ManyToOne
    @JoinColumn(name = "scen_idx", nullable = false)
    private Scenario scenario;

    @ManyToOne
    @JoinColumn(name = "user_idx")
    private User user;           // 비로그인 플레이어의 경우 null

    @Enumerated(EnumType.STRING)
    @Column(length = 20, nullable = false)
    private GameStatus status;   // PLAYING, FINISHED

    @Column(columnDefinition = "JSON")
    private String logJson;      // 세션 로그 JSON 한 줄 저장

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        if (this.status == null) this.status = GameStatus.PLAYING;
        if (this.logJson == null) this.logJson = "{\"logs\":[]}";
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
