package com.lingoguma.detective_backend.scenario.dto;

import com.lingoguma.detective_backend.scenario.entity.ScenAccess;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ScenarioRequest {
    private String scenTitle;
    private String scenSummary;
    private Integer scenLevel;
    private ScenAccess scenAccess; // FREE or MEMBER
    private String contentJson;
}
