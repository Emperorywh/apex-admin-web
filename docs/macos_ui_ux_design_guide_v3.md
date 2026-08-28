# macOS 26+ UI / UX 设计指南

> 原生规范、桌面壳适配与 Mac-first Web 实践

版本：v3.0  
更新日期：2026-08-28  
适用基线：macOS 26 及以后版本的设计语言  
适用产品：AppKit / SwiftUI 原生应用、Electron / Tauri 桌面应用、面向 Mac 用户的复杂 Web 应用、后台管理系统、生产力工具、数据系统与 AI 产品

---

## 0. 文档结论与使用边界

macOS 风格不等于：

~~~text
毛玻璃
+
圆角
+
SF Pro
+
蓝色按钮
~~~

真正接近 macOS 的产品，需要同时尊重：

~~~text
平台行为
+
窗口与工作区模型
+
菜单和命令系统
+
精确输入
+
语义视觉系统
+
可恢复性
+
无障碍
~~~

本指南不是像素级复刻规范，也不主张在所有平台上伪造系统界面。它用于回答：

> 如何让复杂软件具备真实、克制、熟悉且高效的 Mac 使用体验，并在无法使用原生组件时做有边界的近似适配？

### 0.1 参考优先级

发生冲突时，按以下顺序决策：

1. 当前版本 Apple Human Interface Guidelines
2. 当前 macOS 的系统行为与标准组件
3. AppKit / SwiftUI 官方 API 的默认行为
4. Apple 自带应用中与当前任务相符的稳定模式
5. 本指南中的工程建议
6. 产品自己的视觉偏好

不要为了维持自定义视觉，覆盖系统已经正确处理的行为。

### 0.2 三种实现层级

本指南使用三种标签区分要求：

- **原生**：AppKit / SwiftUI 应优先直接采用的系统行为。
- **桌面壳**：Electron / Tauri 等拥有独立窗口、原生菜单和系统集成能力的应用。
- **Web**：运行在 Safari、Chrome 等浏览器中的页面，只能近似部分外观与交互。
- **产品可选**：对专业软件有价值，但不是 macOS 的系统惯例。

同一条建议不能不加区分地套用到三种实现环境。

### 0.3 版本边界

Liquid Glass、悬浮 Sidebar、更新后的 Toolbar 分组、同心几何与滚动边缘效果属于 macOS 26 之后的设计语言。

如果产品需要兼容更早的 macOS：

- 优先让系统组件自动采用当前运行环境的外观。
- 不要在旧系统上手工伪造新系统材质。
- 自定义组件需要同时准备无 Liquid Glass 的标准材质降级方案。

---

## 1. macOS 设计的八项核心原则

当前 Apple 设计原则可以归纳为：

~~~text
Purpose
Agency
Responsibility
Familiarity
Flexibility
Simplicity
Craft
Delight
~~~

### 1.1 Purpose：从真实目的出发

- 明确产品为谁解决什么问题。
- 优先把核心任务做到可靠、快速和清楚。
- 每个功能都需要证明它值得占用用户的时间和注意力。
- 不要用额外界面掩盖产品目的不清的问题。

### 1.2 Agency：让用户保持控制权

用户应该知道：

- 当前在哪里。
- 当前选中了什么。
- 系统正在做什么。
- 操作是否已经生效。
- 是否可以撤销或退出。
- 长任务是否可以暂停、取消或转到后台。

推荐：

- 支持 Undo / Redo。
- 可恢复时优先软删除。
- 保留窗口、选择、筛选、滚动和展开状态。
- 避免没有出口的流程和强制线性步骤。
- 对外部发送、付款、删除、发布等高影响动作提供清楚的最后控制点。

### 1.3 Responsibility：以用户利益为先

Responsibility 不是附加的合规章节，而是产品体验的一部分。

至少做到：

- 只收集完成任务必需的数据。
- 在真正需要权限时再请求权限。
- 在请求前说明用途、范围与不授权的影响。
- 清楚区分本地处理、云端处理与第三方处理。
- 不使用误导性按钮、默认勾选或难以退出的流程。
- 对不可逆、高风险或影响他人的操作进行风险提示。
- 让用户查看、导出、更正和删除自己的数据。
- 安全失败时优先保护数据，而不是假装成功。

对于 AI 产品，还应做到：

- 标记生成内容与用户原始内容。
- 说明关键的不确定性和能力边界。
- 在执行外部副作用前让用户确认。
- 提供停止、撤销、重试和查看执行记录的能力。
- 不把模型推测伪装成已经验证的系统事实。

### 1.4 Familiarity：建立在已有认知上

用户通常已经理解：

- Sidebar 用于稳定导航。
- Toolbar 用于当前视图的常用操作。
- Menu Bar 包含应用命令。
- Secondary Click / Control-Click 打开 Context Menu。
- 双击通常打开对象。
- 拖动可以移动、复制、重排或导入内容。
- 标准快捷键在不同应用中具有稳定语义。

创新应建立在熟悉行为之上，不应通过改变基础规则制造新奇感。

### 1.5 Flexibility：适应不同用户和上下文

同一任务可以通过：

- 菜单
- 工具栏
- 键盘
- 鼠标或触控板
- Context Menu
- Drag & Drop
- 辅助技术

完成。

专业工具还应考虑：

- 多窗口与多显示器。
- 用户可调整的工具栏。
- 可隐藏、可调整宽度的 Sidebar 和 Inspector。
- 不同信息密度。
- 自定义快捷键或工作区配置。

### 1.6 Simplicity：简洁不等于极简

复杂能力可以存在，但不应同时争夺注意力。

可以保留：

- Table
- Outline
- Inspector
- Filters
- Multiple Windows
- Multiple Selection
- Advanced Settings

应该删除：

- 重复标题。
- 无意义容器。
- 无意义边框与阴影。
- 只有装饰作用的 Badge 和背景色。
- 为追求“高级感”添加的光晕、渐变与动画。

### 1.7 Craft：认真处理每个细节

Craft 包括：

- 图标视觉重量一致。
- 文本基线准确。
- 控件状态完整。
- 窗口缩放没有跳变。
- 长任务不阻塞界面。
- 错误说明清楚且可解决。
- 动画具有来源、去向与连续性。
- 在系统更新后持续维护界面质量。

### 1.8 Delight：让体验具有人性

Delight 不是彩带、弹跳或随机装饰。

它来自：

- 操作结果符合预期。
- 系统及时但不过度地回应。
- 用户不害怕尝试。
- 复杂任务依然流畅。
- 产品拥有适合自身目的的语气与细节。

---

## 2. 设计目标：高信息密度与低视觉噪音

Mac 是长时间生产力工作的主要设备之一。高信息密度并不违背 Apple 的设计方向。

Finder、Xcode、Final Cut Pro、Logic Pro 等工具都能同时呈现大量信息。真正目标是：

> High Information Density + Low Visual Noise

### 推荐

- 保留完成任务需要的数据。
- 使用稳定结构和清楚排版支持扫描。
- 让 Table、Outline、Canvas 与 Inspector 按任务同时存在。
- 用选择状态和上下文命令减少重复控件。
- 允许用户根据工作方式调整密度和布局。

### 避免

- 每块内容都变成 Card。
- 通过巨大行高制造虚假的“Apple 感”。
- 多层 Breadcrumb、Tabs 与 Sidebar 同时导航。
- 大量高饱和色抢夺注意力。
- 把所有操作都做成永久可见的 Filled Button。

Density follows task：

~~~text
Settings       → Comfortable
Finder         → Medium
Xcode          → Dense
Trading Tool   → Very Dense
~~~

密度应通过真实任务测试决定，而不是由品牌风格决定。

---

## 3. macOS Desktop Workspace 模型

传统 Web 后台常以 Page 为中心：

~~~text
Route
└── Page
    └── Card
        └── Form / Table
~~~

Mac 生产力软件更适合以 Workspace 为中心：

~~~text
Application
├── Menu Bar
├── Window
│   ├── Toolbar
│   └── Workspace
│       ├── Sidebar / Navigation
│       ├── Main Content
│       └── Inspector / Utility
└── Transient UI
    ├── Menu
    ├── Popover
    ├── Sheet
    └── Alert
~~~

核心状态链：

~~~text
位置
→ 选择
→ 当前内容
→ 可用命令
→ 操作反馈
~~~

切换视图或对象时，应尽量保留：

- Scroll Position
- Selection
- Search / Filter
- 展开的 Outline
- 列宽与排序
- Inspector 可见状态
- Window Size / Position
- 当前工作区与最近文档

---

## 4. Window：窗口是一级设计对象

### 4.1 原生窗口要求

**原生**

