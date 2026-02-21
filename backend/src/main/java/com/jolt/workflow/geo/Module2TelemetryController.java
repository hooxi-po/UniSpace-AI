package com.jolt.workflow.geo;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/module2/telemetry")
public class Module2TelemetryController {

    private static final Set<String> ALLOWED_METRICS = Set.of("pressure", "flow", "turbidity", "chlorine");

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public Module2TelemetryController(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @PostMapping(value = "/ingest", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JsonNode> ingest(@RequestBody String body) {
        JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(error("invalid_json"));
        }

        String pointId = text(root.get("pointId"));
        if (pointId == null || pointId.isBlank()) {
            return ResponseEntity.badRequest().body(error("pointId_required"));
        }

        String metric = text(root.get("metric"));
        if (metric == null || !ALLOWED_METRICS.contains(metric)) {
            return ResponseEntity.badRequest().body(error("invalid_metric"));
        }

        JsonNode valueNode = root.get("value");
        if (valueNode == null || !valueNode.isNumber()) {
            return ResponseEntity.badRequest().body(error("value_required"));
        }
        double value = valueNode.asDouble();

        String featureId = text(root.get("featureId"));
        String pointName = text(root.get("pointName"));
        String unit = text(root.get("unit"));
        String quality = text(root.get("quality"));
        String source = text(root.get("source"));
        OffsetDateTime sampledAt;
        try {
            sampledAt = parseTime(text(root.get("sampledAt")));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(error("invalid_sampledAt"));
        }

        String finalPointName = (pointName == null || pointName.isBlank()) ? ("测点-" + pointId) : pointName;
        String finalQuality = (quality == null || quality.isBlank()) ? "good" : quality;
        String finalSource = (source == null || source.isBlank()) ? "ingest" : source;

        jdbcTemplate.update(
                "INSERT INTO m2_sensor_points (id, feature_id, point_name, point_type, status, properties) " +
                        "VALUES (?, ?, ?, ?, 'online', '{}'::jsonb) " +
                        "ON CONFLICT (id) DO UPDATE SET " +
                        "feature_id = COALESCE(EXCLUDED.feature_id, m2_sensor_points.feature_id), " +
                        "point_name = COALESCE(NULLIF(EXCLUDED.point_name, ''), m2_sensor_points.point_name), " +
                        "point_type = EXCLUDED.point_type, " +
                        "status = 'online', " +
                        "updated_at = now()",
                pointId,
                featureId,
                finalPointName,
                metric
        );

        jdbcTemplate.update(
                "INSERT INTO m2_metric_history (point_id, feature_id, metric, value, unit, sampled_at, quality, source) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                pointId,
                featureId,
                metric,
                value,
                unit,
                sampledAt,
                finalQuality,
                finalSource
        );

        jdbcTemplate.update(
                "INSERT INTO m2_metric_latest (point_id, metric, value, unit, sampled_at, quality, source) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?) " +
                        "ON CONFLICT (point_id, metric) DO UPDATE SET " +
                        "value = EXCLUDED.value, " +
                        "unit = EXCLUDED.unit, " +
                        "sampled_at = EXCLUDED.sampled_at, " +
                        "quality = EXCLUDED.quality, " +
                        "source = EXCLUDED.source",
                pointId,
                metric,
                value,
                unit,
                sampledAt,
                finalQuality,
                finalSource
        );

        ThresholdResult thresholdResult = evaluateThreshold(pointId, metric, value);
        if (thresholdResult.severity() != null) {
            String message = "point " + pointId + " metric " + metric + " triggered " + thresholdResult.severity();
            jdbcTemplate.update(
                    "INSERT INTO m2_alert_events (point_id, feature_id, metric, severity, message, value, threshold_value, status, properties) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?::jsonb)",
                    pointId,
                    featureId,
                    metric,
                    thresholdResult.severity(),
                    message,
                    value,
                    thresholdResult.thresholdValue(),
                    "{}"
            );
        }

        ObjectNode ok = objectMapper.createObjectNode();
        ok.put("ok", true);
        ok.put("pointId", pointId);
        ok.put("metric", metric);
        ok.put("value", value);
        ok.put("sampledAt", sampledAt.toString());
        ok.put("alertCreated", thresholdResult.severity() != null);
        if (thresholdResult.severity() != null) {
            ok.put("severity", thresholdResult.severity());
            if (thresholdResult.thresholdValue() != null) {
                ok.put("thresholdValue", thresholdResult.thresholdValue());
            }
        }
        return ResponseEntity.ok(ok);
    }

    @PutMapping(value = "/thresholds", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JsonNode> upsertThreshold(@RequestBody String body) {
        JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(error("invalid_json"));
        }

        String pointId = text(root.get("pointId"));
        if (pointId == null || pointId.isBlank()) {
            return ResponseEntity.badRequest().body(error("pointId_required"));
        }

        String metric = text(root.get("metric"));
        if (metric == null || !ALLOWED_METRICS.contains(metric)) {
            return ResponseEntity.badRequest().body(error("invalid_metric"));
        }

        Double warnLow = number(root.get("warnLow"));
        Double warnHigh = number(root.get("warnHigh"));
        Double alarmLow = number(root.get("alarmLow"));
        Double alarmHigh = number(root.get("alarmHigh"));
        boolean enabled = root.has("enabled") ? root.path("enabled").asBoolean(true) : true;

        int updated = jdbcTemplate.update(
                "INSERT INTO m2_threshold_rules (point_id, metric, warn_low, warn_high, alarm_low, alarm_high, enabled) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?) " +
                        "ON CONFLICT (point_id, metric) DO UPDATE SET " +
                        "warn_low = EXCLUDED.warn_low, " +
                        "warn_high = EXCLUDED.warn_high, " +
                        "alarm_low = EXCLUDED.alarm_low, " +
                        "alarm_high = EXCLUDED.alarm_high, " +
                        "enabled = EXCLUDED.enabled, " +
                        "updated_at = now()",
                pointId,
                metric,
                warnLow,
                warnHigh,
                alarmLow,
                alarmHigh,
                enabled
        );

        ObjectNode ok = objectMapper.createObjectNode();
        ok.put("ok", updated > 0);
        ok.put("pointId", pointId);
        ok.put("metric", metric);
        return ResponseEntity.ok(ok);
    }

    @GetMapping(value = "/latest", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode latest(
            @RequestParam(name = "pointIds", required = false) String pointIdsRaw,
            @RequestParam(name = "metric", required = false) String metric,
            @RequestParam(name = "limit", required = false, defaultValue = "500") int limit
    ) {
        int safeLimit = Math.max(1, Math.min(limit, 5000));

        List<String> pointIds = pointIdsRaw == null
                ? List.of()
                : List.of(pointIdsRaw.split(",")).stream().map(String::trim).filter(s -> !s.isBlank()).distinct().toList();

        StringBuilder sql = new StringBuilder(
                "SELECT l.point_id, p.feature_id, p.point_name, p.point_type, l.metric, l.value, COALESCE(l.unit, '') AS unit, " +
                        "l.sampled_at, l.quality, l.source " +
                        "FROM m2_metric_latest l " +
                        "JOIN m2_sensor_points p ON p.id = l.point_id " +
                        "WHERE 1=1"
        );
        List<Object> params = new ArrayList<>();

        if (!pointIds.isEmpty()) {
            String placeholders = String.join(",", java.util.Collections.nCopies(pointIds.size(), "?"));
            sql.append(" AND l.point_id IN (").append(placeholders).append(")");
            params.addAll(pointIds);
        }
        if (metric != null && !metric.isBlank()) {
            sql.append(" AND l.metric = ?");
            params.add(metric.trim());
        }

        sql.append(" ORDER BY l.sampled_at DESC LIMIT ?");
        params.add(safeLimit);

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), params.toArray());
        ObjectNode root = objectMapper.createObjectNode();
        ArrayNode list = objectMapper.createArrayNode();
        root.set("list", list);
        for (Map<String, Object> row : rows) {
            ObjectNode item = objectMapper.createObjectNode();
            item.put("pointId", String.valueOf(row.get("point_id")));
            item.put("featureId", row.get("feature_id") == null ? "" : String.valueOf(row.get("feature_id")));
            item.put("pointName", String.valueOf(row.get("point_name")));
            item.put("pointType", String.valueOf(row.get("point_type")));
            item.put("metric", String.valueOf(row.get("metric")));
            item.put("value", ((Number) row.get("value")).doubleValue());
            item.put("unit", String.valueOf(row.get("unit")));
            item.put("sampledAt", String.valueOf(row.get("sampled_at")));
            item.put("quality", String.valueOf(row.get("quality")));
            item.put("source", String.valueOf(row.get("source")));
            list.add(item);
        }
        return root;
    }

