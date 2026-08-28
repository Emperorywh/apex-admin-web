# macOS 26+ UI / UX 设计指南

> 原生规范、桌面壳适配与 Mac-first Web 实践

版本：v3.0  
更新日期：2026-08-28  
适用基线：macOS 26 及以后版本的设计语言  
适用产品：AppKit / SwiftUI 原生应用、Electron / Tauri 桌面应用、面向 Mac 用户的复杂 Web 应用、后台管理系统、生产力工具、数据系统与 AI 产品

---

## 0. 使用边界与决策依据

本指南用于让复杂软件具备真实、克制、熟悉且高效的 Mac 使用体验，不用于像素级复刻系统界面，也不主张在非原生环境伪造系统能力。

macOS 体验由平台行为、窗口与工作区模型、菜单和命令系统、精确输入、语义视觉、可恢复性及无障碍共同构成。毛玻璃、圆角、SF Pro 或蓝色按钮不能单独构成 macOS 风格。

### 0.1 参考优先级

发生冲突时，按以下顺序决策：

1. 当前版本 Apple Human Interface Guidelines。
2. 当前 macOS 的系统行为与标准组件。
3. AppKit / SwiftUI 官方 API 的默认行为。
4. Apple 自带应用中与当前任务相符的稳定模式。
5. 本指南中的工程建议。
6. 产品自身的视觉偏好。

不得为维持自定义视觉而覆盖系统已经正确处理的行为。

### 0.2 实现环境与标记

- **原生**：AppKit / SwiftUI 应优先直接采用的系统行为。
- **桌面壳**：Electron / Tauri 等拥有独立窗口、原生菜单和系统集成能力的应用。
- **Web**：运行在 Safari、Chrome 等浏览器中的页面，只能近似部分外观与交互。
- **产品可选**：对特定专业软件有价值，但不是 macOS 系统惯例。

同一要求必须结合实现环境判断，不能直接跨环境照搬。

### 0.3 系统版本

Liquid Glass、悬浮 Sidebar、更新后的 Toolbar 分组、同心几何与滚动边缘效果属于 macOS 26+ 设计语言。

兼容更早 macOS 时：

- 让系统组件自动采用当前运行环境的外观。
- 不在旧系统上手工伪造新系统材质。
- 自定义组件提供无 Liquid Glass 的标准材质降级方案。

---

## 1. 产品原则与信息密度

### 1.1 八项原则

| 原则 | 当前要求 |
|---|---|
| Purpose | 明确为谁解决什么问题，优先保证核心任务可靠、快速、清楚；每个功能都应证明其必要性，不以额外界面掩盖目的不清。 |
| Agency | 让用户知道当前位置、选择、系统状态和操作结果，并能退出、停止、撤销或恢复。 |
| Responsibility | 只处理必要数据，在需要时请求权限，清楚说明风险、处理边界和外部影响，不使用误导性设计。 |
| Familiarity | 沿用用户已理解的 Sidebar、Toolbar、Menu Bar、Context Menu、双击、拖放和标准快捷键语义。 |
| Flexibility | 支持菜单、工具栏、键盘、鼠标或触控板、Context Menu、Drag & Drop 与辅助技术等合理路径。 |
| Simplicity | 保留任务需要的复杂能力，删除重复标题、无意义容器、边框、阴影、Badge、背景色和装饰动画。 |
| Craft | 完整处理图标重量、文本基线、控件状态、窗口缩放、长任务、错误、动画连续性和系统升级适配。 |
| Delight | 通过符合预期、及时而克制的反馈、流畅任务和可信语气建立愉悦感。 |

### 1.2 用户控制与责任

产品至少应做到：

- 对发送、付款、交易、删除、发布等高影响动作提供清楚的最后控制点。
- 只收集完成任务所必需的数据，并在真正需要权限时说明用途、范围与拒绝后的影响。
- 区分本地、云端和第三方处理，让用户能够查看、导出、更正和删除自己的数据。
- 不使用误导性按钮、默认勾选或难以退出的流程。
- 避免没有出口的流程和不必要的强制线性步骤。
- 安全失败时优先保护数据和用户输入，不伪装成功。

### 1.3 高信息密度与低视觉噪音

Mac 生产力软件可以同时呈现 Table、Outline、Canvas、Filters 和 Inspector。密度应服务于任务，不能靠巨大行高、大片留白或层层 Card 制造表面上的简洁。

| 任务类型 | 建议密度起点 |
|---|---|
| Settings | Comfortable |
| Finder 类文件管理 | Medium |
| Xcode 类开发工具 | Dense |
| Trading Tool | Very Dense |

要求：

- 保留完成任务所需的数据，以稳定结构和清楚排版支持扫描。
- 用 Selection 和上下文命令减少永久可见的重复控件。
- 允许用户按工作方式调整密度和布局。
- 避免多层 Breadcrumb、Tabs 与 Sidebar 同时承担导航。
- 避免高饱和背景、蓝紫渐变、彩色光晕和同屏大量 Filled Button。
- 密度由真实任务、数据量、窗口尺寸和长时间使用测试决定，不由品牌风格决定。

---

## 2. 原生、桌面壳与 Web 的能力边界

