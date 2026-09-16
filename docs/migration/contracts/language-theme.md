# 合同：五语运行时与公共主题（T016 交付）

> 消费方：T017（登录页/用户菜单语言与主题入口）、T021（ApexTable locale 接入）、T081（图表标签与主题接入）、各页面任务（领域词条与主题令牌消费）、T098—T105（五语视觉复核）。
> 规格依据：SPEC §11、§5.2、D16/D17。隔离验证见 `evidence/T016/`。

## 1. 语言清单与归一化

| 语言码 | dayjs locale | antd locale | 资源目录 |
| --- | --- | --- | --- |
| `zh-CN`（默认） | `zh-cn` | `zh_CN` | 不维护（key 即中文文案） |
| `en-US` | `en` | `en_US` | `src/i18n/locales/en-US/<ns>.ts` |
| `zh-TW` | `zh-tw` | `zh_TW` | `src/i18n/locales/zh-TW/<ns>.ts` |
| `ja-JP` | `ja` | `ja_JP` | `src/i18n/locales/ja-JP/<ns>.ts` |
| `ko-KR` | `ko` | `ko_KR` | `src/i18n/locales/ko-KR/<ns>.ts` |

- 唯一入口 `src/i18n/i18n.ts`：`SUPPORTED_LANGUAGES` / `AppLanguage` / `normalizeLanguage` / `readStoredLanguage` / `changeAppLanguage` / `preloadNamespaces` / `DAYJS_LOCALE_MAP`。
- `normalizeLanguage`：`en*`→en-US、`ja*`→ja-JP、`ko*`→ko-KR、`zh-tw|zh_tw|zh-hant*`→zh-TW、其余（含所有 zh）→zh-CN。
- 偏好持久化 key：`apex-admin:lang`（localStorage）；`<html lang>` 随切换同步。
- 语言切换菜单标签用各语言原生写法（简体中文/繁體中文/English/日本語/한국어），Header 与后续 T017 登录页入口共用同一份语言码。

## 2. 命名空间与资源接入约定

- 命名空间声明唯一来源：`src/router/definitions.tsx` 的 `meta.i18nNamespaces`；基础命名空间 `common`、`menu` 全局加载。
- 资源文件约定 `src/i18n/locales/<语言>/<命名空间>.ts`，默认导出 `Record<string, string>`；运行时经 `import.meta.glob('./locales/*/*.ts')` 自动登记为新 chunk，新增文件零代码改动。
- key 即中文文案（`keySeparator`/`nsSeparator` 关闭）；zh-CN 永不加资源文件。新增 key 的步骤：页面直接 `t('中文文案')`，再在四个非默认语言文件补同 key 词条。
- 词条来源分级（本次迁移口径）：旧系统五语 JSON（`docs/migration/reference/snapshot/dd/src/locales/`）优先；旧 JSON 缺失或「译文=简中原文」的未译占位由迁移人工补译（T016 补译清单见 `evidence/T016/manual-translations.json`）。领域词条随页面迁移，页面卡负责自己命名空间的五语补齐。

## 3. 切换时序与竞态保证

- `changeAppLanguage(lang, extraNamespaces)`：先 `preloadNamespaces`（基础 ∪ 已打开页签声明命名空间并集）→ 资源全部就绪后一次 `changeLanguage` → 持久化 → 切 dayjs locale → 同步 `<html lang>`。
- App.tsx 在切换期间以 `settings.locale`（目标语言）驱动渲染等待，切换完成前界面保持旧语言完整文案；异步旧语言响应只写回旧语言缓存，不覆盖新界面文案（V02 快速连切无混语证据）。
- 消费方新增触发语言切换的入口时，必须走 `dispatch(localeChanged(lang))`，由 App.tsx 统一执行上述时序；禁止直接调用 `i18next.changeLanguage`。

## 4. 请求语言（Accept-Language）

- 唯一实现点：`src/services/request/legacy/legacyRequest.ts` 请求头组装读取 `i18next.language`，随切换自动跟随五语，消费方无需处理。
- 真实后端抓包核验归 T090（本隔离环境无旧后端连接，未执行抓包）。

## 5. 主题桥接

- 双体系分工（沿用既有约定）：`<html data-theme>` 供 `globals.css` CSS 变量（业务/自定义控件唯一取色来源）；antd 组件走 `buildAppTheme(resolvedTheme)` 算法（darkAlgorithm/defaultAlgorithm），不改 seed token。
- `useTheme` 解析 `settings.theme`（light/dark/system→跟随系统）并在渲染期同步 `data-theme`；镜像 key `apex-admin:theme` 供 index.html 防闪烁。主题三态与语言互相独立、切换互不重置。
- 公共弹窗（antd App modal/message/ Dropdown/Popover）经 ConfigProvider 同时拿到 locale 与主题算法，无需逐控件处理（V04 深色弹窗证据）。

## 6. 表格（ApexTable）接入约定（T021 消费）

- 语言：向 ApexTable 传 locale 时用 `i18next.language`（AppLanguage 值集）映射库内语言包；在 T021 落库前，页面不得自建第二份表格文案映射。
- 主题：表格配色只消费 `data-theme` CSS 变量或 antd token，不在表格层写死颜色；深浅色切换由 data-theme/ConfigProvider 全局生效。

## 7. 图表接入约定（T081 消费）

- 标签/tooltip 文案经 `t()`（领域命名空间），不硬编码中文；时间轴文案随 dayjs locale。
- 图表配色消费 `data-theme` CSS 变量；主题切换时按 T081 合同重建/resize，不依赖本卡。

## 8. 已验证限制与移交发现

- order-record 模板页的枚举徽标（执行中/排队中/已取消等）与「状态」列头当前仍显示中文：该页为 T066 前的模板实现，枚举文案未接 `t()`，领域词条已备于 `orderRecord` 命名空间，随 T066 页面迁移接入。
- ClockText 中文格式分支已扩展为 `i18n.language.startsWith('zh')`（简/繁共用「M月D日」格式）；ja/ko/en 用英文月名格式。
- 旧系统 UI 语言菜单实际仅两项（zh/en），五语靠 umi 浏览器语言探测；目标按 D16/T016 退出条件在菜单直接暴露五语，行为为有意增强并已记录。
