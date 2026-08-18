# Apex Admin Web — 视觉现代化第二轮专项规格（SPEC-UI2：slash-admin 风格转向）

> 版本：v1.5 · 日期：2026-08-18 · 状态：已确认（两阶段实施完成 + v1.3 导航走查回归修复，见 §16 修订记录）
>
> 本文档是主规格 `docs/SPEC.md` 的**视觉专项子规格**，承接并取代 `docs/SPEC_UI.md`（v1.3，两阶段已验收）。主规格仍是全项目唯一需求依据；本文档只覆盖视觉与壳层呈现，不改变任何功能行为。冲突裁决：功能行为以主规格为准；视觉呈现上 SPEC_UI.md 与本文档冲突的条文**以本文档为准**（§13 给出逐条取代映射）。
>
> 参照实现：`c:\code\slash-admin`（Tailwind v4 + shadcn + Iconify 体系；经实测其 package.json 无 vanilla-extract 依赖）。本项目不引入其样式技术栈，只用 antd v6 token + CSS Modules **翻译其设计语言**（神似而非逐像素复刻）。
>
> 所有标注「已定」的条目来自 2026-08-17 第二轮访谈结论；标注「默认」的条目为访谈未覆盖、参照 slash-admin 选定的默认值，实施时可实测微调并回写本文档。

---

## 1. 背景与目标

第一轮视觉现代化（SPEC_UI v1.3）将界面从 antd 默认观感升级为「Linear 极简细边框」风格并已完成验收，但用户评价仍为「特别丑、不协调、很古板」。经第二轮访谈确认：问题不在执行质量，而在**风格路线本身**——极简细边框路线与用户对「美观」的预期（slash-admin 式柔和卡片风）不符。

**目标（已定）**：在**零功能变更**前提下，全面转向 slash-admin 式观感——柔和卡片、12px 卡片圆角、灰阶画布衬白卡、彩色菜单图标、柔和+彩色阴影、Inter 字体、14px 密度。

**非目标（已定）**：

- 不新增功能：不做 Cmd+K 全局搜索（访谈明确不选）；不加布局模式（双栏菜单 / 内容定宽拉伸均不加）。
- 不重做登录页结构（第一轮左右分栏保留，仅继承新 token/字体并加入场动效）。
- 不恢复字体/字号设置项（主规格 §10.1「字体不提供设置项」不变，构建期定死）。
- 不做移动端适配升级（桌面优先，移动断点行为与现状一致）。
- 不引入 Tailwind/Less 等样式框架（主规格 §2/§18 红线不变）。
- 不引入 Playwright 截图视觉回归（人工走查把关，与上轮一致）。

## 2. 范围

### 2.1 改造范围（已定）

| 区域 | 程度 |
| --- | --- |
| 全局设计令牌 v2：圆角体系、阴影体系（含彩色发光）、灰阶画布、字号 14px、Inter 字体、组件级覆盖 | **重新建立基线** |
| 图标体系：@iconify/react 离线化 + 本地彩色 SVG（菜单）/ lucide-react（工具图标）双轨 | **新建** |
| 壳层：自绘侧边导航 SideNav、顶部导航 TopNav、Header、TabsBar、Breadcrumb、SettingDrawer | **重新设计** |
| 业务页面骨架：单卡片合并规范 + 共享骨架组件，逐页套用 | **新建规范** |
| Dashboard 演示页 | **全面重排 + 迷你趋势图** |
| 全局反馈页：403 / 404 / 500 / 路由错误页 | **加 motion 入场动效**（结构不变） |
| 登录页 | **仅继承 token/字体 + 入场动效** |
| 预设主题色板：默认色改 slash 招牌绿，8 色构成微调 | **调整** |

### 2.2 明确不动（已定）

- 布局模式：侧边/顶部两种 + 内容通栏，无新增；settings 切片**零新字段** → 无 redux-persist 版本迁移（主规格 §8）。
- 页签交互：关闭、affix、dnd-kit 拖拽排序、右键菜单、溢出滚动与箭头、键盘操作、关闭后继顺序、LRU 缓存行为（主规格 §9.3）。
- 头部元素构成：折叠触发器 / 面包屑 / 演示模式标记 / 全屏 / 语言 / 主题快捷切换 / 用户菜单 / 设置入口。
- 面包屑位置（头部左侧）与开关行为；数据仍经 `deriveBreadcrumbCrumbs` 派生。
- 认证、路由三投影、Activity 页面保活、请求状态机、反馈桥等全部功能机制。
- demo 三态与 `src/demo/` 整体剔除机制（`check:demo-off` 必须持续全绿）。
- ECharts 只从 `echarts/core` 按需注册的红线（主规格 §2）。
- 设置抽屉全部设置项及其组合能力、即时生效行为（主规格 §10）。

## 3. 设计原则 v2（已定）

