# SPEC：车辆告警 errorEntryList 表格化展示 + 多语言翻译

> 状态：已定稿（访谈三轮完成）
> 日期：2026-07-17
> 分支：v2.0.0
>
> 修订（2026-07-17）：修正三处矛盾 —— **A1** 宽度控制（组件 `width: 100%`，宽度交调用方外层容器，避免 560px 表格在 520px 弹窗溢出，见 §4.2 / §5 / §7）；**A2** 列宽策略（去 `scroll.x: max-content`，改 `tableLayout="fixed"` + 换行，见 §5）；**A3** 删除“与 OrderInfoModal 组织方式一致”的错误参照（实测其无 less，见 §4.1）。

## 1. 背景与目标

车辆信息 tooltip / 事件弹窗中的 `errorEntryList`（车辆告警列表）目前用 `JSON.stringify(errorEntryList, null, 4)` 在 Popover / `<pre>` 里裸输出 JSON，可读性差。

本次改造：

1. **把 JSON 展示改为结构化表格**（Ant Design `Table`）。
2. **按当前界面语言展示翻译字段**（`errorDescriptionTranslations` / `errorHintTranslations`），并做严格容错与多级回退。

后端 `translationKey` 仅返回 `en_US` 与 `zh_CN` 两种（POSIX/Java 风格、下划线分隔），而项目支持 `zh-CN / en-US / zh-TW / ja-JP / ko-KR`（BCP-47、连字符、5 种）。`zh-TW / ja-JP / ko-KR` 在数据中**无对应翻译**，必须设计回退链。

## 2. 数据结构

```ts
// errorEntryList: ErrorEntry[]
interface ErrorEntry {
  errorDescription: string;                 // 错误码/原文，如 "3"，不翻译、直接展示
  errorDescriptionTranslations: TranslationItem[]; // 描述译文（按语言展示）
  errorHintTranslations: TranslationItem[];        // 处理建议译文（按语言展示）
  errorLevel: string;                       // FATAL | FAIL | WARNING | ERROR | ...
  errorReferences: ErrorReference[];        // 引用，常为空数组
  errorType: string;                        // 如 InVehicleAlarmError，技术字段、原文展示
}

interface TranslationItem {
  translationKey: string;     // 如 "en_US" / "zh_CN"
  translationValue: string;   // 译文正文
}

interface ErrorReference {
  referenceKey: string;
  referenceValue: string;
}
```

> 现有两处 `ErrorEntry` 类型缺少 `errorDescriptionTranslations` / `errorHintTranslations`，需补齐（见 §8）。

## 3. 改造范围（共 4 处）

经全仓搜索，`JSON.stringify(errorEntryList)` 共出现 **4 处**，本次全部统一改造：

| # | 文件 | 位置 | 说明 |
|---|------|------|------|
| 1 | `src/pages/Overlook/ForceGraph/Tooltip/index.tsx` | `case "errorEntryList"`，约 207–222 行 | 总览页 tooltip 收到 WebSocket 时刷新告警项 |
| 2 | `src/pages/Overlook/ForceGraph/GraphStage/index.tsx` | `errorEntryList` 描述项，约 257–271 行 | 总览页点击机器人时构建 tooltip **初始**告警项 |
| 3 | `src/pages/RecordPlayback/components/VehicleInformation/index.tsx` | `errorEntryList` 描述项，约 182–197 行（解构默认值在 125 行） | 回放页车辆信息卡片 |
| 4 | `src/pages/RecordPlayback/components/ControlPanel/index.tsx` | 事件弹窗事件卡片 `<pre>`，约 367–377 行 | 回放页"时刻车辆事件"弹窗 |

**一致性要点**：#1 与 #2 共同决定总览页 tooltip 显示。#2 在点击瞬间生成初始 JSX，#1 在首条 WS 推送到达时刷新。两者必须**同步**改用同一组件，否则点击后到首条 WS 之间会先闪现旧 JSON 再变表格。

## 4. 共享组件设计

抽取一个共享组件，**只负责表格渲染**（不含 Popover 触发器），4 处复用。是否外层包 Popover 由各调用方自行决定。

### 4.1 文件位置

```
src/components/ErrorEntryTable/
  ├── index.tsx     // 组件 + 翻译解析工具函数
  └── index.less    // 表格样式（紧凑、长文本换行）
```

（注：实测 `src/components/OrderInfoModal` 下只有 `index.tsx`、无独立 less，**不作为双文件组织的参照**。本次新建组件按 `index.tsx` + `index.less` 双文件组织；less 仅负责单元格紧凑度与长文本换行，**不写死表格宽度**——宽度交由各调用方的外层容器决定，详见 §4.2 / §5。）

### 4.2 组件 API

