package com.lingoguma.detective_backend.media.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class MediaService {

    // application.properties에서 경로를 읽어옴
    @Value("${app.upload.dir}")
    private String uploadDir;

    public String saveFile(MultipartFile file) {
        try {
            // 실제 저장 경로 (프로젝트 실행 위치 기준)
            String baseDir = System.getProperty("user.dir") 
                    + File.separator + uploadDir;

            // uploads 폴더 없으면 생성
            Files.createDirectories(Paths.get(baseDir));

            // 원본 확장자 추출
            String originalName = file.getOriginalFilename();
            String ext = (originalName != null && originalName.contains("."))
                    ? originalName.substring(originalName.lastIndexOf("."))
                    : "";

            // 고유한 파일명 생성
            String filename = java.util.UUID.randomUUID() + ext;

            // 저장
            Path filePath = Paths.get(baseDir, filename);
            file.transferTo(filePath.toFile());

            // URL 리턴 (정적 리소스로 매핑된 /uploads/ 경로)
            return "/uploads/" + filename;

        } catch (IOException e) {
            throw new RuntimeException("파일 저장 실패", e);
        }
    }
}