1. **Token 翻译，不引 Tailwind**：以 ConfigProvider `token`/`components` + CSS Modules + antd CSS 变量承载 slash 设计语言；保留色值纪律红线（§4.3）。
2. **柔和阴影与细边并存**（取代 SPEC_UI §3.2「细边框优先于阴影」）：卡片 = 1px 细边 + 柔和浅阴影（slash `shadow-sm`/`card` 风格）；浮层保留阴影阶梯；主色按钮/徽标可用彩色发光阴影。
3. **大圆角卡片体系**（取代「小圆角 4–6」）：卡片/大容器 12px，常规组件 6px，小组件 4px；表格/表单维持企业级信息密度。
4. **灰阶画布衬白卡**：内容区浅灰画布（亮 ≈ `#F4F6F8`，暗 ≈ near-black），卡片纸面白（`colorBgContainer`），层次靠「画布灰 vs 卡片白 + 细边浅影」。
5. **双主题同等精品**（不变）：亮/暗各自独立调优，非算法反色了事。
6. **全组合美观**（不变）：侧边/顶部 × 亮/暗 × 任意主题色 × zh/en 都必须成立。
7. **动效克制**（修订 SPEC_UI §9「纯 CSS、禁 JS 动画库」）：纯 CSS 过渡优先（150–300ms）；motion 仅限错误页/登录页入场与组件级微动效，**Activity 缓存页面禁止挂载入场动效**（红线，§10）。

## 4. 设计令牌基线 v2

### 4.1 全局 token（逐行标注「已定/默认」；标「默认」的取值实施时实测定稿并回写）

| Token | 取值方向 | 定位 | 说明 |
| --- | --- | --- | --- |
| `fontSize` | **14**（原 16） | 已定（§4.5） | html font-size 与 antd fontSize 同值，见 §4.5 |
| `fontFamily` | Inter Variable 栈 | 已定（§4.5） | 见 §4.5 |
| `borderRadius` / `borderRadiusLG` | 6 / **12** | 已定（§3.3） | 卡片与大容器 12px；`borderRadiusSM` 4 不变 |
| `colorBgLayout` | 亮 `#F4F6F8` / 暗 `#09090B` | 机制已定，取值默认 | **灰阶画布**（slash `background.neutral`/near-black），在 theme.ts 字面覆盖；启动镜像同步（§11 红线）；hex 实测定稿回写 |
| `boxShadow*` 系 | 柔和阶梯 | 机制已定，取值默认 | 参照 slash：统一 `gray500/16%` 风格低透明阴影（亮）与 `black/16%`（暗）；卡片 `shadow-sm` 级、浮层保留阶梯；具体取值实测定稿回写 |
| 彩色发光阴影 | 主色派生 | 默认 | 实心主按钮 hover、彩色徽标：`<colorPrimary>/24%` 发光（slash 签名），经 token/CSS 变量派生，禁字面量 |
| `controlHeight` 系 | 保持默认 | 已定 | 不牺牲可用性换密度 |
| 全局滚动条 | 细化 | 默认 | Chromium/WebKit：`::-webkit-scrollbar` 细轨 + 圆角灰色 thumb（slash ScrollArea 观感）；Firefox 以 `scrollbar-width: thin` + `scrollbar-color` 对齐近似观感（主规格 §16.4 浏览器目标含 Firefox）。取色经 antd token 派生 |

### 4.2 组件级覆盖（逐条标注「已定/默认」；标「默认」的取值实施时实测定稿并回写）

- `Card`（圆角/边框/阴影已定，内边距 20–24 默认）：`borderRadiusLG: 12`、细边框 + 浅阴影。
- `Table`（机制已定，行高取值默认）：表头纸面底（`colorBgContainer`）+ 细下边框、行高随 14px 密度收敛、行 hover 浅底；不改列结构与交互（唯一例外见 §5.7/§7）。
- `Button`（圆角 6 已定，发光阴影默认）：实心主按钮 hover 加主色发光阴影。
- `Tag`（默认）：slash 式重制——无边框、6px 圆角、语义色浅底 + 语义色文字（经 token 派生）。
- `Menu`（已定）：壳层导航弃用 antd Menu（§6.1 自绘），现有 Menu token 覆盖随之移除；业务页内若用 antd Menu/Dropdown 保持算法默认。
- `Drawer`/`Dropdown`/`Popover`/`Tooltip` 等浮层（默认）：保留阴影阶梯，圆角 8–12。

### 4.3 色值纪律（红线，主规格 §10.2 不变）

- 色值字面量仍只允许出现在 `src/config/theme.ts`；CSS Modules 与 TSX 只能消费 `theme.useToken()`、`var(--ant-*)` 或 theme.ts 导出值。
- slash 灰阶参照值（画布灰、near-black、中性灰阶）以具名导出收敛进 theme.ts；透明度合成优先用 antd 派生 token（`colorFillTertiary` 等）或 `colorPrimary` + CSS `color-mix()`/RGB 通道变量。

### 4.4 预设主题色板调整（已定）

