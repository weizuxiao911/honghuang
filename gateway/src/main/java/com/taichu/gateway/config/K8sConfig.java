package com.honghuang.taixu.config;

import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * K8s 客户端配置, 按 设计文档.md 第三章「taixu（太虚）」> K8s 编排调度.
 *
 * Fabric8 K8s 客户端自动读取 ~/.kube/config 或 KUBECONFIG 环境变量.
 * 生产环境可换成 Spring Cloud Kubernetes 的 ServiceAccount 模式.
 */
@Configuration
public class K8sConfig {

    @Bean
    public KubernetesClient kubernetesClient() {
        return new KubernetesClientBuilder().build();
    }
}