| 能力 | AppKit / SwiftUI | Electron / Tauri | 浏览器 Web |
|---|---|---|---|
| 系统窗口框架 | 直接使用 | 优先使用原生窗口能力 | 由浏览器负责，页面内不伪造 |
| Menu Bar | 完整支持 | 使用原生菜单桥接 | 只能提供应用内命令菜单 |
| Toolbar | 系统 Toolbar | 可桥接或高质量近似 | 页面内上下文 Toolbar |
| Sidebar Material | 系统自动适配 | 平台桥接或有限近似 | CSS 近似并提供降级 |
| Liquid Glass | 标准组件自动获得 | 无法完整复现 | Blur 只能近似外观 |
| Accent Color | 动态系统颜色 | 尽量读取系统偏好 | CSS System Color 或 Fallback |
| Window State | Main / Key / Inactive | 监听系统窗口状态 | 仅有页面 Focus / Visibility |
| Keyboard Shortcut | Menu Command 驱动 | 原生菜单与应用命令驱动 | 避免覆盖浏览器保留快捷键 |
| Drag & Drop | 系统完整支持 | 组合平台与 Web API | 受浏览器安全和文件能力限制 |
| File System | 标准 Open / Save Panel | 使用系统 Dialog | 受授权与沙箱限制 |
| Full Screen | 系统 Full Screen | 调用系统窗口能力 | 浏览器 Fullscreen 语义不同 |
| Accessibility | 标准控件自动获得大量能力 | 验证原生桥接与 DOM | 依赖正确 HTML、ARIA 与 Focus |
| Toolbar Customization | 使用系统能力 | 需要自行实现 | 属于产品功能，不是系统能力 |

结论：

- **原生**的真实性主要来自标准组件和系统行为。
- **桌面壳**的真实性主要来自原生窗口、菜单、文件、快捷键与系统集成，而不是 CSS。
- **Web**应符合 Mac 用户预期，不应伪装成 AppKit 应用。

---

## 3. Desktop Workspace 信息架构

复杂生产力软件应以 Workspace 为中心，而不是以 `Route → Page → Card` 为默认结构。

~~~text
Application
├── Menu Bar
├── Window / Browser Chrome
│   ├── Global App Chrome
│   └── Workspace
│       ├── Sidebar / Navigation
│       ├── Contextual Toolbar
│       ├── Content List（可选）
│       ├── Main Content / Canvas
│       └── Inspector / Utility（可选）
└── Transient UI
    ├── Menu
    ├── Popover
    ├── Sheet
    └── Alert
~~~

核心状态链为：

~~~text
位置 → 选择 → 当前内容 → 可用命令 → 操作反馈
~~~

### 3.1 App Chrome 与 Content

- Global App Chrome 集中承载 Organization、Account、Notifications 和 Global Help，并与 Workspace 的上下文工具分离，避免在每个页面重复。
- Main Content 占据最大视觉面积，直接呈现 Table、Outline、Canvas、Timeline、Map 或 Editor；只有概览本身是任务时才使用 Dashboard。
- Card 只用于表达独立对象、可移动单元或明确的强分组关系，不能作为所有内容的默认外壳。

可按任务增加 Content List、Workspace Tabs、Filter Bar、Bottom Status Bar 或 Floating Controls，但不默认全部显示。

### 3.2 工作区状态

切换视图、对象、Pane 或窗口后，按任务合理保留：

- Scroll Position。
- Selection。
- Search / Filter。
- Outline 的展开状态。
- 列宽、排序和密度。
- Sidebar / Inspector 的宽度与可见状态。
- Window Size / Position。
- 当前工作区、最近文档与未完成编辑。
- 只恢复仍然有效且不会泄露敏感内容的状态。

---

## 4. Window 与可调整布局

### 4.1 窗口实现

**原生**

- 使用系统窗口框架与窗口控制。
- 支持移动、缩放、最小化、全屏和系统平铺。
- 由系统处理交通灯、圆角、阴影与安全区域。
- 设置合理的初始尺寸和最小尺寸，只在任务确实需要时限制最大尺寸。

**桌面壳**

- 优先使用操作系统提供的窗口和菜单能力。
- 定制 Title Bar 时，正确处理拖动区、交通灯位置、全屏、窗口激活和辅助功能。
- 视觉自定义不得破坏系统窗口管理。

**Web**

- 浏览器窗口已经是系统窗口。
- 页面中的工作区不拥有系统窗口能力，不得伪造交通灯、Title Bar 或第二套窗口边框。

### 4.2 窗口状态

- **Main Window**：应用最主要的前景窗口。
- **Key Window**：当前接受键盘输入的活动窗口。
- **Inactive Window**：不在前景或不活动的窗口。

窗口控制颜色、Selection 强调、Material、Toolbar、控件可用状态和键盘焦点应与窗口状态一致。后台窗口不得继续使用与 Key Window 相同的高强调选择色。

### 4.3 多窗口与全屏

适合新窗口的任务包括独立撰写、并排比较、保持多个上下文，以及需要跨文档持续可见的工具。应在 File Menu 或 Context Menu 提供“在新窗口中打开”等可发现入口，不得在每次导航时打开新窗口，也不得用自动生成大量窗口代替信息架构。

