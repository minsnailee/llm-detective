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
    private Integer scenIdx;

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
    private String contentJson;

    private Integer createdBy;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
