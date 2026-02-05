package com.jolt.workflow.geo;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class GeoFeatureController {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public GeoFeatureController(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @GetMapping(value = "/features", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode listFeatures(
            @RequestParam(name = "bbox", required = false) String bbox,
            @RequestParam(name = "layers", required = false) String layers,
            @RequestParam(name = "limit", required = false, defaultValue = "2000") int limit,
            @RequestParam(name = "visible", required = false) Boolean visible
    ) {
        // bbox: minLon,minLat,maxLon,maxLat (EPSG:4326)
        String where = "WHERE 1=1";
        java.util.ArrayList<Object> params = new java.util.ArrayList<>();

        if (layers != null && !layers.isBlank()) {
            List<String> layerList = List.of(layers.split(","));
            StringBuilder sb = new StringBuilder();
            sb.append(" AND layer IN (");
            for (int i = 0; i < layerList.size(); i++) {
                if (i > 0) sb.append(",");
                sb.append("?");
                params.add(layerList.get(i).trim());
            }
            sb.append(")");
            where += sb;
        }

        if (bbox != null && !bbox.isBlank()) {
            double[] b = parseBbox(bbox);
            where += " AND geom && ST_MakeEnvelope(?, ?, ?, ?, 4326)";
            params.add(b[0]);
            params.add(b[1]);
            params.add(b[2]);
            params.add(b[3]);
        }

        if (visible != null) {
            where += " AND visible = ?";
            params.add(visible);
        }

        params.add(limit);
        Object[] finalParams = params.toArray();

        String sql = "SELECT jsonb_build_object(" +
                "'type','FeatureCollection'," +
                "'features', COALESCE(jsonb_agg(jsonb_build_object(" +
                "  'type','Feature'," +
                "  'id', id," +
                "  'properties', properties || jsonb_build_object('visible', visible)," +
                "  'geometry', ST_AsGeoJSON(geom)::jsonb" +
                ")),'[]'::jsonb)" +
                ") AS fc " +
                "FROM (SELECT id, layer, geom, properties, visible FROM geo_features " + where + " LIMIT ?) t";

        String json = jdbcTemplate.queryForObject(sql, finalParams, String.class);
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize FeatureCollection", e);
        }
    }

    @GetMapping(value = "/features/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode getFeature(@PathVariable("id") String id) {
        String sql = "SELECT jsonb_build_object(" +
                "'type','Feature'," +
                "'id', id," +
                "'properties', properties," +
                "'geometry', ST_AsGeoJSON(geom)::jsonb" +
                ") AS f " +
                "FROM geo_features WHERE id = ?";

        String json = jdbcTemplate.query(sql, ps -> ps.setString(1, id), rs -> {
            if (!rs.next()) return null;
            return rs.getString("f");
        });

        if (json == null) {
            try {
                return objectMapper.readTree("{\"error\":\"not_found\"}");
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize Feature", e);
        }
    }

    @PutMapping(value = "/features/visibility", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JsonNode> setVisibilityByBody(@RequestBody String body) {
        String id;
        boolean v;

        try {
            JsonNode n = objectMapper.readTree(body);

            JsonNode idNode = n.get("id");
            if (idNode == null || !idNode.isTextual() || idNode.asText().isBlank()) {
                return ResponseEntity.badRequest().body(objectMapper.readTree("{\"error\":\"id_required\"}"));
            }
            id = idNode.asText();

            JsonNode vv = n.get("visible");
            if (vv == null || !vv.isBoolean()) {
                return ResponseEntity.badRequest().body(objectMapper.readTree("{\"error\":\"visible_required\"}"));
            }
            v = vv.asBoolean();
        } catch (Exception e) {
            try {
                return ResponseEntity.badRequest().body(objectMapper.readTree("{\"error\":\"invalid_json\"}"));
            } catch (Exception ex) {
                throw new RuntimeException(ex);
            }
        }

        int updated = jdbcTemplate.update("UPDATE geo_features SET visible = ? WHERE id = ?", v, id);
        if (updated == 0) {
            try {
                return ResponseEntity.status(404).body(objectMapper.readTree("{\"error\":\"not_found\"}"));
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        try {
            return ResponseEntity.ok(objectMapper.readTree("{\"ok\":true}"));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // Backward compatible endpoint (NOTE: ids like "relation/123" will trigger %2F issues in some servers)
    @PutMapping(value = "/features/{id}/visibility", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JsonNode> setVisibilityLegacy(
            @PathVariable("id") String id,
            @RequestBody String body
    ) {
        boolean v;
        try {
            JsonNode n = objectMapper.readTree(body);
            JsonNode vv = n.get("visible");
            if (vv == null || !vv.isBoolean()) {
                return ResponseEntity.badRequest().body(objectMapper.readTree("{\"error\":\"visible_required\"}"));
            }
            v = vv.asBoolean();
        } catch (Exception e) {
            try {
                return ResponseEntity.badRequest().body(objectMapper.readTree("{\"error\":\"invalid_json\"}"));
            } catch (Exception ex) {
                throw new RuntimeException(ex);
            }
        }

        int updated = jdbcTemplate.update("UPDATE geo_features SET visible = ? WHERE id = ?", v, id);
        if (updated == 0) {
            try {
                return ResponseEntity.status(404).body(objectMapper.readTree("{\"error\":\"not_found\"}"));
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        try {
            return ResponseEntity.ok(objectMapper.readTree("{\"ok\":true}"));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static double[] parseBbox(String bbox) {
        String[] parts = bbox.split(",");
        if (parts.length != 4) {
            throw new IllegalArgumentException("bbox must be minLon,minLat,maxLon,maxLat");
        }
        return new double[] {
                Double.parseDouble(parts[0].trim()),
                Double.parseDouble(parts[1].trim()),
                Double.parseDouble(parts[2].trim()),
                Double.parseDouble(parts[3].trim())
        };
    }
}
