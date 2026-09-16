# 通用国际化（i18n）改造方法论

> 从 robot_scheduler 项目国际化改造中提炼的可复用方案。
> 适用于：基于 React（Umi / Next.js / CRA / Vite）+ Ant Design 的中后台系统。

---

## 一、核心哲学：中文原文作 Key

**原则：代码里写什么，key 就是什么。**

```json
// zh-CN.json（中文 key = 中文值）
{ "确定": "确定", "取消": "取消", "地图管理": "地图管理" }

// en-US.json（中文 key，英文值）
{ "确定": "Confirm", "取消": "Cancel", "地图管理": "Map Management" }
```

**为什么不用英文 key 或命名空间 key？**

| 方案 | 代码可读性 | 维护成本 | 搜索定位 |
|------|-----------|---------|---------|
| 中文原文作 key | `t("确定")` — 一眼看懂 | 改文案 = 改 key，但中文项目本来就常改中文 | `Ctrl+F "确定"` 直接定位 |
| 英文 key | `t("btn.confirm")` — 需要查表 | 多一层映射，中文原文和 key 脱节 | 需要反向查表才知道 "btn.confirm" 是哪个按钮 |
| 命名空间 key | `t("login.form.submit")` — 过度工程 | 嵌套 JSON 维护痛苦 | 还是要查表 |

**唯一例外：菜单项保留框架要求的嵌套结构。** 例如 Umi ProLayout 要求 `menu.调度监控` 格式。

---

## 二、项目改造前的决策框架

每个新项目在动手改造前，需要明确以下 7 个决策。直接拿这张表填：

### 决策检查清单

| # | 决策项 | 默认推荐 | 你的选择 |
|---|--------|---------|---------|
| 1 | Key 设计 | 中文原文作 key（平面结构） | |
| 2 | 目标语言 | zh-CN 必做 + en-US 必做，其他回退到 zh-CN | |
| 3 | 翻译来源 | LLM 生成初稿 → 人工审校专业术语 | |
| 4 | Constants 文件 | 不改 constants，组件层 `t(s.label)` 转换 | |
| 5 | Canvas / 非标准渲染 | HTML overlay 国际化，Canvas 纯文本不翻译 | |
| 6 | 后端 API 文案 | 前端直接展示，不映射 | |
| 7 | 语言切换行为 | `setLocale(locale, true)` 刷新页面 | |

### 关键决策详解

#### D1: Key 冲突处理

相同中文在不同上下文含义不同时：

- **翻译一致 → 共享 key。** `"名称"` 在地图和车辆页面都翻译为 "Name"，共用一个 key。
- **翻译不同 → 加限定词。** `"名称"` vs `"配置名称"`，后者翻译为 "Config Name"。
- **实际操作中几乎不会冲突。** 中文后台系统里，同一段文字在不同页面出现，翻译通常也是一样的。

#### D2: 哪些不翻译

**明确排除的范围，避免过度工程：**

- ❌ Canvas 画布上的静态文本（Konva Text 节点等，改造成本极高）
- ❌ 后端 API 返回的 `message` 字段
- ❌ `console.log` / 注释中的中文
- ❌ ECharts 坐标轴标签和数据标签（只翻译 title 和 legend）
- ❌ 导出文件名/文件内容

#### D3: 缺失翻译的回退策略

- **静默回退到中文原文**，不在界面上做 "未翻译" 标记。
- Umi 的 `locale` 插件默认支持此机制（fallback 到 default locale）。
- 其他框架需自行实现：`t(key)` 查不到翻译时返回 key 本身（即中文原文）。

---

## 三、可复用代码模板

### 3.1 统一国际化 Hook（框架无关版）

```typescript
// src/hooks/useI18n.ts
import { useIntl } from "@umijs/max"; // ← 替换为你框架的 i18n hook

type TranslateValues = Record<string, string | number>;

/**
 * @description 国际化 Hook（统一调用入口）
 *
 * 所有组件应使用此 Hook 而非直接使用框架的 i18n hook。
 * 预留扩展点：缺失 key 日志、key 前缀注入、翻译缓存、回退策略调整。
 */
export function useI18n() {
  const intl = useIntl();

  /** 简化的翻译方法 */
  const t = (id: string, values?: TranslateValues): string => {
    return intl.formatMessage({ id }, values);
  };

  return { t, locale: intl.locale };
}
```

**为什么需要这层封装？**

1. **统一入口** — 未来改行为只改一处
2. **简化调用** — `t("确定")` vs `intl.formatMessage({ id: "确定" })`
3. **降低耦合** — 组件不直接依赖框架的 i18n API

**适配其他框架：**

