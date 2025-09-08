package com.lingoguma.detective_backend.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // -----------------------------
            // CORS 설정
            // -----------------------------
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            // -----------------------------
            // CSRF 비활성화 (REST API는 토큰/세션 기반이므로 비활성화하는 게 일반적)
            // -----------------------------
            .csrf(AbstractHttpConfigurer::disable)
            // -----------------------------
            // 요청별 접근 권한 설정
            // -----------------------------
            .authorizeHttpRequests(auth -> auth
                // -----------------------------
                // 1) 로그인 없이 접근 가능한 API
                // -----------------------------
                .requestMatchers("/api/users/signup", "/api/users/login").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll() // Preflight 허용
                .requestMatchers("/api/nlp/**").permitAll()            // NLP 서버 API 공개
                .requestMatchers("/api/scenarios/**").permitAll()      // 시나리오 목록/조회 공개
                // 게임 API (FREE 시나리오 비회원 접근 허용해야 하므로 공개)
                .requestMatchers(
                    "/api/game/session/start", // 세션 시작
                    "/api/game/ask",           // 질문하기
                    "/api/game/result"         // 사건 종료 (분석+결과 저장)
                ).permitAll()
                .requestMatchers("/uploads/**").permitAll()

                .requestMatchers(HttpMethod.GET,"/api/game-results/**").permitAll()

                // -----------------------------
                // 2) 로그인 후에만 접근 가능한 API
                // -----------------------------
                .requestMatchers(
                    "/api/users/me",
                    "/api/users/logout",
                    "/api/users/update-nickname",
                    "/api/users/update-password"
                ).authenticated()

                // 업로드 API 허용 추가
                .requestMatchers("/api/media/**").permitAll()

                // -----------------------------
                // 3) 그 외 나머지 요청은 기본적으로 인증 필요
                // -----------------------------
                .anyRequest().authenticated()
            )
            // -----------------------------
            // 폼 로그인 / HTTP Basic 비활성화
            // 우리는 JSON 기반 API + 세션 방식 사용
            // -----------------------------
            .formLogin(AbstractHttpConfigurer::disable)
            .httpBasic(AbstractHttpConfigurer::disable);

        return http.build();
    }

    // -----------------------------
    // CORS 설정
    // -----------------------------
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // 개발 단계에서는 여러 주소 허용 (localhost, 127.0.0.1, 내부 IP 등)
        config.setAllowedOriginPatterns(List.of(
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://192.168.*:5173"
        ));

        // 허용 메서드
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        // 허용 헤더
        config.setAllowedHeaders(List.of("*"));
        // 세션 쿠키 전송 허용
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
