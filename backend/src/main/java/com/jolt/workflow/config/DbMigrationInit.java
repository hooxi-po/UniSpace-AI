package com.jolt.workflow.config;

import jakarta.annotation.PostConstruct;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DbMigrationInit {

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

        System.out.printf(
            "[DB MIGRATION] success=%s, migrationsExecuted=%d, targetSchemaVersion=%s%n",
            result.success,
            result.migrationsExecuted,
            result.targetSchemaVersion
        );
    }
}
