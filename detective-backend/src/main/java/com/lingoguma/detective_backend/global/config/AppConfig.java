package com.lingoguma.detective_backend.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.web.http.DefaultCookieSerializer;
import org.springframework.web.client.RestTemplate;

/*
 * 공용 Bean 등록용 설정 파일
 *  - RestTemplate: 다른 서버(FastAPI 등)와 HTTP 통신할 때 사용
 *  - DefaultCookieSerializer: 세션 쿠키 SameSite/보안 설정
 */
@Configuration
public class AppConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public RestTemplate restTemplate() {
        // 간단한 테스트용 RestTemplate
        return new RestTemplate();
    }

    @Bean
    public DefaultCookieSerializer cookieSerializer() {
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setCookieName("JSESSIONID");   // 세션 쿠키 이름
        serializer.setCookiePath("/");            // 전체 경로에서 사용
        serializer.setSameSite(null);             // SameSite 속성 제거 (개발용)
        serializer.setUseSecureCookie(false);     // HTTP 개발환경이므로 Secure=false
        // serializer.setSameSite("None");  // 크로스도메인 요청에서도 쿠키 허용
        // serializer.setUseSecureCookie(true); // HTTPS에서만 전송되도록 보안 강화
        return serializer;
    }
}