全屏要求：

- 使用系统 Full Screen，不自动让用户退出。
- 核心控件在全屏中仍可访问；隐藏 Toolbar 或 Navigation 时提供熟悉的恢复方式。
- 离开全屏、切换应用或重新打开后恢复第 3.2 节定义的有效上下文。

### 4.4 连续缩放

Mac 布局围绕持续变化的窗口尺寸设计：

| 宽度 | 布局 |
|---|---|
| 宽 | Sidebar + Main Content + Inspector |
| 中 | Sidebar + Main Content；Inspector 隐藏、切换或转为 Panel |
| 窄 | 优先保留 Main Content；Sidebar 提供标准显示命令；Inspector 按任务转为 Popover、Panel 或独立窗口 |

布局变化必须：

- 以完整桌面布局为基线，真正放不下时才切换紧凑模式。
- 先保留主任务，优先收起 Inspector 等 Tertiary Pane。
- 缩放过程不得重置第 3.2 节定义的工作区状态。
- 提供 Sidebar 与 Inspector 的明确恢复入口。
- 避免在临界宽度频繁重排全部控件。
- 不把 Mac 窄窗口直接转换成移动端 Hamburger Drawer。

---

## 5. Command、Navigation 与 Search

### 5.1 统一 Command System

成熟应用应让多个入口调用同一命令定义：

~~~text
Command
├── Menu Bar
├── Toolbar
├── Context Menu
├── Keyboard Shortcut
└── Command Palette（产品可选）
~~~

每个 Command 统一管理：

- 可用状态和权限检查。
- 当前 Selection。
- 菜单与控件标签。
- Keyboard Shortcut。
- Undo 名称。
- 执行结果和错误反馈。

### 5.2 Menu Bar

**原生 / 桌面壳**通常提供以下标准结构，并按领域需要增加菜单：

~~~text
App
File
Edit
View
Window
Help
~~~

- Menu Bar 覆盖主要命令，并随选择、权限和窗口状态正确启用或禁用。
- 标准命令保留用户熟悉的位置；菜单标签使用明确动词，并显示已有快捷键。
- Toolbar 和 Context Menu 是高频或对象相关的快捷入口，不能成为重要命令的唯一入口。
- Web 应用内命令菜单不得伪装成系统 Menu Bar，也不得阻断浏览器打印、关闭标签页、刷新和地址栏等行为。

### 5.3 Toolbar

Toolbar 用于定位、导航、搜索和当前内容的高频命令。

~~~text
[Sidebar] [Back] [Forward] [View Title]

                 [View Options] [Search] [Share] [Add] [More]
~~~

- Leading 放置 Sidebar Toggle、返回、前进和视图标题。
- Center 放置与当前视图直接相关的常用控件。
- Trailing 放置 Search、Share、Add、Inspector 和 More 等操作。
- **System Overflow**由系统在窗口变窄时自动收纳项目；**More Menu**由设计者主动承载低频次要操作，两者不得混淆。
- 不手工复制 System Overflow，也不因空间充足就把所有命令放进 Toolbar。
- 原生 Toolbar Item 设置正确优先级；适合的专业应用允许用户增删、移动和恢复项目。
- 熟悉且语义唯一的动作可只使用 Symbol；其他动作使用文本或图标加文本。

### 5.4 Sidebar

Sidebar 用于稳定导航和位置感：

- 图标与文字语义一致，Selection 清楚但克制。
- 使用 Indent 和 Disclosure Control 表达层级，只使用少量 Group Heading 与 Divider。
- 支持显示、隐藏和调整宽度；自动隐藏后保留恢复入口。
- 深层信息优先使用第二个列表 Pane 或 Split View，不无限缩进。
- 不把复杂表单、卡片菜单或关键底部操作塞入 Sidebar。

### 5.5 Tabs

| 类型 | 用途 | 要求 |
|---|---|---|
| Window Tabs | 在同一系统窗口容器中组织多个文档或完整工作区 | 每个 Tab 保留相对完整的窗口级状态，适用于多文档或用户主动合并的窗口。 |
| Tab View | 在同一区域切换互斥且相关的内容面板 | 标签使用清楚的名词或短语；Pane 内控件只影响自身；通常避免达到六个或更多。 |
| Tab Bar | 顶层区域导航 | 只做导航，不放 Toolbar Action。 |
| Workspace Tabs | 同时打开多个订单、查询或对象 | **产品可选**；完整支持关闭、重开、重排、未保存状态、键盘切换与 Context Menu。 |

Workspace Tab 可记住 Scroll、Selection、Filter、Search、Local Edit State 和 Inspector State，但不得与 Sidebar、一级和二级 Tabs 形成多层导航迷宫。

### 5.6 Find、Search、Filter 与 Command Palette

- **Find**：在当前文档、页面或内容范围内查找。
- **Search**：跨集合、来源或应用范围检索。
- **Filter**：缩小当前结果范围。

Search 可组合 Scope Control、Token、建议和 Filter，但必须让范围清楚，并在清空后恢复正常浏览状态。全局 Search 通常位于 Toolbar 尾部；Sidebar、本地列表的搜索分别靠近其作用范围，并在缩放时保持上下文关系。

