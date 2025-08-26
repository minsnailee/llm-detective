package com.lingoguma.detective_backend.user.service;

import com.lingoguma.detective_backend.user.dto.SignUpRequest;
import com.lingoguma.detective_backend.user.dto.UpdateNicknameRequest;
import com.lingoguma.detective_backend.user.dto.UpdatePasswordRequest;
import com.lingoguma.detective_backend.user.entity.User;
import com.lingoguma.detective_backend.user.entity.CustomUserDetails;
import com.lingoguma.detective_backend.user.entity.Role;
import com.lingoguma.detective_backend.user.repository.UserRepository;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    // 회원가입
    public Integer signUp(SignUpRequest request) {
        if (userRepository.existsByUserId(request.getUserId())) {
            throw new RuntimeException("이미 사용 중인 아이디입니다.");
        }
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("이미 사용 중인 이메일입니다.");
        }

        User user = User.builder()
                .userId(request.getUserId())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .nickname(request.getNickname())
                .role(Role.MEMBER) // 기본은 MEMBER
                .expertRequested(false)
                .build();

        return userRepository.save(user).getUserIdx();
    }

    // 로그인
    public User login(String userId, String password, HttpSession session) {
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("아이디가 존재하지 않습니다."));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }

        CustomUserDetails userDetails = new CustomUserDetails(user);
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(authentication);
        session.setAttribute("SPRING_SECURITY_CONTEXT", SecurityContextHolder.getContext());

        return user;
    }

    // 닉네임 변경
    public User updateNickname(Integer userIdx, UpdateNicknameRequest request) {
        User user = userRepository.findByUserIdx(userIdx)
                .orElseThrow(() -> new IllegalArgumentException("해당 사용자가 존재하지 않습니다."));
        user.setNickname(request.getNickname());
        return userRepository.save(user);
    }

    // 비밀번호 변경
    public void updatePassword(Integer userIdx, UpdatePasswordRequest request) {
        User user = userRepository.findByUserIdx(userIdx)
                .orElseThrow(() -> new IllegalArgumentException("해당 사용자가 존재하지 않습니다."));
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        userRepository.save(user);
    }

    // 전문가 권한 신청
    @Transactional
    public void requestExpert(Integer userIdx) {
        User user = userRepository.findById(userIdx)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        user.setExpertRequested(true);
        userRepository.save(user);
    }

    // 관리자: 전문가 권한 승인
    @Transactional
    public void approveExpert(Integer userIdx) {
        User user = userRepository.findById(userIdx)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        if (!user.isExpertRequested()) {
            throw new RuntimeException("전문가 신청을 하지 않은 유저입니다.");
        }
        user.setRole(Role.EXPERT);
        user.setExpertRequested(false);
        userRepository.save(user);
    }
}


// package com.lingoguma.detective_backend.user.service;

// import com.lingoguma.detective_backend.user.dto.SignUpRequest;
// import com.lingoguma.detective_backend.user.dto.UpdateNicknameRequest;
// import com.lingoguma.detective_backend.user.dto.UpdatePasswordRequest;
// import com.lingoguma.detective_backend.user.entity.User;
// import com.lingoguma.detective_backend.user.entity.CustomUserDetails;
// import com.lingoguma.detective_backend.user.entity.Role;
// import com.lingoguma.detective_backend.user.repository.UserRepository;

// import jakarta.servlet.http.HttpSession;
// import lombok.RequiredArgsConstructor;

// import java.util.Collections;

// import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
// import org.springframework.security.core.context.SecurityContextHolder;
// import org.springframework.security.crypto.password.PasswordEncoder;
// import org.springframework.stereotype.Service;

// @Service
// @RequiredArgsConstructor
// public class UserService {
    
//     private final UserRepository userRepository;
//     private final PasswordEncoder passwordEncoder;
    
//     /*
//      * 회원가입
//      */
//     public Long signUp(SignUpRequest request) {
//         if (userRepository.existsByUserId(request.getUserId())) {
//             throw new RuntimeException("이미 사용 중인 아이디입니다.");
//         }
//         if (userRepository.findByEmail(request.getEmail()).isPresent()) {
//             throw new RuntimeException("이미 사용 중인 이메일입니다.");
//         }

//         User user = User.builder()
//                 .userId(request.getUserId())
//                 .email(request.getEmail())
//                 .password(passwordEncoder.encode(request.getPassword()))
//                 .nickname(request.getNickname())
//                 .role(Role.MEMBER)
//                 .build();

//         return userRepository.save(user).getUserIdx();
//     }

//     /*
//      * 로그인
//      */
//     public User login(String userId, String password, HttpSession session) {
//         System.out.println("로그인 시도: " + userId);
//         User user = userRepository.findByUserId(userId)
//                 .orElseThrow(() -> new IllegalArgumentException("아이디가 존재하지 않습니다."));

//         if (!passwordEncoder.matches(password, user.getPassword())) {
//             throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
//         }

//         // SecurityContext 에 Authentication 저장
//         CustomUserDetails userDetails = new CustomUserDetails(user);
//         UsernamePasswordAuthenticationToken authentication =
//                 new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());

//         SecurityContextHolder.getContext().setAuthentication(authentication);

//         // 세션에도 SecurityContext 저장
//         session.setAttribute("SPRING_SECURITY_CONTEXT", SecurityContextHolder.getContext());

//         return user;
//     }

//     /*
//      * 닉네임 변경
//      */
//     public User updateNickname(Long userIdx, UpdateNicknameRequest request) {
//         User user = userRepository.findByUserIdx(userIdx)
//                 .orElseThrow(() -> new IllegalArgumentException("해당 사용자가 존재하지 않습니다."));
//         user.setNickname(request.getNickname());
//         return userRepository.save(user);
//     }

//     /*
//      * 비밀번호 변경
//      */
//     public void updatePassword(Long userIdx, UpdatePasswordRequest request) {
//         User user = userRepository.findByUserIdx(userIdx)
//                 .orElseThrow(() -> new IllegalArgumentException("해당 사용자가 존재하지 않습니다."));
//         user.setPassword(passwordEncoder.encode(request.getPassword()));
//         userRepository.save(user);
//     }
// }
