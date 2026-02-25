package com.jolt.workflow.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.db.init.enabled", havingValue = "true", matchIfMissing = true)
public class DbInit {

    private static final Logger log = LoggerFactory.getLogger(DbInit.class);

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
            log.info("db_init_added_geo_features_visible_column");
        } else {
            log.info("db_init_geo_features_visible_column_exists");
        }
    }
}
