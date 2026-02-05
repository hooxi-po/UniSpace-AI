package com.jolt.workflow.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DbInit {

    private final JdbcTemplate jdbc;

    @PostConstruct
    public void ensureVisibleColumn() {
        // 检查列是否存在
        Integer cnt = jdbc.queryForObject("""
            SELECT count(*) FROM information_schema.columns
            WHERE table_name='geo_features' AND column_name='visible'
            """, Integer.class);

        if (cnt != null && cnt == 0) {
            jdbc.execute("""
                ALTER TABLE geo_features
                ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT TRUE
                """);
            jdbc.execute("""
                CREATE INDEX IF NOT EXISTS geo_features_visible_idx
                ON geo_features(visible)
                """);
            System.out.println("[DB INIT] Added geo_features.visible column automatically");
        } else {
            System.out.println("[DB INIT] geo_features.visible column already exists");
        }
    }
}
