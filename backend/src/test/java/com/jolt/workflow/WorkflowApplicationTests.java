package com.jolt.workflow;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
			"app.security.write-auth-enabled=false",
			"app.db.init.enabled=false",
			"spring.flyway.enabled=false",
			"spring.jpa.hibernate.ddl-auto=none",
			"spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect",
			"spring.datasource.url=jdbc:h2:mem:workflow-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
			"spring.datasource.driverClassName=org.h2.Driver",
			"spring.datasource.username=sa",
			"spring.datasource.password="
	})
class WorkflowApplicationTests {

	@Test
	void contextLoads() {
	}

}
