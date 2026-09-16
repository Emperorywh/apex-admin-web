# 国际化（i18n）完整改造规格说明

> 版本：v1.0
> 日期：2026-06-09
> 状态：待确认

---

## 一、项目现状分析

| 指标 | 数值 |
|------|------|
| 页面文件含中文 | 230 个文件，3916 处 |
| 组件文件含中文 | 18 个文件，271 处 |
| constants 含中文 | 13 个文件 |
| Konva 插件含中文 | 22 个文件 |
| ECharts 图表 | 数据统计页面（OrderStatistics） |
| 现有 locale 文件 | zh-CN（完整）、en-US/zh-TW/ja-JP/ko-KR（仅 4-5 条） |
| useIntl 使用率 | `ActionsRender` 导入了 `useIntl` 但仅使用 `intl.locale` 读取语言标识，全项目 `formatMessage` 调用为零 |
| 语言切换器 | 已注释 |
| Antd locale | 硬编码 `zh-cn` |

---

## 二、决策记录

### 2.1 Key 设计策略

**决策：中文原文作 key（平面结构）**

```json
// zh-CN.json（中文 key 即中文值）
{
  "确定": "确定",
  "取消": "取消",
  "地图管理": "地图管理"
}

// en-US.json（中文 key，英文值）
{
  "确定": "Confirm",
  "取消": "Cancel",
  "地图管理": "Map Management"
}
```

**特殊处理：菜单项保留嵌套结构**

```json
{
  "menu": {
    "调度监控": "Scheduling Monitor",
    "数据统计.录制回放": "Record Playback"
  }
}
```

**理由：**
- 中文 key 直观，搜索定位方便，维护成本低
- 现有 zh-CN.json 已经采用此模式（菜单部分为嵌套结构，通用文案为平面结构）
- 开发者看到代码中的 `intl.formatMessage({ id: '确定' })` 立即理解含义

**已有嵌套结构处理：**
- 当前 zh-CN.json 中 `"弹窗": { "确定": "确定", "取消": "取消" }` 存在嵌套，改造时需将 `"确定"` 和 `"取消"` 提升到顶层，移除 `"弹窗"` 分组
- `menu` 嵌套结构保留不变（Umi ProLayout 要求此格式）
- 其他语言文件（en-US 等）当前仅 4 个 key 且无嵌套，无需迁移

**Key 冲突处理规则：**
- 相同中文在不同上下文含义不同时（如"名称"既可指地图名称也可指车辆名称），如果翻译一致则共享同一个 key
- 如果翻译不同，在 key 后加限定词（如 `"名称"` vs `"配置名称"`）

### 2.2 目标语言

**决策：中英优先，其他可选**

| 语言 | 优先级 | 要求 |
|------|--------|------|
| zh-CN | P0 | 完整翻译（作为 key 来源） |
| en-US | P0 | 完整翻译，同步推进 |
| zh-TW | P2 | 可切换，缺失回退到 zh-CN |
| ja-JP | P2 | 可切换，缺失回退到 zh-CN |
| ko-KR | P2 | 可切换，缺失回退到 zh-CN |

### 2.3 翻译来源

**决策：Claude 生成初稿，用户审校**

- 我根据行业惯例生成所有语言的翻译初稿
- 用户审校修改，特别是专业术语（AGV、充电桩、输送线、交管、工艺配置等）
- 首批交付时附上术语对照表供确认

### 2.4 后端 API 文案

**决策：后端返回中文，前端直接显示**

- API 返回的 `message` 字段直接展示，不做前端映射
- 前端自行生成的提示消息（如 `message.success("操作成功")`）全部国际化
- `responseInterceptors` 中的错误码处理（1001000/1000000）文案不做国际化

### 2.5 Konva Canvas 系统

**决策：HTML overlay 国际化 + Canvas 静态文本保持中文**

