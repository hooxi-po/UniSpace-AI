CREATE TABLE IF NOT EXISTS work_order (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    order_type TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'draft',
    pipeline_medium TEXT NOT NULL DEFAULT 'mixed',
    priority TEXT NOT NULL DEFAULT 'medium',
    area TEXT NOT NULL DEFAULT '未分区',
    topology_chain JSONB NOT NULL DEFAULT '[]'::jsonb,
    node_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    segment_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    building_id TEXT,
    building_name TEXT,
    room_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    equipment_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    assignee TEXT,
    reviewer TEXT,
    planned_date DATE,
    deadline_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    result_summary TEXT NOT NULL DEFAULT '',
    linked_workorder_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    impact_scope JSONB NOT NULL DEFAULT '{"impactedBuildings":[],"bypassRequirement":"","manualAdjusted":false,"adjustmentLogs":[]}'::jsonb,
    inspection_payload JSONB,
    maintenance_payload JSONB,
    retrofit_payload JSONB,
    retire_payload JSONB,
    notifications JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by TEXT NOT NULL DEFAULT 'admin-ui',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT work_order_type_ck CHECK (order_type IN ('inspection', 'maintenance', 'retrofit', 'retire')),
    CONSTRAINT work_order_status_ck CHECK (status IN ('draft', 'todo', 'assigned', 'in_progress', 'paused', 'review', 'completed', 'closed', 'cancelled', 'rejected')),
    CONSTRAINT work_order_priority_ck CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    CONSTRAINT work_order_medium_ck CHECK (pipeline_medium IN ('water', 'drainage', 'sewage', 'mixed'))
);

DROP TRIGGER IF EXISTS trg_work_order_updated_at ON work_order;
CREATE TRIGGER trg_work_order_updated_at
BEFORE UPDATE ON work_order
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS work_order_status_idx ON work_order(status);
CREATE INDEX IF NOT EXISTS work_order_type_idx ON work_order(order_type);
CREATE INDEX IF NOT EXISTS work_order_area_idx ON work_order(area);
CREATE INDEX IF NOT EXISTS work_order_assignee_idx ON work_order(assignee);
CREATE INDEX IF NOT EXISTS work_order_priority_idx ON work_order(priority);
CREATE INDEX IF NOT EXISTS work_order_medium_idx ON work_order(pipeline_medium);
CREATE INDEX IF NOT EXISTS work_order_building_idx ON work_order(building_id);
CREATE INDEX IF NOT EXISTS work_order_created_at_idx ON work_order(created_at DESC);
CREATE INDEX IF NOT EXISTS work_order_updated_at_idx ON work_order(updated_at DESC);
CREATE INDEX IF NOT EXISTS work_order_node_ids_gin ON work_order USING GIN (node_ids);
CREATE INDEX IF NOT EXISTS work_order_segment_ids_gin ON work_order USING GIN (segment_ids);
CREATE INDEX IF NOT EXISTS work_order_impact_scope_gin ON work_order USING GIN (impact_scope);

CREATE TABLE IF NOT EXISTS order_building_link (
    id BIGSERIAL PRIMARY KEY,
    work_order_id TEXT NOT NULL REFERENCES work_order(id) ON DELETE CASCADE,
    building_id TEXT NOT NULL,
    building_name TEXT NOT NULL,
    floor_nos JSONB NOT NULL DEFAULT '[]'::jsonb,
    room_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    source TEXT NOT NULL DEFAULT 'impact',
    is_manual_adjusted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT order_building_link_unique UNIQUE (work_order_id, building_id, source)
);

DROP TRIGGER IF EXISTS trg_order_building_link_updated_at ON order_building_link;
CREATE TRIGGER trg_order_building_link_updated_at
BEFORE UPDATE ON order_building_link
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS order_building_link_work_order_idx ON order_building_link(work_order_id);
CREATE INDEX IF NOT EXISTS order_building_link_building_idx ON order_building_link(building_id);
CREATE INDEX IF NOT EXISTS order_building_link_source_idx ON order_building_link(source);
CREATE INDEX IF NOT EXISTS order_building_link_floor_gin ON order_building_link USING GIN (floor_nos);
CREATE INDEX IF NOT EXISTS order_building_link_room_refs_gin ON order_building_link USING GIN (room_refs);

CREATE TABLE IF NOT EXISTS work_order_log (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL REFERENCES work_order(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    content TEXT NOT NULL,
    actor TEXT NOT NULL,
    location JSONB,
    photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    voice_url TEXT,
    node_id TEXT,
    is_mobile_upload BOOLEAN NOT NULL DEFAULT false,
    extra JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_order_log_work_order_idx ON work_order_log(work_order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS work_order_log_stage_idx ON work_order_log(stage);
CREATE INDEX IF NOT EXISTS work_order_log_actor_idx ON work_order_log(actor);
CREATE INDEX IF NOT EXISTS work_order_log_node_idx ON work_order_log(node_id);
CREATE INDEX IF NOT EXISTS work_order_log_created_at_idx ON work_order_log(created_at DESC);

CREATE TABLE IF NOT EXISTS pump_control_log (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL REFERENCES work_order(id) ON DELETE CASCADE,
    building_id TEXT NOT NULL,
    building_name TEXT NOT NULL,
    pump_id TEXT NOT NULL,
    action TEXT NOT NULL,
    duration_minutes INTEGER,
    result TEXT NOT NULL,
    before_status TEXT,
    after_status TEXT,
    countdown_seconds INTEGER,
    batch_total INTEGER,
    batch_index INTEGER,
    progress_percent NUMERIC(6,2),
    message TEXT,
    executed_by TEXT NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    extra JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT pump_control_action_ck CHECK (action IN ('open', 'close', 'set_duration')),
    CONSTRAINT pump_control_result_ck CHECK (result IN ('success', 'failed'))
);

CREATE INDEX IF NOT EXISTS pump_control_log_work_order_idx ON pump_control_log(work_order_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS pump_control_log_building_idx ON pump_control_log(building_id);
CREATE INDEX IF NOT EXISTS pump_control_log_result_idx ON pump_control_log(result);
CREATE INDEX IF NOT EXISTS pump_control_log_executed_at_idx ON pump_control_log(executed_at DESC);
