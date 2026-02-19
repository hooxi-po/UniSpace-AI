-- Twin topology model for drilldown / trace / telemetry / edit-audit

CREATE TABLE IF NOT EXISTS pipe_nodes (
    id TEXT PRIMARY KEY,
    feature_id TEXT REFERENCES geo_features(id) ON DELETE SET NULL,
    node_type TEXT NOT NULL,
    name TEXT,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pipe_nodes_feature_idx ON pipe_nodes(feature_id);
CREATE INDEX IF NOT EXISTS pipe_nodes_type_idx ON pipe_nodes(node_type);
CREATE INDEX IF NOT EXISTS pipe_nodes_properties_gin ON pipe_nodes USING GIN (properties);

DROP TRIGGER IF EXISTS trg_pipe_nodes_updated_at ON pipe_nodes;
CREATE TRIGGER trg_pipe_nodes_updated_at
BEFORE UPDATE ON pipe_nodes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS pipe_segments (
    id TEXT PRIMARY KEY,
    feature_id TEXT UNIQUE REFERENCES geo_features(id) ON DELETE CASCADE,
    from_node_id TEXT REFERENCES pipe_nodes(id) ON DELETE SET NULL,
    to_node_id TEXT REFERENCES pipe_nodes(id) ON DELETE SET NULL,
    diameter_mm NUMERIC(10, 2),
    material TEXT,
    status TEXT NOT NULL DEFAULT 'normal',
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pipe_segments_feature_idx ON pipe_segments(feature_id);
CREATE INDEX IF NOT EXISTS pipe_segments_from_node_idx ON pipe_segments(from_node_id);
CREATE INDEX IF NOT EXISTS pipe_segments_to_node_idx ON pipe_segments(to_node_id);
CREATE INDEX IF NOT EXISTS pipe_segments_status_idx ON pipe_segments(status);
CREATE INDEX IF NOT EXISTS pipe_segments_properties_gin ON pipe_segments USING GIN (properties);

DROP TRIGGER IF EXISTS trg_pipe_segments_updated_at ON pipe_segments;
CREATE TRIGGER trg_pipe_segments_updated_at
BEFORE UPDATE ON pipe_segments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS asset_relations (
    id BIGSERIAL PRIMARY KEY,
    source_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asset_relations_source_idx ON asset_relations(source_id, source_type);
CREATE INDEX IF NOT EXISTS asset_relations_target_idx ON asset_relations(target_id, target_type);
CREATE INDEX IF NOT EXISTS asset_relations_type_idx ON asset_relations(relation_type);
CREATE INDEX IF NOT EXISTS asset_relations_properties_gin ON asset_relations USING GIN (properties);

CREATE TABLE IF NOT EXISTS telemetry_latest (
    point_id TEXT NOT NULL,
    feature_id TEXT NOT NULL REFERENCES geo_features(id) ON DELETE CASCADE,
    metric TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit TEXT,
    sampled_at TIMESTAMPTZ NOT NULL,
    quality TEXT NOT NULL DEFAULT 'good',
    source TEXT NOT NULL DEFAULT 'manual',
    PRIMARY KEY (point_id, metric)
);

CREATE INDEX IF NOT EXISTS telemetry_latest_feature_idx ON telemetry_latest(feature_id);
CREATE INDEX IF NOT EXISTS telemetry_latest_metric_idx ON telemetry_latest(metric);
CREATE INDEX IF NOT EXISTS telemetry_latest_sampled_idx ON telemetry_latest(sampled_at DESC);

CREATE TABLE IF NOT EXISTS edit_audit_log (
    id BIGSERIAL PRIMARY KEY,
    feature_id TEXT NOT NULL REFERENCES geo_features(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    changed_by TEXT NOT NULL DEFAULT 'system',
    before_payload JSONB,
    after_payload JSONB,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS edit_audit_feature_idx ON edit_audit_log(feature_id);
CREATE INDEX IF NOT EXISTS edit_audit_changed_at_idx ON edit_audit_log(changed_at DESC);
