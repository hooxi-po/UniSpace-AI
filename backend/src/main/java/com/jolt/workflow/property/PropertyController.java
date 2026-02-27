package com.jolt.workflow.property;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/property")
public class PropertyController {

    private final JdbcTemplate jdbcTemplate;

    public PropertyController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/buildings")
    public Map<String, Object> listBuildings() {
        String sql = "SELECT code, project_name, building_name, contractor, supervisor, contract_amount, " +
                "audit_amount, fund_source, location, planned_area, floor_count, room_count, project_manager, " +
                "planned_start_date, planned_end_date, actual_start_date, actual_end_date, status " +
                "FROM buildings ORDER BY code";
        List<Map<String, Object>> buildings = jdbcTemplate.queryForList(sql);
        return Map.of(
                "source", "postgres",
                "buildings", buildings
        );
    }

    @GetMapping("/rooms")
    public Map<String, Object> listRooms(
            @RequestParam(name = "buildingCode", required = false) String buildingCode,
            @RequestParam(name = "type", required = false) String type,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "limit", defaultValue = "500") int limit,
            @RequestParam(name = "offset", defaultValue = "0") int offset
    ) {
        int safeLimit = Math.max(1, Math.min(limit, 2000));
        int safeOffset = Math.max(0, offset);

        StringBuilder where = new StringBuilder(" WHERE 1=1 ");
        List<Object> params = new ArrayList<>();

        if (buildingCode != null && !buildingCode.isBlank()) {
            where.append(" AND r.building_code = ? ");
            params.add(buildingCode);
        }
        if (type != null && !type.isBlank() && !"all".equalsIgnoreCase(type)) {
            where.append(" AND r.type = ? ");
            params.add(type);
        }
        if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
            where.append(" AND r.status = ? ");
            params.add(status);
        }

        String sql = "SELECT r.id, r.building_code, r.building_name, r.room_no, r.floor, r.area, r.type, r.status, " +
                "r.department, r.main_category, r.sub_category, COALESCE(b.building_name, r.building_name) AS master_building_name " +
                "FROM rooms r LEFT JOIN buildings b ON b.code = r.building_code " +
                where +
                " ORDER BY r.building_code, r.floor, r.room_no LIMIT ? OFFSET ?";

        params.add(safeLimit);
        params.add(safeOffset);

        List<Map<String, Object>> rooms = jdbcTemplate.queryForList(sql, params.toArray());

        return Map.of(
                "source", "postgres",
                "rooms", rooms,
                "limit", safeLimit,
                "offset", safeOffset
        );
    }

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        String totalSql = "SELECT COUNT(*) FROM rooms";
        String occupiedSql = "SELECT COUNT(*) FROM rooms WHERE status = 'Occupied'";

        Integer totalRooms = jdbcTemplate.queryForObject(totalSql, Integer.class);
        Integer occupiedRooms = jdbcTemplate.queryForObject(occupiedSql, Integer.class);

        int total = totalRooms == null ? 0 : totalRooms;
        int occupied = occupiedRooms == null ? 0 : occupiedRooms;
        int available = Math.max(0, total - occupied);
        String occupancyRate = total == 0 ? "0.0" : String.format("%.1f", occupied * 100.0 / total);

        return Map.of(
                "source", "postgres",
                "stats", Map.of(
                        "totalRooms", total,
                        "occupiedRooms", occupied,
                        "availableRooms", available,
                        "pendingApplications", 0,
                        "occupancyRate", occupancyRate,
                        "unpaidUtilities", 0
                )
        );
    }
}

