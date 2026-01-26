CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS geo_features (
    id TEXT PRIMARY KEY,
    layer TEXT NOT NULL,
    geom geometry(GEOMETRY, 4326) NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS geo_features_layer_idx ON geo_features(layer);
CREATE INDEX IF NOT EXISTS geo_features_geom_gist ON geo_features USING GIST (geom);
CREATE INDEX IF NOT EXISTS geo_features_properties_gin ON geo_features USING GIN (properties);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_geo_features_updated_at ON geo_features;
CREATE TRIGGER trg_geo_features_updated_at
BEFORE UPDATE ON geo_features
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