- 使用系统窗口框架与窗口控制。
- 支持移动、缩放、最小化、全屏与系统平铺。
- 让系统处理交通灯按钮、圆角、阴影与安全区域。
- 不制作看似相同但行为不同的假窗口控件。
- 设置合理的初始尺寸与最小尺寸。
- 只有任务确实需要时才限制最大尺寸。

**桌面壳**

- 优先使用操作系统提供的窗口和菜单能力。
- 如果定制 Title Bar，必须正确处理拖动区、交通灯位置、全屏、辅助功能和窗口激活状态。
- 视觉自定义不能破坏系统窗口管理。

**Web**

- 浏览器窗口已经是系统窗口。
- 不要在页面内部伪造交通灯、Title Bar 或第二套窗口边框。
- 页面中的“工作区”只是浏览器内容，不应假装拥有系统窗口能力。

### 4.2 窗口状态

macOS 窗口至少需要考虑：

- **Main Window**：应用最主要的前景窗口。
- **Key Window**：当前接受键盘输入的活动窗口。
- **Inactive Window**：不在前景或不活动的窗口。

活动与非活动状态应在以下内容中得到正确反映：

- 窗口控制颜色。
- Selection 强调程度。
- Vibrancy / Material。
- Toolbar 和控件可用状态。
- 键盘焦点。

不要让后台窗口继续使用与 Key Window 完全相同的高强调选择色。

### 4.3 多窗口

适合新窗口的情况：

- 撰写独立内容。
- 并排比较两个对象。
- 保持一个上下文，同时处理另一个任务。
- Inspector 或工具需要跨多个文档持续可见。

避免：

- 每次导航都打开新窗口。
- 用窗口代替基本信息架构。
- 自动制造大量难以管理的窗口。

应该在 File Menu 或 Context Menu 中提供“在新窗口中打开”等可发现入口。

### 4.4 全屏

- 使用系统提供的 Full Screen。
- 不自动让用户退出全屏。
- 全屏后仍应能访问完成任务所需的核心控件。
- 如果隐藏 Toolbar 或 Navigation，需要提供熟悉的恢复方式。
- 离开全屏或切换应用后，返回时恢复上下文。

### 4.5 状态恢复

适合恢复：

- Window Size / Position
- Sidebar / Inspector Width
- 展开与隐藏状态
- 当前文档或工作区
- Scroll Position
- Selection 与 Search

恢复不能泄露敏感内容，也不能在状态已经失效时强行恢复。

---

## 5. Menu Bar 与统一 Command System

Menu Bar 是 macOS 应用的核心，不是可选装饰。

成熟应用应建立统一命令层：

~~~text
Command
├── Menu Bar
├── Toolbar
├── Context Menu
├── Keyboard Shortcut
├── Touch Bar / Service（如适用）
└── Command Palette（产品可选）
~~~

所有入口调用同一个命令定义，共享：

- 可用状态。
- 当前 Selection。
- 权限检查。
- Undo 名称。
- 执行结果。
- Keyboard Shortcut。

### 5.1 标准菜单结构

**原生 / 桌面壳**通常应提供：

~~~text
App
File
Edit
View
Window
Help
~~~

根据产品需要增加领域菜单，但不要改变用户熟悉的标准命令位置。

### 5.2 Menu Bar 应覆盖命令

- Menu Bar 应包含用户在应用中可以执行的主要命令。
- Context Menu 是与当前对象相关的快捷入口，不应成为重要功能的唯一入口。
- Toolbar 是常用命令的快速入口，不应承载所有命令。
- 菜单项需要随当前选择、权限和窗口状态正确启用或禁用。
- 菜单标签使用明确动词，并在需要时显示快捷键。

### 5.3 Web 边界

浏览器 Web 无法拥有完整的 macOS Menu Bar。可以提供应用内命令菜单，但必须：

- 不伪装成系统菜单栏。
- 不接管浏览器保留命令。
- 为键盘用户提供清楚、可发现的命令入口。
- 允许浏览器的打印、关闭标签页、刷新、地址栏等行为正常工作。

---

## 6. Toolbar：当前视图的上下文工具

Toolbar 用于：

- 定位当前视图。
- 导航。
- 搜索。
- 当前内容的高频命令。

它不是传统后台的全局信息垃圾桶。

推荐结构：

~~~text
[Sidebar] [Back] [Forward] [View Title]

                 [View Options] [Search] [Share] [Add] [More]
~~~

### 6.1 布局职责

- Leading：返回、前进、Sidebar Toggle、视图标题。
- Center：常用且与当前视图相关的控件。
- Trailing：Search、Share、Add、Inspector、More 等操作。
- 窗口窄时，由系统管理可溢出的 Toolbar Items。

### 6.2 System Overflow 与 More Menu

两者不是同一件事：

- **System Overflow**：窗口变窄后，系统自动收纳放不下的项目。
- **More Menu**：设计时主动放入的低频次要操作。

**原生**

- 不要手工复制系统 Overflow。
- 为 Toolbar Item 设置正确优先级。
- 在适合的专业应用中允许用户增删、移动和恢复 Toolbar Items。

### 6.3 Toolbar 标签与图标

- 熟悉且唯一的动作可以使用 Symbol。
- 语义不明确时使用文本或图标加文本。
- Icon-only 控件仍需要 Tooltip 和无障碍标签。
- 不要因为空间足够就把所有命令放进 Toolbar。
- 不要在同一 Toolbar 中给多个普通动作添加强调色背景。

### 6.4 与传统 Admin Header 的区别

以下内容更适合全局账户或应用层：

- Avatar
- Account
- Organization Switcher
- Notifications
- Help

以下内容更适合 Workspace Toolbar：

- New
- Search
- Filter
- View
- Sort
- Share
- Export
- Inspector
- More

---

## 7. Sidebar：稳定导航与位置感

Sidebar 的主要作用是建立稳定位置感，而不是展示菜单卡片。

### 7.1 推荐

- 图标与文本使用一致的语义。
- 当前项目有清楚但克制的 Selection。
- 层级通过 Indent 与 Disclosure Control 表达。
- 使用少量 Group Heading 和 Divider。
- 支持 Show / Hide。
- 窗口变窄时可以自动隐藏，并保留恢复入口。
- 更深层次的信息使用第二列表列或 Split View，而不是无限缩进。

### 7.2 当前 macOS 视觉行为

在 macOS 26+：

- Sidebar 位于 Liquid Glass 功能层。
- 内容可以延伸到 Sidebar 下方。
- 较大 Sidebar 会提高不透明程度以保持可读性。
- Sidebar 图标通常响应用户 Accent Color。
- Sidebar 行高、文本和图标尺寸可以随系统 Sidebar Size 改变。

因此：

- 不要写死所有 Sidebar 图标颜色。
- 不要让背景内容破坏文字对比度。
- 不要把关键操作放在可能被窗口底边遮挡的 Sidebar 底部。

### 7.3 避免

- 每个菜单一张 Card。
- 每个层级都使用大标题。
- 选中项使用巨大高饱和背景。
- 把复杂表单塞进 Sidebar。
- 在原生 Mac 应用中套用移动端 Drawer 作为默认导航。

---

## 8. Split View、Content 与 Inspector

### 8.1 Split View

典型结构：

~~~text
Sidebar | Content List | Detail / Canvas | Inspector
~~~

不要求所有列同时存在。根据任务选择两列或三列。

要求：

- 分隔条可以拖动。
- 当前导航路径保持 Selection。
- 窗口缩小时，优先保留主任务内容。
- 适合时支持跨 Pane Drag & Drop。
- Pane 显示或隐藏后保持原有状态。

### 8.2 Content Area

真实内容应占据最大的视觉面积。

优先使用：

1. Typography
2. Spacing
3. Background Difference
4. Divider
5. Standard Material
6. Shadow

进行分组。

不要默认形成：

~~~text
Page
└── Card
    └── Card Header
        └── Card Body
            └── Table Card
~~~

Card 不是禁止使用；只有在它能清楚表达独立对象、可移动单元或强分组关系时才使用。

### 8.3 Inspector

Inspector 用于显示和编辑当前 Selection 的属性，并在 Selection 改变时自动更新。

适合：

- Metadata
- Style
- Configuration
- Object State
- Advanced Properties

Inspector 可以是：

- Split View 的尾部 Pane。
- 可显示或隐藏的辅助区域。
- 独立浮动 Panel。

不要把以下概念混为一谈：

- **Inspector**：内容随当前 Selection 改变。
- **Info Window**：固定展示某一个对象的信息。
- **Panel**：浮在应用窗口上方的辅助窗口。
- **Sheet**：相对于一个父窗口的模态任务。

Inspector 可以减少不必要 Modal，但不能替代所有需要集中完成或确认的任务。

---

## 9. Popover、Sheet、Alert 与独立窗口

选择容器时，不使用固定“打断等级”，而是根据任务关系判断。

