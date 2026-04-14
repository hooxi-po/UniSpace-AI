package com.jolt.workflow.util;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;

/**
 * 数据填充工具
 * 启动时自动执行 seed SQL 脚本
 *
 * 使用方式：
 * 1. 启动应用时添加参数：--seed.enabled=true
 * 2. 或在 application.properties 中设置：seed.enabled=true
 */
@Component
public class DataSeeder implements CommandLineRunner {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) throws Exception {
        // 检查是否启用数据填充
        boolean seedEnabled = false;
        for (String arg : args) {
            if (arg.equals("--seed.enabled=true") || arg.equals("--seed")) {
                seedEnabled = true;
                break;
            }
        }

        if (!seedEnabled) {
            System.out.println("数据填充未启用。使用 --seed 参数启用。");
            return;
        }

        System.out.println("开始执行数据填充...");

        try {
            // 读取 SQL 文件
            ClassPathResource resource = new ClassPathResource("db/seed/seed_pipeline_workorders.sql");
            String sql;
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
                sql = reader.lines().collect(Collectors.joining("\n"));
            }

            // 执行 SQL
            jdbcTemplate.execute(sql);

            System.out.println("✅ 数据填充完成！");
            System.out.println("已导入管网运维工单测试数据。");

        } catch (Exception e) {
            System.err.println("❌ 数据填充失败：" + e.getMessage());
            e.printStackTrace();
        }
    }
}
