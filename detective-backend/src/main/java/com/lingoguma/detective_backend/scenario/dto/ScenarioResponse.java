package com.lingoguma.detective_backend.scenario.dto;

import com.lingoguma.detective_backend.scenario.entity.Scenario;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScenarioResponse {
    private Integer scenIdx;
    private String scenTitle;
    private String scenSummary;
    private Integer scenLevel;
    private String contentJson;
    private String scenAccess;
    private String scenStatus;

    public static ScenarioResponse fromEntity(Scenario s) {
        return ScenarioResponse.builder()
                .scenIdx(s.getScenIdx())
                .scenTitle(s.getScenTitle())
                .scenSummary(s.getScenSummary())
                .scenLevel(s.getScenLevel())
                .contentJson(s.getContentJson())
                .scenAccess(s.getScenAccess().name())
                .scenStatus(s.getScenStatus().name())
                .build();
    }
}