### 9.1 Popover

适合：

- 少量相关信息。
- 快速设置。
- 日期或范围选择。
- 简单筛选。
- 由某个明确控件触发的短任务。

要求：

- 箭头尽量指向 Trigger。
- 一次只显示一个 Popover。
- 不级联 Popover。
- 自动关闭时保存非模态编辑，除非用户明确选择 Cancel。
- 内容变复杂或需要长期保留时，考虑可分离 Panel、Inspector 或 Window。

### 9.2 Sheet

Sheet 用于与当前窗口上下文紧密相关的短任务。

在 macOS 中：

- Sheet 相对于父窗口始终是 Modal。
- Sheet 出现时不能操作父窗口。
- 用户仍可切换和操作应用中的其他窗口。
- Sheet 应保持任务范围清楚且尽量简短。

适合：

- Save / Export 的必要参数。
- 与当前文档相关的创建或编辑。
- 完成动作前必须提供的信息。

### 9.3 Alert

Alert 仅用于用户现在就需要知道的关键、最好可操作的信息。

适合：

- 不可逆的数据破坏风险。
- 用户必须解决后才能继续的问题。
- 异常且重要的状态改变。

避免：

- 用 Alert 告知普通成功。
- 用 Alert 展示只有“知道了”的信息。
- 启动应用后立即弹出多个 Alert。
- 对可 Undo 的常见删除反复确认。

### 9.4 独立窗口

当任务：

- 需要长期保留。
- 包含多个步骤。
- 需要与父内容并排查看。
- 可能同时处理多个对象。

优先考虑独立窗口，而不是不断扩大 Sheet。

“Dialog”只是泛称。设计文档应尽量写明具体使用 Alert、Sheet、Popover、Panel 还是 Window。

---

## 10. Tabs：先区分四种不同概念

### 10.1 Window Tabs

用于把多个文档或工作区放入同一个系统窗口容器。

适合：

- 多文档应用。
- 用户主动合并的多个窗口。
- 每个 Tab 都有相对完整的窗口级状态。

### 10.2 Tab View

用于同一区域中互斥的相关内容面板。

要求：

- 各 Tab 内容彼此相关。
- 每个 Pane 内的控件只影响自身内容。
- 标签使用清楚的名词或短语。
- 一般避免达到六个或更多 Tab。

### 10.3 Tab Bar

主要用于顶层区域导航，不用于执行动作。

不要把 Toolbar Action 放进 Tab Bar。

### 10.4 Workspace Tabs

**产品可选**

复杂 Web 后台或专业工具可以使用自定义 Workspace Tabs，例如同时打开多个订单、查询或对象。

每个 Workspace Tab 可以记住：

- Scroll
- Selection
- Filter
- Search
- Local Edit State
- Inspector State

但它不是自动成为“macOS 原生模式”。需要额外保证：

- Close、Reopen、Reorder 行为稳定。
- 未保存状态清楚。
- 键盘切换与 Context Menu 完整。
- 不与 Sidebar、一级 Tabs、二级 Tabs 形成多层导航迷宫。

---

## 11. Search、Find、Filter 与 Command Palette

### 11.1 Find 与 Search

- **Find**：在当前文档、页面或内容范围内查找，标准入口通常是 ⌘F。
- **Search**：在集合、来源或应用范围内检索内容。
- **Filter**：缩小当前已有结果的范围。

Search 可以同时提供 Scope Control、Token 和建议，因此 Search 与 Filter 的能力可以组合，但语义必须清楚。

### 11.2 Search Field 位置

- 全局或多来源 Search 常放在 Toolbar 尾部。
- 过滤 Sidebar 内容时，可以放在 Sidebar 顶部。
- 搜索本地列表时，可以放在列表上方。
- 清空 Search 后，应清楚恢复正常浏览状态。
- 窗口缩放时，Search 仍应处于合乎上下文的位置。

### 11.3 快捷键

- ⌘F：打开当前内容的 Find。
- ⌥⌘F：标准语义是跳到 Search Field。
- 不要把 ⌘P 定义成 Quick Open；⌘P 是 Print。

如果产品提供 Quick Open，可以选择：

- 与领域习惯一致、没有系统冲突的快捷键。
- 在菜单中显示该快捷键。
- 为专业用户提供自定义能力。

### 11.4 Command Palette

**产品可选**

Command Palette 适合：

- 快速跳转。
- 搜索命令。
- 打开对象。
- 执行低频但明确的功能。

它不是 macOS 系统标准，也不能替代：

- Menu Bar
- Toolbar
- Context Menu
- 正常导航

⌘K 是部分产品的约定，不是平台通用快捷键。使用前必须检查冲突，并让入口可发现。

---

## 12. Selection Model

桌面软件必须把 Selection 作为明确状态设计。

### 12.1 常见规则

~~~text
Click            → 单选或激活控件
Shift-Click      → 范围选择
Command-Click    → 非连续多选
Command-A        → 在当前焦点范围内全选
Arrow Keys       → 在当前集合内移动选择
Esc              → 取消当前临时状态或操作
~~~

### 12.2 Selection 与 Activation

不要把“选中对象”和“执行默认动作”混为一谈。

- 单击通常选择。
- 双击通常打开对象或进入编辑。
- Return 的行为取决于上下文；它不能被全局规定为“打开”。
- 在 Finder 中，Return 可能代表 Rename。
- 默认按钮可以响应 Return，但文本输入区域需要避免冲突。

### 12.3 多选后的界面

- Toolbar 可以显示批量命令。
- Inspector 可以显示共同属性或混合值。
- Context Menu 需要说明动作影响多个对象。
- 删除、移动、导出等命令应使用完整 Selection。
- 非活动窗口中的 Selection 应降低强调程度。

---

## 13. Keyboard First，但必须尊重系统快捷键

键盘效率是 macOS 体验的重要组成部分，但“支持键盘”不等于随意注册 Command 组合。

### 13.1 标准快捷键

| 快捷键 | 标准语义 | 说明 |
|---|---|---|
| ⌘C / ⌘V / ⌘X | Copy / Paste / Cut | 作用于当前 Selection 或输入焦点 |
| ⌘Z / ⇧⌘Z | Undo / Redo | 应在 Edit Menu 中显示具体动作名 |
| ⌘A | Select All | 只作用于当前焦点范围 |
| ⌘F | Find | 当前文档或内容范围 |
| ⌥⌘F | Focus Search Field | 适用于应用内 Search Field |
| ⌘G / ⇧⌘G | Find Next / Previous | 与 Find 配套 |
| ⌘N | New | 根据应用语义创建新文档或窗口 |
| ⌘O | Open | 打开文档或对象 |
| ⌘S | Save | 文档型应用的保存 |
| ⌘P | Print | 不应默认改成 Quick Open |
| ⌘W | Close Window / Tab | Web 页面应保留浏览器行为 |
| ⌘, | Settings | 原生或桌面壳应用 |
| ⌘Q | Quit | 原生或桌面壳应用 |
| ⌃⌘F | Enter Full Screen | 使用系统全屏能力 |
| Esc | Cancel Current Action | 不保证关闭所有类型界面 |

### 13.2 自定义快捷键

- 不复用仍有意义的标准快捷键。
- 高频领域命令才值得分配快捷键。
- 菜单项中显示快捷键。
- 保持修饰键使用逻辑一致。
- 专业应用可以支持用户自定义。
- 测试不同键盘布局与输入法。

### 13.3 Full Keyboard Access

核心功能必须能通过键盘完成：

- Tab / Shift-Tab 访问焦点。
- 焦点顺序与视觉顺序一致。
- Focus Ring 清楚。
- Arrow Keys 在集合、菜单和表格中按预期导航。
- VoiceOver 开启后，键盘操作仍然有效。

### 13.4 Web 快捷键边界

浏览器 Web 不应轻易覆盖：

- ⌘L 地址栏
- ⌘R 刷新
- ⌘T 新标签页
- ⌘W 关闭标签页
- ⌘P 打印
- ⌘, 浏览器设置

只有在用户明确进入专用编辑器上下文、不会造成意外且提供退出方式时，才考虑拦截部分行为。

---

## 14. Pointer、Hover、Tooltip 与 Context Menu

Mac 用户通常会组合鼠标或触控板与键盘。

### 14.1 Pointer

- 使用系统 Pointer Style 表达文本、拖动、调整大小、链接等语义。
- Resize Handle 与实际可调整方向一致。
- 不隐藏系统指针来制造无必要的自定义体验。
- 不重新定义系统级触控板手势。

### 14.2 Hover

Hover 可用于：

- Row Highlight
- Tooltip
- Reveal Secondary Action
- Drag Handle
- Resize Handle
- Preview

但：

