package com.jolt.workflow;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 简单演示接口：GET /api/hello -> { "message": "Hello, world!" }
 */
@RestController
public class HelloController {

    @GetMapping("/api/hello")
    public Map<String, String> hello() {
        return Map.of("message", "Hello, world!");
    }
}

