package com.lingoguma.detective_backend.game.dto;

import lombok.*;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class NlpAskRequest {
    private Long session_id;    // FastAPI와 맞추기 위해 snake_case
    private String suspect_name;
    private String user_text;
}