- **右键菜单（ContextMenu）**：使用 HTML overlay（react-konva 的 `Html` 组件），可以直接用 React 的 `useIntl`，全部国际化
- **Tooltip**：使用 HTML overlay 渲染，全部国际化
- **工具栏（GraphBar）**：工具栏已经是 React 组件（按钮组），全部国际化
- **Canvas 画布上的节点标签、路径标签**：保持中文不翻译（如节点类型标识、方向箭头旁的文字）

**理由：** Canvas 内的 Text 节点需要将 intl 上下文穿透到 Konva 插件系统，改造成本极高且容易出错。

### 2.6 ECharts 图表

**决策：仅国际化标题和图例**

- ECharts 的 `title.text`、`legend.data` 国际化
- 坐标轴标签（axis label）、数据标签（data label）、tooltip 内容保持原样
- 在图表配置生成时注入 `intl.formatMessage`

### 2.7 宽度适配

**决策：固定宽度 + 省略号**

- 现有 UI 元素保持固定宽度
- 英文溢出时通过 `text-overflow: ellipsis` + `overflow: hidden` 截断
- 必要时适当增加 `min-width` 或缩短英文翻译（使用缩写）
- 对于 Ant Design Table 列宽，可适当增加 `width` 值以适应英文

### 2.8 日期/数字格式

**决策：dayjs locale 自动处理**

- 跟随语言切换 dayjs locale
- 使用 dayjs 的 locale-aware 格式化方法
- 数字格式化使用 `Intl.NumberFormat` 或保持原样（项目内数字较简单）

### 2.9 Constants 文件处理

**决策：组件层转换**

```typescript
// constants 文件结构不变
// src/constants/vehicle/index.ts
export const vehicleStatus = [
  { label: "充电中", value: "charging" },
  { label: "空闲", value: "idle" },
];

// 组件中使用时转换
import { vehicleStatus } from "@/constants/vehicle";
const { t } = useI18n();

<Select options={vehicleStatus.map(s => ({
  ...s,
  label: t(s.label)
}))} />
```

### 2.10 封装方案

**决策：自定义 Hook 二次封装，提供统一调用入口**

```typescript
// src/hooks/useI18n.ts
import { useIntl } from "@umijs/max";

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
type TranslateValues = Record<string, string | number>;

export function useI18n() {
  const intl = useIntl();

  /** 简化的翻译方法，替代 intl.formatMessage({ id }) */
  const t = (id: string, values?: TranslateValues): string => {
    return intl.formatMessage({ id }, values);
  };

  return { t, locale: intl.locale };
}
```

**调用方式：**

```typescript
import { useI18n } from "@/hooks/useI18n";

const { t, locale } = useI18n();

// 纯文本
t("确定");

// 带变量
t("已选择 {count} 项", { count: selectedCount });

// 获取当前语言标识
locale; // "zh-CN" | "en-US" | ...
```

**封装理由：**
- **统一入口**：所有国际化调用集中到一个 Hook，未来需要调整行为（日志、缓存、回退策略等）只改一处
- **简化调用**：`t("确定")` 比 `intl.formatMessage({ id: "确定" })` 更简洁，减少样板代码
- **高内聚低耦合**：组件只依赖 `useI18n`，不直接依赖 Umi 的 `useIntl`，降低框架耦合度
- **遵循项目惯例**：与现有 `useWarningBlink`、`useUndoHistory` 等 Hook 风格一致（命名导出、JSDoc 注释）

### 2.11 Ant Design Locale

**决策：跟随用户语言动态切换**

- `.umirc.ts` 中移除硬编码的 `locale: "zh-cn"`
- 在 `app.tsx` 的 `layout` / `rootContainer` 中动态注入 antd locale
- 切换语言时同步更新 antd locale（日期选择器、分页、空状态等）

### 2.12 缺失翻译回退

**决策：静默回退到中文原文，不做标记**

- en-US 缺少某个 key 时，显示 zh-CN 中的值（即中文）
- 不在界面上做任何"未翻译"标记
- Umi locale 默认行为已支持此回退机制（fallback 到 default locale）

### 2.13 变量插值

