package com.lingoguma.detective_backend.scenario.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "scenarios")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Scenario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer scenIdx;   // int 기반 PK

    @Column(nullable = false, length = 225)
    private String scenTitle;

    @Column(columnDefinition = "TEXT")
    private String scenSummary;

    private Integer scenLevel;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ScenAccess scenAccess;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ScenStatus scenStatus;

    @Column(columnDefinition = "JSON")
    private String contentJson;   // JSON 한 줄 저장

    private Integer createdBy;    // 작성자 (users.user_idx FK)

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
