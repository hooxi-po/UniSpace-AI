package com.jolt.workflow.pipelineops;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pipeline-ops")
public class PipelineOpsController {

    private final WorkOrderRepository repository;
    private final ObjectMapper objectMapper;

    public PipelineOpsController(WorkOrderRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @GetMapping(value = "/workorders", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode listWorkorders(
            @RequestParam(name = "type", required = false) String type,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "area", required = false) String area,
            @RequestParam(name = "pipelineMedium", required = false) String pipelineMedium,
            @RequestParam(name = "nodeId", required = false) String nodeId,
            @RequestParam(name = "segmentId", required = false) String segmentId,
            @RequestParam(name = "buildingId", required = false) String buildingId,
            @RequestParam(name = "assignee", required = false) String assignee,
            @RequestParam(name = "createdFrom", required = false) String createdFrom,
            @RequestParam(name = "createdTo", required = false) String createdTo,
            @RequestParam(name = "q", required = false) String keyword,
            @RequestParam(name = "page", defaultValue = "1") Integer page,
            @RequestParam(name = "limit", required = false) Integer limit
    ) {
        return repository.listWorkorders(buildListQuery(
                type,
                status,
                area,
                pipelineMedium,
                nodeId,
                segmentId,
                buildingId,
                assignee,
                createdFrom,
                createdTo,
                keyword,
                page,
                limit
        ));
    }

    @GetMapping(value = "/workorder", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode getWorkorder(@RequestParam("id") String id) {
        String finalId = text(id);
        if (finalId == null || finalId.isBlank()) {
            throw new WorkOrderRepository.PipelineOpsException(400, "id_required");
        }
        ObjectNode workorder = repository.getWorkorder(finalId);
        if (workorder == null) {
            throw new WorkOrderRepository.PipelineOpsException(404, "workorder_not_found");
        }
        ObjectNode root = objectMapper.createObjectNode();
        root.set("workorder", workorder);
        return root;
    }

    @PostMapping(value = "/workorders", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode upsertWorkorder(@RequestBody String body) {
        ObjectNode payload = readObjectBody(body);
        ObjectNode workorder = repository.upsertWorkorder(payload);
        ObjectNode root = objectMapper.createObjectNode();
        root.set("workorder", workorder);
        return root;
    }

    @PatchMapping(value = "/workorders", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode transitionWorkorder(@RequestBody String body) {
        ObjectNode payload = readObjectBody(body);
        ObjectNode workorder = repository.transitionWorkorder(payload);
        ObjectNode root = objectMapper.createObjectNode();
        root.set("workorder", workorder);
        return root;
    }

    @PostMapping(value = "/auto-create", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode autoCreate(@RequestBody String body) {
        ObjectNode payload = readObjectBody(body);
        ObjectNode workorder = repository.autoCreate(payload);
        ObjectNode root = objectMapper.createObjectNode();
        root.set("workorder", workorder);
        return root;
    }

    @PostMapping(value = "/action", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode action(@RequestBody String body) {
        ObjectNode payload = readObjectBody(body);
        String action = text(payload.get("action"));
        ObjectNode result = repository.handleAction(payload);
        ObjectNode root = objectMapper.createObjectNode();
        if ("convert_to_maintenance".equals(action)) {
            root.set("maintenanceWorkorder", result);
        } else {
            root.set("workorder", result);
        }
        return root;
    }

    @GetMapping(value = "/stats", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode stats(
            @RequestParam(name = "type", required = false) String type,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "area", required = false) String area,
            @RequestParam(name = "pipelineMedium", required = false) String pipelineMedium,
            @RequestParam(name = "nodeId", required = false) String nodeId,
            @RequestParam(name = "segmentId", required = false) String segmentId,
            @RequestParam(name = "buildingId", required = false) String buildingId,
            @RequestParam(name = "assignee", required = false) String assignee,
            @RequestParam(name = "createdFrom", required = false) String createdFrom,
            @RequestParam(name = "createdTo", required = false) String createdTo,
            @RequestParam(name = "q", required = false) String keyword
    ) {
        ObjectNode root = objectMapper.createObjectNode();
        root.set("stats", repository.getStats(buildListQuery(
                type,
                status,
                area,
                pipelineMedium,
                nodeId,
                segmentId,
                buildingId,
                assignee,
                createdFrom,
                createdTo,
                keyword,
                1,
                null
        )));
        return root;
    }

    @GetMapping(value = "/dashboard", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode dashboard(
            @RequestParam(name = "type", required = false) String type,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "area", required = false) String area,
            @RequestParam(name = "pipelineMedium", required = false) String pipelineMedium,
            @RequestParam(name = "nodeId", required = false) String nodeId,
            @RequestParam(name = "segmentId", required = false) String segmentId,
            @RequestParam(name = "buildingId", required = false) String buildingId,
            @RequestParam(name = "assignee", required = false) String assignee,
            @RequestParam(name = "createdFrom", required = false) String createdFrom,
            @RequestParam(name = "createdTo", required = false) String createdTo,
            @RequestParam(name = "q", required = false) String keyword
    ) {
        ObjectNode root = objectMapper.createObjectNode();
        root.set("dashboard", repository.getDashboard(buildListQuery(
                type,
                status,
                area,
                pipelineMedium,
                nodeId,
                segmentId,
                buildingId,
                assignee,
                createdFrom,
                createdTo,
                keyword,
                1,
                null
        )));
        return root;
    }

    @ExceptionHandler(WorkOrderRepository.PipelineOpsException.class)
    public ResponseEntity<JsonNode> handlePipelineOpsException(WorkOrderRepository.PipelineOpsException ex) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("error", ex.getMessage());
        node.put("message", ex.getMessage());
        return ResponseEntity.status(ex.getStatusCode()).body(node);
    }

    private ObjectNode readObjectBody(String body) {
        try {
            JsonNode parsed = objectMapper.readTree(body == null ? "{}" : body);
            if (!parsed.isObject()) {
                throw new WorkOrderRepository.PipelineOpsException(400, "invalid_json");
            }
            return (ObjectNode) parsed;
        } catch (WorkOrderRepository.PipelineOpsException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new WorkOrderRepository.PipelineOpsException(400, "invalid_json");
        }
    }

    private String text(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isTextual()) {
            String value = node.asText();
            return value == null ? null : value.trim();
        }
        if (node.isNumber() || node.isBoolean()) {
            return String.valueOf(node.asText()).trim();
        }
        return null;
    }

    private String text(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private WorkOrderRepository.PipelineOrderListQuery buildListQuery(
            String type,
            String status,
            String area,
            String pipelineMedium,
            String nodeId,
            String segmentId,
            String buildingId,
            String assignee,
            String createdFrom,
            String createdTo,
            String keyword,
            Integer page,
            Integer limit
    ) {
        return new WorkOrderRepository.PipelineOrderListQuery(
                text(type),
                text(status),
                text(area),
                text(pipelineMedium),
                text(nodeId),
                text(segmentId),
                text(buildingId),
                text(assignee),
                text(createdFrom),
                text(createdTo),
                text(keyword),
                page == null ? 1 : page,
                limit
        );
    }
}
