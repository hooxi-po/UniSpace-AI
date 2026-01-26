package com.jolt.workflow.geo;

import com.fasterxml.jackson.databind.JsonNode;

public record GeoFeatureRow(
        String id,
        String layer,
        String geomGeoJson,
        JsonNode properties
) {}