```tsx
interface ErrorEntryTableProps {
  /** 告警条目列表，可能为 null/undefined/空数组 */
  errorEntryList?: ErrorEntry[] | null;
  /** 表格最大高度（px），超出纵向滚动；默认 320 */
  maxHeight?: number;
}

export const ErrorEntryTable: React.FC<ErrorEntryTableProps>;
```

- **宽度不写死、也不通过 prop 暴露**：组件内部 `<Table>` 渲染为 `width: 100%`，最终宽度由调用方的外层容器（Popover content 的包裹 div / #4 事件卡片体）决定。这样同一组件既能填满约 560px 的 Popover，又能自适应约 472px 的 #4 弹窗内容区而不溢出（修正 A1，详见 §5 / §7）。
- 组件内部通过 `useI18n()` 读取 `locale`，自行完成语言匹配与回退。
- **语言切换会整页刷新**（`setLocale(locale, true)`），因此无需考虑"已打开的弹窗实时切换语言"的响应式问题——刷新后重新渲染即拿到正确 locale。组件在每次 render 时读取 `locale`，保证打开 Popover 时的语言正确。

### 4.3 语言归一化与回退算法

```ts
/**
 * 将任意风格的语言标识归一化为 "lang_REGION"（lang 小写、region 大写）。
 * "zh-CN" / "zh_CN" / "zh-cn" / "zh_cn" → "zh_CN"
 * "en-US" → "en_US"，"ja-JP" → "ja_JP"，"ko-KR" → "ko_KR"，"zh-TW" → "zh_TW"
 */
function normalizeLocaleKey(key: string): string {
  if (!key) return "";
  const parts = key.replace(/-/g, "_").split("_");
  const lang = (parts[0] || "").toLowerCase();
  const region = (parts[1] || "").toUpperCase();
  return region ? `${lang}_${region}` : lang;
}

/**
 * 按回退链从 translations 中解析译文。
 * 回退顺序（中文优先）：当前语言 → zh_CN → en_US → （调用方决定兜底）。
 * translationValue 为空白字符串、translations 非数组/空数组均视为未命中，继续回退。
 * 全部未命中返回空字符串 ""。
 */
function resolveTranslation(
  translations: TranslationItem[] | null | undefined,
  locale: string
): string {
  if (!Array.isArray(translations) || translations.length === 0) return "";
  const want = normalizeLocaleKey(locale);
  const order = [want, "zh_CN", "en_US"];
  for (const target of order) {
    if (!target) continue;
    const hit = translations.find(
      (item) =>
        item && normalizeLocaleKey(item.translationKey) === target
    );
    if (
      hit &&
      typeof hit.translationValue === "string" &&
      hit.translationValue.trim() !== ""
    ) {
      return hit.translationValue;
    }
  }
  return "";
}
```

**两条独立回退链**（描述与建议各自独立回退，互不影响）：

| 字段 | 回退链 | 最终兜底 |
|------|--------|----------|
| 描述（errorDescriptionTranslations） | 当前语言 → `zh_CN` → `en_US` | → `errorDescription` 原文 → `"-"` |
| 处理建议（errorHintTranslations） | 当前语言 → `zh_CN` → `en_US` | → `"-"`（无原文兜底字段） |

> 说明：描述列最终兜底走 `errorDescription` 原文，与 §5"错误码"独立列存在轻微重复——仅当**所有译文全部缺失**时才会出现，属可接受边界，忠实于访谈中确认的回退决策。

## 5. 表格列定义（6 列）

采用 Ant `<Table size="small" pagination={false} tableLayout="fixed">`，具体如下：

- **列宽策略（修正 A2）**：**不使用 `scroll={{ x: "max-content" }}`**。理由：容器宽度有限且含长中文译文，`max-content` 与下方 `word-break` 叠加时，中文连续文本自然宽度退化为单字宽，列宽与横向滚动行为不可预测。改为 `tableLayout="fixed"`，按列 `width` 比例分配、长文本在单元格内换行，表格宽度始终等于容器宽度、不出现横向滚动。
- **宽度（修正 A1）**：组件内 Table 为 `width: 100%`、不写死。
  - #1–#3 Popover 场景：由 Popover content 外层 `<div style={{ width: 560 }}>` 控宽（推荐值，可按实际调整）；
  - #4 Modal 场景：表格置于 `width={520}` 的事件卡片体内，自适应内容区（约 472px），**天然不溢出**——不再断言“空间足够”，宽度 100% 即适配。
- **长文本换行**：`white-space: normal; word-break: break-word`，**不省略截断**。