- 8 色预设数量不变；**将 `emerald #059669`（翡冷翠）替换为 slash 招牌绿 `meadow #00A76F`（原野绿）并置首作为新默认**（`DEFAULT_COLOR_PRIMARY` 变更）。其余 7 色不变：indigo / azure / violet / sunset / crimson / teal / magenta。
- 新色必须通过 `contrastRatio ≥ 3` 白字对比度校验；`#00A76F` 估算 ≈3.1 贴线，若不达标微调明度后回写本文档。
- 兼容性（已定）：老用户 localStorage 持久化的 `colorPrimary` 为任意 hex，不受影响；新默认只影响首次安装。预设 key/labelKey 变化同步 en-US 资源（新增 原野绿 Meadow、移除 翡冷翠 Emerald）。

### 4.5 字体与字号（已定，主规格 §10.1 表述实施时同步修订）

- 引入 `@fontsource-variable/inter` **自托管**（仅拉丁子集，无 CDN 依赖）；字体族栈固定为 `"Inter Variable", system-ui, -apple-system, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif`——拉丁字母/数字/标点用 Inter，中文回退系统中文字体。字体许可：Inter 为 SIL OFL，随资产附带许可说明。
- 基准字号 **16px → 14px**：`BASE_FONT_SIZE_PX`、html font-size（rem 基准）、antd `fontSize` 三处同值改 14。
- **rem 审计（edge case）**：rem 基准缩小 12.5%，壳层全部 rem 尺寸等比缩小——逐文件核对壳层 rem 数值（品牌区、菜单行高、登录 `max-width: 20rem`、StatusResult 5rem 徽章等），该保 px 语义的改回 px 或重算 rem，实测定稿回写。
- 不提供字体/字号设置项（主规格 §10.1 不变）；settings 切片无字体字段。

## 5. 图标体系（新建，已定）

**双轨制**：菜单彩色图标走 Iconify 本地 SVG；工具/内联线性图标继续 lucide-react（现状不变，不引第二套线性图标库）。

1. **离线红线**：禁止运行时请求 `api.iconify.design`。全部图标打进 bundle，仅支持 `local:` 前缀；不允许 `url:` 与在线图标集。装载路径（阶段一 PoC 定稿回写）：**首选**构建期把 `src/assets/icons/*.svg` 预转换为 IconifyJSON collection（`.json`，转换脚本随资产提交），运行时 `import.meta.glob('*.json')` 聚合、统一 `addCollection` 注册（`addCollection` 由 `@iconify/react` 导出，**非** `@iconify/utils`——后者为构建期工具集）；备选 `import.meta.glob('*.svg', { as: 'raw' })` + 运行时解析，仅当 PoC 证明可行且依赖归属清晰时采用。
2. **资产来源（已定）**：复用 slash-admin `src/assets/icons/` 的彩色 SVG（MIT 许可），落盘 `src/assets/icons/`，随目录附带其 LICENSE/NOTICE 说明；业务需要的缺口图标按同风格（双色面性、24px 画布）增补。
3. **封装（红线）**：唯一入口 `src/components/AppIcon/AppIcon.tsx`；其他文件禁止直接 `import '@iconify/react'`——`check-structure.mjs` 增加导入白名单规则强制。
4. **路由图标字符串化**：`meta.icon` 由 `LucideIcon` 组件引用改为 `local:` 图标名字符串（`router.types.ts`/`projections.tsx`/`navModel.ts` 同步）；新增**注册完整性单测**——断言路由/菜单引用的每个图标名均已注册。
5. **尺寸规范（默认）**：一级菜单 24px 彩色、子级 20px 同风格；无彩色资产的条目回退 lucide 线性图标并**保持同尺寸（24/20px）**，回退关系由注册表统一管理；mini 折叠态图标 24px + 12px 标题；Header 工具图标继续 lucide 16–18px。
6. **结构门禁**：`src/assets/` 为**既有**合法资产目录（主规格 §3.1 结构树与 `check-structure.mjs` 的 `SRC_TOP_LEVEL_NAMES` 均已收录），本次仅确认图标/图片资产落位于此，无目录白名单调整；门禁唯一新增规则是 §5.3 的 `@iconify/react` 导入限制。
7. 菜单管理演示页**新增图标列**（本规格唯一列结构例外，§7 同步豁免）：`icon` 为 demo fixture 私有演示字段（种子数据在 `src/demo/` 内，值为 `local:` 图标名），主规格 §14.1 `MenuItem` 契约不变；真实后端数据无该字段时图标列呈现占位；渲染统一经 AppIcon。

## 6. 壳层组件设计 v2

### 6.1 自绘导航 SideNav / TopNav（已定，取代 SPEC_UI §5.1）