Command Palette 仅作为快速跳转、搜索命令、打开对象和执行明确低频功能的可选入口，不能替代 Menu Bar、Toolbar、Context Menu 或正常导航。`⌘K` 不是平台通用快捷键，采用前必须检查冲突并提供可发现入口。

---

## 6. Pane 与任务容器

### 6.1 Split View 与 Content

典型结构为：

~~~text
Sidebar | Content List | Detail / Canvas | Inspector
~~~

按任务选择两列或三列，不要求全部出现。

- Divider 可拖动，Pane 显隐后保留原状态。
- 当前导航路径持续显示 Selection。
- 窗口缩小时优先保留主任务内容。
- 适合时支持跨 Pane Drag & Drop。

### 6.2 Inspector、Info Window、Panel 与 Sheet

- **Inspector**：随当前 Selection 更新属性、Metadata、Configuration、Object State 或 Advanced Properties，可位于尾部 Pane、辅助区域或浮动 Panel。
- **Info Window**：固定展示某个对象的信息。
- **Panel**：浮在应用窗口上方、可持续使用的辅助窗口。
- **Sheet**：相对于一个父窗口的模态任务。

Inspector 可以减少不必要的 Modal，但不能替代所有需要集中完成或确认的任务。

### 6.3 Popover、Sheet、Alert 与独立窗口

| 容器 | 适用任务 | 关键约束 |
|---|---|---|
| Popover | 少量信息、快速设置、日期或范围、简单筛选、由明确 Trigger 发起的短任务 | 箭头指向 Trigger；一次一个；不级联；自动关闭时保存非模态编辑，除非用户明确 Cancel。 |
| Sheet | 与当前窗口紧密相关的短任务，如 Save / Export 参数、文档内创建或编辑 | 对父窗口 Modal，但不阻止操作应用中的其他窗口；范围清楚且简短。 |
| Alert | 必须立即知道且最好可处理的关键问题、不可逆风险或阻断状态 | 不用于普通成功、仅有“知道了”的信息或可 Undo 的常见删除；不在启动后连续弹出多个 Alert。 |
| 独立窗口 | 需要长期保留、多步骤、并排查看或同时处理多个对象的任务 | 不得通过不断扩大 Sheet 承载长期工作。 |

复杂 Popover 应转为可分离 Panel、Inspector 或 Window。设计文档应明确具体容器，不以泛称“Dialog”代替决策。

---

## 7. Selection、输入与可恢复操作

### 7.1 Selection Model

~~~text
Click            → 单选或激活控件
Shift-Click      → 范围选择
Command-Click    → 非连续多选
Command-A        → 在当前焦点范围内全选
Arrow Keys       → 在当前集合内移动选择
Esc              → 取消当前临时状态或操作
~~~

Selection 与 Activation 必须分离：

- 单击通常选择，双击通常打开对象或进入编辑。
- Return 的含义由当前上下文决定；例如 Finder 中可用于 Rename，不能全局规定为“打开”。
- 默认按钮可响应 Return，但必须避免与文本输入区域冲突。
- 多选时，Toolbar 显示批量命令，Inspector 显示共同属性或混合值，Context Menu 明确动作影响范围。
- 删除、移动、导出等命令作用于完整 Selection。

### 7.2 键盘

| 快捷键 | 标准语义 | 约束 |
|---|---|---|
| ⌘C / ⌘V / ⌘X | Copy / Paste / Cut | 作用于当前 Selection 或输入焦点。 |
| ⌘Z / ⇧⌘Z | Undo / Redo | Edit Menu 显示具体动作名。 |
| ⌘A | Select All | 只作用于当前焦点范围。 |
| ⌘F | Find | 当前文档或内容范围。 |
| ⌥⌘F | Focus Search Field | 跳到应用内 Search Field。 |
| ⌘G / ⇧⌘G | Find Next / Previous | 与 Find 配套。 |
| ⌘N | New | 按应用语义创建文档或窗口。 |
| ⌘O | Open | 打开文档或对象。 |
| ⌘S | Save | 文档型应用保存。 |
| ⌘P | Print | 不得改为 Quick Open。 |
| ⌘W | Close Window / Tab | Web 页面保留浏览器行为。 |
| ⌘, | Settings | 原生或桌面壳应用。 |
| ⌘Q | Quit | 原生或桌面壳应用。 |
| ⌃⌘F | Enter Full Screen | 调用系统全屏能力。 |
| Esc | Cancel Current Action | 不保证关闭所有类型界面。 |

自定义快捷键只分配给高频领域命令，不复用仍有意义的标准组合，并保持修饰键语义一致；菜单显示快捷键，并测试不同键盘布局和输入法。专业应用可支持用户自定义。

浏览器 Web 不应覆盖 `⌘L`、`⌘R`、`⌘T`、`⌘W`、`⌘P`、`⌘,`。只有用户明确进入专用编辑器上下文、不会造成意外且有清楚退出方式时，才可考虑拦截部分行为。

### 7.3 Pointer、Hover、Tooltip 与 Context Menu

