# 版本包上传真实进度改造规格说明

- 文档：`docs/SPEC_update_version_real_upload_progress.md`
- 目标页面：`src/pages/SystemInvolve/VersionControl/UpdateVersion/index.tsx`
- 关联全局配置：`src/app.tsx`（请求/响应拦截器）
- 创建日期：2026-07-06
- 状态：已与用户确认全部关键决策（三轮访谈），待实施

---

## 1. 背景与目标

当前"更新版本包"上传使用**伪进度条**：`setInterval` 以递减速率把百分比从 0 推到 90%，请求成功后跳到 100%。它与真实上传字节数完全无关，慢网下 90% 长期停滞、快网下又"假慢"，体验差且误导。

**目标**：改为基于真实上传字节数的进度反馈，同时不破坏现有的鉴权与业务码路由（token 注入、`1001000`/`1000000` 跳转）。

### 1.1 硬约束（决定方案选型）

Umi Max 内置的 `request`（`@umijs/max` 的 `request`）底层基于 **fetch**。**fetch 标准不支持上传进度回调**（无 `upload.onprogress` 等价物）。

> 结论：umi 的 `request` 无法提供真实上传进度，**必须改用原生 `XMLHttpRequest`**（`xhr.upload.onprogress`）。

### 1.2 XHR 带来的副作用（本规格的核心命题）

XHR 不经过 `app.tsx` 的 `requestInterceptors` / `responseInterceptors`，意味着：

- 请求不会自动带 `Authorization` 头；
- 响应不会自动按 `data.code` 路由（`1001000` 跳授权页 / `1000000` 清 token 跳登录）。

用户明确要求："也要把 `app.tsx` 请求和响应的拦截器加上去"。因此 XHR 路径必须**复刻这两段拦截器逻辑**，且为避免两处维护漂移，**抽取为共享函数**，让 `app.tsx` 与 XHR 封装调用同一份实现。

---

## 2. 决策汇总（访谈结论）

| 维度 | 决策 |
|---|---|
| 封装范围 | 新建**通用** `uploadWithProgress` 工具，但**本次仅接入 UpdateVersion**；`upLoadMap` / `uploadPlaybackFile` 暂不动（后续可直接复用） |
| 拦截器复用 | **抽共享函数** `buildAuthHeaders()` / `dispatchBusinessCode(code)`；`app.tsx` 与 XHR 封装都调用同一份 |
| 重启语义 | 后端**先响应、后重启**（前端能拿到正常成功响应） |
| 超时与中止 | **不设硬超时**；用"进度停滞检测 + 显式取消按钮" |
| 上传后过渡 | 拿到成功响应**立即清 token 跳登录**（不轮询健康检查） |
| 进度信息维度 | 百分比 + 已传/总大小(MB) + 速度(MB/s) + ETA |
| 取消 | 模态框"取消"按钮 + `Modal.confirm` 二次确认 → `xhr.abort()` |
| beforeunload | **仅上传中**拦截关闭/刷新；响应回来后不再拦截 |
| `lengthComputable=false` | 降级为 **indeterminate** 走马灯（不造假）；**不影响停滞检测**（停滞检测基于 XHR 生命周期事件，不依赖 `loaded` 数值，连接与上传阶段照常保护） |
| 停滞判定阈值 | **连接或上传阶段** 60 秒无进展信号 → 自动中止（`phase` 标注卡在哪段）；**请求体发完（`upload.onload`）后进入「等待响应」态并停用停滞检测** |
| 失败后重传 | **手动重选重传**（不做自动重试，jar 上传不幂等） |
| 响应判定 | 严格：`code===200 && message==='success'` 才算成功；解析失败/HTTP 非 2xx 视为失败并提示原文片段 |

---

## 3. 方案总览

### 3.1 数据流

