package com.lingoguma.detective_backend.game.dto;

import lombok.Data;
import java.util.Map;

@Data
public class NlpAnalyzeResponse {
    private Map<String, Integer> skills; // logic, creativity, focus, diversity, depth
}