- 使用系统 Pointer Style 表达文本、链接、拖动和调整大小；Resize Handle 与真实方向一致。
- 不隐藏系统指针，不重新定义系统级触控板手势。
- Hover 可提示行、预览、Secondary Action、Drag Handle 或 Resize Handle，但不能成为关键动作或状态的唯一入口。
- Tooltip 简短说明控件作用；Icon-only Button 必须提供，但 Tooltip 不能替代无障碍名称。
- Context Menu 支持 Secondary Click 和 Control-Click，调用统一 Command，危险操作放在末尾并正确标记。

### 7.4 Drag & Drop

Drag & Drop 适用于文件导入、列表或 Tab 重排、移动对象、跨 Pane 操作、拖入和拖出内容。

- 同一容器内通常表示移动；跨容器或应用通常可能表示复制；Modifier Key 可改变语义。
- 通过 Pointer Badge、Drag Preview 和文字说明让 Move / Copy 结果可预期。
- 显示 Valid / Invalid Drop Target、Insertion Position、Multi-item Count 和完成反馈。
- 优先支持 Undo；不可恢复的高风险 Drop 在必要时确认。
- 提供菜单或按钮等非拖动替代路径。

### 7.5 Undo、Redo、Autosave 与冲突

- Undo / Redo 位于 Edit Menu 顶部，使用 `⌘Z` 与 `⇧⌘Z`，标签说明具体动作。
- 连续编辑合理合并 Undo Group，Undo 后正确更新 Redo。
- 可逆且结果符合预期的动作直接执行并提供 Undo；不可逆、罕见且高风险的动作使用明确 Alert。
- 自动保存不得让用户误判内容是否已经保存；同步、上传和本地保存状态必须可区分。
- 冲突不得静默覆盖；失败时保留用户输入并提供重试或恢复路径。

---

## 8. 数据视图与 Controls

### 8.1 Table、List、Outline 与 Collection

| 视图 | 适用场景 | 核心要求 |
|---|---|---|
| Table | 多列、可排序、需要横向比较的数据 | 标题使用名词或短名词；点击标题排序，再次点击已排序列时反向排序；支持必要的列宽调整、键盘导航和多选；数字右对齐或按小数点对齐，Secondary Text 降低视觉重量；按扫描任务决定 Divider 或 Alternating Row Colors。 |
| List | 扁平集合、消息、文件、简短任务、单列导航 | 导航型 List 持续显示 Selection；一次性选项可短暂高亮后显示 Checkmark。 |
| Outline | 文件、设备、项目等层级数据 | 层级放在第一列，以 Disclosure Triangle 和 Indent 表达深度；非层级数据使用 Table。 |
| Collection | 图像为主、尺寸差异大、网格布局或可移动独立单元 | 保持项目边界与选择、重排语义清楚。 |

### 8.2 Button Role

系统 Button Role 包括 Normal、Primary、Cancel 和 Destructive。

- Primary 表示最可能选择的默认动作，通常响应 Accent Color 和 Return；一个临时视图通常只有一个。
- Destructive 不得同时作为 Primary。
- Label 说明实际结果，Cancel 提供安全退出。
- “Secondary”和“Tertiary”可描述视觉层级，但不是正式 macOS Button Role。

### 8.3 控件选择

| 控件 | 语义 |
|---|---|
| Checkbox | 多个彼此独立的布尔选项。 |
| Radio Group | 少量互斥选项。 |
| Pop-up Button | 从列表选择一个值。 |
| Pull-down Button | 显示一组命令。 |
| Segmented Control | 切换少量视图或模式。 |
| Toggle / Switch | 立即生效的开关状态。 |
| Text Field | 键盘输入内容。 |
| Stepper / Slider | 连续或步进调整。 |

Toolbar 中熟悉动作可以使用 Symbol；Form 中关键动作通常保留文字。所有控件完整实现 Hover、Pressed、Focus、Selected、Disabled 和 Default 状态。自定义控件只有在标准控件无法满足任务时使用，并承担键盘、VoiceOver、Reduce Motion 和系统升级适配责任。

---

## 9. 视觉系统

### 9.1 层级与分组

按以下顺序建立层级，只在前一种方式不足时使用下一种：

~~~text
Typography → Spacing → Background Difference → Divider → Standard Material → Shadow
~~~

Divider 适用于 Table Row、Toolbar 与 Content 边界、Split View Pane、Inspector 和需要提高跨列扫描准确性的区域；使用系统 Separator Color，并在 Increase Contrast 下增强。普通内容块不使用完整边框包围。

Shadow 只表达 Window、Popover、Menu、Panel、Drag Preview 或临时升起内容的空间关系，不用于证明某个区域是一张 Card。

### 9.2 Typography

**原生**

- 使用 SF Pro、系统字体 API、标准控件字体和语义用途。
- macOS 常规默认文本尺寸为 13 pt，一般不低于 10 pt。
- 按用途选择 System Font、Label Font、Control Content Font、Menu Font、Title Bar Font、User Font 或 Monospaced User Font。
- 不为模拟系统而把所有文字强制设为同一字号。
- 避免 Ultralight、Thin、Light 等在小字号下难以阅读的字重。

**Web 近似层级**