- **弃用 antd Menu**，参考 slash-admin `src/components/nav/` 完全自绘（侧边 + 顶部均自绘）。
- 选中态：整行圆角 6px + 主色 8–10% 浅底（`colorPrimaryBg` 派生）+ 主色文字/图标；**无左侧指示条**（移除第一轮 `::before` 实现）；hover 为中性浅底；过渡 200–300ms。
- 行高 44px、标题 14px/500；**副标题 caption**（已定）：路由 `meta` 新增 `caption` 字段（i18n key，en-US 资源同步），12px 灰色，投影进 NavTreeNode。
- 侧边栏宽度 **224 → 260px**（已定，见访谈风格预览）；右缘 1px **虚线分隔**（slash 签名，默认）；底色纸面（`colorBgContainer`），不再是第一轮的中性灰底。
- **mini 折叠态（已定）**：宽度 80 → **88px**，图标在上、12px 标题在下纵向排列；有子菜单的项 hover 弹出右侧浮层卡片（自绘浮层，圆角 12 + 阴影阶梯）；无子菜单项保持 tooltip。
- 折叠触发：Header 折叠钮保留；**新增侧边栏右缘悬浮折叠球**（slash 签名，默认）——圆形小按钮半压侧边栏右缘。
- 品牌区：高度与 Header 对齐为 64px；保留文字品牌 + 图形标，仅精修排版与折叠态（默认）。
- 层级：子级缩进 + 展开箭头 90° 旋转过渡；任意层级能力不变（主规格 §11.2）。
- **可访问性红线**：自绘菜单必须重建 antd Menu 现成的语义与键盘能力——`role="menu"/"menuitem"`、`aria-expanded`/`aria-current`、方向键/Enter/Esc 操作、焦点可见、选中/展开链仍由路由 match 派生（现有 openKeys 派生逻辑移植）；键盘导航与展开逻辑抽为可测纯函数/Hook 并有单测。
- TopNav：横向自绘，同一套选中语言（浅底 + 主色文字）；二级以下走下拉浮层（主规格 §11.1 行为不变）。
- 移动断点行为不变：<768px 侧边导航改 Drawer 呈现（自绘 SideNav 在 Drawer 内复用）。

### 6.2 Header（已定）

- 高度 **48 → 64px**；sticky；底色 `colorBgContainer` 60% 透明度 + `backdrop-filter: blur`（毛玻璃）；暗色主题透明度单独调优。
- **edge case（已定）**：内容滚动容器在每个 Activity 页面内部（`PageCacheHost .pagePane`），页签滚动位置保活依赖该结构——**不改滚动架构**；毛玻璃作为质感呈现（半透明底 + blur），不追求内容穿过头部的效果。
- 工具图标按钮：统一 36px 圆形 hover 容器（slash 风）；元素构成与顺序不变；演示模式 Badge 保留语义色精修。
- 底部 1px 细分隔线（`colorBorderSecondary`），无阴影。

### 6.3 TabsBar 卡片式（已定，取代 SPEC_UI §5.3 下划线式）

- 转向 slash multi-tabs 形态：**直角顶卡片**（无圆角）——非激活页签为灰阶浅底/透明 + 次级文字；激活页签为纸面白底 + 主色文字，底部与内容区视觉相连（激活页签下无分隔线）。
- 栏高适配卡片形态（40–48px 区间实测定稿回写）；栏底色随画布灰。
- **交互零变更（红线）**：dnd-kit 拖拽排序（含键盘拖拽）、右键菜单五项、溢出横滚 + 箭头、affix 页签、关闭后继顺序、roving tabindex 全部保留（主规格 §9.3）。
- 关闭按钮仅 hover/当前页/focus-visible 显现（沿用 opacity 方案）；affix 页签 Pin 图标不变。
- 纯 CSS transition（150–250ms）；禁止依赖挂载 Effect 的 JS 动效（Activity 红线不变）。

### 6.4 Breadcrumb（默认）

- 位置、开关、派生逻辑、目录节点不可点行为全部不变；仅精修：14px 字号、分隔符与图标对齐、hover 浅底圆角。

### 6.5 SettingDrawer slash 化（已定，四要素全选）

- **布局缩略图预览**：侧边/顶部布局选项改为两张迷你线框缩略图卡片，选中态主色描边 + 浅底，替代 Radio 文字。
- **纵向色条选择器**：8 色预设改为纵向圆角色条列表，选中时横向拉宽 + 白色对勾（slash 签名交互），纯 CSS 宽度过渡；自定义取色器与低对比度警告保留（主规格 §10.1/§11.3）。
- **毛玻璃 + 光斑背景**：抽屉背景 `backdrop-filter: blur(20px)` + 右上/左下两张模糊光斑装饰（复用 slash-admin 的 cyan-blur/red-blur PNG，MIT 许可，随资产附 NOTICE）；暗色主题光斑透明度单独调。
- **主题模式图标卡片**：亮/暗/跟随系统改为三张图标卡片分段选择。
- 分组保留「主题 / 布局 / 界面元素」（主规格 §10.2 分组要求）；全部设置项与即时生效不变；抽屉宽度 320 → ≈360px（默认，实测定稿）；浮层阴影阶梯保留。

## 7. 业务页面骨架（新建规范，已定）

