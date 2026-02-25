package com.jolt.workflow.config;

import jakarta.annotation.PostConstruct;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.db.init.enabled", havingValue = "true", matchIfMissing = true)
public class DbMigrationInit {

    private static final Logger log = LoggerFactory.getLogger(DbMigrationInit.class);

    private final DataSource dataSource;

    @PostConstruct
    public void migrateOnStartup() {
        // Boot auto-config may be disabled or skipped in some environments.
        // Enforce migration execution to keep schema in sync.
        MigrateResult result = Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .baselineOnMigrate(true)
            .load()
            .migrate();

        log.info(
                "db_migration_complete success={} migrationsExecuted={} targetSchemaVersion={}",
                result.success,
                result.migrationsExecuted,
                result.targetSchemaVersion
        );
    }
}
