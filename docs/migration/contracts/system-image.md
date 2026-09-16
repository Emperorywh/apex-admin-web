# 合同：系统图片读取与按位置失效通知（T017 交付）

> 消费方：T074（上传后失效通知）、T098（P27/G04 外壳图片复核）。
> 规格依据：SPEC P27、附录B.1（fetchSystemImage / uploadSystemImage 特殊契约）。
> 实现见 `src/services/system-involve/system-setting/system-setting.service.ts`、`src/hooks/useSystemImage.ts`。

## 1. 位置键与读取

| placementKey | 消费方 | 默认回退 |
| --- | --- | --- |
| `headerLogo` | Header 品牌图 | `/favicon.ico`（本工程无打包 SVG，沿用现视觉） |
| `loginBackground` | 登录页背景 | 空值＝不覆盖，透出全局 Wallpaper（保持当前登录视觉） |
| `favicon` | `<link rel="icon">`（SystemFavicon，挂 App 根部） | `/favicon.ico`（index.html 初始值） |

- `fetchSystemImage(placementKey)`：GET `/fms/v1/systemLogos/{encodeURIComponent(placementKey)}/file`，经 T003 `downloadBinary` 携带鉴权头；URL 编码按 B.1 契约。
- 可用判定与源一致：`blob.size > 0 && blob.type.includes('image')`；不满足、业务错误、404、网络失败一律回退默认资源（源 catch → default），**不作为页面级异常**。
- Object URL 生命周期收敛在 `useSystemImage`：换图/卸载时 revoke 旧 URL，无泄漏。
- 已实测（10.11.2.67:8888）：`loginBackground` 返回 401KB 真实图片并被登录页应用；`headerLogo` 返回 855KB 并被品牌图应用；`favicon` 后端 404 → 正确回退默认。
- 登录前（无 token）请求会失败并回退默认：登录页背景/图标在登录后自动重新拉取（Hook 挂载时机决定），符合「登录前后读图」场景。

## 2. 按位置失效通知（T074 消费）

```ts
import { notifySystemImagesReplaced } from '@/services/system-involve/system-setting/system-setting.service'

// 上传成功后：仅通知被替换的位置，外壳消费方立即重拉
notifySystemImagesReplaced(['headerLogo'])
```

- `subscribeSystemImageInvalidation(listener)`：消费方按位置过滤；`useSystemImage` 已内置订阅，其他直接消费 Blob 的调用方（如 T074 预览）自行注册。
- 通知为同步广播、无持久化；刷新页面后由读取链路自然取新图。
- `uploadSystemImage`（PUT multipart，B.1 特殊契约）归 T074 实现，上传成功后必须调用通知，完成 P27/G04 联动。

## 3. 已验证限制

- 未验证：真实上传后失效通知联动（依赖 T074 上传链路）；favicon 位置在当前环境未配置（404），替换路径待 T074 联调。
- 双请求说明：dev StrictMode 双挂载会发出两次读取（生产单次）；证据见 `evidence/T017/`。