- 关键动作不能只在 Hover 时存在。
- Hover 不能成为唯一状态说明。
- 触控板、键盘和辅助技术仍需访问同一能力。

### 14.3 Tooltip

- 简短说明控件会做什么。
- Icon-only Button 必须提供。
- 不在 Tooltip 中写长篇教程。
- Tooltip 不能代替无障碍标签。

### 14.4 Context Menu

Context Menu 适合当前对象或 Selection 的高频动作：

~~~text
Open
Rename
Duplicate
Move
Share
Export
Inspect
Delete
~~~

要求：

- 支持 Secondary Click 和 Control-Click。
- 命令与 Menu Bar、Toolbar 共用定义。
- 危险操作放在末尾并正确标记。
- 重要命令不能仅存在于 Context Menu。

---

## 15. Drag & Drop

Drag & Drop 是真实桌面体验的一部分。

适合：

- 文件导入。
- 列表、Tab 与 Outline 重排。
- 把对象移动到分组。
- 跨 Pane 操作。
- 从应用拖出内容。
- 从其他应用接收内容。

### 15.1 基本语义

通常：

- 同一容器内 Drop 表示移动。
- 不同容器之间可能表示复制。
- 跨应用 Drop 通常表示复制。
- Modifier Key 可以改变 Move / Copy 等语义。

具体产品必须通过 Pointer Badge、Drag Preview 和文字说明让结果可预期。

### 15.2 必要反馈

- Drag Preview
- Valid Drop Target
- Invalid Drop Target
- Insertion Position
- Move / Copy Indicator
- Multi-item Count
- Drop Completion

### 15.3 可恢复与无障碍

- 优先让 Drag & Drop 可以 Undo。
- 不可 Undo 的 Drop 在必要时确认。
- 提供菜单或按钮作为拖动的替代操作。
- 支持 Full Keyboard Access、VoiceOver 或辅助技术完成同一任务。

---

## 16. Undo、Redo、Autosave 与可恢复性

专业软件不应让用户害怕尝试。

推荐模式：

~~~text
Action
→ Immediate Result
→ Clear Feedback
→ Undo Available
~~~

### 16.1 Undo / Redo

- 放在 Edit Menu 顶部。
- 使用 ⌘Z 与 ⇧⌘Z。
- 菜单标签说明具体动作，例如 Undo Rename。
- 连续编辑需要合理合并 Undo Group。
- Undo 后 Redo 状态正确更新。

### 16.2 Confirmation

可逆且结果符合预期的动作：

- 通常不需要 Alert。
- 可以直接执行并提供 Undo。

不可逆、罕见且高风险的动作：

- 使用明确 Alert。
- 按钮说明实际结果。
- Destructive Action 不能成为 Primary Default Button。

### 16.3 Autosave 与状态

- 自动保存不能让用户误以为尚未保存。
- 同步、上传与本地保存需要区分。
- 冲突不能静默覆盖。
- 失败时保留用户输入并提供恢复路径。

---

## 17. Typography

macOS 通过排版建立层级，但原生字号不应被一套固定 Web Scale 取代。

### 17.1 原生原则

- SF Pro 是 macOS 系统字体。
- macOS 常规默认文本尺寸为 13 pt。
- 一般建议不要低于 10 pt。
- 优先使用系统字体 API、标准控件字体和语义用途。
- 不要为模拟系统而把所有文字强行设置为同一个字号。
- 避免 Ultralight、Thin、Light 等在小字号下难以阅读的字重。

原生应用应优先使用：

- System Font
- Label Font
- Control Content Font
- Menu Font
- Title Bar Font
- User Font
- Monospaced User Font

而不是把每个字号写成视觉常量。

### 17.2 Web 系统字体栈

Mac-first Web 可以使用：

~~~css
/*
 * 使用操作系统提供的界面字体，不在页面中伪造或重新分发系统字体文件。
 * 后续字体仅作为系统字体不可用时的跨平台降级。
 */
font-family:
  -apple-system,
  BlinkMacSystemFont,
  "Helvetica Neue",
  Arial,
  sans-serif;
~~~

### 17.3 Web 近似层级

以下只是一套起始值，不是 Apple 官方尺寸：

~~~text
Content / Workspace Heading   20–28 px / Semibold
Section Heading               17–20 px / Semibold
Body                          13–15 px / Regular
Primary Table Text            13–14 px / Regular or Medium
Secondary Text                12–13 px / Regular
Caption                       11–12 px / Regular
~~~

注意：

- Toolbar / Window Title 通常不应使用 24–30 px 的大型网页标题。
- 内容标题可以较大，但它属于 Content，不等于系统 Title Bar。
- 数字表格使用 Tabular Numerals。
- 长文本需要合适行高和段落宽度。
- 中英文混排需要单独校准基线、标点和字重。

---

## 18. Color 与 Semantic Color

颜色主要承担语义，而不是装饰。

### 18.1 原生动态颜色

原生应用应使用动态系统颜色，例如：

- Label Color
- Secondary Label Color
- Tertiary Label Color
- Window Background Color
- Control Background Color
- Separator Color
- Selected Content Background Color
- Unemphasized Selected Content Background Color
- Control Accent Color

不要把视觉稿中观察到的 RGB 值当作系统规范。系统颜色会根据：

- Light / Dark
- Increase Contrast
- Active / Inactive Window
- Desktop Tinting
- Accent Color
- 系统版本

动态变化。

### 18.2 Accent Color

- 用户可以在系统中选择 Accent Color。
- 原生应用应让标准控件自动响应用户选择。
- 品牌色不应覆盖所有系统交互色。
- 固定色只用于确实具有稳定业务语义的内容。
- 不要把所有可点击文字、Sidebar Icon 和 Primary Button 永久写死为蓝色。

### 18.3 状态颜色

常见映射可以作为起点：

~~~text
Accent   → 主要交互或选择
Green    → 成功、正常或正向状态
Yellow   → 警告或需要注意
Red      → 错误、危险或破坏
Gray     → 次要、非活动或禁用
~~~

但颜色语义需要考虑：

- 文化和地区差异。
- 领域习惯，例如金融涨跌色。
- 当前上下文。
- 色觉差异。

状态不能只依赖颜色，还要结合 Label、Symbol、Shape 或 Position。

### 18.4 Web Token 边界

- 固定色只能作为无法读取系统语义色时的 Fallback。
- Fallback 不是“真实 macOS 颜色值”。
- Light、Dark、Increased Contrast 都需要独立验证。
- 不要把旧版 iOS 的 Separator RGBA 当作通用 macOS Token。

---

## 19. Materials 与 Liquid Glass

### 19.1 两类材质

当前 Apple 平台区分：

- **Liquid Glass**：主要用于 Controls 与 Navigation 的功能层。
- **Standard Materials**：主要用于 Content Layer 内部的结构和层级。

核心关系：

~~~text
Content Layer
↑
Functional Layer / Controls
↑
Transient Presentation
~~~

### 19.2 Liquid Glass 适用范围

适合：

- Toolbar
- Sidebar
- Floating Controls
- Popover
- Menu
- Alert
- Sheet
- 少量顶层自定义控件

不适合：

- 每一个 Card。
- Table Cell。
- 主要阅读背景。
- 大量嵌套内容容器。
- 纯装饰光斑。

### 19.3 Regular 与 Clear

- Regular 适合文字较多、背景复杂或需要稳定可读性的控件。
- Clear 只适合照片、视频等视觉丰富且默认对比度可控的背景。
- Clear 上方内容需要根据背景亮度考虑 Dimming。
- 不要因为 Clear 更“通透”就默认使用。

### 19.4 原生优先

**原生**

- 优先使用标准 App Structure、Toolbar、Sidebar、Search、Controls 和 Presentation。
- 系统组件会自动获得当前系统版本正确的 Liquid Glass 行为。
- 只有最重要、位于顶层功能层的自定义控件才考虑自定义 Glass Effect。
- 多个相邻 Glass Element 需要正确分组，避免相互错误采样。

**桌面壳 / Web**

- backdrop-filter 只能模拟 Blur，不能复现系统的动态采样、折射、光照、层级和无障碍降级。
- 不应宣称 CSS Blur 等同于 Liquid Glass。
- 必须提供 Reduce Transparency 后的不透明背景。
- 背景内容滚动时持续测试对比度。

### 19.5 macOS 26+ 结构变化

当前设计语言强调：

- Sidebar 作为悬浮 Glass Pane。
- Toolbar Item 自动形成 Glass Group。
- Inspector 可以使用 Edge-to-edge Glass。
- 内容延伸到 Sidebar 与 Toolbar 下方。
- Scroll Edge Effect 保持滚动内容与控件之间的可读性。
- 工具栏、菜单、Sheet 和 Alert 与其触发源保持空间连续性。

