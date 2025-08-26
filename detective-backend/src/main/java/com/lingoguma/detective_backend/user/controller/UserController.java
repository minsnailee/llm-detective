package com.lingoguma.detective_backend.user.controller;

import com.lingoguma.detective_backend.user.dto.*;
import com.lingoguma.detective_backend.user.entity.CustomUserDetails;
import com.lingoguma.detective_backend.user.entity.Role;
import com.lingoguma.detective_backend.user.entity.User;
import com.lingoguma.detective_backend.user.repository.UserRepository;
import com.lingoguma.detective_backend.user.service.UserService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true")
public class UserController {

    private final UserService userService;
    private final UserRepository userRepository;

    // 회원가입
    @PostMapping("/signup")
    public ResponseEntity<?> signUp(@RequestBody SignUpRequest request) {
        Integer userId = userService.signUp(request);
        return ResponseEntity.ok("회원가입 성공! ID: " + userId);
    }

    // 로그인
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request, HttpSession session) {
        User user = userService.login(request.getUserId(), request.getPassword(), session);
        return ResponseEntity.ok(UserResponse.from(user));
    }

    // 현재 로그인 사용자
    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
        }

        // DB에서 최신 유저 정보 가져오기
        User freshUser = userRepository.findById(userDetails.getUser().getUserIdx())
                .orElseThrow(() -> new RuntimeException("User not found"));

        return ResponseEntity.ok(UserResponse.from(freshUser));
    }

    // 닉네임 변경
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

    // 로그아웃
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.ok("로그아웃 되었습니다.");
    }

    // 전문가 권한 신청 (회원 → 관리자 검토 요청)
    @PostMapping("/request-expert")
    public ResponseEntity<?> requestExpert(@AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
        }
        userService.requestExpert(userDetails.getUser().getUserIdx());
        return ResponseEntity.ok("전문가 권한 신청 완료. 관리자의 승인을 기다려주세요.");
    }

    // 관리자: 전문가 권한 승인
    @PostMapping("/approve-expert/{userId}")
    public ResponseEntity<?> approveExpert(@PathVariable Integer userId,
                                           @AuthenticationPrincipal CustomUserDetails adminDetails) {
        if (adminDetails == null || adminDetails.getUser().getRole() != Role.ADMIN) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("관리자 권한이 필요합니다.");
        }
        userService.approveExpert(userId);
        return ResponseEntity.ok("해당 유저가 전문가로 승격되었습니다.");
    }
}


// package com.lingoguma.detective_backend.user.controller;

// import com.lingoguma.detective_backend.user.dto.LoginRequest;
// import com.lingoguma.detective_backend.user.dto.SignUpRequest;
// import com.lingoguma.detective_backend.user.dto.UpdateNicknameRequest;
// import com.lingoguma.detective_backend.user.dto.UpdatePasswordRequest;
// import com.lingoguma.detective_backend.user.dto.UserResponse;
// import com.lingoguma.detective_backend.user.entity.CustomUserDetails;
// import com.lingoguma.detective_backend.user.entity.User;
// import com.lingoguma.detective_backend.user.service.UserService;

// import jakarta.servlet.http.HttpSession;
// import lombok.RequiredArgsConstructor;

// import org.springframework.http.HttpStatus;
// import org.springframework.http.ResponseEntity;
// import org.springframework.web.bind.annotation.*;
// import org.springframework.security.core.annotation.AuthenticationPrincipal;

// /*
//  * 사용자가 브라우저에서 요청하면, 그걸 받아줌
//  */
// @RestController
// @RequestMapping("/api/users")
// @RequiredArgsConstructor
// @CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true")
// public class UserController {

//     private final UserService userService;

//     /*
//      * 회원가입 API
//      */
//     @PostMapping("/signup")
//     public ResponseEntity<?> signUp(@RequestBody SignUpRequest request) {
//         Long userId = userService.signUp(request);
//         return ResponseEntity.ok("회원가입 성공! ID: " + userId);
//     }

//     /*
//      * 로그인 API
//      */
//     @PostMapping("/login")
//     public ResponseEntity<?> login(@RequestBody LoginRequest request, HttpSession session) {
//         User user = userService.login(request.getUserId(), request.getPassword(), session);
//         return ResponseEntity.ok(UserResponse.from(user));
//     }

//     @GetMapping("/me")
//     public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal CustomUserDetails userDetails) {
//         if (userDetails == null) {
//             return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
//         }
//         return ResponseEntity.ok(UserResponse.from(userDetails.getUser()));
//     }


//     @PostMapping("/update-nickname")
//     public ResponseEntity<?> updateNickname(
//             @RequestBody UpdateNicknameRequest request,
//             @AuthenticationPrincipal CustomUserDetails userDetails) {

//         if (userDetails == null) {
//             return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
//         }

//         User updated = userService.updateNickname(userDetails.getUser().getUserIdx(), request);
//         return ResponseEntity.ok(UserResponse.from(updated));
//     }

//     @PostMapping("/update-password")
//     public ResponseEntity<?> updatePassword(
//             @RequestBody UpdatePasswordRequest request,
//             @AuthenticationPrincipal CustomUserDetails userDetails) {

//         if (userDetails == null) {
//             return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
//         }

//         userService.updatePassword(userDetails.getUser().getUserIdx(), request);
//         return ResponseEntity.ok("비밀번호 변경 성공");
//     }

//     // 로그아웃 처리
//     @PostMapping("/logout")
//     public ResponseEntity<?> logout(HttpSession session) {
//         session.invalidate(); // 세션 만료 (로그아웃 처리)
//         return ResponseEntity.ok("로그아웃 되었습니다.");
//     }
// }
