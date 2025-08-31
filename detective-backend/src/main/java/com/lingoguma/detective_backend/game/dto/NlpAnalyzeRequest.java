package com.lingoguma.detective_backend.game.dto;

import lombok.Data;
import java.util.Map;

@Data
public class NlpAnalyzeRequest {
    private Integer sessionId;
    private Map<String, Object> logJson;
}