---

## 20. Concentricity 与几何系统

当前 macOS 设计不只是“多用圆角”，而是强调形状嵌套时的同心关系。

### 20.1 三类形状

- **Fixed Shape**：固定圆角。
- **Capsule**：半径等于高度的一半。
- **Concentric Shape**：根据父容器半径减去内边距计算。

### 20.2 macOS 密度差异

- Mini、Small、Medium 控件在高密度桌面环境中通常继续使用 Rounded Rectangle。
- Large 与 Extra Large 控件可以使用 Capsule 强调。
- Capsule 不应覆盖所有密集型 Inspector、Toolbar 和 Table Control。
- 控件靠近 Window Corner 时，需要尊重系统 Corner-avoiding Layout Guide。

### 20.3 Web 适配

Web 可以为不同层级定义 Radius Token，但必须：

- 父子半径与内边距保持合理关系。
- 不把所有容器设置为 16 px 或 20 px。
- 密集区域使用更克制的半径。
- 窗口、Popover、Control 和 Badge 具有不同层级。

---

## 21. Border、Divider、Background 与 Depth

视觉分组的推荐优先级：

~~~text
Spacing
→ Typography
→ Background Difference
→ Divider
→ Standard Material
→ Shadow
~~~

### Divider

适合：

- Table Row。
- Toolbar 与 Content 边界。
- Split View Pane。
- Inspector 边界。
- 需要提高跨列扫描准确性的区域。

要求：

- 使用系统 Separator Color。
- 在 Increase Contrast 下增强。
- 不使用完整边框包围每个普通内容块。

### Shadow

Shadow 只用于表达空间关系：

- Window 层级。
- Popover、Menu、Panel 等浮层。
- Drag Preview。
- 临时升起的内容。

不要用 Shadow 证明“这里是一张 Card”。

### Background

- 原生窗口优先使用系统 Background Color 和 Material。
- 内容区域可以使用不同背景表达 Pane。
- Dark Mode 下 Elevated Background 不是 Light Mode 的简单反色。
- Card 在表达独立对象、集合或可移动单元时可以使用。

---

## 22. Iconography 与 SF Symbols

### 22.1 原生

- 优先使用 SF Symbols。
- 图标与相邻文字匹配 Weight 和 Scale。
- 使用熟悉 Symbol 表达标准动作。
- 自定义 Symbol 需要匹配系统的细节、视觉重量、对齐与透视。
- 不把受限制的 Apple 产品 Symbol 用于 Logo 或品牌。

### 22.2 Web

Lucide 等线性图标可以作为近似，但它们不是 SF Symbols。

要求：

- 全产品使用一套 Icon System。
- 统一 Size、Stroke、Optical Weight 和 Baseline。
- 不混用 Emoji、彩色 SVG、Filled Icon 与多套线性图标。
- 熟悉动作保持稳定语义。

### 22.3 标签与无障碍

- 图标语义不明确时显示文本。
- Icon-only Button 提供 Tooltip。
- 所有自定义图标提供 VoiceOver / Accessible Name。
- 不把颜色变化作为唯一状态。

---

## 23. Spacing、Layout Rhythm 与点击区域

### 23.1 原生

- 优先使用系统控件、Layout Guide、Safe Area 和标准间距。
- 不把自定义 4 px Scale 当作 Apple 官方规范。
- Sidebar、Toolbar、Form 和 Sheet 使用系统提供的尺寸与布局行为。

### 23.2 Web 起始 Scale

Web 可以使用：

~~~text
4
8
12
16
20
24
32
40
48
64
~~~

它只是工程一致性工具，不是必须使用的 macOS 数值。

可作为起点：

~~~text
Icon ↔ Label          6–8
Control Gap           8
Related Fields        8–12
Section Internal      12–16
Section Gap           20–32
Workspace Margin      20–32
~~~

最终应以：

- 可读性。
- 扫描效率。
- 点击准确性。
- 窗口尺寸。
- 任务密度。

为准。

### 23.3 点击区域

macOS 控件：

- 推荐默认点击区域至少 28 × 28 pt。
- 最低不应小于 20 × 20 pt。
- 相邻控件需要足够间隔，避免误操作。

视觉图标可以小于点击区域，但可点击区域不能因此缩小。

---

## 24. Tables、Lists、Collections 与 Outlines

### 24.1 Table

适合：

- 多列属性。
- 可排序的数据。
- 需要横向比较的数据。
- 生产力与管理任务。

推荐：

- Column Heading 使用名词或短名词。
- 允许点击标题排序。
- 已排序列再次点击时反向排序。
- 在数据宽度变化明显时允许调整列宽。
- 数字右对齐或按小数点对齐。
- Secondary Text 降低视觉重量。
- 支持 Keyboard Navigation。
- 需要时支持 Multi-selection。
- 宽表格可考虑 Alternating Row Colors。

不要机械删除所有 Grid Line；是否使用 Divider 取决于扫描任务。

### 24.2 List

适合：

- 扁平集合。
- 消息。
- 文件。
- 简短任务。
- 单列导航。

导航型 List 应持续显示当前 Selection；一次性选项列表可以使用短暂高亮后显示 Checkmark。

### 24.3 Outline

用于层级数据：

- 文件结构。
- 系统结构。
- 设备树。
- 项目层级。

要求：

- 层级主要放在第一列。
- 使用 Disclosure Triangle。
- 使用 Indent 表达深度。
- 非层级数据使用 Table，不要强行使用 Outline。

### 24.4 Collection

当项目：

- 尺寸差异较大。
- 主要由图像构成。
- 需要网格布局。
- 具有可移动的独立单元。

可以使用 Collection，而不是把所有内容塞进 Table。

---

## 25. Buttons 与 Controls

### 25.1 原生 Button Role

系统 Button Role 包括：

- Normal
- Primary
- Cancel
- Destructive

Primary 表示最可能选择的默认动作，通常使用 Accent Color，并可以响应 Return。

规则：

- 一个临时视图通常只有一个 Primary。
- Destructive Button 不能同时作为 Primary。
- 按钮 Label 应说明实际动作。
- Cancel 提供安全退出。

“Secondary”和“Tertiary”可以描述视觉层级，但不是 macOS 正式 Button Role。

### 25.2 选择正确控件

- Checkbox：多个彼此独立的布尔选项。
- Radio Group：少量互斥选项。
- Pop-up Button：从列表中选择一个值。
- Pull-down Button：显示一组命令。
- Segmented Control：切换少量视图或模式。
- Toggle / Switch：立即生效的开关状态。
- Text Field：需要键盘输入的内容。
- Stepper / Slider：连续或步进调整。

不要因为视觉更简洁，把语义不同的控件都改成自定义 Pill Button。

### 25.3 Toolbar 与 Form

- Toolbar 中熟悉动作可以使用 Symbol。
- Form 中关键动作通常保留文字 Label。
- 不要让一屏出现几十个 Filled Accent Button。
- Disabled 状态仍需可辨认，但不能与 Enabled 状态混淆。
- Pressed、Hover、Focus、Selected、Disabled、Default 状态必须完整。

---

## 26. Feedback、System Status 与 Progress

macOS 没有通用的：

~~~text
Inline
→ Toast
→ Popover
→ Banner
→ Sheet
→ Dialog
~~~

官方打断层级。

反馈方式应匹配信息的重要程度与用户下一步。

### 26.1 常规成功

普通操作通常应按预期完成，不需要额外庆祝：

- Copy
- Save
- Refresh
- Sort
- Filter

适合：

- 控件状态变化。
- 内容立即更新。
- 菜单项或 Toolbar 状态更新。
- 必要时提供短暂、非打断的上下文状态。

不要为每次成功显示 Toast。

### 26.2 重要成功

当动作：

- 影响较大。
- 需要较长时间。
- 结果不在当前界面可见。
- 用户需要确认最终状态。

可以提供明确完成反馈。

### 26.3 错误

错误反馈需要说明：

- 发生了什么。
- 哪些内容受到影响。
- 用户可以做什么。
- 输入是否已保留。
- 是否可以重试或恢复。

可在当前上下文解决的问题优先 Inline Error；只有关键且必须立即处理的问题才使用 Alert。

### 26.4 Progress

- 时长已知：优先 Determinate Progress。
- 时长未知：使用 Indeterminate Progress。
- 局部任务：在局部显示，不锁住整个窗口。
- 长任务：显示状态，并在可行时支持 Cancel、Pause 或后台继续。
- 进度不能长期停在某个百分比却没有说明。
- 卡住时给出原因和解决方案。

### 26.5 Skeleton

Skeleton 更偏 Web 模式。

只有当内容结构已知且不会制造明显布局跳变时才使用。原生应用优先采用标准 Progress Indicator 和真实占位状态。

---

