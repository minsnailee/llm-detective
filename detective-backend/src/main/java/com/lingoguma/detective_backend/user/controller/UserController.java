package com.lingoguma.detective_backend.user.controller;

import com.lingoguma.detective_backend.user.dto.LoginRequest;
import com.lingoguma.detective_backend.user.dto.SignUpRequest;
import com.lingoguma.detective_backend.user.dto.UpdateNicknameRequest;
import com.lingoguma.detective_backend.user.dto.UpdatePasswordRequest;
import com.lingoguma.detective_backend.user.dto.UserResponse;
import com.lingoguma.detective_backend.user.entity.CustomUserDetails;
import com.lingoguma.detective_backend.user.entity.User;
import com.lingoguma.detective_backend.user.service.UserService;

import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

/*
 * 사용자가 브라우저에서 요청하면, 그걸 받아줌
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true")
public class UserController {

    private final UserService userService;

    /*
     * 회원가입 API
     */
    @PostMapping("/signup")
    public ResponseEntity<?> signUp(@RequestBody SignUpRequest request) {
        Long userId = userService.signUp(request);
        return ResponseEntity.ok("회원가입 성공! ID: " + userId);
    }

    /*
     * 로그인 API
     */
    // @PostMapping("/login")
    // public ResponseEntity<?> login(@RequestBody LoginRequest request, HttpSession session) {
    //     User user = userService.login(request.getUserId(), request.getPassword());

    //     // 로그인 성공 시 세션에 사용자 정보 저장
    //     session.setAttribute("user", user);

    //     // return ResponseEntity.ok(user);
        
    //     // 민감 정보 제거 후 DTO로 응답
    //     return ResponseEntity.ok(UserResponse.from(user));
    // }
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request, HttpSession session) {
        User user = userService.login(request.getUserId(), request.getPassword(), session);
        return ResponseEntity.ok(UserResponse.from(user));
    }

    // 로그인 상태 확인용 API
    // @GetMapping("/me")
    // public ResponseEntity<?> getCurrentUser(HttpSession session) {
    //     User user = (User) session.getAttribute("user");
        
    //     if (user == null) {
    //         return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
    //     }

    //     // return ResponseEntity.ok(user);

    //     // 민감 정보 제거 후 DTO로 응답
    //     return ResponseEntity.ok(UserResponse.from(user));
    // }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
        }
        return ResponseEntity.ok(UserResponse.from(userDetails.getUser()));
    }



    // 닉네임 변경
    // @PostMapping("/update-nickname")
    // public ResponseEntity<?> updateNickname(@RequestBody UpdateNicknameRequest request, HttpSession session) {
    //     User user = (User) session.getAttribute("user");
    //     if (user == null) return ResponseEntity.status(401).body("로그인이 필요합니다.");

    //     User updated = userService.updateNickname(user.getUserIdx(), request);
    //     session.setAttribute("user", updated); // 세션 정보 갱신
    //     return ResponseEntity.ok(UserResponse.from(updated));
    // }

    @PostMapping("/update-nickname")
    public ResponseEntity<?> updateNickname(
            @RequestBody UpdateNicknameRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
        }

        User updated = userService.updateNickname(userDetails.getUser().getUserIdx(), request);
        return ResponseEntity.ok(UserResponse.from(updated));
    }

    // 비밀번호 변경
    // @PostMapping("/update-password")
    // public ResponseEntity<?> updatePassword(@RequestBody UpdatePasswordRequest request, HttpSession session) {
    //     User user = (User) session.getAttribute("user");
    //     if (user == null) return ResponseEntity.status(401).body("로그인이 필요합니다.");

    //     userService.updatePassword(user.getUserIdx(), request);
    //     return ResponseEntity.ok("비밀번호 변경 성공");
    // }

    @PostMapping("/update-password")
    public ResponseEntity<?> updatePassword(
            @RequestBody UpdatePasswordRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
        }

        userService.updatePassword(userDetails.getUser().getUserIdx(), request);
        return ResponseEntity.ok("비밀번호 변경 성공");
    }

    // 로그아웃 처리
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpSession session) {
        session.invalidate(); // 세션 만료 (로그아웃 처리)
        return ResponseEntity.ok("로그아웃 되었습니다.");
    }
}
