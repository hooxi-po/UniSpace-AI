-- Add visibility column to geo_features table
ALTER TABLE geo_features
ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT TRUE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS geo_features_visible_idx ON geo_features(visible);