```
UpdateVersion 页面
   │  用户选 .jar → beforeUpload
   ▼
uploadWithProgress(url, formData, { onProgress, signal })
   │
   ├─ 组装请求头：{ Authorization: buildAuthHeaders().Authorization }
   ├─ new XMLHttpRequest()
   │     ├─ xhr.upload.onprogress → 节流 → onProgress({loaded, total, lengthComputable})
   │     ├─ 停滞计时器：连接/上传阶段无进展信号 60s → xhr.abort() → reject(STALL, phase)
   │     ├─ signal.onabort        → xhr.abort() → reject(ABORTED)
   │     └─ xhr.onload / onerror / ontimeout(不设) / onabort
   ▼
响应处理（复刻响应拦截器）
   │  read xhr.responseText → JSON.parse
   │  ├─ 解析成功 → dispatchBusinessCode(code) → resolve({code, message, ...})
   │  └─ 解析失败/HTTP 非 2xx → reject(Error{status, rawSnippet})
   ▼
UpdateVersion 调用方
   │  res.code===200 && res.message==='success' ?
   │  ├─ 是 → 清 token、refresh()、跳 /login、message.success
   │  └─ 否 → message.warning
```

### 3.2 文件改动清单

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/api/httpShared.ts` | **新增** | 共享拦截器逻辑：`buildAuthHeaders()`、`dispatchBusinessCode(code)` |
| `src/api/uploadWithProgress.ts` | **新增** | 通用 XHR 上传封装（带真实进度、停滞检测、可中止、降级） |
| `src/app.tsx` | **改造** | 请求/响应拦截器改为调用 `httpShared` 中的函数（行为不变，仅去重） |
| `src/pages/SystemInvolve/VersionControl/UpdateVersion/index.tsx` | **改造** | 替换伪进度条、接入 `uploadWithProgress`、新增取消/beforeunload/速度与 ETA 计算 |

> 命名说明：`httpShared.ts` 集中"被拦截器与 XHR 共用"的逻辑；`uploadWithProgress.ts` 是请求层工具。两者均放 `src/api/`，与现有 `request.ts` / `index.ts` 同级，符合该目录"请求层"的语义。

---

## 4. 详细设计

### 4.1 共享拦截器 `src/api/httpShared.ts`

抽取 `app.tsx` 现有两段拦截器逻辑为纯函数，确保 XHR 与 umi 拦截器**共用同一份真相源**。

```ts
/**
 * 请求拦截器共享逻辑：从 localStorage 读取 accessInfo，组装鉴权头。
 * 供 app.tsx 的 requestInterceptors 与 uploadWithProgress 共同调用，
 * 避免两处分别硬编码导致漂移。
 */
export function buildAuthHeaders(): Record<string, string> {
  // 从 localStorage 解析 accessInfo，缺失或非法 JSON 时返回空 token。
  // 现状 app.tsx 直接 JSON.parse 无兜底，存储被篡改时整个拦截器会抛错；
  // 抽取为共享函数后顺手加 try-catch：异常时退化为空 token（后续被后端
  // 1000000 拒绝并走正常跳登录流程），比直接抛错更稳。
  let accessInfo: any = {};
  try {
    accessInfo = JSON.parse(localStorage.getItem("accessInfo") || "{}");
  } catch {
    accessInfo = {};
  }
  return {
    Authorization: accessInfo?.token || ""
  };
}

/**
 * 业务码定义集中常量，便于 dispatchBusinessCode 与测试引用。
 */
export const BIZ_CODE = {
  UNAUTHORIZED: 1001000, // 未授权 → 跳授权页
  TOKEN_EXPIRED: 1000000 // token 过期 → 清 token 跳登录
} as const;

