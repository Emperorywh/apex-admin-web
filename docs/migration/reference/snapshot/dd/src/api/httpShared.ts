/**
 * @description HTTP 拦截器共享逻辑（被 app.tsx 与 uploadWithProgress 共用）
 * @date 2026-07-06
 *
 * 抽取目的：XHR 上传路径不经过 umi 的 request/responseInterceptors，
 * 为避免两处分别硬编码导致漂移，集中"鉴权头组装"与"业务码路由"为纯函数，
 * 让 app.tsx 的拦截器与 uploadWithProgress 调用同一份真相源。
 */
import { history } from "@umijs/max";

/**
 * 请求拦截器共享逻辑：组装鉴权头与语言头。
 *
 * - 鉴权：从 localStorage 读取 accessInfo 取 token。现状 app.tsx 直接
 *   JSON.parse 无兜底，存储被篡改时整个拦截器会抛错；抽取为共享函数后
 *   顺手加 try-catch：异常时退化为空 token（后续被后端 1000000 拒绝并
 *   走正常跳登录流程），比直接抛错更稳。
 * - 语言：拦截器不在 React 上下文，无法调用 useI18n，直接从 localStorage
 *   读取当前国际化语言，动态下发给后端用于返回对应语言文案。
 *
 * 由 app.tsx 的 requestInterceptors 与 uploadWithProgress 共同调用，
 * 确保两路请求（umi fetch / 原生 XHR）携带完全一致的请求头。
 */
export function buildAuthHeaders(): Record<string, string> {
    // 从 localStorage 解析 accessInfo，缺失或非法 JSON 时返回空 token
    let accessInfo: any = {};
    try {
        accessInfo = JSON.parse(localStorage.getItem("accessInfo") || "{}");
    } catch {
        accessInfo = {};
    }
    return {
        Authorization: accessInfo?.token || "",
        // 国际化语言：拦截器不在 React 上下文，直接从 localStorage 读取，
        // 动态下发给后端用于返回对应语言文案
        "Accept-Language": localStorage.getItem("umi_locale") || "zh-CN"
    };
}

/**
 * 业务码定义集中常量，便于 dispatchBusinessCode 与调用方引用。
 */
export const BIZ_CODE = {
    UNAUTHORIZED: 1001000, // 未授权 → 跳授权页
    TOKEN_EXPIRED: 1000000 // token 过期 → 清 token 跳登录并 reload
} as const;

/**
 * 响应拦截器共享逻辑：按后端 data.code 做全局路由。
 * - 1001000：跳授权页
 * - 1000000：清 token、设过期标记、跳登录并 reload
 * - 其余：不处理
 *
 * 返回值表示是否触发了重定向/重载，调用方可据此短路后续逻辑。
 */
export function dispatchBusinessCode(code: number): boolean {
    switch (code) {
        case BIZ_CODE.UNAUTHORIZED:
            // 未授权，跳转到授权页
            history.push({ pathname: "/authorize-ingress" });
            return true;
        case BIZ_CODE.TOKEN_EXPIRED:
            // token 过期：清存储、打标记、跳登录并重载
            localStorage.removeItem("accessInfo");
            sessionStorage.setItem("token_expired", "1");
            history.replace({ pathname: "/login" });
            window.location.reload();
            return true;
        default:
            return false;
    }
}
