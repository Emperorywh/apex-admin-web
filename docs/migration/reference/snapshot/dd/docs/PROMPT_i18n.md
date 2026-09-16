# i18n 改造提示词（可直接粘贴到新项目的 CLAUDE.md）

> 使用方法：将下方内容粘贴到目标项目的 `CLAUDE.md` 文件的 `## i18n（国际化）` 章节。
> 适配说明：根据实际框架替换 `@umijs/max` 等框架相关导入路径。

---

## i18n（国际化）

项目已完成全面国际化改造，支持 zh-CN / en-US {{及其他语言}}。

### 核心文件

- `src/locales/` — locale JSON 文件，中文原文作为 key（平面结构），menu 保留嵌套结构
- `src/hooks/useI18n.ts` — 统一的国际化 Hook（框架 i18n hook 的二次封装），暴露 `t()` 和 `locale`

### 使用规范

```typescript
import { useI18n } from "@/hooks/useI18n";
const { t } = useI18n();

// 纯文本
<Button>{t("确定")}</Button>

// 带变量
<span>{t("共 {total} 条", { total: 100 })}</span>

// constants 中的中文 label 在组件层用 t() 转换
<Select options={statusList.map(s => ({ ...s, label: t(s.label) }))} />
```

### 新增文案规范

1. 新增界面文案时，直接使用 `t("中文原文")` 调用
2. 将新 key 同步添加到 `zh-CN.json`（值 = 中文原文）和 `en-US.json`（值 = 英文翻译）
3. 其他语言文件可后续补充翻译（缺失时回退到中文原文）
4. **不要修改** `src/constants/` 中的中文 label，在组件层用 `t()` 转换

### 国际化范围

- ✅ 按钮、表格列头、表单 label、placeholder、验证消息、message 提示、弹窗标题
- ✅ Canvas HTML overlay（右键菜单、Tooltip、工具栏）
- ✅ ECharts 图表标题和图例
- ✅ Ant Design 组件内置文案（分页、日期选择器等）
- ❌ Canvas 画布上的节点标签（改造成本极高）
- ❌ API 返回的 message 字段（后端文案，前端直接展示）
- ❌ console 日志、注释中的中文

### Key 设计策略

- **中文原文作 key**：`t("确定")` → 查找 `{ "确定": "Confirm" }`
- **相同中文翻译一致 → 共享 key**；翻译不同 → 加限定词（如 `"名称"` vs `"配置名称"`）
- **菜单项**保留嵌套格式：`"menu": { "调度监控": "Scheduling Monitor" }`

### 语言切换

- 已登录用户通过顶部导航栏的语言切换器切换
- 登录页根据 `navigator.language` 自动检测浏览器语言
- 使用 `setLocale(locale, true)` 切换并刷新页面
- 语言偏好持久化到 `localStorage.umi_locale`

### 批量改造脚本

```bash
# 对指定目录批量添加 useI18n 并替换常见中文模式
node scripts/batch_i18n.cjs src/pages/YourModule
```

脚本自动处理：`label/title/placeholder/message` 属性中的中文 → `t()` 调用。
脚本不处理：动态拼接、三元表达式、模板字符串中的中文 → 需人工审查。

---