| 列 | 字段 | 渲染 |
|----|------|------|
| 等级 | `errorLevel` | 彩色 `Tag`，见 §6 配色；空值显 `"-"` |
| 类型 | `errorType` | 原文展示（后端枚举，不做 `t()`） |
| 错误码 | `errorDescription` | **原文直接展示，不翻译**（如 `"3"`） |
| 描述 | `errorDescriptionTranslations` | `resolveTranslation(...) \|\| errorDescription \|\| "-"` |
| 处理建议 | `errorHintTranslations` | `resolveTranslation(...) \|\| "-"` |
| 引用 | `errorReferences` | 非空：每条 `referenceKey: referenceValue` 换行排列；空数组：`"-"` |

列头均用 `t()` 转换：`等级 / 类型 / 错误码 / 描述 / 处理建议 / 引用`。

`rowKey` 使用索引（`(_, i) => String(i)`），因后端无稳定主键。

**列宽建议**（`tableLayout="fixed"` 下，单位 px）：等级 `70`、类型 `120`、错误码 `70`、引用 `120`；描述 / 处理建议**不定宽**，平分剩余空间以容纳长文本换行。窄列（等级 / 错误码）定宽，避免被长文本撑开或挤压。

## 6. errorLevel 配色

```ts
const LEVEL_COLOR: Record<string, string> = {
  FATAL: "red",
  ERROR: "red",
  FAIL: "red",
  WARNING: "orange",
};

// 渲染：<Tag color={LEVEL_COLOR[lvl] || "default"}>{lvl || "-"}</Tag>
```

- `FATAL / ERROR / FAIL` → 红
- `WARNING` → 橙
- 其余未识别等级 → Antd `default`（灰）Tag + 原值文字，对后端新增等级安全。

## 7. 各调用方改造点

### 7.1 #1 Overlook Tooltip/index.tsx（WS 刷新分支）

`case "errorEntryList"` 的 `children` 改为：

- `errorEntryList` 非空数组：`<Popover title={t("车辆告警")} content={<div style={{ width: 560 }}><ErrorEntryTable errorEntryList={errorEntryList} /></div>}><Text code>{t("详情")}</Text></Popover>`
  - 移除旧的 `width:300;height:360` 内联样式。**宽度由外层 `<div style={{ width: 560 }}>` 控制**，表格 `width: 100%` 自适应填充；纵向滚动交给组件 `maxHeight` prop（默认 320，需更高可传 `maxHeight={360}`）。不再“由组件 + less 写死宽度”（修正 A1）。
- `errorEntryList` 空/null：`children` 直接为 `<Text type="secondary">{t("暂无告警")}</Text>`（不再包 Popover）。

### 7.2 #2 Overlook GraphStage/index.tsx（点击初始项）

与 7.1 **完全一致**的 `children` 生成逻辑，保证点击瞬间与 WS 刷新后展示同形。同样：空列表显"暂无告警"。

> 建议把"构造 errorEntryList children"的逻辑抽成一个本地小函数（或直接复用组件），#1/#2 共用，避免两处手写分歧。

### 7.3 #3 RecordPlayback VehicleInformation/index.tsx

`generateDescriptionItems()` 中 `errorEntryList` 项的 `children` 改为同 7.1 的结构（"详情" Popover + `ErrorEntryTable`），并**保留** `getPopupContainer={getPopupContainer}` 透传。

- 非空：`<Popover ... getPopupContainer={getPopupContainer} content={<div style={{ width: 560 }}><ErrorEntryTable errorEntryList={errorEntryList} /></div>}><Typography.Text code style={{ cursor: 'pointer' }}>{t("详情")}</Typography.Text></Popover>`（宽度由外层 div 控制，同 §7.1）
- 空：`<Typography.Text type="secondary">{t("暂无告警")}</Typography.Text>`（替代当前 `t("无")`）。

### 7.4 #4 RecordPlayback ControlPanel/index.tsx（事件弹窗）

事件卡片体内当前 `<pre>{JSON.stringify(...)}</pre>` 改为**内联表格，不套 Popover**。表格 `width: 100%` 自适应 `width={520}` 的事件卡片内容区（约 472px），**不传外层宽度、不固定 560px**，天然不溢出（修正 A1；原 §5 的 560px 仅适用于 #1–#3 的 Popover 场景）：

- `Array.isArray(errorEntryList) && errorEntryList.length > 0`：渲染 `<ErrorEntryTable errorEntryList={errorEntryList} />`，替换原 `<pre>`。
- 否则：渲染 `<div>{t("暂无告警")}</div>`（替代"长度为 0 时不渲染任何内容"）。

## 8. 类型定义更新

在以下两处 `ErrorEntry` 接口补充翻译字段（保持其它字段不动，最小改动）：

1. `src/utils/typing.d.ts`（约 129–134 行，被 Overlook WebSocket 数据消费）
2. `src/types/PlaybackTypings/index.d.ts`（约 315–320 行，被回放页消费）