/**
 * 响应拦截器共享逻辑：按后端 data.code 做全局路由。
 * - 1001000：跳授权页
 * - 1000000：清 token、设过期标记、跳登录并 reload
 * - 其余：不处理
 * 返回值表示是否触发了重定向/重载（调用方可据此短路后续逻辑）。
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
```

> 注意：`history` 需从 `@umijs/max` 导入。`app.tsx` 当前已 `import { history }`；`httpShared.ts` 同样导入即可。

### 4.2 `src/app.tsx` 改造（行为不变）

将原内联匿名拦截器改为调用共享函数。**不改变任何运行时行为**，只是去重，使后续修改只改一处。

```ts
import { buildAuthHeaders, dispatchBusinessCode } from "@/api/httpShared";

// requestInterceptors 改为：
requestInterceptors: [
  (url, options) => {
    options.headers = {
      ...(options?.headers || {}),
      ...buildAuthHeaders()
    };
    return { url, options };
  }
],
// responseInterceptors 改为：
responseInterceptors: [
  (response) => {
    // @ts-ignore
    dispatchBusinessCode(response?.data?.code);
    return response;
  }
]
```

> 改造前 `Authorization` 直接取 `?.token || ""`；改造后由 `buildAuthHeaders()` 返回同样值，等价。原 `switch` 中 `default: break` 与 `dispatchBusinessCode` 的 `default: return false` 等价。**唯一差异**：`buildAuthHeaders` 对 `JSON.parse` 异常做了兜底（返回空 token），现状会抛错——属有意加固；正常路径（合法 JSON）行为完全一致。

### 4.3 通用上传封装 `src/api/uploadWithProgress.ts`

#### 4.3.1 签名

```ts
/**
 * 上传进度事件。
 * - lengthComputable=true：loaded/total 可信，可算百分比与 ETA
 * - lengthComputable=false：仅 loaded 可信（也可能为 0），调用方应降级为 indeterminate
 */
export interface UploadProgressEvent {
  loaded: number;          // 已上传字节数
  total: number;           // 总字节数（lengthComputable=false 时可能为 0）
  lengthComputable: boolean;
}

/**
 * 上传选项。
 */
export interface UploadOptions {
  /** 进度回调（已节流，不必担心高频渲染） */
  onProgress?: (e: UploadProgressEvent) => void;
  /** 中止信号；abort 后 promise reject({aborted:true}) */
  signal?: AbortSignal;
  /** 停滞阈值：连续 N 毫秒无新字节则自动中止。默认 60000(60s) */
  stallTimeoutMs?: number;
  /** 额外请求头（如未来需要自定义字段） */
  headers?: Record<string, string>;
}

/**
 * 通用上传：基于 XMLHttpRequest，提供真实上传进度。
 * URL 直接使用相对路径（/fms/v1/...），dev 走 umi proxy，prod 同源。
 * 内部复刻 app.tsx 的鉴权注入与业务码路由（调用 httpShared）。
 * 成功时 resolve 后端业务体 {code, message, ...}，与 umi post 返回结构一致。
 */
