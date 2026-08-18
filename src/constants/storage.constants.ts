/**
 * Storage key、前缀与持久化 schema 版本（规格 §3.6 所有权表、§8）。
 * 任何 localStorage 读写与 redux-persist 配置一律引用本文件，禁止散落字符串 key。
 */

/**
 * Storage key 统一前缀（规格 §8.2）。
 * redux-persist 各 slice key 与其他本地存储 key 均以该前缀开头，避免与其他应用冲突。
 */
export const STORAGE_KEY_PREFIX = 'apex_'

/**
 * 主题启动镜像 Storage key（规格 §8.3，固定为含前缀的完整字面量）。
 * settings 变化时同步写入最小只读镜像，index.html 启动脚本读取 mode/resolvedMode
 * 提前设置 data-theme、color-scheme 与初始背景，避免刷新时出现反色闪烁。
 */
export const THEME_BOOT_STORAGE_KEY = 'apex_boot_theme'

/**
 * redux-persist schema 版本，从 1 起步（规格 §8.2）。
 * 持久化结构变化必须递增该版本并提供 migrate 映射；
 * 迁移失败时清认证字段、保留可解析的界面设置并提示一次恢复失败。
 *
 * 版本历史：v1 初始；v2（2026-08-17）settings 移除 fontSize/fontFamily（规格 v1.6 §10.1），
 * 迁移识别并丢弃这两个遗留字段；v3（2026-08-18）user 移除 sessionSource（规格 v1.12
 * 演示模式移除），迁移识别并丢弃该遗留字段；v4（2026-08-18）user 移除 refreshToken
 * （规格 v1.14 改由 HttpOnly Cookie 承载），迁移识别并丢弃该遗留字段。
 */
export const PERSIST_SCHEMA_VERSION = 4
