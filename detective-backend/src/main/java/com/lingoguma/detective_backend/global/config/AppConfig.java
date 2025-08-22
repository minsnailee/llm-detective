package com.lingoguma.detective_backend.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestTemplate;

/*
 * 공용 Bean 등록용 설정 파일
 *  - RestTemplate: 다른 서버(FastAPI 등)와 HTTP 통신할 때 사용
 */
@Configuration
public class AppConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public RestTemplate restTemplate() {
        // 간단한 테스트
        return new RestTemplate();
    }
}