export declare function uploadWithProgress(
  url: string,
  formData: FormData,
  options?: UploadOptions
): Promise<{ code: number; message: string; [k: string]: any }>;
```

#### 4.3.2 实现要点

**请求组装**
- `xhr.open("POST", url, true)`
- 头部：合并 `buildAuthHeaders()` 与 `options.headers`。**不要手动设置 `Content-Type`**（让浏览器自动带 `multipart/form-data; boundary=...`，否则 boundary 丢失后端解析失败）。
- `xhr.withCredentials`：保持与现有 `post` 一致，**不开启**（鉴权走 Authorization 头，不依赖 cookie；同源无影响）。
- **不设置 `xhr.timeout`**（决策：不设硬超时，仅靠停滞检测）。
- **不设置 `xhr.responseType`**（保持默认 text，以便错误页（HTML）也能以文本读出做兜底提示）。

**进度回调（节流）**
- `xhr.upload.onprogress = (e) => { ... }`
- 节流：最近一次回调时间，**至少间隔 100ms** 才向上触发 `onProgress`（最后一次 100% 必发）。避免高频 `setState` 卡顿。
- 透传 `{ loaded: e.loaded, total: e.total, lengthComputable: e.lengthComputable }`。
- **作用域注意**：`onprogress` 只在「发送请求体字节」阶段触发；**连接建立阶段（DNS/TCP/TLS）和等待响应阶段都不会触发**。因此停滞检测不能只看 `loaded`，必须基于 XHR 生命周期事件覆盖这些空窗（见下）。

**停滞检测（自动保护，基于请求生命周期阶段）**
- 请求生命周期分三段：
  ```
  ① 连接建立：xhr.send()           → xhr.upload.onloadstart
  ② 发送请求体：xhr.upload.onloadstart → xhr.upload.onload
  ③ 等待响应：xhr.upload.onload     → xhr.onload
  ```
- **关键动机**：`onprogress` 只在②段触发。若仅用"loaded 是否增长"判停滞，则**①段连接卡死会被漏判**——典型表现即 F12 Timing 的 `Initial connection` 长达数分钟而 `Stalled` 仅 1ms（TCP SYN 发出后服务器/中间设备不回，连接空挂到系统级超时）。本方案必须覆盖此场景。
- **stallTimer 设计**：
  - **启动**：`xhr.send()` 之后立即 `setTimer(stallTimeoutMs)`（覆盖①连接阶段）。
  - **重置（任一进展信号即重置）**：
    - `xhr.upload.onloadstart` —— 连接建好、开始发请求体（①段进展）；
    - `xhr.upload.onprogress` 且 `e.loaded` 较上次增长 —— 字节在发（②段进展）。
  - **停用**：`xhr.upload.onload` 触发后 `clearTimeout` 且**不再重启** —— 请求体已发完、进入③等待响应；后端校验/落盘/准备重启耗时可能较长且期间无内置进展信号，**不应误判为停滞**（这是本方案最重要的边界修正，见风险与权衡）。
  - **触发**：定时器到期 → `xhr.abort()` → `reject({ reason:"STALL", phase })`，`phase` 取 `"connecting" | "uploading"` 标注卡在哪段，便于调用方给不同文案（连接超时 / 上传停滞）。
- **`lengthComputable` 不影响停滞检测**：检测基于 XHR 事件而非 `loaded` 数值。`lengthComputable=false` 只让进度条降级为走马灯，连接与上传阶段的事件照常驱动 stallTimer —— 消除了上一版"`lengthComputable=false` 禁用停滞检测"带来的保护空窗。
- **上传完成 flush**：`xhr.upload.onload` 时强制触发最后一次 `onProgress`（绕过节流），确保 100% 那次回调必发；`lengthComputable=true` 时调用方据此切到 `awaiting-response`（见 4.4.3）。

**外部中止**
- `xhr.open` 之后**立即**检查：`if (options.signal?.aborted) { xhr.abort(); reject({ reason: "ABORTED" }); return; }`，避免调用方在传入 `signal` 前已 `abort()` 时请求仍被发出。
- 随后 `options.signal?.addEventListener("abort", ...)` → `xhr.abort()` → `reject({ reason: "ABORTED" })`。
- 页面卸载时无需特殊处理（XHR 会被浏览器自动中止；配合 beforeunload 已防误关）。

**响应处理（复刻响应拦截器）**
- `xhr.onload`：
  - HTTP 状态 `>= 200 && < 300`：
    - `raw = xhr.responseText`；`try { body = JSON.parse(raw) } catch { reject({ reason:"PARSE_FAIL", status: xhr.status, snippet: raw.slice(0,200) }); return; }`
    - 调 `dispatchBusinessCode(body.code)`：若返回 `true`（已触发跳转/重载），直接 `resolve(body)`（页面即将重载，调用方逻辑不再有意义，但不 reject 以免误弹错误提示）。
    - 否则正常 `resolve(body)`。
  - HTTP 非 2xx：`reject({ reason:"HTTP_ERROR", status: xhr.status, snippet: raw.slice(0,200) })`，**不**调 `dispatchBusinessCode`（无可用 body）。
- `xhr.onerror`：网络层失败（DNS、断网、CORS 拒绝）→ `reject({ reason:"NETWORK" })`。
- `xhr.onabort`：被中止（停滞或外部 signal）→ 由中止处统一 reject，此处仅兜底标记。

> 上面 `reject` 的是结构化对象而非 `Error`，便于调用方区分 `STALL`/`ABORTED`/`NETWORK`/`PARSE_FAIL`/`HTTP_ERROR` 给不同文案。若需 `Error` 类型，可包一层 `new Error(reason)`。

### 4.4 `UpdateVersion/index.tsx` 改造

#### 4.4.1 状态机

```
idle ─（选文件）─▶ uploading ──（请求体发完 upload.onload）──▶ awaiting-response ──（响应成功）──▶ success ─▶ 跳 /login
                          │            (停用停滞检测)              │
                          ├──（取消）──▶ aborted ─▶ idle            ├──（取消/网络/解析/HTTP 错）──▶ error ─▶ idle
                          ├──（停滞/网络/解析/HTTP 错）──▶ error ─▶ idle
                          └─（lengthComputable=false）──▶ uploading(indeterminate, 禁用停滞检测) ──（响应成功）──▶ success