**决策：少量，用 Umi 原生的 ICU 变量插值简单处理**

```json
// en-US.json
{
  "已选择 {count} 项": "Selected {count} items",
  "共 {total} 条记录": "{total} records in total"
}
```

```typescript
t("已选择 {count} 项", { count: selectedRows.length });
```

### 2.14 登录页语言

**决策：自动检测浏览器语言 + 手动切换入口**

- 登录页（`layout: false`）根据 `navigator.language` 自动选择语言
- 登录页提供语言切换按钮（不需要登录即可切换）
- 用户选择后存入 localStorage

### 2.15 语言偏好持久化

**决策：localStorage 持久化**

- 使用 `localStorage.setItem('umi_locale', locale)` 持久化
- Umi 内置支持通过 `setLocale(locale, false)` 切换并自动处理 localStorage（key 为 `umi_locale`）
- 页面刷新后恢复上次选择的语言

### 2.16 语言切换行为

**决策：切换后刷新页面**

- 调用 `setLocale(locale, true)`（第二个参数 `true` 表示刷新）
- 简单可靠，确保所有组件（包括 Ant Design、ECharts）完全重新渲染
- 刷新后从 localStorage 读取语言偏好

### 2.17 布局标题

**决策：跟随语言切换**

- `app.tsx` 中的 `title: "调度系统"` 改为动态值
- 通过 `t("调度系统")` 获取当前语言的标题

### 2.18 文案国际化范围

**决策：全部国际化（覆盖所有层级）**

| 文案类型 | 示例 | 是否国际化 |
|----------|------|------------|
| 按钮 | 确定、取消、提交、删除 | ✅ |
| 表格列头 | 名称、状态、操作 | ✅ |
| 表单 label | 地图名称、车辆类型 | ✅ |
| placeholder | 请输入名称、请选择状态 | ✅ |
| 表单验证 | 请输入必填项、名称不能超过20个字符 | ✅ |
| message 提示 | 操作成功、删除失败 | ✅ |
| 空状态 | 暂无数据、请先选择地图 | ✅ |
| tooltip | 鼠标悬停的提示文字 | ✅ |
| 弹窗标题 | 新增地图、编辑车辆 | ✅ |
| 帮助文本 | 辅助说明文字 | ✅ |
| 右键菜单（Canvas） | 画布上的右键菜单项 | ✅ |
| 工具栏（Canvas） | 画布工具栏按钮文字 | ✅ |
| Canvas 节点标签 | 节点类型标识 | ❌ 保持中文 |
| API 返回的 message | 后端错误/成功消息 | ❌ 直接显示 |
| console 日志 | 开发调试信息 | ❌ 不处理 |

### 2.19 执行策略

**决策：逐步迭代，按模块推进**

### 2.20 提交策略

**决策：按模块逐步提交**

每个模块完成一个独立的 commit，便于回滚和追踪。

### 2.21 验证方式

**决策：人工逐页面验证**

每个模块完成后，切换到英文环境逐页面检查。

---

## 三、技术实现方案

### 3.1 基础设施改造

#### 3.1.1 `.umirc.ts` 配置变更

```typescript
// 移除 antd.configProvider.locale 的硬编码
antd: {
  configProvider: {
    // 移除: locale: "zh-cn",
    // 改为动态注入（在 app.tsx 中处理）
  },
  theme: {
    cssVar: true,
    hashed: false,
  },
},
// locale 配置保持不变
locale: {
  default: "zh-CN",
},
```

#### 3.1.2 `app.tsx` 改造

> **说明：** 当前 `app.tsx` 已有注释掉的 `import enUS from "antd/locale/en_US"` 和 `import zhCN from "antd/locale/zh_CN"`，说明之前有人尝试过但未完成，改造时复用这些已有导入。