## 27. Motion

macOS Motion 强调：

- Continuity
- Origin
- Destination
- Physicality
- Restraint

动画需要回答：

~~~text
它从哪里来？
它为什么出现？
它会到哪里去？
~~~

适合：

- Inspector 从相邻边缘展开。
- Popover 与 Trigger 保持空间关系。
- Sheet、Menu、Alert 从触发源自然呈现。
- Selection 与 Detail 变化保持连续。
- Drag Preview 与 Drop Result 对应。

避免：

- 所有组件同时弹跳。
- 大面积无来源缩放。
- 把 Blur 当作每次过渡的必选项。
- 动画阻塞输入。
- 在 Reduce Motion 下仍保留大幅移动。

Reduced Motion 后仍需通过状态、文字和布局表达完整信息。

---

## 28. Light Mode、Dark Mode 与系统外观

Dark Mode 不是简单反色。

需要重新校准：

- Background Hierarchy
- Text Level
- Separator
- Material
- Shadow
- Hover
- Selection
- Accent
- Image / Icon

### 原则

- 尊重系统 Appearance。
- 优先使用动态系统颜色。
- 自定义颜色提供 Light、Dark 和 Increased Contrast 变体。
- 原生应用一般避免再提供一套独立主题开关。
- 只有内容创作、预览或特殊专业任务确实需要时，才提供应用内 Appearance 选择。
- Dark Mode 下不要使用纯黑加纯白作为唯一层级。
- 测试 Desktop Tinting、Inactive Window 和不同 Accent Color。

---

## 29. Accessibility

Accessibility 必须从信息架构与组件选择阶段开始，而不是发布前补丁。

### 29.1 VoiceOver

- 每个 Button、Icon、Form Control 和交互对象都有简短 Accessible Name。
- Label 描述“是什么”，必要时 Hint 说明“会发生什么”。
- 不朗读纯装饰元素。
- Selection、Expanded、Checked、Disabled、Progress 等状态正确暴露。
- 动态内容变化需要在必要时发送无障碍通知。
- 自定义 Table、Canvas、Tree 和拖放区域必须定义合理语义。

### 29.2 Full Keyboard Access

- 所有核心功能都可以通过键盘访问。
- Focus Order 与视觉顺序一致。
- Focus Ring 清楚且不被裁切。
- 不把 Hover 作为唯一入口。
- Menu、Toolbar、Context Menu 与控件状态一致。
- Modal 出现后焦点进入正确位置，关闭后回到 Trigger。

### 29.3 Voice Control 与 Switch Control

- 控件具有可说出的稳定 Label。
- 避免多个可见控件使用完全相同但无法区分的名称。
- 核心手势提供按钮或菜单替代路径。
- 自定义控件可以被扫描、聚焦和激活。

### 29.4 Control Size 与 Dexterity

- macOS 默认点击区域至少 28 × 28 pt。
- 最低不小于 20 × 20 pt。
- 相邻控件保持足够距离。
- Drag & Drop 提供非拖动替代方式。
- 需要高精度拖动时提供数值输入或键盘微调。

### 29.5 Typography 与 Contrast

- 默认文本达到可读尺寸。
- 支持用户需要的更大文本或缩放方式。
- 17 pt 及以下普通文字一般至少达到 4.5:1 对比度。
- 较大或粗体文字一般至少达到 3:1。
- Light、Dark 和 Increase Contrast 分别测试。
- Disabled 仍可辨认，但不能看起来可操作。

### 29.6 Reduced Motion 与 Reduce Transparency

- Reduce Motion 下减少位移、缩放、视差和自动播放。
- Reduce Transparency 下使用可读的不透明或更厚背景。
- Material 降级后仍保持 Pane 和控件关系。
- 动画与透明度不能表达唯一信息。

### 29.7 Color Independence

以下状态不能只依赖颜色：

- Error
- Warning
- Success
- Selected
- Required
- Changed

同时使用：

- Symbol
- Label
- Shape
- Pattern
- Position

### 29.8 测试

至少测试：

- Accessibility Inspector
- VoiceOver
- Full Keyboard Access
- Voice Control
- Switch Control
- Increase Contrast
- Reduce Transparency
- Reduce Motion
- Light / Dark
- 不同 Accent Color
- 不同字体与窗口缩放

---

## 30. Responsive 与 Resizable Layout

Mac 布局的关键不是 Mobile Responsive，而是持续变化的 Window Size。

### 30.1 宽屏

~~~text
Sidebar | Content / Canvas | Inspector
~~~

### 30.2 中等宽度

~~~text
Sidebar | Main Content

Inspector → Hidden / Toggle / Panel
~~~

### 30.3 窄宽度

~~~text
Main Content

Sidebar   → Hidden with familiar Show Sidebar command
Inspector → Popover / Panel / Separate Window when appropriate
~~~

### 30.4 原则

- 先设计完整桌面布局，只有真正放不下时才切换紧凑模式。
- 优先隐藏 Tertiary Pane，例如 Inspector。
- 变化过程保持稳定，不频繁重排所有控件。
- 保持 Selection、Scroll、Search 与编辑内容。
- 为 Sidebar 和 Inspector 提供明确恢复入口。
- 不把原生 Mac 窄窗口直接转换成移动端 Hamburger Drawer。

### 30.5 测试尺寸

测试：

- 最小窗口。
- 最大窗口。
- 半屏、三分之一、三分之二与四分之一平铺。
- 全屏。
- 多显示器与不同缩放比例。
- 带 Camera Housing 的显示区域。
- Toolbar Item Overflow。
- Sidebar 与 Inspector 的自动隐藏边界。

---

## 31. 原生、桌面壳与 Web 的适配矩阵

| 能力 | AppKit / SwiftUI | Electron / Tauri | 浏览器 Web |
|---|---|---|---|
| 系统窗口框架 | 直接使用 | 优先使用原生窗口能力 | 由浏览器负责，不在页面伪造 |
| Menu Bar | 完整支持 | 使用原生菜单桥接 | 只能提供应用内命令菜单 |
| Toolbar | 系统 Toolbar | 可桥接或高质量近似 | 页面内上下文 Toolbar |
| Sidebar Material | 系统自动适配 | 近似或平台桥接 | CSS 近似，必须可降级 |
| Liquid Glass | 标准组件自动获得 | 无法完全复现 | Blur 只近似外观 |
| Accent Color | 动态系统颜色 | 尽量读取系统偏好 | 使用 CSS System Color 或 Fallback |
| Window State | Main / Key / Inactive | 监听系统窗口状态 | 只知道页面 Focus / Visibility |
| Keyboard Shortcut | Menu Command 驱动 | 原生菜单与应用命令 | 避免覆盖浏览器保留快捷键 |
| Drag & Drop | 系统完整支持 | 使用平台与 Web API 组合 | 受浏览器安全和文件能力限制 |
| File System | 标准 Open / Save Panel | 使用系统 Dialog | 受浏览器授权与沙箱限制 |
| Full Screen | 系统 Full Screen | 调用系统窗口能力 | 浏览器 Fullscreen 语义不同 |
| Accessibility | 标准控件自动获得大量能力 | 需验证原生桥接与 DOM | 依赖正确 HTML / ARIA / Focus |
| Toolbar Customization | 系统能力 | 需要自行实现 | 产品自定义，不是系统级 |

### 31.1 结论

- **原生**：真实性主要来自标准组件和系统行为。
- **桌面壳**：真实性主要来自原生窗口、菜单、文件、快捷键与系统集成，而不是 CSS。
- **Web**：应追求“符合 Mac 用户预期”，而不是“伪装成 AppKit”。

---

## 32. macOS 风格后台管理系统结构

推荐：

~~~text
┌──────────────────────────────────────────────────────────┐
│ Window Frame / Browser Chrome                             │
├──────────────┬─────────────────────────────┬─────────────┤
│              │ Contextual Toolbar          │             │
│ Sidebar      ├─────────────────────────────┤ Inspector   │
│              │                             │             │
│ Navigation   │ Main Workspace              │ Properties  │
│              │ Table / Outline / Canvas    │ Metadata    │
│              │                             │             │
└──────────────┴─────────────────────────────┴─────────────┘
~~~

可选：

- Content List
- Workspace Tabs
- Filter Bar
- Bottom Status Bar
- Floating Controls

不要默认全部出现。

### 32.1 全局 App Chrome

可以包含：

- Organization
- Account
- Notifications
- Global Help

它应与当前 Workspace Toolbar 分离，避免每个页面重复。

### 32.2 Workspace Toolbar

围绕当前内容：

- Create
- Search
- Filter
- Sort
- View
- Share
- Export
- Inspector
- More

### 32.3 Main Workspace

优先显示真实任务内容：