- **单卡片合并**（slash/minimal 式）：搜索区 + 工具栏 + 表格/内容放进**同一张白色圆角卡片**（12px 圆角、细边、浅阴影）；搜索区与内容区之间细分隔线；卡片间/页边距 16px；页面衬底为灰阶画布（§4.1）。
- 新增共享骨架组件（`src/components/` 下，命名如 `PageCard`，实施定稿），统一标题区/搜索区/内容区节奏；列表页逐页套用：用户/角色/菜单管理、个人中心、嵌套演示页。
- 列结构、查询字段、按钮级权限、交互零变更；表格仅经 §4.2 token 与骨架间距变化。**唯一例外**（§5.7）：菜单管理页新增图标列（demo fixture 私有 `icon` 演示字段驱动，`MenuItem` 契约不变，缺省数据呈现占位）。
- 页面容器 padding 随 14px 密度复核（现 16px，实测定稿）。

## 8. Dashboard 全面重排（已定）

- 统计卡改 slash workbench 式：**彩色浅底圆角图标块**（语义色/主色 10% 浅底派生 + 彩色图标）+ 大数字 + 环比文案 + **迷你趋势图**。
- 迷你趋势图（默认）：自绘 SVG sparkline 小组件，落位 `src/features/dashboard/components/Sparkline/`（单业务域组件，主规格 §3.2 归属规则）——无新依赖、无 Effect 负担，避开 Activity 隐藏页 Effect 清理与多 ECharts 实例开销；CSS 描边动画即可。
- 图表区卡片化重排：卡片 12px 圆角白卡 + 间距节奏收紧；ECharts 按需注册红线与 `usePageActive` 暂停/恢复纪律不变；图表用色继续 token 派生。
- demo 数据补充时间序列（`src/demo/` 内，演示账号数据唯一数据源不变）；off 构建整体剔除机制不变，`check:demo-off` 持续全绿。
- 信息架构不新增业务模块（无新页面、无新路由）。

## 9. 登录页与全局反馈页（已定）

- 登录页：左右分栏结构与表单行为零变更；继承新 token（圆角/字体/14px/色板）与卡片规范；加 **motion 淡入/上滑入场**（登录页非缓存路由，无 Activity 冲突）；demo 账号提示卡样式随新卡片规范精修。
- 403/404/500/RouterErrorBoundary：StatusResult 结构不变，加 **motion bounce 入场**（slash 错误页同款）；重试/返回等行为不变。
- PageLoading 等加载态随新 token 精修（默认）。

## 10. 动效规范（已定）

- 引入 `motion`（framer-motion 新名，MIT），统一封装在 `src/components/animate/`（仿 slash 的 varFade/varSlide/varBounce 变体 + 容器级联）；业务代码不直接散落 motion API（默认）。
- **使用边界（红线）**：motion 只用于①错误页/登录页入场编排（淡入/上滑/bounce 与容器级联）、②CSS 难以表达的组件级微动效（如数值变化）；hover、展开/折叠、选中切换等过渡一律纯 CSS（§3.7「纯 CSS 过渡优先」次序不变，卡片 hover 抬升属 CSS 职责、禁用 motion）；**PageCacheHost 下的 Activity 缓存页面禁止挂载入场动效**——隐藏页 Effect 被 React 清理，重显时入场动画会重播/闪烁（主规格 §9）。Dashboard 等缓存页内的动效只能是纯 CSS 或交互响应式（hover/transition），不得是 mount 触发。
- 时长 150–300ms，`ease-out` 为主；无滚动动效、无装饰性循环动画（设置齿轮不转）。
- `prefers-reduced-motion` 全局降级机制不变，motion 入场同样受降级约束。

## 11. 双主题与启动镜像（红线）

- 亮/暗各自独立取值：画布灰（亮 `#F4F6F8` / 暗 `#09090B`）、纸面、边框明度、选中态浅底透明度、阴影阶梯、毛玻璃透明度、光斑透明度，均经人工走查确认。
- **启动镜像同步（红线）**：画布底色变更后，`index.html` 内联启动脚本（主规格 §8.3，读 `apex_boot_theme`）写入的首帧背景字面量同步更新为新画布色（亮 `#F4F6F8` / 暗 `#09090B`），`themeBootMirror.ts` 同步；保证整页刷新无首帧闪变。Redux 仍是运行时单一数据源。
- 跟随系统、手动切换、系统偏好监听行为零变更（主规格 §10.2）。

## 12. 验收与走查（已定）

