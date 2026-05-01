package com.jolt.workflow.pipelineops;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

class WorkOrderRepositoryTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void listWorkordersTreatsDateOnlyCreatedToAsInclusiveEndOfDay() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(anyString(), any(Object[].class), eq(Integer.class))).thenReturn(0);
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());

        WorkOrderRepository repository = new WorkOrderRepository(jdbcTemplate, objectMapper);

        repository.listWorkorders(new WorkOrderRepository.PipelineOrderListQuery(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                "2026-03-10",
                null,
                null,
                1,
                20
        ));

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> paramsCaptor = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).queryForObject(sqlCaptor.capture(), paramsCaptor.capture(), eq(Integer.class));

        assertEquals(
                "SELECT COUNT(*) FROM work_order w WHERE 1=1  AND w.created_at < (?::date + INTERVAL '1 day') ",
                sqlCaptor.getValue()
        );
        assertArrayEquals(new Object[]{"2026-03-10"}, paramsCaptor.getValue());
    }

    @Test
    void convertToMaintenanceCarriesOverAdjustedImpactScope() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        WorkOrderRepository repository = org.mockito.Mockito.spy(new WorkOrderRepository(jdbcTemplate, objectMapper));

        ObjectNode sourceOrder = inspectionOrderWithManualImpactScope();
        doReturn(sourceOrder).when(repository).getWorkorder("WO-INS-1");

        ArgumentCaptor<JsonNode> createPayloadCaptor = ArgumentCaptor.forClass(JsonNode.class);
        doAnswer(invocation -> ((JsonNode) invocation.getArgument(0)).deepCopy())
                .when(repository)
                .upsertWorkorder(createPayloadCaptor.capture());

        ObjectNode action = objectMapper.createObjectNode();
        action.put("action", "convert_to_maintenance");
        ObjectNode payload = action.putObject("payload");
        payload.put("id", "WO-INS-1");
        payload.put("actor", "inspector");

        ObjectNode created = repository.handleAction(action);

        JsonNode createdPayload = createPayloadCaptor.getValue();
        assertNotNull(createdPayload);
        assertEquals(sourceOrder.path("impactScope"), createdPayload.path("impactScope"));
        assertEquals(true, createdPayload.path("impactScope").path("manualAdjusted").asBoolean());
        assertEquals(createdPayload.path("impactScope"), created.path("impactScope"));
    }

    @Test
    void convertToMaintenanceRejectsInspectionWithoutAbnormalRecord() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        WorkOrderRepository repository = org.mockito.Mockito.spy(new WorkOrderRepository(jdbcTemplate, objectMapper));

        ObjectNode sourceOrder = inspectionOrderWithManualImpactScope();
        ((ArrayNode) sourceOrder.path("inspection").path("records")).removeAll();
        doReturn(sourceOrder).when(repository).getWorkorder("WO-INS-1");

        ObjectNode action = objectMapper.createObjectNode();
        action.put("action", "convert_to_maintenance");
        ObjectNode payload = action.putObject("payload");
        payload.put("id", "WO-INS-1");
        payload.put("actor", "inspector");

        WorkOrderRepository.PipelineOpsException ex = assertThrows(
                WorkOrderRepository.PipelineOpsException.class,
                () -> repository.handleAction(action)
        );

        assertEquals(400, ex.getStatusCode());
        assertEquals("inspection_abnormal_required", ex.getMessage());
    }

    @Test
    void pumpControlLooksUpPriorStatusAcrossWorkOrders() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        WorkOrderRepository repository = org.mockito.Mockito.spy(new WorkOrderRepository(jdbcTemplate, objectMapper));

        ObjectNode currentOrder = maintenanceOrderWithBuilding("WO-MAI-2", "BLD-001", "博学楼");
        doReturn(currentOrder).when(repository).getWorkorder("WO-MAI-2");
        doReturn("running").when(jdbcTemplate).queryForObject(anyString(), eq(String.class), eq("BLD-001"));

        ObjectNode action = objectMapper.createObjectNode();
        action.put("action", "pump_control");
        ObjectNode payload = action.putObject("payload");
        payload.put("id", "WO-MAI-2");
        payload.put("actor", "dispatcher");
        payload.put("action", "close");

        repository.handleAction(action);

        ArgumentCaptor<String> querySqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).queryForObject(querySqlCaptor.capture(), eq(String.class), eq("BLD-001"));
        assertFalse(querySqlCaptor.getValue().contains("work_order_id"));

        ArgumentCaptor<String> updateSqlCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> updateArgsCaptor = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate, atLeastOnce()).update(updateSqlCaptor.capture(), updateArgsCaptor.capture());

        Object[] pumpInsertArgs = null;
        List<String> sqls = updateSqlCaptor.getAllValues();
        List<Object[]> args = updateArgsCaptor.getAllValues();
        for (int i = 0; i < sqls.size(); i++) {
            if (sqls.get(i).startsWith("INSERT INTO pump_control_log")) {
                pumpInsertArgs = args.get(i);
                break;
            }
        }

        assertNotNull(pumpInsertArgs);
        assertEquals("running", pumpInsertArgs[8]);
    }

    @Test
    void reopenClearsCompletionMetadata() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        WorkOrderRepository repository = org.mockito.Mockito.spy(new WorkOrderRepository(jdbcTemplate, objectMapper));

        ObjectNode currentOrder = objectMapper.createObjectNode();
        currentOrder.put("id", "WO-MAI-3");
        currentOrder.put("status", "completed");
        currentOrder.put("assignee", "tech");
        currentOrder.put("reviewer", "lead");
        currentOrder.put("resultSummary", "done");
        currentOrder.put("startedAt", "2026-03-09T08:00:00Z");
        currentOrder.put("reviewedAt", "2026-03-09T10:00:00Z");
        currentOrder.put("finishedAt", "2026-03-09T12:00:00Z");
        currentOrder.put("closedAt", "2026-03-09T12:30:00Z");

        doReturn(currentOrder, currentOrder).when(repository).getWorkorder("WO-MAI-3");

        ObjectNode body = objectMapper.createObjectNode();
        body.put("id", "WO-MAI-3");
        body.put("action", "reopen");

        repository.transitionWorkorder(body);

        ArgumentCaptor<String> updateSqlCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> updateArgsCaptor = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate, atLeastOnce()).update(updateSqlCaptor.capture(), updateArgsCaptor.capture());

        Object[] transitionArgs = null;
        List<String> sqls = updateSqlCaptor.getAllValues();
        List<Object[]> args = updateArgsCaptor.getAllValues();
        for (int i = 0; i < sqls.size(); i++) {
            if (sqls.get(i).startsWith("UPDATE work_order SET status = ?")) {
                transitionArgs = args.get(i);
                break;
            }
        }

        assertNotNull(transitionArgs);
        assertNull(transitionArgs[5]);
        assertNull(transitionArgs[6]);
        assertNull(transitionArgs[7]);
    }

    @Test
    void nextWorkorderIdAddsRandomSuffixToAvoidMillisecondCollisions() throws Exception {
        WorkOrderRepository repository = new WorkOrderRepository(mock(JdbcTemplate.class), objectMapper);
        Method method = WorkOrderRepository.class.getDeclaredMethod("nextWorkorderId", String.class);
        method.setAccessible(true);

        String firstId = (String) method.invoke(repository, "maintenance");
        String secondId = (String) method.invoke(repository, "maintenance");

        assertTrue(firstId.startsWith("WO-MAI-"));
        assertTrue(secondId.startsWith("WO-MAI-"));
        assertTrue(firstId.matches("WO-MAI-\\d+-[0-9a-f]{8}"));
        assertTrue(secondId.matches("WO-MAI-\\d+-[0-9a-f]{8}"));
        assertFalse(firstId.equals(secondId));
    }

    @Test
    void normalizeWorkOrderInputRejectsUnknownNodeIds() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());
        WorkOrderRepository repository = new WorkOrderRepository(jdbcTemplate, objectMapper);

        ObjectNode body = objectMapper.createObjectNode();
        body.put("title", "节点校验");
        body.put("type", "inspection");
        body.set("nodeIds", textArray("NODE-UNKNOWN"));

        WorkOrderRepository.PipelineOpsException ex = assertThrows(
                WorkOrderRepository.PipelineOpsException.class,
                () -> repository.normalizeWorkOrderInput(body, null, "WO-TEST-1", true)
        );

        assertEquals(400, ex.getStatusCode());
        assertEquals("node_ids_invalid", ex.getMessage());
    }

    @Test
    void normalizeWorkOrderInputRejectsUnknownBuildingId() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());
        WorkOrderRepository repository = new WorkOrderRepository(jdbcTemplate, objectMapper);

        ObjectNode body = objectMapper.createObjectNode();
        body.put("title", "楼宇校验");
        body.put("type", "inspection");
        body.put("buildingId", "BLD-UNKNOWN");

        WorkOrderRepository.PipelineOpsException ex = assertThrows(
                WorkOrderRepository.PipelineOpsException.class,
                () -> repository.normalizeWorkOrderInput(body, null, "WO-TEST-2", true)
        );

        assertEquals(400, ex.getStatusCode());
        assertEquals("building_id_invalid", ex.getMessage());
    }

    @Test
    void normalizeWorkOrderInputCanonicalizesSegmentFeatureIds() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0, String.class);
            if (sql.contains("FROM pipe_segments ps")) {
                return List.of(Map.of(
                        "id", "SEG-001",
                        "feature_id", "pipe-feature-1",
                        "from_node_id", "NODE-A",
                        "to_node_id", "NODE-B"
                ));
            }
            if (sql.contains("FROM pipe_segments WHERE")) {
                return List.of(Map.of(
                        "id", "SEG-001",
                        "feature_id", "pipe-feature-1"
                ));
            }
            if (sql.contains("FROM buildings WHERE code = ?")) {
                return List.of(Map.of(
                        "building_id", "BLD-001",
                        "building_name", "博学楼"
                ));
            }
            if (sql.contains("FROM asset_relations")) {
                return List.of(Map.of("building_id", "BLD-001"));
            }
            if (sql.contains("FROM building_rooms")) {
                return List.of(Map.of(
                        "id", "ROOM-101",
                        "room_no", "101",
                        "floor_no", 1
                ));
            }
            if (sql.contains("FROM rooms")) {
                return List.of();
            }
            return List.of();
        });
        WorkOrderRepository repository = new WorkOrderRepository(jdbcTemplate, objectMapper);

        ObjectNode body = objectMapper.createObjectNode();
        body.put("title", "管段归一化");
        body.put("type", "maintenance");
        body.put("pipelineMedium", "water");
        body.put("buildingId", "BLD-001");
        body.set("segmentIds", textArray("pipe-feature-1"));

        ObjectNode normalized = repository.normalizeWorkOrderInput(body, null, "WO-TEST-3", true);

        assertEquals("SEG-001", normalized.path("segmentIds").path(0).asText());
        assertEquals("BLD-001", normalized.path("buildingId").asText());
        assertEquals("博学楼", normalized.path("buildingName").asText());
        assertTrue(normalized.path("topologyChain").toString().contains("SEG-001"));
        assertTrue(normalized.path("topologyChain").toString().contains("pipe-feature-1"));
    }

    private ObjectNode inspectionOrderWithManualImpactScope() {
        ObjectNode sourceOrder = objectMapper.createObjectNode();
        sourceOrder.put("id", "WO-INS-1");
        sourceOrder.put("type", "inspection");
        sourceOrder.put("title", "巡检工单");
        sourceOrder.put("pipelineMedium", "water");
        sourceOrder.put("area", "北区");
        sourceOrder.put("buildingId", "BLD-001");
        sourceOrder.put("buildingName", "博学楼");
        sourceOrder.put("priority", "medium");
        sourceOrder.set("topologyChain", textArray("N-1001"));
        sourceOrder.set("nodeIds", textArray("N-1001"));
        sourceOrder.set("segmentIds", textArray("S-2101"));
        sourceOrder.set("roomIds", textArray("101"));
        sourceOrder.set("equipmentIds", textArray("PUMP-1"));
        sourceOrder.set("linkedWorkorderIds", objectMapper.createArrayNode());

        ObjectNode impactScope = objectMapper.createObjectNode();
        ArrayNode impactedBuildings = objectMapper.createArrayNode();
        ObjectNode building = impactedBuildings.addObject();
        building.put("buildingId", "BLD-001");
        building.put("buildingName", "博学楼");
        building.set("floors", textArray("1"));
        building.set("rooms", textArray("101", "102"));
        impactScope.set("impactedBuildings", impactedBuildings);
        impactScope.put("bypassRequirement", "manual_override");
        impactScope.put("manualAdjusted", true);
        ArrayNode adjustmentLogs = objectMapper.createArrayNode();
        adjustmentLogs.addObject()
                .put("actor", "dispatcher");
        impactScope.set("adjustmentLogs", adjustmentLogs);
        sourceOrder.set("impactScope", impactScope);

        ObjectNode inspection = objectMapper.createObjectNode();
        ArrayNode records = objectMapper.createArrayNode();
        ObjectNode abnormalRecord = records.addObject();
        abnormalRecord.put("judgement", "abnormal");
        abnormalRecord.put("issueText", "pressure anomaly");
        abnormalRecord.put("checkinNodeId", "N-1001");
        inspection.set("records", records);
        sourceOrder.set("inspection", inspection);
        return sourceOrder;
    }

    private ObjectNode maintenanceOrderWithBuilding(String id, String buildingId, String buildingName) {
        ObjectNode order = objectMapper.createObjectNode();
        order.put("id", id);
        ObjectNode impactScope = order.putObject("impactScope");
        ArrayNode impactedBuildings = impactScope.putArray("impactedBuildings");
        ObjectNode building = impactedBuildings.addObject();
        building.put("buildingId", buildingId);
        building.put("buildingName", buildingName);
        impactScope.put("bypassRequirement", "");
        impactScope.put("manualAdjusted", false);
        impactScope.putArray("adjustmentLogs");
        return order;
    }

    private ArrayNode textArray(String... values) {
        ArrayNode array = objectMapper.createArrayNode();
        for (String value : values) {
            array.add(value);
        }
        return array;
    }
}
