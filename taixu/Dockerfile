# taixu（太虚）Docker 镜像构建
#
# 唯一事实源: ../设计文档.md 第三章「taixu（太虚）」
# 镜像与业务能力完全解耦: 本镜像不绑定任何业务 Agent; 业务配置由 taixu 网关注入.
# 调研参考（已沉淀、不再重写）: ../docs/opencode-server-api调研.md、../docs/架构设计.md

FROM eclipse-temurin:21-jre-jammy

ENV TZ=Asia/Shanghai \
    JAVA_OPTS="-Xms256m -Xmx512m"

WORKDIR /app

# 复制 jar 包 (maven 构建产物)
COPY target/taixu-0.1.0.jar /app/taixu.jar

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/taixu.jar"]