```typescript
// 取消已有的注释导入，并补充其他语言
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
// import zhTW from "antd/locale/zh_TW";
// import jaJP from "antd/locale/ja_JP";
// import koKR from "antd/locale/ko_KR";
import { ConfigProvider } from "antd";
import { useI18n } from "@/hooks/useI18n";

// antd locale 映射表
const ANTD_LOCALE_MAP: Record<string, any> = {
  "zh-CN": zhCN,
  "en-US": enUS,
  // "zh-TW": zhTW,
  // "ja-JP": jaJP,
  // "ko-KR": koKR,
};

export default defineApp({
  layout: ({ initialState }) => {
    // 注意：Umi Max 的 layout 回调函数内部支持使用 hooks
    const { t, locale: currentLocale } = useI18n();
    // 动态设置 dayjs locale
    const dayjsLocaleMap: Record<string, string> = {
      "zh-CN": "zh-cn",
      "en-US": "en",
      // ...
    };
    dayjs.locale(dayjsLocaleMap[currentLocale] || "zh-cn");

    return {
      layout: "mix",
      menu: { locale: true },
      siderWidth: 256,
      title: t("调度系统"),
      logo: initialState?.headerLogoUrl || HeaderSvg,
      loading: false,
      actionsRender: () => <ActionsRender />,
      onMenuHeaderClick: () => {
        history.push({ pathname: "/over-look" });
      },
      unAccessible: <UnAccess />,
    };
  },
  // antd 动态 locale 通过 rootContainer 注入 ConfigProvider
  // 注意：rootContainer 不是 React 组件上下文，不能使用 hooks
  // 需从 localStorage 读取当前语言偏好
  rootContainer: (container) => {
    const currentLocale = localStorage.getItem("umi_locale") || "zh-CN";
    return React.createElement(
      ConfigProvider,
      { locale: ANTD_LOCALE_MAP[currentLocale] },
      React.createElement(WebSocketProvider, null, container)
    );
  },
  // ...其余不变
});
```

#### 3.1.3 语言切换器

恢复并完善 `ActionsRender` 中被注释的语言切换菜单。

> **注意 1：** 取消注释后需同时补充 `TranslationOutlined` 的图标导入（当前导入列表中缺少此图标）。
>
> **注意 2：** 当前代码使用 `setLocale(key, false)`（不刷新），需改为 `setLocale(key, true)`（刷新页面），确保所有组件（含 antd、ECharts）完全重新渲染。这是一个行为变更。

```typescript
{
  label: "",
  key: "changeLocale",
  icon: <TranslationOutlined />,
  children: [
    { label: <span>🇨🇳 简体中文</span>, key: "zh-CN" },
    { label: <span>🇺🇸 English</span>, key: "en-US" },
    // 其他语言后续开放
  ],
}
```

切换时：
```typescript
setLocale(key, true); // true = 刷新页面（当前代码为 false，需改为 true）
```

#### 3.1.4 登录页语言检测与切换

```typescript
// src/pages/Login/index.tsx
import { setLocale } from "@umijs/max";
import { useI18n } from "@/hooks/useI18n";

export default () => {
  const { t } = useI18n();

  useEffect(() => {
    // 首次访问时，如果没有存储的语言偏好，检测浏览器语言
    const savedLocale = localStorage.getItem("umi_locale");
    if (!savedLocale) {
      const browserLang = navigator.language;
      if (browserLang.startsWith("en")) {
        setLocale("en-US", true);
      }
      // 其他情况保持默认 zh-CN
    }
  }, []);

  // 登录页添加语言切换按钮
  // ...
};
```

### 3.2 国际化调用规范

#### 3.2.1 页面组件中的使用

```typescript
import { useI18n } from "@/hooks/useI18n";

const { t } = useI18n();

// 纯文本
<Button>{t("确定")}</Button>

// 带变量
<span>{t("共 {total} 条", { total: 100 })}</span>

// message 提示
message.success(t("操作成功"));

// 表单验证规则
rules={[{ required: true, message: t("请输入账号") }]}

// placeholder
<Input placeholder={t("请输入名称")} />

// 表格列头
const columns = [
  { title: t("名称"), dataIndex: "name" },
  { title: t("状态"), dataIndex: "status" },
  {
    title: t("操作"),
    render: (_, record) => (
      <Button type="link">{t("编辑")}</Button>
    ),
  },
];
```