- **v1.4 起**单元测试与 E2E 体系已随主规格 v1.9 整体移除（主规格 §16.3），本节原有的单测/E2E 断言与覆盖率要求不再适用；视觉质量由人工走查把关。
- `pnpm check`（structure → lint → typecheck → build）全绿是每阶段交付前提，`check:demo-off` 按需执行；check-structure 含 `@iconify/react` 导入限制规则（`src/assets/` 已属合法目录，无需白名单调整）。
- **人工走查矩阵（扩展）**：亮/暗 × 侧边/顶部 × 色板（含新默认绿 + 至少 2 个非默认色）× zh/en；页签栏全交互（拖拽/右键/横滚/affix）；**自绘导航键盘走查**——方向键/Enter/Esc 全层级遍历、`aria-expanded`/`aria-current` 状态核验、焦点可见、TopNav 下拉浮层键盘操作与 Esc 关闭；mini 折叠悬浮子菜单（鼠标 hover + 键盘）；14px 密度与 Inter 字体渲染（中英文混排）；毛玻璃 Header 亮暗两态；设置抽屉新控件全组合；登录页与错误页动效（含 reduced-motion 降级）。

## 13. 与既有规格的冲突裁决

### 13.1 取代映射（SPEC_UI v1.3 → 本文档）

| SPEC_UI v1.3 条文 | 本文档取代条文 |
| --- | --- |
| §3.2 细边框优先于阴影 | §3.2 柔和阴影与细边并存 |
| §3.3 小圆角 4–6 紧凑 | §3.3 卡片 12px 大圆角体系 |
| §4.1/§4.2 token 基线与组件覆盖（含 Menu/Table 实测定稿） | §4.1/§4.2 v2 基线 |
| §4.4 色板 8 色、indigo 默认 | §4.4 meadow 绿替换 emerald 并默认 |
| §5.1 antd Menu + 2px 指示条、侧边栏中性灰底 | §6.1 自绘导航、无指示条、纸面底 + 虚线 |
| §5.2 Header 48px 白底细边 | §6.2 Header 64px 毛玻璃 |
| §5.3 下划线极简页签 | §6.3 圆角卡片式页签 |
| §5.5 设置抽屉 Radio 平铺 | §6.5 抽屉 slash 化四要素 |
| §9 纯 CSS、禁止 JS 动画库 | §10 受限 motion + Activity 红线 |
| §11 系统字体栈 + 16px 固定、禁 Web 字体 | §4.5 Inter Variable 自托管 + 14px |
| §2.2 零新依赖 | §15 依赖白名单（3 必选 + 1 待定） |

未被映射的 SPEC_UI 条文（如 §4.3 色值纪律、§10 启动镜像）继续有效。

### 13.2 文档衔接（阶段一第 0 步前置交付，先于任何代码改动）

> 时序依据（红线）：主规格 v1.6 明文「基准字号固定 16px + 系统字体栈」（§10.1）与「图标 lucide-react」（§2），与本文档直接矛盾；按主规格「变更必须先改 SPEC 及修订记录，再改代码」纪律，以下修订全部落地并提交后，方可开始阶段一实施。

- 主规格 `docs/SPEC.md` 修订记录追加（升 v1.7）：「新增视觉第二轮专项子规格 docs/SPEC_UI2.md，视觉呈现以 SPEC_UI2 为准（取代 SPEC_UI.md 冲突条文），功能行为不变」。
- 主规格 §2 图标栈表述修订：「线性图标 lucide-react + 菜单彩色图标 @iconify/react（离线 local:）双轨」。
- 主规格 §10.1 字体/字号/预设色板默认色表述同步修订（Inter Variable + 14px + meadow 默认）。
- 主规格 §4.2 `RouteMeta` 接口同步修订：`icon?: string`（`local:` 图标名，原 `LucideIcon` 组件引用废止）、新增 `caption?: string`（i18n key）。
- 主规格 §16.2 check-structure 职责清单追加：`@iconify/react` 直接导入限制（唯一豁免 `src/components/AppIcon/`）。
- `docs/SPEC_UI.md` 头部标注「已被 SPEC_UI2.md 取代，仅作历史留存」，正文不删改。

## 14. 实施计划（两阶段，已定）

| 阶段 | 内容 | 走查点 |
| --- | --- | --- |
| 阶段一 | 第 0 步（前置）：§13.2 文档衔接全部落地（主规格 v1.7 + SPEC_UI.md 头部标注）→ 依赖与资产接入（§15 依赖 + slash SVG/PNG 资产 + 许可说明）→ token v2 基线（§4 全部）→ 图标体系（§5，含装载路径 PoC）→ 壳层（§6 自绘导航/Header/卡片页签/抽屉）→ 启动镜像同步（§11） | 壳层全组合走查矩阵（§12） |
| 阶段二 | 业务页单卡片骨架逐页套用（§7）→ Dashboard 重排 + sparkline + demo 时序数据（§8）→ 登录/错误页 motion 入场（§9/§10） | 业务页/Dashboard 亮暗走查 + 全量 E2E |

每阶段：先改本文档（如需微调）→ 实现 → 测试修复 → 走查确认 → 实测定稿回写本文档修订记录。

## 15. 依赖与资产清单（已定）