| 用途 | 起始值，非 Apple 官方尺寸 |
|---|---|
| Content / Workspace Heading | 20–28 px / Semibold |
| Section Heading | 17–20 px / Semibold |
| Body | 13–15 px / Regular |
| Primary Table Text | 13–14 px / Regular 或 Medium |
| Secondary Text | 12–13 px / Regular |
| Caption | 11–12 px / Regular |

Toolbar / Window Title 不使用网页式超大标题。数字表格使用 Tabular Numerals；长文本控制行高和段落宽度；中英文混排单独校准基线、标点和字重。Web 系统字体栈见第 14 节。

### 9.3 Color、Appearance 与状态

原生应用使用动态系统颜色，包括 Label、Secondary Label、Tertiary Label、Window Background、Control Background、Separator、Selected Content Background、Unemphasized Selected Content Background 和 Control Accent Color。

系统颜色会随 Light / Dark、Increase Contrast、窗口活动状态、Desktop Tinting、Accent Color 和系统版本变化，不得把视觉稿中的 RGB 值记录为系统规范。

- 标准控件自动响应用户 Accent Color；品牌色不得覆盖所有系统交互色。
- 固定颜色只用于稳定业务语义，不把所有可点击文字、Sidebar Icon 和 Primary Button 写死为蓝色。
- Accent、Green、Yellow、Red、Gray 可分别作为主要交互、成功、警告、错误和次要状态的起点，但必须结合领域与地区语义。
- 颜色选择同时考虑文化、金融涨跌色等领域惯例、当前上下文和色觉差异。
- Dark Mode 单独校准背景层级、文字、Separator、Material、Shadow、Hover、Selection、Accent、图像和图标，不做简单反色。
- Dark Mode 不以纯黑和纯白作为唯一层级。
- 原生应用通常跟随系统 Appearance；只有内容创作、预览或专业任务需要时才增加应用内外观选择。

### 9.4 Materials 与 Liquid Glass

当前系统将材质分为：

- **Liquid Glass**：Controls、Navigation、Toolbar、Sidebar、Floating Controls、Popover、Menu、Alert、Sheet 等顶层功能层。
- **Standard Materials**：Content Layer 内的结构和层级。

Liquid Glass 不用于每个 Card、Table Cell、主要阅读背景、嵌套内容容器或装饰光斑。

- Regular 适合文字较多、背景复杂或需要稳定可读性的控件。
- Clear 只用于照片、视频等视觉丰富且默认对比可控的背景，并根据亮度提供 Dimming。
- 原生优先使用标准 App Structure、Toolbar、Sidebar、Search、Controls 和 Presentation；只有重要的顶层自定义控件才考虑自定义 Glass Effect。
- 相邻 Glass Element 正确分组，避免错误采样。
- macOS 26+ 的 Sidebar 可作为悬浮 Glass Pane，Toolbar Item 自动形成 Glass Group，Inspector 可使用 Edge-to-edge Glass；内容可延伸到 Sidebar 与 Toolbar 下方，并通过 Scroll Edge Effect 保持可读性。
- 较大 Sidebar 会提高不透明度以保持可读性；图标通常响应 Accent Color，行高、文字和图标尺寸可随系统 Sidebar Size 改变。自定义实现不得写死全部图标颜色或让背景破坏对比度。
- Toolbar、Menu、Sheet 和 Alert 与触发源保持空间连续性。
- 桌面壳或 Web 的 `backdrop-filter` 只能模拟 Blur，不能复现动态采样、折射、光照、层级和无障碍降级，也不得被称为完整 Liquid Glass。
- 背景内容滚动时持续测试文字和控件对比度。

### 9.5 Concentricity 与几何

- **Fixed Shape**：固定圆角。
- **Capsule**：半径等于高度一半。
- **Concentric Shape**：根据父容器半径减去内边距计算。

Mini、Small、Medium 控件在高密度桌面环境中通常使用 Rounded Rectangle；Large 与 Extra Large 可用 Capsule 强调。不得把所有容器统一为 16 px 或 20 px 圆角，也不得在密集 Inspector、Toolbar 和 Table Control 中滥用 Capsule。靠近 Window Corner 的控件遵循系统 Corner-avoiding Layout Guide。

Web Radius Token 应区分 Window、Popover、Panel、Control 和 Badge，并维持父子半径与内边距关系。

### 9.6 Iconography

- 原生优先使用 SF Symbols，并匹配相邻文字的 Weight、Scale 和 Baseline。
- 自定义 Symbol 匹配系统细节、视觉重量、对齐与透视；受限制的 Apple 产品 Symbol 不用于 Logo 或品牌。
- Web 可选择一套一致的线性图标系统，但不得把 Lucide 等称为 SF Symbols，也不得混用 Emoji、彩色 SVG、Filled Icon 和多套线性图标。
- 图标语义不明确时显示文本；自定义图标提供 Accessible Name。

### 9.7 Spacing 与点击区域

原生优先使用标准控件、Layout Guide、Safe Area 和系统间距，不把固定 4 px Scale 当作 Apple 官方规范。

Web 可使用以下范围作为起点：

| 关系 | 间距 |
|---|---|
| Icon ↔ Label | 6–8 px |
| Control Gap | 8 px |
| Related Fields | 8–12 px |
| Section Internal | 12–16 px |
| Section Gap | 20–32 px |
| Workspace Margin | 20–32 px |