#### 3.2.2 Constants 在组件中的转换模式

```typescript
// constants 文件不变
// src/constants/vehicle/index.ts
export const vehicleStatus = [
  { label: "充电中", value: "charging" },
  { label: "空闲", value: "idle" },
];

// 组件中使用
const { t } = useI18n();

<Select
  options={vehicleStatus.map(item => ({
    value: item.value,
    label: t(item.label),
  }))}
/>
```

#### 3.2.3 弹窗/Modal 组件的国际化

```typescript
<Modal
  title={t("新增地图")}
  okText={t("确定")}
  cancelText={t("取消")}
>
  {/* ... */}
</Modal>
```

#### 3.2.4 Konva Canvas HTML overlay 的国际化

```typescript
// 右键菜单（已经是 HTML overlay）
import { Html } from "react-konva-utils";
import { useI18n } from "@/hooks/useI18n";

const ContextMenu = () => {
  const { t } = useI18n();
  return (
    <Html>
      <Menu items={[
        { label: t("添加节点"), key: "addNode" },
        { label: t("删除"), key: "delete" },
      ]} />
    </Html>
  );
};
```

#### 3.2.5 ECharts 标题/图例的国际化

```typescript
const { t } = useI18n();

const option = {
  title: {
    text: t("任务统计"),
  },
  legend: {
    data: [
      t("完成任务"),
      t("未完成任务"),
    ],
  },
  // axis label、tooltip 内容不做国际化
};
```

### 3.3 locale JSON 文件结构

#### 3.3.1 zh-CN.json 结构

> **已有结构变更：** 当前 zh-CN.json 中有 `"弹窗": { "确定": "确定", "取消": "取消" }` 嵌套结构，改造时需移除 `"弹窗"` 分组，将 `"确定"` 和 `"取消"` 提升到顶层。`menu` 嵌套结构保留不变。

```json
{
  "menu": {
    "调度监控": "调度监控",
    "任务管理": "任务管理"
    // ... 所有菜单项（保留现有嵌套结构不变）
  },
  "调度系统": "调度系统",
  "确定": "确定",
  "取消": "取消",
  "提交": "提交",
  "删除": "删除",
  "编辑": "编辑",
  "新增": "新增",
  "搜索": "搜索",
  "重置": "重置",
  "操作": "操作",
  "名称": "名称",
  "状态": "状态",
  "类型": "类型",
  "请输入账号": "请输入账号",
  "请输入密码": "请输入密码",
  "登录": "登录",
  "登录成功": "登录成功",
  "操作成功": "操作成功",
  "删除成功": "删除成功",
  "暂无数据": "暂无数据",
  "共 {total} 条记录": "共 {total} 条记录"
  // ... 所有文案
}
```

#### 3.3.2 en-US.json 结构

```json
{
  "menu": {
    "调度监控": "Scheduling Monitor",
    "任务管理": "Task Management"
  },
  "调度系统": "Dispatch System",
  "确定": "Confirm",
  "取消": "Cancel",
  "提交": "Submit",
  "删除": "Delete",
  "编辑": "Edit",
  "新增": "Add",
  "搜索": "Search",
  "重置": "Reset",
  "操作": "Action",
  "名称": "Name",
  "状态": "Status",
  "类型": "Type",
  "请输入账号": "Please enter username",
  "请输入密码": "Please enter password",
  "登录": "Login",
  "登录成功": "Login successful",
  "操作成功": "Operation successful",
  "删除成功": "Deleted successfully",
  "暂无数据": "No data",
  "共 {total} 条记录": "{total} records in total"
}
```

---

## 四、执行计划

### 阶段 0：基础设施搭建

**目标：** 完成所有配置和工具准备，不改造任何业务页面。

**步骤：**