新增字段：

```ts
interface ErrorEntry {
  errorType: string;
  errorReferences: ErrorReferences[]; // / ErrorReference[]（沿用各自文件现有命名）
  errorDescription: string;
  errorLevel: string;
  errorDescriptionTranslations: TranslationItem[]; // 新增
  errorHintTranslations: TranslationItem[];        // 新增
}

// 同文件内新增（若不存在）：
interface TranslationItem {
  translationKey: string;
  translationValue: string;
}
```

> `src/types/VehicleDeploy/VehicleType.d.ts` 的 `Errors` 接口属 VehicleDeploy 另一域，**不在本次范围**，不改。

## 9. i18n key 清单

遵循项目规范：新增界面文案用 `t("中文原文")`，并将 key 同步加入 `zh-CN.json`（值=中文原文）与 `en-US.json`（值=英文）；`zh-TW / ja-JP / ko-KR` 以中文回退，可后续补译。

| key | zh-CN | en-US | 状态 |
|-----|-------|-------|------|
| 告警 | 告警 | Alert | ✅ 已存在 |
| 车辆告警 | 车辆告警 | Vehicle Alerts | ✅ 已存在 |
| 详情 | 详情 | Details | ✅ 已存在 |
| 处理建议 | 处理建议 | Suggestion | ✅ 已存在 |
| 暂无告警 | 暂无告警 | No alerts | ❌ 新增 |
| 错误码 | 错误码 | Code | ❌ 新增 |
| 等级 | 等级 | Level | ⚠️ 若不存在则新增 |
| 类型 | 类型 | Type | ⚠️ 若不存在则新增 |
| 描述 | 描述 | Description | ⚠️ 若不存在则新增 |
| 引用 | 引用 | Reference | ⚠️ 若不存在则新增 |

> 实施时先在 `zh-CN.json` 检索 `等级/类型/描述/引用` 是否已存在，存在则复用，不存在再新增。

## 10. 容错与边界汇总

| 场景 | 处理 |
|------|------|
| `errorEntryList` 为 `null` / `undefined` / `[]` | 调用方显示 `t("暂无告警")`（#4 内联、#1–#3 为告警行 children 文案） |
| `translations` 缺失 / 非数组 / 空数组 | `resolveTranslation` 返回 `""` → 进入回退链 |
| `translationValue` 为空字符串或纯空白 | 视为未命中，继续回退 |
| 所有译文均未命中（描述） | 描述列兜底 `errorDescription` 原文；原文也为空则 `"-"` |
| 所有译文均未命中（建议） | 建议列兜底 `"-"` |
| `errorLevel` 为空 | Tag 显 `"-"` |
| `errorLevel` 为未识别值 | `default` 灰色 Tag + 原值 |
| `errorReferences` 为空数组 | 引用列显 `"-"` |
| `errorReferences` 元素字段缺失 | 单条跳过/容错渲染，不整表崩溃 |
| 单条 entry 字段缺失（如无 `errorType`） | 该单元格显 `"-"`，不影响其它行 |

## 11. 不在本次范围

- `src/types/VehicleDeploy/VehicleType.d.ts` 的 `Errors` 类型（不同域）。
- Canvas/Konva 上的告警文本节点（按 CLAUDE.md 国际化范围约定，不改）。
- 后端 `message` 字段文案。
- 告警列表排序、分页（数量预期很少，`pagination={false}` + 纵向滚动即可）。
- 实时响应语言切换（语言切换整页刷新，无需处理）。

## 12. 验收清单

- [ ] 4 处 JSON 展示全部替换为 `ErrorEntryTable`。
- [ ] 共享组件 `src/components/ErrorEntryTable/` 已创建，4 处引用同一组件。
- [ ] 描述/建议按当前语言展示；`zh-TW/ja-JP/ko-KR` 回退到中文、再英文、再原文。
- [ ] `translationValue` 空串、translations 缺失等均不报错，按回退链处理。
- [ ] `errorLevel` 配色：FATAL/ERROR/FAIL 红、WARNING 橙、未知灰。
- [ ] `errorDescription` 作为"错误码"独立列始终原文展示。
- [ ] `errorReferences` 非空时按 `key: value` 渲染，空数组显 `-`。
- [ ] 空告警列表统一显示"暂无告警"。
- [ ] 总览页点击机器人→首条 WS 之间不再闪现 JSON（#1/#2 同步）。
- [ ] 两处 `ErrorEntry` 类型已补翻译字段。
- [ ] 新增 i18n key 已写入 `zh-CN.json` 与 `en-US.json`。
- [ ] 回放页 `getPopupContainer` 透传保留。
- [ ] 代码含简体中文注释（遵循项目约定）。
