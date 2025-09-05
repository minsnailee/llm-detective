package com.lingoguma.detective_backend.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/*
 * 정적 리소스 핸들러
 * - /uploads/** 요청을 실제 서버의 uploads 폴더와 연결
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 상대경로: 프로젝트 루트/uploads 폴더
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:uploads/");

        // 절대경로 사용 시 (예: /home/ubuntu/app/uploads/)
        // registry.addResourceHandler("/uploads/**")
        //         .addResourceLocations("file:/home/ubuntu/app/uploads/");
    }
}