1. **创建 `src/hooks/useI18n.ts`**
   - 实现 `useI18n` Hook（二次封装 `useIntl`）
   - 暴露 `t()` 翻译方法和 `locale` 属性
   - 此后所有组件统一使用 `useI18n` 而非直接使用 `useIntl`

2. **修改 `.umirc.ts`**
   - 移除 `antd.configProvider.locale: "zh-cn"` 硬编码
   - 确认 `locale` 和 `layout.locale` 配置正确

3. **修改 `app.tsx`**
   - 动态 antd locale 注入（rootContainer 中添加 ConfigProvider）
   - layout title 国际化
   - dayjs locale 跟随切换

4. **恢复并完善语言切换器**
   - 取消 `ActionsRender` 中的语言切换菜单注释
   - 主题名称国际化（默认主题 / 暗色主题）
   - "退出" 按钮文案国际化

5. **完善 `zh-CN.json`**
   - 补充通用文案 key（确定、取消、操作、名称等高频词）
   - 保留现有菜单嵌套结构

6. **生成 `en-US.json` 初稿**
   - 所有 key 与 zh-CN.json 对齐
   - 提供专业术语翻译初稿

7. **创建术语对照表**
   - 提取所有专业术语，生成独立的中英对照表供审校

**提交：** `feat: 搭建国际化基础设施`

---

### 阶段 1：通用组件国际化

**目标：** 改造 `src/components/` 下的所有 18 个组件。

> **注意：** `FromToChecbox` 目录名有拼写错误（缺少字母 `k`），改造时保持目录名不变，仅修改组件内部文案。

**组件清单：**

| 组件 | 预估中文条目 |
|------|-------------|
| ActionsRender | ~17 |
| ActionsTable | ~5 |
| CommonJsonViewer | ~9 |
| Coordinate | ~6 |
| CreateOrderModal | ~55 |
| DraggableTag | ~1 |
| FakeProgressModal | ~35 |
| FromToChecbox（目录名拼写如此） | ~6 |
| FromToInput | ~10 |
| FromToInterval | ~12 |
| GraphPixel | ~46 |
| GridLayer | ~12 |
| JsonViewer | ~9 |
| MockDispatchModal | ~12 |
| OrderCancelModal | ~8 |
| OrderInfoModal | ~9 |
| RotateMap | ~20 |
| VehicleInfoModal | ~8 |

**改造模式：** 每个组件：
1. 添加 `import { useI18n } from "@/hooks/useI18n"`
2. 在组件函数内 `const { t } = useI18n()`
3. 将所有硬编码中文替换为 `t("原文")`
4. 将新增的 key 同步到 zh-CN.json 和 en-US.json

**提交：** `feat: 通用组件国际化`

---

### 阶段 2：Login + 独立页面

**目标：** 改造 Login、AuthorizeIngress、NotFound、UnAccess 等独立页面。

**要点：**
- Login 页面添加语言切换入口（不依赖 layout）
- 浏览器语言自动检测逻辑
- Token 过期提示文案国际化

**提交：** `feat: 登录及独立页面国际化`

---

### 阶段 3：核心业务页面（第一批）

**目标：** 改造最高频使用的页面。

**页面清单：**
- `Overlook`（调度监控 + 所有子组件：ForceGraph、PanelTabs、Tooltip、GraphMenu 等）
- `OrderRecord`（任务管理）
- `OrderInfo`（任务详情）

**这是最复杂的模块：**
- Overlook 包含大量 Canvas 相关组件（~30+ 子文件）
- 需要区分 Canvas 静态文本 vs HTML overlay
- ForceGraph 的 Tooltip/ContextMenu 使用 HTML overlay，需国际化

**提交：** `feat: 调度监控及任务管理页面国际化`

---

### 阶段 4：车辆管理 + 地图管理

**页面清单：**
- `VehicleDeploy`（VehicleGroup + VehicleDisplay + Modal）
- `VehicleInfo`
- `MapThrough`（MapList + MapNestModify + CrossMaps + 所有子组件）

