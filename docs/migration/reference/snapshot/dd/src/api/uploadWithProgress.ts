/**
 * @description 通用上传封装（基于 XMLHttpRequest，提供真实上传进度）
 * @date 2026-07-06
 *
 * 背景：Umi Max 的 request 底层基于 fetch，而 fetch 标准不支持上传进度回调。
 * 因此真实进度必须改用原生 XMLHttpRequest（xhr.upload.onprogress）。
 *
 * XHR 不经过 app.tsx 的拦截器，故在此复刻鉴权头注入与业务码路由（调用
 * httpShared），与 umi 路径保持一致的真相源。
 *
 * 核心能力：
 * 1. 真实进度回调（100ms 节流，末次必发）
 * 2. 停滞检测：连接/上传阶段 60s 无进展信号 → 自动中止（phase 区分卡在哪段）
 *    请求体发完（upload.onload）后停用，避免后端响应慢被误杀
 * 3. 外部中止：AbortSignal，调用方可随时取消
 * 4. lengthComputable=false 时仅透传 loaded，调用方降级为 indeterminate
 * 5. 结构化 reject：STALL/ABORTED/NETWORK/PARSE_FAIL/HTTP_ERROR，便于分类文案
 */
import { buildAuthHeaders, dispatchBusinessCode } from "./httpShared";

/**
 * 上传进度事件。
 * - lengthComputable=true：loaded/total 可信，可算百分比与 ETA
 * - lengthComputable=false：仅 loaded 可信（也可能为 0），调用方应降级为 indeterminate
 */
export interface UploadProgressEvent {
    /** 已上传字节数 */
    loaded: number;
    /** 总字节数（lengthComputable=false 时可能为 0） */
    total: number;
    /** total 是否可信 */
    lengthComputable: boolean;
}

/**
 * 上传选项。
 */
export interface UploadOptions {
    /** 进度回调（已节流，不必担心高频渲染） */
    onProgress?: (e: UploadProgressEvent) => void;
    /** 中止信号；abort 后 promise reject({reason:"ABORTED"}) */
    signal?: AbortSignal;
    /** 停滞阈值：连续 N 毫秒无新进展信号则自动中止。默认 60000(60s) */
    stallTimeoutMs?: number;
    /** 额外请求头（如未来需要自定义字段） */
    headers?: Record<string, string>;
}

/**
 * 中止/失败原因，调用方据此给不同文案。
 */
export type UploadRejectReason =
    | "ABORTED" // 用户/外部主动取消
    | "STALL" // 连接或上传阶段长时间无进展
    | "NETWORK" // 网络层错误（断网/DNS/CORS）
    | "PARSE_FAIL" // 响应非合法 JSON
    | "HTTP_ERROR"; // HTTP 非 2xx（含 nginx 502 HTML 错误页）

/**
 * reject 的结构化 payload（非 Error 实例，便于调用方区分场景）。
 */
export interface UploadRejectPayload {
    reason: UploadRejectReason;
    /** STALL 时标注卡在哪段：连接建立 / 上传字节 */
    phase?: "connecting" | "uploading";
    /** HTTP_ERROR / PARSE_FAIL 时的 HTTP 状态码 */
    status?: number;
    /** HTTP_ERROR / PARSE_FAIL 时的响应原文前 200 字符 */
    snippet?: string;
    /** 兜底 message */
    message?: string;
}

/** 进度回调最小节流间隔（毫秒），避免高频 setState 卡顿 */
const PROGRESS_THROTTLE_MS = 100;

/**
 * 通用上传：基于 XMLHttpRequest，提供真实上传进度。
 *
 * URL 直接使用相对路径（/fms/v1/...），dev 走 umi proxy，prod 同源。
 * 内部复刻 app.tsx 的鉴权注入与业务码路由（调用 httpShared）。
 * 成功时 resolve 后端业务体 {code, message, ...}，与 umi post 返回结构一致。
 */
