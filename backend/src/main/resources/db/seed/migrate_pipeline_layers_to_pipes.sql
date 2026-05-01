BEGIN;

UPDATE geo_features
SET layer = 'pipes'
WHERE layer = 'roads'
  AND id IN (
      SELECT feature_id
      FROM pipe_segments
      WHERE feature_id IS NOT NULL
  );

COMMIT;
