package com.lingoguma.detective_backend.user.service;

import com.lingoguma.detective_backend.user.dto.SignUpRequest;
import com.lingoguma.detective_backend.user.entity.User;
import com.lingoguma.detective_backend.user.entity.Role;
import com.lingoguma.detective_backend.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

import java.util.Collections;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {
    
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    
    /*
     * 회원가입 로직(비밀번호 암호화, 이메일 중복 확인 등)을 처리하는 클래스
     */
    public Long signUp(SignUpRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("이미 사용 중인 이메일입니다.");
        }

        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .nickname(request.getNickname())
                .role(Role.MEMBER)
                .build();

        return userRepository.save(user).getId();
    }

    /*
     * 로그인
     */
    public User login(String email, String password) {
        System.out.println("로그인 시도: " + email);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("이메일이 존재하지 않습니다."));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }

        System.out.println("로그인 성공: " + email);
        
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(user, null, Collections.emptyList());

        SecurityContextHolder.getContext().setAuthentication(authentication);

        return user;
    }

}