| 框架 | import 替换为 | 返回值调整 |
|------|--------------|-----------|
| Umi Max | `useIntl` from `@umijs/max` | `intl.formatMessage({ id }, values)` |
| Next.js | `useTranslations` from `next-intl` | `t(id, values)` 直接返回 |
| React i18next | `useTranslation` from `react-i18next` | `const { t: _t, i18n } = ...; const t = (id, v) => _t(id, v ?? {})` |
| Vite + react-intl | `useIntl` from `react-intl` | 同 Umi |

### 3.2 Constants 文件转换模式

```typescript
// ❌ 不要改 constants 文件本身
// src/constants/status.ts
export const statusList = [
  { label: "充电中", value: "charging" },
  { label: "空闲", value: "idle" },
];

// ✅ 在组件中用 t() 转换
const { t } = useI18n();
<Select
  options={statusList.map(s => ({ ...s, label: t(s.label) }))}
/>
```

**理由：** constants 文件不依赖 React 上下文，改造成本低但耦合高。保持 constants 纯数据，翻译在组件层注入。

### 3.3 antd Locale 动态注入（app.tsx 模板）

```typescript
// app.tsx（Umi Max 运行时配置）
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { ConfigProvider } from "antd";

const ANTD_LOCALE_MAP: Record<string, any> = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

export default defineApp({
  // layout 回调支持 hooks
  layout: ({ initialState }) => {
    const { t, locale } = useI18n();
    return {
      title: t("系统名称"),
      menu: { locale: true },
    };
  },
  // rootContainer 不支持 hooks，从 localStorage 读取
  rootContainer: (container) => {
    const locale = localStorage.getItem("umi_locale") || "zh-CN";
    return React.createElement(
      ConfigProvider,
      { locale: ANTD_LOCALE_MAP[locale] },
      container,
    );
  },
});
```

### 3.4 登录页浏览器语言检测

```typescript
// src/pages/Login/index.tsx
import { setLocale } from "@umijs/max";
import { useI18n } from "@/hooks/useI18n";

export default () => {
  const { t } = useI18n();

  useEffect(() => {
    const saved = localStorage.getItem("umi_locale");
    if (!saved) {
      const lang = navigator.language;
      if (lang.startsWith("en")) setLocale("en-US", true);
      // 其他语言可按需添加
    }
  }, []);

  return <Form>{/* 使用 t() 包裹所有文案 */}</Form>;
};
```

### 3.5 语言切换器组件

```typescript
// 核心代码：语言切换后刷新页面
import { setLocale } from "@umijs/max";

const LANGUAGES = [
  { key: "zh-CN", label: "🇨🇳 简体中文" },
  { key: "en-US", label: "🇺🇸 English" },
];

const handleSwitch = (key: string) => {
  setLocale(key, true); // true = 刷新页面
};
```

**为什么切换后必须刷新？** 确保 Ant Design、ECharts、dayjs 等第三方库完全重新渲染，不遗漏任何角落。

---

## 四、批量改造脚本（半自动化）

批量改造的核心思路：**脚本做 80% 的机械工作（添加 import、添加 hook、替换属性中的中文），人工做 20% 的审查（复杂表达式、动态文案）。**

### 脚本核心逻辑

```javascript
// scripts/batch_i18n.cjs（Node.js 脚本，无额外依赖）
// 用法：node scripts/batch_i18n.cjs src/pages/YourModule

const fs = require("fs");
const path = require("path");

const USE_I18N_IMPORT = 'import { useI18n } from "@/hooks/useI18n";';
const I18N_HOOK = "const { t } = useI18n();";

function processFile(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");
  if (content.includes("useI18n")) return false; // 跳过已处理的文件

  // 1. 检测是否含中文（排除注释和 console）
  if (!hasChineseContent(content)) return false;

  // 2. 在最后一个 import 后插入 useI18n import
  content = insertImport(content);

  // 3. 在组件函数体开头插入 const { t } = useI18n()
  content = insertHook(content);

  // 4. 替换常见模式
  content = replacePatterns(content);

  fs.writeFileSync(filePath, content, "utf-8");
  return true;
}
```

### 脚本替换的模式清单

| 模式 | 原代码 | 替换后 |
|------|--------|--------|
| JSX 属性（label/title/placeholder/message） | `label="中文"` | `label={t("中文")}` |
| JSX 子元素 | `>中文</Button>` | `>{t("中文")}</Button>` |
| message 调用 | `message.success("中文")` | `message.success(t("中文"))` |
| 对象属性 | `title: "中文"` | `title: t("中文")` |
| Modal 按钮文字 | `okText="确定"` | `okText={t("确定")}` |

### 脚本不处理的（需人工审查）