    @GetMapping(value = "/history", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JsonNode> history(
            @RequestParam(name = "pointId") String pointId,
            @RequestParam(name = "metric", required = false) String metric,
            @RequestParam(name = "from", required = false) String fromRaw,
            @RequestParam(name = "to", required = false) String toRaw,
            @RequestParam(name = "limit", required = false, defaultValue = "1000") int limit
    ) {
        if (pointId == null || pointId.isBlank()) {
            return ResponseEntity.badRequest().body(error("pointId_required"));
        }

        OffsetDateTime from = null;
        OffsetDateTime to = null;
        try {
            if (fromRaw != null && !fromRaw.isBlank()) from = OffsetDateTime.parse(fromRaw);
            if (toRaw != null && !toRaw.isBlank()) to = OffsetDateTime.parse(toRaw);
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest().body(error("invalid_time_range"));
        }

        int safeLimit = Math.max(1, Math.min(limit, 5000));
        StringBuilder sql = new StringBuilder(
                "SELECT id, point_id, feature_id, metric, value, COALESCE(unit, '') AS unit, sampled_at, quality, source " +
                        "FROM m2_metric_history WHERE point_id = ?"
        );
        List<Object> params = new ArrayList<>();
        params.add(pointId);

        if (metric != null && !metric.isBlank()) {
            sql.append(" AND metric = ?");
            params.add(metric.trim());
        }
        if (from != null) {
            sql.append(" AND sampled_at >= ?");
            params.add(from);
        }
        if (to != null) {
            sql.append(" AND sampled_at <= ?");
            params.add(to);
        }

        sql.append(" ORDER BY sampled_at DESC LIMIT ?");
        params.add(safeLimit);

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), params.toArray());
        ObjectNode root = objectMapper.createObjectNode();
        root.put("pointId", pointId);
        ArrayNode list = objectMapper.createArrayNode();
        root.set("list", list);