> 关键：`awaiting-response` 阶段**不再判定停滞**（后端校验/落盘/准备重启可能 >60s）；仅可被「取消 / 网络错 / 解析错 / HTTP 非 2xx」终止。
```

新增状态：
- `phase: "uploading" | "awaiting-response" | "success"` —— 控制文案（上传中 / 等待服务器处理 / 上传完成）。
- `loaded: number` / `total: number` / `lengthComputable: boolean` —— 来自进度回调。
- `speed: number`（MB/s）/ `eta: number`（秒）—— 由调用方基于采样计算。
- `abortController: AbortController | null` —— 取消用。

#### 4.4.2 删除伪进度条

移除 `startFakeProgress` / `stopFakeProgress` / `timerRef` / 对应 `useEffect` 清理。百分比不再用 `setInterval` 推进，改由 `onProgress` 直接派生 `Math.floor(loaded/total*100)`。

#### 4.4.3 调用

```ts
const abortController = new AbortController();
setAbortController(abortController);
setPhase("uploading");
setUploading(true);

uploadWithProgress(UPDATEJARRESTART, formData, {
  signal: abortController.signal,
  stallTimeoutMs: 60000,
  onProgress: ({ loaded, total, lengthComputable }) => {
    setLoaded(loaded);
    setTotal(total);
    setLengthComputable(lengthComputable);
    // 字节发完即切到「等待响应」阶段（工具层在 upload.onload 时会 flush 最后一次
    // 进度并停用停滞检测）。lengthComputable=false 时 loaded 可能到不了 total，
    // 此处不切 phase、走马灯保持到 success——可接受（停滞检测已由事件层覆盖）
    if (lengthComputable && loaded >= total) {
      setPhase("awaiting-response");
    }
    // 速度与 ETA 由独立 effect 基于采样序列计算（见 4.4.4）
  }
}).then(async res => {
  if (res.code === 200 && res.message === "success") {
    setPhase("success");
    setAccessInfo({ username: "", token: "" });
    await refresh();
    history.replace({ pathname: "/login" });
    message.success("更新版本包成功");
    setUploading(false);
  } else {
    setUploading(false);
    message.warning("更新版本包出错：" + res?.message);
  }
}).catch(err => {
  setUploading(false);
  // 区分原因给文案
  switch (err?.reason) {
    case "ABORTED": message.info("已取消上传"); break;
    case "STALL":   message.error("上传长时间无进展，已中止，请重试"); break;
    case "NETWORK": message.error("网络错误，请检查后重试"); break;
    case "PARSE_FAIL":
    case "HTTP_ERROR":
      message.error(`更新版本包出错（HTTP ${err?.status}）：${err?.snippet || ""}`);
      break;
    default: message.error("更新版本包出错：" + (err?.message || ""));
  }
});
```

> URL 常量 `UPDATEJARRESTART` 从 `@/api` 导入（已存在）；可直接用，或经 `@/api` 重新导出。原 `updateJarRestart` 函数在本方案下**不再被本页使用**（保留以供他处潜在调用，避免误删）。

#### 4.4.4 速度与 ETA 计算

- 维护 `samplesRef = [{ loaded, ts }, ...]`，每次 `onProgress` push。
- 滑动窗口：仅取最近 **3 秒内**的样本计算速度，过滤老数据，平滑抖动。
  - `speed = (latestLoaded - windowStartLoaded) / (latestTs - windowStartTs)`（字节/秒 → MB/s）。
  - `eta = (total - latestLoaded) / bytesPerSec`；`bytesPerSec<=0` 时不显示 ETA（显示 `--`）。
- 节流已在工具层做了 100ms，调用方此处无需再节流。

#### 4.4.5 取消按钮 + 二次确认

模态框 `footer` 增加"取消上传"按钮：

```ts
const handleCancel = () => {
  Modal.confirm({
    title: "确认取消上传？",
    content: "已上传的部分将被丢弃，需要重新选择文件上传。",
    okText: "取消上传",
    okButtonProps: { danger: true },
    cancelText: "继续上传",
    onOk: () => abortController?.abort()
  });
};
```

> `success` 阶段不再渲染取消按钮（请求已完成，`abort` 无意义），见 4.4.7 footer 条件渲染。`awaiting-response` 阶段保留取消入口（用户可主动放弃等待后端响应）。
```