- 动态拼接的中文：`` `删除${name}成功` `` → 改为 `t("删除 {name} 成功", { name })`
- 三元表达式中的中文：`flag ? "是" : "否"` → `flag ? t("是") : t("否")`
- 条件渲染的中文片段
- 模板字符串中的中文
- Konva Canvas / ECharts 等非标准渲染中的中文

---

## 五、执行流程（7 阶段法）

### 阶段 0：基础设施（1 次，通用）

**产出：** 一次搭建，所有页面共用。

1. 创建 `src/hooks/useI18n.ts`
2. 修改框架配置（移除硬编码 locale）
3. 修改 `app.tsx`（动态 antd locale、layout title 国际化）
4. 实现语言切换器组件
5. 完善 `zh-CN.json`（提取高频通用词：确定、取消、操作、名称...）
6. 生成 `en-US.json` 初稿
7. **提交：** `feat: 搭建国际化基础设施`

### 阶段 1：通用组件

- 改造 `src/components/` 下所有组件
- **提交：** `feat: 通用组件国际化`

### 阶段 2：登录 + 独立页面

- 登录页语言检测、Token 过期提示
- 404、403 等独立页面
- **提交：** `feat: 登录及独立页面国际化`

### 阶段 3-N：按业务模块推进

- 每个模块一个独立提交
- 按页面复杂度排序：高频页面优先
- **提交格式：** `feat: XXX页面国际化`

### 最后阶段：收尾

- 全局搜索剩余硬编码中文
- 英文宽度适配（`text-overflow: ellipsis`）
- 其他语言文件同步 key 结构
- **提交：** `feat: 国际化收尾与宽度适配`

---

## 六、locale JSON 文件管理规范

### 文件结构

```
src/locales/
├── zh-CN.json    ← P0：主文件，所有 key 的来源
├── en-US.json    ← P0：完整翻译
├── zh-TW.json    ← P2：可回退到 zh-CN
├── ja-JP.json    ← P2：可回退到 zh-CN
└── ko-KR.json    ← P2：可回退到 zh-CN
```

### Key 排序规则

按 Unicode 码点排序（JSON 键的自然排序），高频通用词自然聚集在文件顶部。

### 新增文案规范

1. 在代码中直接写 `t("中文原文")`
2. 在 `zh-CN.json` 中添加 `"中文原文": "中文原文"`
3. 在 `en-US.json` 中添加 `"中文原文": "English translation"`
4. 其他语言文件可暂不补充（回退到中文）

### 变量插值

```json
// zh-CN.json
{ "共 {total} 条": "共 {total} 条" }
// en-US.json
{ "共 {total} 条": "{total} records in total" }
```

```typescript
t("共 {total} 条", { total: 100 });
```

---

## 七、LLM 提示词模板

> 以下是给 LLM（Claude / GPT 等）的标准化提示词，复制后替换 `{{占位符}}` 即可使用。

### 7.1 完整改造提示词（项目初始化用）

```markdown
# 任务：对 {{项目名称}} 进行全面国际化改造

## 项目信息
- 框架：{{Umi Max / Next.js / Vite + React}}
- UI 库：Ant Design {{版本}}
- 源语言：中文
- 目标语言：zh-CN（主） + en-US（必做），{{其他语言可选}}

## Key 设计策略
- 中文原文作 key，平面结构（非嵌套）
- 菜单项保留框架要求的嵌套格式
- 相同中文翻译一致时共享 key，翻译不同时加限定词

## 文案国际化范围
✅ 必须：按钮、表格列头、表单 label/placeholder/验证消息、message 提示、弹窗标题/按钮、空状态、tooltip
✅ 必须：HTML overlay（右键菜单、Tooltip、工具栏）
✅ 必须：ECharts 图表标题和图例
❌ 排除：Canvas 画布静态文本、API 返回的 message、console 日志/注释
❌ 排除：ECharts 坐标轴标签和数据标签

## Constants 处理方式
不修改 constants 文件中的中文 label，在组件层用 t() 转换：
<Select options={list.map(s => ({ ...s, label: t(s.label) }))} />

## 技术约束
1. 语言切换使用 setLocale(locale, true) 刷新页面
2. rootContainer / 非 React 上下文中从 localStorage 读取语言偏好
3. antd locale 通过 ConfigProvider 动态注入
4. dayjs locale 跟随语言切换

## 执行步骤
### 阶段 0：基础设施
1. 创建 src/hooks/useI18n.ts（封装框架的 i18n hook，暴露 t() 和 locale）
2. 修改框架配置（移除硬编码 locale）
3. 修改 app.tsx（动态 antd locale、layout title、dayjs locale）
4. 实现语言切换器
5. 完善 zh-CN.json 和 en-US.json

### 阶段 1-N：按模块推进
每个模块：添加 useI18n import → const { t } = useI18n() → 替换中文 → 同步 locale JSON

### 收尾
全局搜索剩余中文 → 英文宽度适配 → 同步其他语言文件

## 验证方式
每个模块完成后切换到英文环境逐页面检查：
- [ ] 所有按钮文字
- [ ] 表格列头
- [ ] 表单 label/placeholder
- [ ] 表单验证提示
- [ ] message 提示
- [ ] 弹窗标题和按钮
- [ ] Ant Design 内置文案（分页、日期选择器等）
- [ ] 英文文本无溢出
```

