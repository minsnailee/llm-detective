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
            // CORS 설정
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            // CSRF 비활성화 (REST API 에서는 일반적으로 비활성화)
            .csrf(AbstractHttpConfigurer::disable)
            // 요청별 접근 권한 설정
            .authorizeHttpRequests(auth -> auth
                // 로그인 전 접근 가능
                .requestMatchers("/api/users/signup", "/api/users/login").permitAll()
                // Preflight (OPTIONS 요청)은 항상 허용
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // 로그인 후에만 접근 가능
                .requestMatchers(
                    "/api/users/me",
                    "/api/users/logout",
                    "/api/users/update-nickname",
                    "/api/users/update-password"
                ).authenticated()
                // NLP 엔드포인트는 공개
                .requestMatchers("/api/nlp/**").permitAll()
                // 시나리오 API 공개
                .requestMatchers("/api/scenarios/**").permitAll()
                // 게임 세션 시작 API는 비로그인도 호출 가능
                .requestMatchers("/api/game/session/start").permitAll()
                // 나머지는 인증 필요
                .anyRequest().authenticated()
            )
            // 폼 로그인 / HTTP Basic 비활성화 (우리는 세션 + JSON 기반 API만 사용)
            .formLogin(AbstractHttpConfigurer::disable)
            .httpBasic(AbstractHttpConfigurer::disable);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // 개발 단계에서는 여러 주소 허용 (localhost, 127.0.0.1, 내부IP 등)
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