最终以可读性、扫描效率、点击准确性、窗口尺寸和任务密度为准。

macOS 控件推荐点击区域至少为 28 × 28 pt，最低不小于 20 × 20 pt；视觉图标可以更小，但点击区域不能随之缩小，相邻控件之间应避免误触。

### 9.8 Motion

动画体现 Continuity、Origin、Destination、Physicality 和 Restraint，并能回答“从哪里来、为何出现、到哪里去”。

适合表达 Inspector 展开、Popover 与 Trigger 的关系、Sheet / Menu / Alert 的来源、Selection 与 Detail 连续性、Drag Preview 与 Drop Result。避免无来源缩放、全界面弹跳、每次过渡都使用 Blur 或阻塞输入。

---

## 10. Feedback、System Status 与 Progress

macOS 不存在一套通用的 `Inline → Toast → Popover → Banner → Sheet → Dialog` 打断等级。反馈容器由信息重要程度、作用范围和用户下一步决定。

### 10.1 成功与错误

- Copy、Save、Refresh、Sort、Filter 等常规成功通过内容或控件状态变化表达，不为每次操作显示 Toast。
- 影响较大、耗时较长、结果不在当前界面可见或需要确认最终状态时，提供明确完成反馈。
- 错误说明发生了什么、影响范围、可采取的动作、输入是否保留，以及能否重试或恢复。
- 可在当前上下文解决的问题优先 Inline Error；只有关键且必须立即处理的问题使用 Alert。

### 10.2 Progress

- 时长已知使用 Determinate Progress，未知使用 Indeterminate Progress。
- 局部任务在局部显示，不锁住整个窗口。
- 长任务显示状态，并在可行时支持 Cancel、Pause 或后台继续。
- 进度不得长期停在某个百分比而没有说明；卡住时给出原因和解决路径。
- Skeleton 仅用于结构已知且不会造成明显布局跳变的 Web 内容；原生优先使用标准 Progress Indicator 和真实占位状态。

---

## 11. Accessibility

Accessibility 从信息架构和组件选择阶段开始。

### 11.1 语义与辅助技术

- 每个 Button、Icon、Form Control 和交互对象有简短 Accessible Name；必要时用 Hint 说明结果。
- 不朗读装饰元素；正确暴露 Selection、Expanded、Checked、Disabled 和 Progress 等状态。
- 必要的动态变化发送无障碍通知。
- 自定义 Table、Canvas、Tree 和 Drag & Drop 区域定义合理语义。
- Voice Control 使用可说出的稳定 Label；多个可见控件不能使用无法区分的同名。
- Switch Control 能扫描、聚焦和激活自定义控件；高精度拖动另提供数值输入或键盘微调。

### 11.2 Full Keyboard Access 与 Focus

- 所有核心功能都能通过键盘完成。
- Tab / Shift-Tab 的焦点顺序与视觉顺序一致，Arrow Keys 在集合、菜单和表格中按预期导航。
- Focus Ring 清楚且不被裁切。
- Modal 出现后焦点进入正确位置，关闭后回到 Trigger。
- VoiceOver 开启后，键盘路径仍然有效。

### 11.3 可读性与系统偏好

- 默认文本达到可读尺寸，并支持必要的更大文本或缩放。
- 17 pt 及以下普通文字通常至少达到 4.5:1 对比度；较大或粗体文字通常至少达到 3:1。
- Disabled 状态可辨认，但不能看起来仍可操作。
- Increase Contrast 下增强文字、边界和 Selection。
- Reduce Motion 下减少位移、缩放、视差和自动播放。
- Reduce Transparency 下使用可读的不透明或更厚背景，且保持 Pane 与控件关系。
- Error、Warning、Success、Selected、Required、Changed 等状态同时使用文字、Symbol、形状、图案或位置。
- 动画、透明度和颜色不得承载唯一信息；相关效果被系统关闭后，状态、文字和布局仍须完整。

---

## 12. AI 产品的 macOS UX

AI 产品在本指南通用要求之外，还必须明确模型状态、内容真实性和外部副作用。

### 12.1 状态与控制

区分并正确呈现：

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

- 不用永久旋转的 Spinner 代替完整状态。
- 允许 Stop，并遵守第 7.5、10.2 节的恢复与长任务要求。
- 不因模型开始生成而锁住整个窗口。
- 用户可以查看系统将要做什么、已经做了什么，并能确认、撤销、恢复或重试。

### 12.2 外部副作用

发送消息或邮件、发布、删除文件、修改远端数据、支付、交易、预订、创建长期自动化、访问敏感账户或数据前，必须提供与风险匹配的预览和确认。执行记录应靠近动作发生的上下文。

### 12.3 内容真实性与隐私

- 区分用户内容与 AI 生成内容，必要时显示来源和验证状态。
- 不确定内容不得使用与已验证事实相同的视觉状态。
- 自动修改支持 Diff、Review 或 Undo，不把模型推测伪装成系统事实。
- 错误和未验证状态不得被动画或装饰效果掩盖。
- 清楚说明数据发送位置、模型或服务提供方，以及本地、云端和第三方处理边界。
- 最小化上传范围；本地处理、不保存等敏感选项应易于理解。
- 权限请求必须与当前任务相关。