| 项 | 版本（下限指引） | 许可 | 用途 |
| --- | --- | --- | --- |
| `@iconify/react` | ^6.x（2026-08 实查最新 6.0.2，peer `react >=16`） | MIT | 图标运行时，`addCollection` 离线注册（仅 AppIcon 封装内使用） |
| `@fontsource-variable/inter` | ^5.x（5.3.0） | 代码 MIT / 字体 SIL OFL | Inter Variable 自托管（拉丁子集） |
| `motion` | ^13.x（13.1.0） | MIT | 受限动效（§10 边界） |
| `@iconify/utils`（待定） | ^3.x（3.1.4） | MIT | **构建期**工具集，仅当 §5.1 选定「构建期 SVG→IconifyJSON 转换脚本」路径时按需引入；若脚本改用其他工具或人工维护 JSON 则不引入（**v1.2 定稿：未引入**——转换脚本 `scripts/generate-icon-collection.mjs` 为零依赖自写实现） |
| slash-admin `src/assets/icons/*.svg`、光斑 PNG | — | MIT | 菜单彩色图标、抽屉光斑背景；随资产附 LICENSE/NOTICE |

版本为下限指引而非锁定：实际可复现版本以 `pnpm-lock.yaml` 定稿为准，升级依赖单独提交并重跑完整质量链（主规格 §2 惯例）。

红线不变：不引入 Tailwind/Less、ESLint/Prettier、react-router-dom、MSW；不引入第二套线性图标库；Iconify 严禁运行时 CDN 拉取。

## 16. 修订记录

- v1.5（2026-08-18）：随主规格 v1.11 变更——§6.3 页签卡片由「圆角顶卡片」改为「直角顶卡片」（无圆角，其余配色/相连/过渡规则不变）；§6.3 红线中「右键菜单四项」随主规格 §9.3 扩为五项（新增「关闭左侧」）。
- v1.4（2026-08-18）：随主规格 v1.9 整体移除单元测试与 E2E 测试体系——§12 改写为「验收与走查」，删除单测/E2E 断言与覆盖率条文；§4.4 对比度校验要求保留，去掉对已删 `theme.test.ts` 机制的引用。以下历史修订记录中的测试机制表述按原文保留。
- v1.3（2026-08-18）：§6.1 自绘导航走查回归修复（行为回到条文本意，无规格变更）——
  - **子菜单收纳失效（闭合目录残留大片空白）**：`.branch` 同时承载行按钮与 submenu 两个子元素，却只声明一条 `grid-template-rows` 轨道，submenu 落入隐式 `auto` 轨道——`0fr` 收纳从未作用于它，闭合态仅 `visibility: hidden` 却占满高。改为显式两轨道 `auto 1fr ↔ auto 0fr`（轨道 1 行按钮常显、轨道 2 submenu 收纳），展开/折叠过渡不变。
  - **mini 折叠浮层空壳（hover 一级目录看不到二级）**：浮层节点渲染在 `NavRowContext.Provider` 之外，浮层内 NavRow 取不到行上下文（ctx 为 null）整树返回 null，浮层只剩 16px 空卡片。Provider 上提包住主菜单与浮层两棵子树；BasicLayout.test.tsx 新增 mini 浮层回归用例（hover 弹出、子级可点导航、导航即关闭）。
