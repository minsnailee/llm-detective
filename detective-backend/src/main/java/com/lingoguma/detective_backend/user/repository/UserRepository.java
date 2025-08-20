package com.lingoguma.detective_backend.user.repository;

import com.lingoguma.detective_backend.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/*
 *  User를 저장하고 조회
 */
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email); // 이메일 중복 체크용, 사용자 조회
}