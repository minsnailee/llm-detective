package com.lingoguma.detective_backend.user.dto;

import com.lingoguma.detective_backend.user.entity.User;
import lombok.AllArgsConstructor;
import lombok.Getter;

/*
 * 응답 객체
 */
@Getter
@AllArgsConstructor
public class UserResponse {
    private Long userIdx;
    private String id;        // 로그인 아이디
    private String nickname;  // 닉네임
    private String role;      // 권한

    public static UserResponse from(User user) {
        return new UserResponse(
            user.getUserIdx(),
            user.getId(),
            user.getNickname(),
            user.getRole().name()
        );
    }
}
