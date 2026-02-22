-- Module 2 telemetry data model for pressure / flow / turbidity / chlorine.

CREATE TABLE IF NOT EXISTS m2_sensor_points (
    id TEXT PRIMARY KEY,
    feature_id TEXT REFERENCES geo_features(id) ON DELETE SET NULL,
    point_name TEXT NOT NULL,
    point_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'online',
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS m2_sensor_points_feature_idx ON m2_sensor_points(feature_id);
CREATE INDEX IF NOT EXISTS m2_sensor_points_type_idx ON m2_sensor_points(point_type);
CREATE INDEX IF NOT EXISTS m2_sensor_points_status_idx ON m2_sensor_points(status);
CREATE INDEX IF NOT EXISTS m2_sensor_points_properties_gin ON m2_sensor_points USING GIN (properties);

DROP TRIGGER IF EXISTS trg_m2_sensor_points_updated_at ON m2_sensor_points;
CREATE TRIGGER trg_m2_sensor_points_updated_at
BEFORE UPDATE ON m2_sensor_points
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS m2_threshold_rules (
    id BIGSERIAL PRIMARY KEY,
    point_id TEXT NOT NULL REFERENCES m2_sensor_points(id) ON DELETE CASCADE,
    metric TEXT NOT NULL,
    warn_low DOUBLE PRECISION,
    warn_high DOUBLE PRECISION,
    alarm_low DOUBLE PRECISION,
    alarm_high DOUBLE PRECISION,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT m2_threshold_rules_unique UNIQUE (point_id, metric)
);

CREATE INDEX IF NOT EXISTS m2_threshold_rules_point_idx ON m2_threshold_rules(point_id);
CREATE INDEX IF NOT EXISTS m2_threshold_rules_metric_idx ON m2_threshold_rules(metric);
CREATE INDEX IF NOT EXISTS m2_threshold_rules_enabled_idx ON m2_threshold_rules(enabled);

DROP TRIGGER IF EXISTS trg_m2_threshold_rules_updated_at ON m2_threshold_rules;
CREATE TRIGGER trg_m2_threshold_rules_updated_at
BEFORE UPDATE ON m2_threshold_rules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS m2_metric_latest (
    point_id TEXT NOT NULL REFERENCES m2_sensor_points(id) ON DELETE CASCADE,
    metric TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit TEXT,
    sampled_at TIMESTAMPTZ NOT NULL,
    quality TEXT NOT NULL DEFAULT 'good',
    source TEXT NOT NULL DEFAULT 'manual',
    PRIMARY KEY (point_id, metric)
);

CREATE INDEX IF NOT EXISTS m2_metric_latest_metric_idx ON m2_metric_latest(metric);
CREATE INDEX IF NOT EXISTS m2_metric_latest_sampled_idx ON m2_metric_latest(sampled_at DESC);

CREATE TABLE IF NOT EXISTS m2_metric_history (
    id BIGSERIAL PRIMARY KEY,
    point_id TEXT NOT NULL REFERENCES m2_sensor_points(id) ON DELETE CASCADE,
    feature_id TEXT REFERENCES geo_features(id) ON DELETE SET NULL,
    metric TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit TEXT,
    sampled_at TIMESTAMPTZ NOT NULL,
    quality TEXT NOT NULL DEFAULT 'good',
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS m2_metric_history_point_metric_sampled_idx
    ON m2_metric_history(point_id, metric, sampled_at DESC);
CREATE INDEX IF NOT EXISTS m2_metric_history_feature_metric_idx
    ON m2_metric_history(feature_id, metric);
CREATE INDEX IF NOT EXISTS m2_metric_history_sampled_idx
    ON m2_metric_history(sampled_at DESC);

CREATE TABLE IF NOT EXISTS m2_alert_events (
    id BIGSERIAL PRIMARY KEY,
    point_id TEXT REFERENCES m2_sensor_points(id) ON DELETE SET NULL,
    feature_id TEXT REFERENCES geo_features(id) ON DELETE SET NULL,
    metric TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning',
    message TEXT NOT NULL,
    value DOUBLE PRECISION,
    threshold_value DOUBLE PRECISION,
    status TEXT NOT NULL DEFAULT 'open',
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS m2_alert_events_point_idx ON m2_alert_events(point_id);
CREATE INDEX IF NOT EXISTS m2_alert_events_metric_idx ON m2_alert_events(metric);
CREATE INDEX IF NOT EXISTS m2_alert_events_severity_idx ON m2_alert_events(severity);
CREATE INDEX IF NOT EXISTS m2_alert_events_status_idx ON m2_alert_events(status);
CREATE INDEX IF NOT EXISTS m2_alert_events_triggered_idx ON m2_alert_events(triggered_at DESC);
CREATE INDEX IF NOT EXISTS m2_alert_events_properties_gin ON m2_alert_events USING GIN (properties);