#### 4.4.6 beforeunload（仅上传中）

```ts
useEffect(() => {
  if (!uploading) return;
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = ""; // 触发浏览器原生提示
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}, [uploading]);
```

> 仅依赖 `uploading`：响应回来 `setUploading(false)` 即解除拦截，与"先响应后重启、关页面无妨"的语义一致。

#### 4.4.7 UI（进度信息维度）

```tsx
<Modal
  title="正在上传版本包"
  open={uploading}
  footer={
    /* success 阶段请求已完成，不再显示取消按钮 */
    phase !== "success" ? <Button onClick={handleCancel}>取消上传</Button> : null
  }
  closable={false}
  maskClosable={false}
  centered
>
  <div style={{ padding: "20px 0" }}>
    {lengthComputable ? (
      <Progress percent={percent} status={phase === "success" ? "success" : "active"}
                strokeColor={{ from: "#108ee9", to: "#87d068" }} />
    ) : (
      /* lengthComputable=false 降级：走马灯，不显示百分比 */
      <Progress percent={99} status="active" strokeColor={{ from: "#108ee9", to: "#87d068" }} />
    )}
    <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, color:"#666", fontSize:12 }}>
      <span>{lengthComputable ? `${fmtMB(loaded)} / ${fmtMB(total)}` : `已上传 ${fmtMB(loaded)}`}</span>
      <span>{lengthComputable && speed > 0 ? `${speed.toFixed(2)} MB/s · 剩余 ${fmtETA(eta)}` : ""}</span>
    </div>
    <p style={{ textAlign:"center", marginTop:12, color:"#999" }}>
      {phase === "success" ? "上传完成，正在跳转登录..."
       : phase === "awaiting-response" ? "上传完成，等待服务器处理版本包，请勿关闭页面..."
       : "版本包上传中，请勿关闭页面..."}
    </p>
  </div>
</Modal>
```

> `indeterminate` 降级用 antd `Progress` 的 trick：`percent={99}` + `status="active"` 模拟走马灯（antd v5 无原生 indeterminate）。文案不显示百分比与 ETA，仅显示已传字节。

---

## 5. 边界情况与异常处理（汇总）

