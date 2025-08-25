package com.lingoguma.detective_backend.user.repository;

import com.lingoguma.detective_backend.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/*
 *  User를 저장하고 조회
 */
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email); // 이메일 중복 체크용
    boolean existsByUserId(String userId); // 아이디 중복 체크용
    Optional<User> findByUserId(String userId); // 로그인 시 사용자 조회
    Optional<User> findByUserIdx(Long userIdx); // userIdx 기반 조회
}