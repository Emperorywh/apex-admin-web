/**
 * @description 国际化 Hook（useIntl 二次封装）
 *
 * 统一的国际化调用入口，所有组件应使用此 Hook 而非直接使用 useIntl。
 * 预留未来扩展点：
 *   - 缺失 key 日志追踪
 *   - key 前缀自动注入
 *   - 翻译缓存优化
 *   - 统一的回退策略调整
 */
import { useIntl } from "@umijs/max";

type TranslateValues = Record<string, string | number>;

export function useI18n() {
  const intl = useIntl();

  /**
   * 简化的翻译方法，替代 intl.formatMessage({ id })
   *
   * 空 id 防护：
   *   当 id 为空字符串、undefined 或 null 时（常见于枚举查找未命中、
   *   接口字段为空等场景），直接返回空字符串，避免 React Intl 抛出
   *   "An `id` must be provided to format a message" 错误导致页面崩溃。
   *   例如：t(MissionState[value] || "") 在 value 未命中枚举时曾触发该错误。
   */
  const t = (id: string, values?: TranslateValues): string => {
    if (!id) return "";
    return intl.formatMessage({ id }, values);
  };

  return { t, locale: intl.locale };
}
