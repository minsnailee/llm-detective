package com.lingoguma.detective_backend.user.controller;

import com.lingoguma.detective_backend.user.dto.LoginRequest;
import com.lingoguma.detective_backend.user.dto.SignUpRequest;
import com.lingoguma.detective_backend.user.entity.User;
import com.lingoguma.detective_backend.user.service.UserService;

import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/*
 * 사용자가 브라우저에서 요청하면, 그걸 받아줌
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /*
     * 회원가입 API
     */
    @PostMapping("/signup")
    public ResponseEntity<?> signUp(@RequestBody SignUpRequest request) {
        Long id = userService.signUp(request);
        return ResponseEntity.ok("회원가입 성공! ID: " + id);
    }

    /*
     * 로그인 API
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request, HttpSession session) {
        User user = userService.login(request.getEmail(), request.getPassword());

        // 로그인 성공 시 세션에 사용자 정보 저장
        session.setAttribute("user", user);

        return ResponseEntity.ok("로그인 성공");
    }

    // 로그인 상태 확인용 API
    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(HttpSession session) {
        User user = (User) session.getAttribute("user");
        
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
        }

        return ResponseEntity.ok(user.getNickname() + "님 로그인 중입니다.");
    }

    // 로그아웃 처리
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpSession session) {
        session.invalidate(); // 세션 만료 (로그아웃 처리)
        return ResponseEntity.ok("로그아웃 되었습니다.");
    }
}