---

## 13. 实施与验收

### 13.1 实施顺序

| 顺序 | 目标 |
|---|---|
| 1 | 明确原生、桌面壳或 Web、最低 macOS 版本及可用系统能力。 |
| 2 | 按 Workspace、Selection、Detail、Command 重建 Information Architecture。 |
| 3 | 建立统一 Command，并连接 Menu、Toolbar、Context Menu、Shortcut、Undo 和错误反馈。 |
| 4 | 删除重复 Page Header、无意义 Card、Border、Shadow、Badge、背景色和多余 Primary Action。 |
| 5 | 完成 Selection、Keyboard、Context Menu、Drag & Drop、Column Resize、Window Resize 与恢复。 |
| 6 | 优先采用 System Font、Semantic Color、Standard Control、SF Symbols、Standard Material 和系统功能层。 |
| 7 | 完成无障碍语义、Focus、替代操作和系统偏好适配。 |
| 8 | 在真实环境、真实数据和失败条件下验收。 |

AI 生成的界面同样以本指南为唯一约束来源，不能用额外“Apple 风格”提示覆盖平台边界；生成结果必须人工验证。

### 13.2 验收矩阵

| 维度 | 必测条件 |
|---|---|
| 设备与窗口 | 真实 Mac；最小和最大窗口；半屏、三分之一、三分之二、四分之一平铺；全屏；多显示器；不同缩放；Camera Housing。 |
| 工作区 | Toolbar Overflow；Sidebar / Inspector 自动隐藏和恢复；Pane Resize；多窗口；状态恢复；Main / Key / Inactive。 |
| 外观 | Light、Dark、不同 Accent Color、Desktop Tinting、Increase Contrast、Reduce Transparency、Reduce Motion。 |
| 输入 | 键盘、不同键盘布局和输入法、鼠标、触控板、Context Menu、Drag & Drop。 |
| 辅助技术 | Accessibility Inspector、VoiceOver、Full Keyboard Access、Voice Control、Switch Control。 |
| 内容与性能 | 空、加载、成功、失败、离线、慢网络、冲突、大数据量、长文本、中英文混排、不同字体与窗口缩放、长时间使用。 |
| 生命周期 | 切换应用、进入和离开全屏、重新打开、系统升级后的标准组件行为。 |

---

## 14. Design Tokens：原生语义与 Web Fallback

### 14.1 原生应用

原生应用不得把系统外观降级为固定 HEX、RGBA、字号和 Radius。优先使用 Dynamic System Colors、System Fonts、Standard Control Sizes、System Materials、Layout Guides、SF Symbols、User Accent Color 和 Accessibility Settings。

### 14.2 Web 建议 Token

以下 Token 只用于建立一致的 Web 近似，不代表 Apple 官方数值：

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

### 14.3 Token 约束

- Component 只引用 Semantic Token，不在多个组件中重复硬编码 Accent。
- Light / Dark 不共用未经验证的固定色；Increase Contrast 单独增强。
- Reduce Transparency 后替换半透明背景。
- Radius 按层级和同心关系使用，不机械统一。

---

## 15. 官方参考资料

以 Apple 当前 HIG 为最高参考。

### Foundations

- [Design Principles](https://developer.apple.com/design/human-interface-guidelines/design-principles)
- [Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos)
- [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

### App structure

- [Windows](https://developer.apple.com/design/human-interface-guidelines/windows)
- [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)
- [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)
- [Split Views](https://developer.apple.com/design/human-interface-guidelines/split-views)
- [Panels](https://developer.apple.com/design/human-interface-guidelines/panels)
- [Tab Views](https://developer.apple.com/design/human-interface-guidelines/tab-views)

### Commands and input

- [Menus](https://developer.apple.com/design/human-interface-guidelines/menus)
- [Context Menus](https://developer.apple.com/design/human-interface-guidelines/context-menus)
- [Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards)
- [Pointing Devices](https://developer.apple.com/design/human-interface-guidelines/pointing-devices)
- [Drag and Drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop)
- [Undo and Redo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo)
- [Searching](https://developer.apple.com/design/human-interface-guidelines/searching)
- [Search Fields](https://developer.apple.com/design/human-interface-guidelines/search-fields)

### Presentation and feedback

- [Modality](https://developer.apple.com/design/human-interface-guidelines/modality)
- [Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers)
- [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)
- [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts)
- [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback)
- [Progress Indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators)

### Visual system

- [Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Color](https://developer.apple.com/design/human-interface-guidelines/color)
- [Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
- [SF Symbols](https://developer.apple.com/design/human-interface-guidelines/sf-symbols)
- [Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [Lists and Tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)
- [Outline Views](https://developer.apple.com/design/human-interface-guidelines/outline-views)

### Current design system

- [Meet Liquid Glass — WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/)
- [Get to know the new design system — WWDC25](https://developer.apple.com/videos/play/wwdc2025/356/)
- [Build an AppKit app with the new design — WWDC25](https://developer.apple.com/videos/play/wwdc2025/310/)