        for (Map<String, Object> row : rows) {
            ObjectNode item = objectMapper.createObjectNode();
            item.put("id", String.valueOf(row.get("id")));
            item.put("pointId", String.valueOf(row.get("point_id")));
            item.put("featureId", row.get("feature_id") == null ? "" : String.valueOf(row.get("feature_id")));
            item.put("metric", String.valueOf(row.get("metric")));
            item.put("value", ((Number) row.get("value")).doubleValue());
            item.put("unit", String.valueOf(row.get("unit")));
            item.put("sampledAt", String.valueOf(row.get("sampled_at")));
            item.put("quality", String.valueOf(row.get("quality")));
            item.put("source", String.valueOf(row.get("source")));
            list.add(item);
        }

        return ResponseEntity.ok(root);
    }

    private ThresholdResult evaluateThreshold(String pointId, String metric, double value) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT warn_low, warn_high, alarm_low, alarm_high " +
                        "FROM m2_threshold_rules WHERE point_id = ? AND metric = ? AND enabled = true LIMIT 1",
                pointId,
                metric
        );
        if (rows.isEmpty()) return new ThresholdResult(null, null);

        Map<String, Object> row = rows.get(0);
        Double warnLow = asDouble(row.get("warn_low"));
        Double warnHigh = asDouble(row.get("warn_high"));
        Double alarmLow = asDouble(row.get("alarm_low"));
        Double alarmHigh = asDouble(row.get("alarm_high"));

        if (alarmLow != null && value <= alarmLow) return new ThresholdResult("critical", alarmLow);
        if (alarmHigh != null && value >= alarmHigh) return new ThresholdResult("critical", alarmHigh);
        if (warnLow != null && value <= warnLow) return new ThresholdResult("warning", warnLow);
        if (warnHigh != null && value >= warnHigh) return new ThresholdResult("warning", warnHigh);
        return new ThresholdResult(null, null);
    }

    private OffsetDateTime parseTime(String raw) {
        if (raw == null || raw.isBlank()) return OffsetDateTime.now();
        try {
            return OffsetDateTime.parse(raw);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("invalid_sampledAt", e);
        }
    }

    private ObjectNode error(String code) {
        ObjectNode n = objectMapper.createObjectNode();
        n.put("error", code);
        return n;
    }

    private String text(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (!node.isTextual()) return null;
        String value = node.asText();
        return value == null ? null : value.trim();
    }

    private Double number(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (!node.isNumber()) return null;
        return node.asDouble();
    }

    private Double asDouble(Object value) {
        if (value instanceof Number number) return number.doubleValue();
        return null;
    }

    private record ThresholdResult(String severity, Double thresholdValue) {}
}