**MapNestModify 特别注意：**
- 属性面板（AttributePane）有大量表单 label 和验证规则
- GraphMenu（右键菜单、显示元素）是 HTML overlay
- GraphBar（工具栏）是 React 组件
- Canvas 内的节点标签不翻译

**提交：** `feat: 车辆管理与地图管理页面国际化`

---

### 阶段 5：工艺配置 + 调度中心

**页面清单：**
- `MissionCluster`（MissionCreate + MissionFlow + 子组件）
- `ActionControl`（AGVAction + AGVActionGroup + CustomAction）
- `ObstacleAvoidance`
- `DispatchHub`
- `StrategyManage`（PickStrategy + DropStrategy + EditStrategy）

> **注意：** `StrategyManage` 及其子页面（PickStrategy、DropStrategy、EditStrategy）在 `.umirc.ts` 路由中没有直接注册，可能通过 DispatchHub 内部导航访问。改造时确认其访问路径，同样需要国际化。

**提交：** `feat: 工艺配置与调度中心页面国际化`

---

### 阶段 6：三方资源 + 系统管理 + 数据统计

**页面清单：**
- `TriResource` + `TriDevice`（Elevator_back、AutoDoor_back、ChargePile、ConveyorLine、AirShowerDoor_back）
- `TriTraffic`
- `SystemInvolve`（VersionControl、SystemLog、SystemFile、SystemSetting、OperationLog、SoftwareInformation）
- `AnalyzeVisual`（OrderStatistics）
- `RecordPlayback`

> **注意 1（TriDevice 目录说明）：**
> - `.umirc.ts` 路由中注册的是 `Elevator_back`、`AutoDoor_back`、`ChargePile/ModbusChargePile`
> - 同级目录下还有不带 `_back` 的 `Elevator`、`AutoDoor` 版本，以及 `ConveyorLine`、`AirShowerDoor_back`
> - `ConveyorLine` 和 `AirShowerDoor_back` 在路由中未注册但目录存在，改造时需确认是否使用
> - 改造时应以实际被路由引用的文件为准，避免遗漏
>
> **注意 2（SystemFile 说明）：** `SystemFile` 目录存在于 `SystemInvolve/` 下，但 `.umirc.ts` 路由中没有对应条目（可能通过内部跳转访问），改造时需确认是否使用。

**ECharts 注意事项：**
- OrderStatistics 的图表标题和图例国际化
- 坐标轴标签和 tooltip 内容不翻译

**提交：** `feat: 三方资源、系统管理与数据统计页面国际化`

---

### 阶段 7：收尾与完善

1. **全局检查**
   - 搜索代码中剩余的硬编码中文（排除 console.log、注释、API 参数等不需要国际化的文本）
   - 确保所有 zh-CN.json 中的 key 在 en-US.json 中都有对应翻译

2. **宽度适配检查**
   - 切换到英文环境，逐页面检查文本溢出
   - 对溢出的组件添加 `text-overflow: ellipsis` 或调整宽度

3. **更新其他语言文件**
   - zh-TW、ja-JP、ko-KR 同步 key 结构（值可以暂时留空或用中文回退）

4. **文档更新**
   - 更新 CLAUDE.md 中的 i18n 相关说明
   - 添加新增文案的规范指引

**提交：** `feat: 国际化收尾与宽度适配`

---

## 五、文件变更预估

| 类别 | 文件数 | 说明 |
|------|--------|------|
| 配置文件 | 2 | .umirc.ts, app.tsx |
| locale JSON | 5 | zh-CN/en-US/zh-TW/ja-JP/ko-KR |
| 通用组件 | 18 | src/components/ |
| 页面文件 | ~130 | src/pages/（含子组件） |
| constants 文件 | 0 | 不修改，组件层转换 |
| Konva 插件 | 0 | Canvas 静态文本不翻译 |
| CSS/Less | ~20 | 可能需要调整宽度的样式文件 |

**预估新增 locale key 数量：** 800-1200 条

---

## 六、约束与风险

### 6.1 技术约束