### 7.2 单模块改造提示词（日常使用）

```markdown
# 任务：对 {{模块路径}} 进行国际化改造

## 前置条件（已完成）
- useI18n Hook 已创建
- zh-CN.json 和 en-US.json 已初始化
- 语言切换器已就绪

## 改造规范
1. 每个组件：添加 `import { useI18n } from "@/hooks/useI18n"`
2. 在组件函数体内：`const { t } = useI18n()`
3. 替换模式：
   - `label="中文"` → `label={t("中文")}`
   - `>中文</Button>` → `>{t("中文")}</Button>`
   - `message.success("中文")` → `message.success(t("中文"))`
   - `placeholder="中文"` → `placeholder={t("中文")}`
   - `title: "中文"` → `title: t("中文")`
4. 不修改 constants 文件，在组件中用 `t(s.label)` 转换
5. 不翻译 console.log、注释、API 返回的 message
6. 将新 key 同步追加到 zh-CN.json 和 en-US.json

## 输出要求
- 改造完所有文件后，列出新增的 locale key 清单
- 标注需要人工审查的复杂表达式（如有）
```

### 7.3 locale JSON 补充提示词

```markdown
# 任务：为以下 key 生成多语言翻译

## 翻译要求
- zh-CN.json 的值 = 中文原文（与 key 相同）
- en-US.json 提供专业英文翻译
- 行业术语对照表：{{附上术语表，或让 LLM 先生成术语表供审校}}

## 待翻译的 key
{{粘贴 key 列表}}

## 输出格式
直接输出 JSON 片段，可以直接粘贴到 locale 文件中。
```

---

## 八、实施统计（参考基准）

本项目（robot_scheduler）的实施数据，可作为其他项目的规模估算参考：

| 指标 | 数值 |
|------|------|
| 改造前中文文件数 | ~280 个（pages + components + konva） |
| 实际改造文件数 | ~180 个 |
| 不改造的文件 | constants（13个）、Canvas 纯文本（~20个） |
| locale key 总数 | ~1250 条 |
| locale JSON 行数 | 每个文件 1292 行 |
| 改造轮次 | 8 个 commit（基础设施 → 组件 → 登录 → 核心页面 → 车辆/地图 → 工艺/调度 → 三方/系统 → 收尾） |
| 批量脚本处理率 | ~80%（简单模式自动替换，复杂表达式人工审查） |

---

## 九、避坑指南

### 9.1 常见陷阱

| 陷阱 | 症状 | 解决方案 |
|------|------|---------|
| `rootContainer` 中用 hooks | 运行时报错 "Hooks can only be called inside a component" | 从 `localStorage` 读取语言偏好 |
| `setLocale(key, false)` | 切换语言后部分组件不更新 | 改为 `setLocale(key, true)` 刷新 |
| constants 文件里用 `t()` | 编译报错（不在 React 组件上下文） | constants 保持原样，组件层转换 |
| JSON 嵌套太深 | Umi locale 插件不支持 | 只保留 `menu` 嵌套，其他全部平面化 |
| 英文文本溢出 | 切换到英文后按钮/表格变形 | 提前规划 `min-width` + `text-overflow: ellipsis` |

### 9.2 性能注意事项

- **locale JSON 按需加载** — Umi locale 插件已内置支持，无需额外优化
- **避免在 render 中创建对象** — `t("文本", { count })` 的 values 参数每次 render 都是新对象，但 `formatMessage` 内部不深度比较，性能影响可忽略
- **批量脚本处理后再审查** — 不要逐文件手动改造，效率太低

### 9.3 与 LLM 协作的最佳实践

1. **先让 LLM 读规格文档再动手** — 避免 LLM 自行决策导致不一致
2. **批量脚本先行** — LLM 生成批量脚本，处理 80% 的机械替换
3. **按模块提交** — 每个 commit 独立可回滚，出问题只影响一个模块
4. **术语表提前对齐** — 让 LLM 先生成术语对照表，人工确认后再批量翻译
5. **改造完成后让 LLM 做全局检查** — 搜索剩余硬编码中文，查漏补缺