export function uploadWithProgress(
    url: string,
    formData: FormData,
    options: UploadOptions = {}
): Promise<{ code: number; message: string; [k: string]: any }> {
    const {
        onProgress,
        signal,
        stallTimeoutMs = 60000,
        headers: extraHeaders
    } = options;

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);

        // 中止标记：避免 onabort 兜底与触发处重复 reject
        let aborted = false;
        // 请求体是否已发完（upload.onload 触发后停用停滞检测）
        let uploadDone = false;
        // 停滞定时器句柄
        let stallTimer: ReturnType<typeof setTimeout> | null = null;
        // 进度回调上次触发时间（节流用）
        let lastProgressEmitTs = 0;
        // 最近一次已知 loaded（用于判断是否真有新字节 + 末次 flush）
        let lastLoaded = 0;
        // 最近一次 total（末次 flush 用，仅在 lengthComputable=true 时有意义）
        let lastTotal = 0;
        // 最近一次 lengthComputable（末次 flush 保持一致，避免误切 phase）
        let lastLengthComputable = false;
        // 当前所处阶段，用于 STALL 文案区分"连接超时 / 上传停滞"
        let phase: "connecting" | "uploading" = "connecting";

        const clearStallTimer = () => {
            if (stallTimer) {
                clearTimeout(stallTimer);
                stallTimer = null;
            }
        };

        /**
         * 统一的失败出口：标记中止 → 清定时器 → 中止 xhr → reject。
         * 已 aborted 时直接返回，保证只 settle 一次。
         */
        const finishReject = (payload: UploadRejectPayload) => {
            if (aborted) return;
            aborted = true;
            clearStallTimer();
            try {
                xhr.abort();
            } catch {
                /* ignore */
            }
            reject(payload);
        };

        /**
         * 重置停滞定时器（任一进展信号调用）。
         * uploadDone 后直接返回——请求体已发完、进入等待响应阶段，
         * 后端校验/落盘/重启耗时可能 >60s 且无内置进展信号，不应误判为停滞。
         */
        const resetStallTimer = () => {
            if (uploadDone) return;
            clearStallTimer();
            stallTimer = setTimeout(() => {
                finishReject({ reason: "STALL", phase });
            }, stallTimeoutMs);
        };

        // 外部 signal 已 abort（调用方在传入前已 abort）—— 在 send 之前拦截，不发出请求
        if (signal?.aborted) {
            reject({ reason: "ABORTED" });
            return;
        }
        // 监听外部 abort 信号
        signal?.addEventListener("abort", () => {
            finishReject({ reason: "ABORTED" });
        });

        // 鉴权头合并；不要手动设置 Content-Type（multipart 由浏览器自动带 boundary）
        const headers = {
            ...buildAuthHeaders(),
            ...(extraHeaders || {})
        };
        Object.keys(headers).forEach((key) => {
            xhr.setRequestHeader(key, headers[key]);
        });

        /**
         * 进度回调（节流）。force=true 时绕过节流（用于 upload.onload 末次 flush）。
         */
        const emitProgress = (
            e: { loaded: number; total: number; lengthComputable: boolean },
            force = false
        ) => {
            if (aborted || !onProgress) return;
            const now = Date.now();
            if (!force && now - lastProgressEmitTs < PROGRESS_THROTTLE_MS) return;
            lastProgressEmitTs = now;
            onProgress({
                loaded: e.loaded,
                total: e.total,
                lengthComputable: e.lengthComputable
            });
        };

        // ① 连接建好、开始发请求体（连接阶段进展信号）
        xhr.upload.onloadstart = () => {
            phase = "uploading";
            resetStallTimer();
        };

        // ② 字节在发（上传阶段进展信号 + 进度回调）
        xhr.upload.onprogress = (e: ProgressEvent) => {
            // 仅当 loaded 真正增长才视为进展（同字节重复事件不重置定时器）
            if (e.loaded > lastLoaded) {
                lastLoaded = e.loaded;
                resetStallTimer();
            }
            lastTotal = e.total;
            lastLengthComputable = e.lengthComputable;
            emitProgress(e);
        };

        // 请求体发完 → 进入等待响应阶段：停用停滞检测 + 强制 flush 最后一次进度
        xhr.upload.onload = () => {
            uploadDone = true;
            clearStallTimer();
            if (onProgress) {
                if (lastLengthComputable) {
                    // lengthComputable=true：确保 100% 那次回调必发（节流可能吞掉末次 onprogress）
                    // 调用方据此切到 awaiting-response
                    emitProgress(
                        {
                            loaded: lastTotal,
                            total: lastTotal,
                            lengthComputable: true
                        },
                        true
                    );
                } else {
                    // lengthComputable=false：仅透传已知 loaded，不伪造 total；
                    // 调用方据此保持走马灯直到 success（停滞检测已由事件层覆盖）
                    emitProgress(
                        {
                            loaded: lastLoaded,
                            total: 0,
                            lengthComputable: false
                        },
                        true
                    );
                }
            }
        };

        // 响应回到（复刻响应拦截器）
        xhr.onload = () => {
            clearStallTimer();
            if (aborted) return;
            const status = xhr.status;
            const raw = xhr.responseText || "";
            if (status >= 200 && status < 300) {
                let body: any;
                try {
                    body = JSON.parse(raw);
                } catch {
                    reject({
                        reason: "PARSE_FAIL",
                        status,
                        snippet: raw.slice(0, 200)
                    });
                    return;
                }
                // 复刻响应拦截器业务码路由（1001000 跳授权 / 1000000 清 token 跳登录）
                // 即使已触发跳转/重载也 resolve（避免调用方误弹错误提示）
                dispatchBusinessCode(body?.code);
                resolve(body);
            } else {
                // HTTP 非 2xx（含 nginx 502 HTML 错误页）：不调 dispatchBusinessCode（无可用 body）
                reject({
                    reason: "HTTP_ERROR",
                    status,
                    snippet: raw.slice(0, 200)
                });
            }
        };

        // 网络层失败（DNS、断网、CORS 拒绝）
        xhr.onerror = () => {
            clearStallTimer();
            if (!aborted) {
                reject({ reason: "NETWORK" });
            }
        };

        // 被中止（停滞或外部 signal）—— 由 finishReject 统一 reject，这里兜底防漏
        xhr.onabort = () => {
            if (!aborted) {
                finishReject({ reason: "ABORTED" });
            }
        };

        // 不设 xhr.timeout（决策：依赖停滞检测 + 手动取消，不设硬超时）
        xhr.send(formData);
        // send 之后立即启动停滞检测，覆盖①连接建立阶段（onloadstart 之前）
        resetStallTimer();
    });
}