- Table
- Outline
- Canvas
- Timeline
- Map
- Editor
- Dashboard only when overview is the task

不要把“后台系统”默认理解为 Card Dashboard。

---

## 33. 从传统 Admin 迁移的方法

### 第一阶段：确定平台边界

- 标明原生、桌面壳或 Web。
- 确定最低 macOS 版本。
- 列出能使用的系统能力。
- 禁止在浏览器中伪造无法实现的系统行为。

### 第二阶段：重建 Information Architecture

从：

~~~text
Route → Page → Card
~~~

转为：

~~~text
Workspace → Selection → Detail → Command
~~~

明确：

- 稳定导航。
- 当前对象。
- 主任务内容。
- 上下文工具。
- 属性与辅助信息。

### 第三阶段：建立 Command System

- 为每个动作建立统一 Command。
- 连接 Menu、Toolbar、Context Menu 和 Shortcut。
- 正确管理 Enabled / Disabled。
- 定义 Undo 与错误反馈。

### 第四阶段：删除视觉噪音

检查并删除：

- 重复 Page Header。
- 无意义 Card。
- 重复 Border。
- 多余 Shadow。
- 无语义 Badge。
- 无意义背景色。
- 同屏多个 Primary Action。

### 第五阶段：加入桌面交互

- Selection
- Multi-selection
- Keyboard Navigation
- Context Menu
- Drag & Drop
- Column Resize
- Window Resize
- Undo / Redo

### 第六阶段：采用系统视觉

- System Font
- Semantic Color
- Standard Control
- SF Symbols
- Standard Material
- Liquid Glass Functional Layer

先使用标准组件，再判断是否真的需要 Custom UI。

### 第七阶段：Accessibility

- VoiceOver
- Full Keyboard Access
- Control Size
- Focus
- Contrast
- Reduced Motion
- Reduce Transparency
- Alternative Actions

### 第八阶段：真实环境验证

- 不同窗口尺寸。
- 多显示器。
- 不同系统外观。
- 不同 Accent Color。
- 长时间工作。
- 大数据量。
- 慢网络与失败状态。
- 键盘、鼠标、触控板和辅助技术。

---

## 34. AI 产品的 macOS UX

AI 产品不仅需要“看起来像 Mac”，还需要体现 Agency 与 Responsibility。

### 34.1 状态

清楚区分：

~~~text
Idle
Thinking
Generating
Using Tool
Waiting for User
Completed
Failed
Cancelled
~~~

不要只显示一个永远旋转的 Spinner。

### 34.2 用户控制

- 允许 Stop。
- 长任务允许后台继续。
- 高影响动作执行前确认。
- 可以查看系统将要做什么。
- 可以撤销或恢复。
- 失败后保留输入和已完成工作。
- 不因为模型开始生成就锁住整个窗口。

### 34.3 外部副作用

以下行为需要明确边界：

- 发送消息或邮件。
- 发布内容。
- 删除文件。
- 修改远端数据。
- 支付、交易与预订。
- 创建长期自动化。
- 访问敏感账户和数据。

预览、确认和执行记录应靠近动作发生的上下文。

### 34.4 内容真实性

- 区分用户内容与 AI 生成内容。
- 必要时显示来源和验证状态。
- 不确定内容不使用与已验证事实相同的视觉状态。
- 自动修改应支持 Diff、Review 或 Undo。
- 错误不能被华丽动画掩盖。

### 34.5 隐私

- 清楚说明数据发送位置。
- 在需要时说明模型或服务提供方。
- 尽量减少上传范围。
- 敏感内容提供本地或不保存选项时，应使其易于理解。
- 权限请求与当前任务相关。

---

## 35. 常见伪 macOS 风格

### 1. 全屏毛玻璃

每个容器都使用 Blur，不符合功能层与内容层的关系。

### 2. 所有东西都是 20 px 圆角

忽略密度、控件尺寸和同心关系。

### 3. 假交通灯与假 Title Bar

视觉像窗口，行为却不能移动、全屏、辅助访问或正确响应窗口状态。

### 4. 移动端 Drawer 直接搬到 Mac

忽略 Sidebar、View Menu 与可调整窗口。

### 5. 蓝紫渐变与彩色光晕

通常更接近概念设计或 Glassmorphism。

### 6. 每块内容都是 Card

用容器代替层级。

### 7. 巨大留白和超大行高

以牺牲工作效率换取静态截图的“干净”。

### 8. Toast 覆盖每次成功

用户被迫不断处理无价值反馈。

### 9. Command Palette 替代所有导航

只有熟悉产品的人才能操作，且缺乏稳定位置感。

### 10. 随意覆盖标准快捷键

尤其是把 ⌘P 改成 Quick Open，或覆盖浏览器的 ⌘W、⌘L、⌘R。

### 11. 只有视觉，没有桌面行为

有字体、Blur 和 Sidebar，却没有：

- Menu Command
- Keyboard Navigation
- Selection
- Context Menu
- Drag & Drop
- Undo
- Window Resize
- Accessibility

### 12. 自定义控件复制系统外观

看起来接近，但缺少 Focus、Hover、Pressed、Disabled、VoiceOver、Reduce Motion 和系统更新适配。

---

## 36. Design Tokens：原生语义与 Web Fallback

### 36.1 原生应用

原生应用不应把系统外观降级成一组固定 HEX、RGBA 和 Radius。

优先使用：

- Dynamic System Colors
- System Fonts
- Standard Control Sizes
- System Materials
- Layout Guides
- SF Symbols
- User Accent Color
- Accessibility Settings

### 36.2 Web 建议 Token

以下只用于建立一致的 Web 近似，不代表 Apple 官方数值：

~~~css
:root {
  /*
   * 这些变量只用于浏览器中的工程化近似。
   * 它们不是 AppKit 的固定规格，也不能替代系统动态颜色、材质和控件。
   */
  color-scheme: light dark;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  --radius-small: 5px;
  --radius-control: 7px;
  --radius-panel: 12px;
  --radius-pill: 999px;

  --text-primary: CanvasText;
  --bg-primary: Canvas;
  --accent-fallback: #007aff;
  --accent: var(--accent-fallback);

  /*
   * Separator 使用当前前景色混合得到，只作为 Web Fallback。
   * 不要把这里的结果记录成“macOS 官方 RGBA”。
   */
  --separator: color-mix(in srgb, CanvasText 16%, transparent);

  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Helvetica Neue",
    Arial,
    sans-serif;
}