- **Umi Max locale 插件限制：** JSON 格式不支持嵌套太深，menu 使用特殊的 `.` 分隔符表示层级
- **Konva Text 节点：** 不走 React 渲染，Canvas 内文本国际化成本极高，决策为不翻译
- **Ant Design ProLayout：** 菜单的 locale 需要与 zh-CN.json 的 menu 结构严格对应
- **Umi `setLocale` + 刷新：** 第二个参数 `true` 表示刷新页面，确保所有组件重新渲染。当前代码使用 `false`，需改为 `true`
- **rootContainer 中不可使用 hooks：** `rootContainer` 回调不在 React 组件上下文中，不能调用 `useIntl()` 等 hooks。需通过 `localStorage.getItem("umi_locale")` 获取当前语言
- **layout 回调中的 hooks：** Umi Max 的 `layout` 回调被当作 React 组件渲染，支持 hooks（`useIntl` 可用），但需在实际改造时验证
- **部分页面目录与路由不对应：** StrategyManage、SystemFile、ConveyorLine、AirShowerDoor 等页面目录存在但未在 `.umirc.ts` 路由中注册，改造前需确认这些页面是否被使用

### 6.2 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 翻译质量不一致 | 专业术语翻译不准确 | 提供术语对照表供审校 |
| 英文文本溢出 | UI 布局错乱 | 逐页面检查 + ellipsis |
| 遗漏硬编码中文 | 部分文案不跟随切换 | 最终全局搜索中文正则检查 |
| 共享 key 冲突 | 不同上下文含义不同的中文共用 key | 翻译相同时可共用，不同时加限定词 |
| 性能影响 | 大 JSON 文件增加包体积 | Umi locale 按需加载 |

### 6.3 不在本次范围内

- 后端 API 国际化
- Canvas 画布内静态文本标签
- ECharts 坐标轴标签和 tooltip 内容
- WebSocket 推送消息的翻译
- 导出文件名/文件内容的国际化
- 右到左（RTL）布局支持

### 6.4 路由与页面目录差异记录

以下页面目录存在但未在 `.umirc.ts` 路由中直接注册，改造前需逐个确认是否被使用（通过内部导航、动态路由等方式访问）：

| 页面目录 | 路由中状态 | 可能的访问方式 |
|----------|-----------|---------------|
| `StrategyManage/`（含 PickStrategy、DropStrategy、EditStrategy） | 未注册路由 | 可能通过 DispatchHub 内部跳转 |
| `SystemInvolve/SystemFile/` | 未注册路由 | 可能通过其他系统管理页面跳转 |
| `TriDevice/ConveyorLine/` | 未注册路由 | zh-CN.json menu 中有"输送线"条目 |
| `TriDevice/AirShowerDoor_back/` | 未注册路由 | 可能在三方设备页内部使用 |
| `TriDevice/Elevator/`（非 _back 版本） | 未注册路由 | 路由指向 `Elevator_back` |
| `TriDevice/AutoDoor/`（非 _back 版本） | 未注册路由 | 路由指向 `AutoDoor_back` |

**处理原则：**
- 如果页面被实际使用（通过代码搜索确认有引用），则纳入国际化改造范围
- 如果页面确实未被使用，则在改造时跳过，但保留记录

---

## 七、验证检查清单

每个模块完成后，按以下清单验证：

- [ ] 切换到 en-US，检查所有按钮文字
- [ ] 检查所有表格列头
- [ ] 检查所有表单 label 和 placeholder
- [ ] 检查表单验证提示
- [ ] 检查 message.success/error 提示
- [ ] 检查弹窗标题和按钮
- [ ] 检查空状态文案
- [ ] 检查下拉选项（来自 constants 的）
- [ ] 检查 Ant Design 组件内置文案（分页、日期选择器等）
- [ ] 检查页面标题（title）
- [ ] 检查侧边栏菜单
- [ ] 检查英文文本是否溢出
- [ ] 切换回 zh-CN，确认中文显示正常
- [ ] 刷新页面，确认语言偏好保持