| 情况 | 处理 |
|---|---|
| `lengthComputable=false`（部分代理/chunked） | 进度条降级为 indeterminate 走马灯；仅显示已传字节；不显示百分比/ETA；**停滞检测照常**（基于 XHR 事件，不依赖 `loaded` 数值）；上传完成事件仍正常触发 |
| 连接建立卡死（F12 `Initial connection` 数分钟、`Stalled≈0`；TCP SYN 无回应） | ①段无 `onloadstart` → stallTimer 到期 → `reject({reason:"STALL", phase:"connecting"})`，提示"连接服务器超时，请检查网络/服务" |
| 上传阶段停滞（②段 `onprogress` 无新字节） | stallTimer 到期 → `reject({reason:"STALL", phase:"uploading"})`，提示"长时间无进展，已中止" |
| 请求体发完等待后端响应（`upload.onload` 后） | 进入 `awaiting-response` 阶段，**停用停滞检测**；后端校验/落盘/准备重启耗时不受 60s 限制；UI 文案切为"等待服务器处理"；仅可被取消/网络/解析/HTTP 错终止 |
| 用户点取消 | `Modal.confirm` 二次确认 → `abortController.abort()` → `reject({reason:"ABORTED"})`，提示"已取消" |
| 调用方在传入 `signal` 前已 `abort()` | `xhr.open` 后立即检测 `signal.aborted`，直接 `reject({reason:"ABORTED"})`，不发出请求 |
| 用户关闭/刷新页面（上传中） | `beforeunload` 触发浏览器原生确认；强关则浏览器自动中止 XHR |
| 网络层错误（断网/DNS/CORS） | `xhr.onerror` → `reject({reason:"NETWORK"})`，提示"网络错误" |
| HTTP 非 2xx（含 nginx 502 HTML 错误页） | `reject({reason:"HTTP_ERROR", status, snippet})`，提示状态码 + 响应前 200 字符 |
| 响应非合法 JSON | `reject({reason:"PARSE_FAIL", status, snippet})`，同上提示 |
| 业务码 `1001000` | `dispatchBusinessCode` 跳 `/authorize-ingress` |
| 业务码 `1000000`（含上传期间 token 过期） | `dispatchBusinessCode` 清 token、设 `token_expired`、跳登录并 reload（页面重载后上传结果无意义，符合预期） |
| 业务码非 200 / message 非 success | 走调用方 `else` 分支，`message.warning` 提示后端 message |
| 失败/取消后重传 | 回到 `idle`，用户重新点"更新版本包"重选文件；无自动重试（jar 上传不幂等） |
| 重复点击按钮 | `uploading` 期间按钮 `loading` 禁用；模态框 `maskClosable=false` 防穿透 |
| `Content-Type` 误设 | **禁止**手动设置 `multipart/form-data`，必须让浏览器自动带 boundary |
| `withCredentials` | 不开启（鉴权走 Authorization 头；与现有 `post` 一致） |

---

## 6. 验收清单

- [ ] 上传一个 ~50MB 的 `.jar`，进度百分比随真实字节增长（可在 DevTools 网络限速下观察）。
- [ ] 上传中显示：百分比、`已传/总大小`、`MB/s`、`ETA`。
- [ ] 点"取消上传" → 二次确认 → 中止，提示"已取消上传"，可重新选择上传。
- [ ] 模拟**连接建立卡死** → 60s 内无 `onloadstart` → 自动中止，提示"连接服务器超时"（操作方式：临时把 `stallTimeoutMs` 调到 5s，将请求指向会丢包的地址/端口，如 `localhost:1` 或防火墙 DROP 的端口，观察 `phase:"connecting"` 的 STALL）。
- [ ] 模拟上传阶段停滞超过 60s → 自动中止并提示（操作方式：临时把 `stallTimeoutMs` 调到 5s，配合 DevTools throttle 慢速，观察②段无新字节时触发中止，`phase:"uploading"`；DevTools 节流是"慢"非"停"，直接暂停难以真实复现 0 字节）。
- [ ] 上传完成但后端延迟响应（人为 >60s）→ `upload.onload` 后文案切为"等待服务器处理"，**不**被停滞检测误杀，最终正常拿到响应并跳登录。
- [ ] 上传中关闭/刷新页面 → 浏览器弹出离开确认。
- [ ] 上传成功 → 清 token、跳 `/login`、`message.success`，与改造前一致。
- [ ] 后端返回非 200 业务码 → `message.warning(后端 message)`。
- [ ] 模拟 HTTP 502（改后端返回 HTML）→ 提示含状态码与响应片段。
- [ ] 改造 `app.tsx` 后，**其他所有页面的请求行为不变**（鉴权头、`1001000`/`1000000` 跳转回归正常）——重点回归登录、token 过期跳转、授权页跳转。
- [ ] `lengthComputable=false`（可在某些代理下复现）→ 进度条走 indeterminate，不报错、不造假。