@supports (color: AccentColor) {
  :root {
    /*
     * 浏览器支持系统强调色时优先使用。
     * 仍需在不同浏览器、系统版本和高对比度模式下测试。
     */
    --accent: AccentColor;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    /*
     * 关闭非必要动画，但保留状态变化本身。
     * 业务逻辑不能依赖动画结束事件才能完成。
     */
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
~~~

### 36.3 Token 使用要求

- Component 只引用 Semantic Token。
- 不在几十个组件中重复硬编码 Accent。
- Light / Dark 不共用未经验证的固定色。
- Increase Contrast 需要单独增强。
- Reduce Transparency 后替换半透明背景。
- Radius 根据层级与同心关系使用，不机械统一。

---

## 37. AI 生成 UI 时的约束

可以把以下内容附加到 UI 生成 Prompt：

~~~text
Target macOS 26+ and distinguish native macOS behavior from Web approximation.
Treat the product as a desktop productivity workspace, not a collection of dashboard cards.

Prioritize:
- system window behavior
- menu and unified command system
- stable sidebar
- contextual toolbar
- clear selection
- inspector-style details
- keyboard and pointer parity
- drag and drop with undo
- semantic system colors
- system typography
- restrained Liquid Glass in the functional layer
- concentric geometry
- resizable layout
- accessibility
- privacy, transparency, and user control

Do not:
- imitate Apple style as generic glassmorphism
- make every container a card
- use excessive rounded corners
- add decorative blue-purple gradients
- fake macOS traffic-light window controls in browser content
- replace standard shortcuts such as Command-P
- use a command palette as the only navigation
- show a toast for every successful action
- hide critical actions only on hover
- rely on color as the only state indicator
- sacrifice information density merely to create whitespace
~~~

生成结果还需要人工验证：

- 当前 macOS 版本。
- 标准组件行为。
- 快捷键冲突。
- Window Resize。
- VoiceOver 与 Keyboard。
- Reduce Motion / Transparency。
- 大数据与错误状态。

---

## 38. 最终设计公式

### macOS UI

~~~text
macOS UI
=
System Components
+
Typography
+
Hierarchy
+
Semantic Color
+
Functional Material
+
Concentric Geometry
+
Precise Icons
+
Natural Motion
-
Visual Noise
~~~

### macOS UX

~~~text
macOS UX
=
Purpose
+
Agency
+
Responsibility
+
Familiarity
+
Flexible Windows
+
Menu Commands
+
Multiple Input Methods
+
Selection
+
Undo / Recovery
+
Accessibility
~~~

### macOS 风格复杂后台

~~~text
Apple-style Productivity Workspace
=
High Information Density
+
Low Visual Noise
+
Stable Navigation
+
Contextual Commands
+
Few Unnecessary Containers
+
Strong Selection
+
Inspector
+
Keyboard Efficiency
+
Resizable Layout
+
Reversible Actions
~~~

---

## 39. Checklist

### Scope 与版本

- [ ] 是否明确目标是原生、桌面壳还是浏览器 Web？
- [ ] 是否明确最低 macOS 版本？
- [ ] 是否区分系统要求与 Web 近似？
- [ ] 是否避免伪造无法完整实现的系统窗口？

### Purpose 与 Responsibility

- [ ] 核心任务是否清楚？
- [ ] 每个主要界面是否服务于真实任务？
- [ ] 权限是否在需要时请求并说明原因？
- [ ] 是否只处理必要数据？
- [ ] AI 或自动化是否在产生外部副作用前让用户控制？

### Window

- [ ] 是否使用系统窗口与 Full Screen？
- [ ] 是否支持 Resize、Minimize、Move 与多窗口？
- [ ] Main、Key、Inactive 状态是否正确？
- [ ] 是否恢复合理的窗口与工作区状态？
- [ ] 最小窗口是否仍能完成核心任务？

### Menu 与 Command

- [ ] Menu Bar 是否覆盖主要命令？
- [ ] Menu、Toolbar、Context Menu 是否共用 Command？
- [ ] Enabled / Disabled 是否随 Selection 更新？
- [ ] 是否尊重标准快捷键？
- [ ] 是否没有把 ⌘P 改成 Quick Open？

### Navigation 与 Layout

- [ ] Sidebar 是否稳定且可隐藏？
- [ ] 深层层级是否使用 Split View 而非无限缩进？
- [ ] Toolbar 是否围绕当前上下文？
- [ ] Content 是否比容器更醒目？
- [ ] Inspector 是否真正跟随 Selection？
- [ ] 是否避免多层 Tabs 与导航叠加？

### Interaction

- [ ] Single、Range、Multiple Selection 是否清楚？
- [ ] Selection 与 Activation 是否分离？
- [ ] 是否支持 Keyboard Navigation？
- [ ] 是否支持 Secondary Click / Context Menu？
- [ ] Drag & Drop 是否显示 Move / Copy 与 Drop Target？
- [ ] 拖动是否有替代路径？
- [ ] 是否支持 Undo / Redo？

### Visual

- [ ] 是否使用系统字体或合适系统字体栈？
- [ ] 是否使用 Semantic Color？
- [ ] 是否响应用户 Accent Color？
- [ ] Liquid Glass 是否只用于功能层？
- [ ] 是否使用同心几何而非统一大圆角？
- [ ] 是否避免无意义 Card、Border 与 Shadow？
- [ ] Dark Mode 是否独立校准？

### Controls 与 Feedback

- [ ] Button Role 是否正确？
- [ ] Destructive 是否没有成为 Primary？
- [ ] Routine Success 是否避免无意义 Toast？
- [ ] Error 是否说明解决办法并保留输入？
- [ ] Progress 是否匹配已知或未知时长？
- [ ] 长任务是否可取消或后台继续？

### Accessibility

- [ ] VoiceOver 是否完整描述控件和状态？
- [ ] Full Keyboard Access 是否可完成核心任务？
- [ ] Focus Ring 和 Focus Order 是否正确？
- [ ] 点击区域是否达到 macOS 最低要求？
- [ ] Reduce Motion 是否可用？
- [ ] Reduce Transparency 后是否可读？
- [ ] Increase Contrast 是否经过测试？
- [ ] 状态是否不只依赖颜色？
- [ ] 拖动和手势是否有替代操作？

### 验证

- [ ] 是否在真实 Mac 和当前系统版本测试？
- [ ] 是否测试多个窗口尺寸和系统平铺？
- [ ] 是否测试多显示器和不同缩放？
- [ ] 是否测试慢网络、失败、离线和大数据量？
- [ ] 是否测试系统更新后的标准组件行为？

---

## 40. 官方参考资料

以 Apple 当前 HIG 为最高参考：

### Foundations

- Design Principles  
  https://developer.apple.com/design/human-interface-guidelines/design-principles

- Designing for macOS  
  https://developer.apple.com/design/human-interface-guidelines/designing-for-macos

- Accessibility  
  https://developer.apple.com/design/human-interface-guidelines/accessibility

### App structure

- Windows  
  https://developer.apple.com/design/human-interface-guidelines/windows

- Toolbars  
  https://developer.apple.com/design/human-interface-guidelines/toolbars

- Sidebars  
  https://developer.apple.com/design/human-interface-guidelines/sidebars

- Split Views  
  https://developer.apple.com/design/human-interface-guidelines/split-views

- Panels  
  https://developer.apple.com/design/human-interface-guidelines/panels

- Tab Views  
  https://developer.apple.com/design/human-interface-guidelines/tab-views

### Commands and input

- Menus  
  https://developer.apple.com/design/human-interface-guidelines/menus

- Context Menus  
  https://developer.apple.com/design/human-interface-guidelines/context-menus

- Keyboards  
  https://developer.apple.com/design/human-interface-guidelines/keyboards

- Pointing Devices  
  https://developer.apple.com/design/human-interface-guidelines/pointing-devices

- Drag and Drop  
  https://developer.apple.com/design/human-interface-guidelines/drag-and-drop

- Undo and Redo  
  https://developer.apple.com/design/human-interface-guidelines/undo-and-redo

- Searching  
  https://developer.apple.com/design/human-interface-guidelines/searching

- Search Fields  
  https://developer.apple.com/design/human-interface-guidelines/search-fields

### Presentation and feedback

- Modality  
  https://developer.apple.com/design/human-interface-guidelines/modality

- Popovers  
  https://developer.apple.com/design/human-interface-guidelines/popovers

- Sheets  
  https://developer.apple.com/design/human-interface-guidelines/sheets

- Alerts  
  https://developer.apple.com/design/human-interface-guidelines/alerts

- Feedback  
  https://developer.apple.com/design/human-interface-guidelines/feedback

- Progress Indicators  
  https://developer.apple.com/design/human-interface-guidelines/progress-indicators

### Visual system

- Typography  
  https://developer.apple.com/design/human-interface-guidelines/typography

- Color  
  https://developer.apple.com/design/human-interface-guidelines/color

- Materials  
  https://developer.apple.com/design/human-interface-guidelines/materials

- Dark Mode  
  https://developer.apple.com/design/human-interface-guidelines/dark-mode

- SF Symbols  
  https://developer.apple.com/design/human-interface-guidelines/sf-symbols

- Layout  
  https://developer.apple.com/design/human-interface-guidelines/layout

- Buttons  
  https://developer.apple.com/design/human-interface-guidelines/buttons

- Lists and Tables  
  https://developer.apple.com/design/human-interface-guidelines/lists-and-tables

- Outline Views  
  https://developer.apple.com/design/human-interface-guidelines/outline-views

### Current design system

- Meet Liquid Glass — WWDC25  
  https://developer.apple.com/videos/play/wwdc2025/219/

- Get to know the new design system — WWDC25  
  https://developer.apple.com/videos/play/wwdc2025/356/

- Build an AppKit app with the new design — WWDC25  
  https://developer.apple.com/videos/play/wwdc2025/310/

---

## 41. 一句话总结

> macOS 风格的本质不是模仿 Apple 的截图，而是使用系统熟悉的窗口、命令、选择、输入、材质和可恢复性，让复杂工作保持高效、安静、可信且由用户掌控。

---

## 42. v3.0 修订说明

相对旧版，本版主要修订：

- 明确以 macOS 26+ 为视觉基线。
- 区分原生、Electron / Tauri 与浏览器 Web。
- 补充 Responsibility、隐私、权限和 AI 外部副作用。
- 补充 Main / Key / Inactive Window State。
- 强化 Menu Bar 与统一 Command System。
- 区分 System Overflow 与 More Menu。
- 区分 Window Tabs、Tab View、Tab Bar 与 Workspace Tabs。
- 修正 ⌘P、⌘F、⌥⌘F 和 Return 的说明。
- 删除把 Toast 当作系统反馈层级的表述。
- 将固定字体、间距和颜色值降级为 Web Fallback。
- 补充当前 Liquid Glass、Concentricity 与 Scroll Edge Effect。
- 补充标准 Button Role 和 Destructive 规则。
- 增加 VoiceOver、Voice Control、Switch Control、Control Size 与完整无障碍测试。
- 扩展官方参考资料。

