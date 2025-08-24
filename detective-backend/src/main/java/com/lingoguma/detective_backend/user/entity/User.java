package com.lingoguma.detective_backend.user.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_idx")
    private Long userIdx;  // PK (DB 내부 식별자)

    @Column(nullable = false, unique = true, length = 50)
    private String userId; // 로그인용 아이디 (기존 id → userId 로 변경)

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @JsonIgnore // 응답 JSON 직렬화 시 제외
    @Column(nullable = false, length = 255)
    private String password;

    @Column(nullable = false, length = 50)
    private String nickname;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role = Role.MEMBER;

    @Column(length = 20)
    private String provider; // ex: google, kakao, naver

    @Column(length = 100)
    private String providerId; // SNS 로그인 시 고유 식별자

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
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