---

## 7. 风险与权衡

1. **XHR 与 umi 拦截器的双重维护**：通过抽 `httpShared` 把真相源收口到一处，`app.tsx` 与 XHR 都调用。代价是 `app.tsx` 这份全局运行时配置被改动 —— 需在第 6 节"其他页面回归"上把关。
2. **ETA 抖动**：慢网/停滞时单点速度会跳变，采用 3 秒滑动窗口平滑；速度为 0 时不显示 ETA，避免显示"剩余 ∞"。
3. **不设硬超时**：依赖停滞检测，极端情况下"极慢但每 50s 来 1 字节"不会被判定卡死 —— 这是用户选择的"60 秒宽容"策略的已知取舍。**注意**：原 `updateJarRestart` 带 **5 分钟硬超时**（`api/index.ts:464` 的 `{ timeout: 1000*60*5 }`），本方案**移除该超时**改由停滞检测 + 手动取消兜底——这是有意的行为变化（大文件慢网下 5 分钟可能不够）；旧函数保留但本页不再走它，超时随之失效。停滞检测现已覆盖**连接、上传两段**（用 `phase` 区分），连接卡死（如 `Initial connection` 数分钟）也会在 60s 内被中止，无硬超时的风险进一步收窄。
4. **indeterminate 降级的观感**：用 `percent=99 + active` 模拟走马灯是 antd v5 下的折中；若后续 antd 升级提供原生 indeterminate，可替换。
5. **`updateJarRestart` 旧函数保留**：避免误删影响潜在调用方；本页不再使用它。
6. **后端重启期间的登录时序**：决策为"先响应后重启 + 立即跳登录"。用户跳到 `/login` 时后端服务可能仍在重启，登录请求可能短暂失败。前端跳转本身合理（不卡在上传页），登录页宜对"服务暂不可用"做轻量提示——属后续可优化项，非本次范围。

---

## 8. 未决 / 未来工作

- `upLoadMap`（导入地图）、`uploadPlaybackFile`（录制文件）同为大文件上传、同样无真实进度。本次建好的 `uploadWithProgress` 可直接复用，待后续排期迁移（决策：本次不动）。
- 若未来部署为跨域，需重新评估 `withCredentials` 与 CORS 头。
- 停滞阈值 60s 为可配置项（`stallTimeoutMs`）；如线上反馈误杀或漏杀，可调整默认值。

---

## 附录 A：访谈问题与最终答复（节选）

1. 封装范围 → **通用工具 + 仅改本页**
2. 拦截器复用 → **抽共享函数**
3. 重启语义 → **先响应后重启**
4. 超时与中止 → **停滞检测 + 可取消（不设硬超时）**
5. 上传后过渡 → **立即跳登录**
6. 进度信息维度 → **百分比 + 大小 + 速度 + ETA**
7. 取消 → **取消 + 二次确认**
8. beforeunload → **仅上传中**
9. `lengthComputable=false` → **indeterminate 降级**
10. 停滞阈值 → **60 秒**
11. 失败重传 → **手动重选重传**
12. 响应判定 → **严格 `code===200 && message==='success'` + 原文兜底**