- v1.2（2026-08-17）：两阶段实施完成，实测定稿回写——
  - **§5.1 装载路径 PoC 定稿**：选定首选路径「构建期预生成 IconifyJSON + `import.meta.glob` 聚合 + `addCollection`」；转换脚本 `scripts/generate-icon-collection.mjs` 为零依赖自写实现（剥外层 `<svg>` 取 body、读 viewBox 推尺寸），产物 `src/assets/icons/local.iconify.json` 随资产提交；**未引入 `@iconify/utils`**（§15 待定项落空）。glob 以 `@/assets/icons/*.iconify.json` 别名形态使用（Vite 对 CSS/TS url 与 glob 均解析别名）。
  - **§10 动效封装落位调整**：`src/components/MotionDiv/`（`MotionDiv.tsx` + `motionVariants.ts`）承载统一封装。原定 `src/components/animate/` 与结构门禁「components/ 直属子项必须是同名组件文件夹」冲突（主规格 §3.3 优先于子规格路径命名），按裁决规则调整；业务代码仍不直接 import `motion/react`。
  - **实测定稿值**（标「默认」条目回写）：TabsBar 栏高 **44px**（§6.3 区间定稿）；SettingDrawer 宽 **360px**（§6.5）；Card `bodyPadding 24` / Table `cellPaddingBlock 10`、`cellPaddingInline 16`（§4.2）；页面容器 padding 维持 **16px**（§7 复核不变）；Header 毛玻璃亮 **60%** / 暗 **78%** 透明度 + `blur(12px)`（§6.2）；Header 工具图标按钮 **36px** 圆形（§6.2）；主色发光阴影定稿 `0 4px 10px -2px <colorPrimary>/24%`，经 `--app-primary-glow` CSS 变量派生消费（§4.1）；画布色 `#F4F6F8`/`#09090B` 与卡片浅阴影取值实测通过亮暗走查（§4.1）。
  - **§4.4 对比度实测**：meadow `#00A76F`（落盘统一小写 `#00a76f`）与白字对比度 ≈**3.11** ≥3 通过，无需微调。
  - **§8 落地口径**：Sparkline 为**静态 SVG**（缓存页禁 mount 触发动效的 §10 红线优先于 §8「CSS 描边动画」示例表述）；统计卡趋势序列由 overview 既有时间序列确定性推导（启用用户按当前启用占比对增长序列等比缩放），demo 趋势窗口 7 → **14 天**补充时间序列；`DashboardOverview` 契约（§14.1）零变更。
  - **§4.5 rem 审计定稿**：壳层 rem 尺寸全部改 px（StatusResult 徽章 80px、Login 品牌区/表单列、PageLoading、DemoLoginHint）；全局 CSS 已无 rem 依赖（基准 14px 下保像素语义）。
  - **§6.3 稳定性修复**：页签栏溢出滚动箭头改为**绝对定位覆盖**（不参与 flex 布局），消除箭头显隐瞬间页签整体横移导致点击落点漂移到关闭按钮的竞态（E2E 实测捕获并根治）。
  - **§12 E2E 选择器同步**：`.ant-menu-*` → `nav[data-nav-mode]` / `getByRole('menuitem')`（自绘导航目录与叶子同为 menuitem）；启动镜像背景断言 `rgb(9, 9, 11)`；`helpers.ts` 新增 `settleRouter`（双 rAF 冲刷 pending transition），LRU 用例在连发 spaNavigate 后的页签点击前调用（既有 router POP 竞态的测试侧加固，基线在同等压力下亦存在）。
  - 两阶段交付完成：第 0 步文档衔接（主规格 v1.7 + SPEC_UI.md 头部标注）→ 依赖/资产（含 LICENSE/NOTICE）→ token v2 → 图标体系 → 壳层五件套 + 启动镜像 → PageCard 骨架逐页套用（含 §5.7 菜单管理图标列）→ Dashboard 重排 → 登录/错误页 motion 入场；`pnpm check` 各环节与 `check:demo-off` 全绿，chromium 全量 + firefox/webkit 冒烟 E2E 全绿。
- v1.1（2026-08-17）：审核修订——①纠正事实错误：`src/assets/` 本就是合法资产目录（无白名单新增）、slash-admin 参照栈无 vanilla-extract；②§5.7 重写：菜单管理页为**新增**图标列（现状无此列、demo 数据无 icon 字段），明确为 demo fixture 私有字段 + 本规格唯一列结构例外（§7 豁免），`MenuItem` 契约不变；③§5.1 明确装载路径首选「构建期预生成 IconifyJSON + glob 聚合 + addCollection」，纠正 addCollection 导出归属（`@iconify/react`，非 `@iconify/utils`），后者降为构建期待定项；④§13.2 升级为阶段一第 0 步前置交付（消除与主规格 v1.6 的「已确认」矛盾窗口），补主规格 §4.2 RouteMeta 与 §16.2 门禁清单两项衔接；⑤§4.1/§4.2 逐行标注已定/默认，§4.1 补 Firefox 滚动条口径；⑥§5.5 回退图标改为同尺寸（24/20px）；⑦§10 明确 hover 类动效禁用 motion；⑧§12 补 theme.test.ts 存量断言破坏、导航测试同目录约定、自绘导航键盘走查矩阵项；⑨§15 版本更新为当前 major（@iconify/react ^6 / motion ^13 / @iconify/utils ^3 待定）并注明以 lock 定稿；⑩§8 sparkline 落位 `features/dashboard/components/`。
- v1.0（2026-08-17）：第二轮访谈结论落盘——全面转向 slash-admin 式观感；范围=壳层五件套再设计 + 设置抽屉重做 + Dashboard 全面重排（含迷你趋势图）+ 业务页单卡片骨架，登录页仅继承+入场动效；维持 Tailwind 红线（token 翻译）；新增四依赖（@iconify/react、@iconify/utils、@fontsource-variable/inter、motion）；菜单完全自绘（无指示条、260px、虚线分隔、mini 88px 纵向+悬浮子菜单、44px 行高+副标题 caption，不分组）；图标复用 slash SVG 离线打包（local: 唯一前缀，禁运行时 CDN）；布局模式零新增（settings 零迁移）；Inter Variable + 固定 14px；色板保留 8 色、默认改 slash 绿（替换 emerald）；页签圆角卡片式；Header 64px + 毛玻璃 + 圆形按钮（滚动架构不变，毛玻璃仅质感）；不加 Cmd+K；业务页单卡片合并；motion 限错误页/登录/组件级，Activity 缓存页禁挂载动效；设置抽屉四要素（缩略图/色条/毛玻璃光斑/图标卡片）；新建本文档取代 SPEC_UI 冲突条文；沿用上轮测试验收机制；两阶段交付。
