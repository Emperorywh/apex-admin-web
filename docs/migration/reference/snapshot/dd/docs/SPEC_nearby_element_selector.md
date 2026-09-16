# SPEC：右键「选择附近元素」（重叠路径选取 + 连通分量批量选中）

> 状态：设计规格（核心决策已通过 5 轮访谈确认；§3.3 候选范围经第 5 轮修正为「仅路径」；经代码评审修订：§3.7 隐藏路径不纳入连通分量、§5.7.2 useMemo 依赖修正、§5.4/§5.7.4 代码细节修正）
> 日期：2026-08-03
> 关联代码：`src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/index.tsx`、`src/pages/MapThrough/MapNestModify/NestGraph/ContextMenu/index.tsx`、`src/constants/mapThrough.ts`、`src/types/MapNestModify/index.d.ts`、`src/utils/bindStage.ts`、`src/utils/graph.ts`（`bezierSamplePoints`）

---

## 1. 背景与目标

地图编辑器（MapNestModify）现有左键单击、Ctrl 多选、框选三种选中入口。当**多条路径重叠**或**节点与路径叠在一起**时，左键只能命中 Konva 渲染树最顶层的单个 Shape，无法选中被遮挡的元素，用户被迫反复拖动/隐藏元素才能选中目标。

本次新增**右键「选择附近元素」**入口：在右键位置周围一定屏幕半径内搜索所有路径，以**二级候选菜单**列出，用户点选其一后**自动沿连通分量扩散**，把该路径所在连通分量的所有路径一次性加入 `selectShapes`（进入属性面板批量修改），并把分量内的节点与路径在各自 Layer 内**置顶**以突出显示。

### 1.1 用户故事

> 作为地图编辑者，当多条路径叠在一起难以点选时，我希望在某区域**右键**，从弹出的候选列表里**精确选中目标路径**，系统**自动把这条路径所在连通分量的所有路径都选中**并放到画布顶层，让我**批量修改配置**（限速、避障、车辆分组等）。

### 1.2 典型数据（用户提供）

3 组节点完全叠合（每组 3 个节点同坐标），构成 3 条视觉重合的 `A→B` 直线 + `B→C` 贝塞尔双向通道：

| 视觉位置 | 叠合节点 | 说明 |
| --- | --- | --- |
| 左端点 (-4.27, -11.22) | 节点 1 / 4 / 7 | 三节点坐标完全一致 |
| 中点 (-0.91, -11.32) | 节点 2 / 6 / 9 | 2 与 6 完全一致，9 差 0.01m |
| 右端点 (0.60, -13.73) | 节点 3 / 5 / 8 | 3 与 5 完全一致，8 差 0.01m |

对应 12 条边，构成 3 个**互不连通的子图**（组 A: 节点1-2-3 + 路径1/4/2/3；组 B: 节点4-6-5 + 路径5/6/7/8；组 C: 节点7-9-8 + 路径9/10/11/12），三组在画布上视觉完全重合。

**预期**：右键重叠区 → 候选列出 12 条路径（按到鼠标距离升序）→ 点「路径 2」→ 选中组 A 全部 4 条路径（路径 1/4/2/3）→ 属性面板进入「路径批量改」→ 节点 1/2/3 置顶。

---

## 2. 现有机制回顾（实现基线）

阅读 `GraphStage/index.tsx`、`ContextMenu/index.tsx`、`BrushSelect/index.tsx` 后确认的关键事实，新功能必须遵守：

1. **右键事件链**：`Stage.onContextMenu` → `onStageContextMenu`（GraphStage:339）→ `setContextMenu({ open, left, top, event })` → `ContextMenu`（antd `Dropdown`）渲染。`ContextMenuType = { open?, left?, top?, event? }`（types/MapNestModify:88）。
2. **manualKey 守卫**：非框选模式（`brushSelect*`）右键**先退出当前模式并 return**（不弹菜单）；框选模式右键直接弹菜单。新功能作为菜单项，**沿用此逻辑，不改右键守卫**。
3. **只读守卫**：`!enableModify` 时 `onContextMenu` 仅 `preventDefault`，不弹菜单。新功能天然不触发。
4. **菜单项定义**：`menuItems`（constants/mapThrough:330），每项 `enable: string[]` 标注命中类型（`"stage" | "node" | "edge" | "robot"`）。`ContextMenu` 的 `useMemo` 按 `event.target` 分类过滤。
5. **子菜单挂载**：`ContextMenu` 的 `itemsWithChildren` 给 4 个区域一级项动态生成 `children`；一级项 `disabled` ⟺ `children` 非空且全部 `disabled`（空数组 `every` 返回 `true` → 置灰，与「无区域时区域项置灰」同机制）。
6. **点击分派**：`onContextMneuClick` 用 `keyPath.indexOf(一级key) !== -1` 分派区域子菜单，`switch(key)` 分派普通项。子菜单项 `key` = 业务 id（区域用 groupId）。
7. **选中机制**：`selectShapes` state + `attrs.state === "selected"` 为选中判据；`updateShapeStyle(shape)` 设选中、`deselectShape(shape)` 取消；`unSelectShapeEvent(event)` 批量还原。
8. **坐标变换**：`worldToScreen(worldX, worldY, stage)`（bindStage:31）含完整 `translate * rotate * scale`，与旋转/缩放天然兼容。**edge 数据 `y` 与画布 `y` 反向**（§2.4 of SPEC_brush_same_direction 已确立）：转屏幕坐标需 `worldToScreen(sx, -sy, stage)`。
9. **BEZIER 采样**：`bezierSamplePoints(sx, sy, cx, cy, dx, dy, ex, ey, 32)` 返回世界点数组（**已含 y 取反**，见 BrushSelect:66 注释），逐点 `worldToScreen` 转屏幕即可。
10. **Layer 顺序**：`GridLayer → AreaLayer → EdgesLayer → DeviceLayer → ActionBadgeLayer → AnglesLayer → ActionLayer → NodesLayer → RobotLayer`。节点永远盖住路径。同 Layer 内可用 `shape.moveToTop() / moveUp()`；**跨 Layer 无 z-index 可比**。
11. **Transformer 不干扰纯路径选中**：`Transformer`（ActionLayer）仅绑定 `enableSelect === "node"` 的 Shape，且 `resizeEnabled / borderEnabled` 全 `false`。纯路径选中时 `nodes` 为空数组，无任何手柄。
12. **AttributePane 自动分派**：`selectShapes` 全是 edge → `EdgeShape`（含 `BatchModifyTips` 批量改面板）；全是 node → `NodeShape`；混合/空 → 默认 Alert。新功能产出纯路径选中，**面板无需改动**。
13. **撤销快照**：`saveSnapshot()` 仅在**改数据**时调用（删除、拖动、改属性）。**选中操作不改数据，不 saveSnapshot**。

---

## 3. 设计决策（访谈结论）

### 3.1 触发入口：现有右键菜单新增一级项 ✅

在 `ContextMenu` 现有菜单中追加一项 **「选择附近元素」**（省略号暗示有子菜单），**hover 展开二级候选列表**。不替代、不抢现有菜单（批量删除/等距插入/对齐/区域等全部保留），不新增独立快捷键。

- 用户右键习惯完全不变；
- 候选列表复用 antd `Dropdown` 的 `children` 子菜单机制，与区域项同款；
- 只读模式 / manualKey 模式下的右键守卫**不变**。

> 备选与放弃理由：
> - **右键直接弹候选替代常规菜单**：丢失批量删除/对齐/区域等入口，破坏性大；
> - **智能切换（重叠时弹候选否则弹原菜单）**：行为不可预测，学习成本高；
> - **独立快捷键（Shift+右键）**：多一个组合键需记忆，发现性差。

### 3.2 菜单项位置与 enable ✅

- **位置**：在「添加反向路径」之后、4 个区域项之前（与选中/路径操作聚类）。
- **enable**: `["stage", "node", "edge"]` —— 右键空白、右键命中节点、右键命中路径时**均出现**；右键 robot 不出现。
- **label**: `"选择附近元素"`（中文硬编码，与现有 `menuItems` 文案风格一致，不走 locales）。

### 3.3 候选范围：仅路径 ✅（第 5 轮修正）

候选列表**只含路径**，不含节点、不含区域/交管组。

- 第 2 轮原选「路径 + 节点」，但与 §3.7「selectShapes 仅路径」存在语义冲突（点节点后节点不进 selectShapes，选中"消失"）；
- 第 5 轮修正为仅路径，彻底消除冲突；节点重叠仍可由现有「放大画布后左键」或未来独立功能解决，**不在本期范围**。

### 3.4 「附近」判定：屏幕 30px 像素半径命中圆 ✅

以**鼠标右键位置的屏幕坐标**（相对于 stage 容器，即 `stage.getPointerPosition()` 返回值）为圆心、**30 屏幕像素**为半径做命中圆。

- **屏幕像素而非世界坐标**：缩放/旋转下视觉范围恒定，体验稳定（缩放 50x → 0.6m 世界，缩放 1000x → 0.03m 世界，放大后能精确筛出更紧凑的重叠元素）；
- **worldToScreen 已含 rotation**：30px 圆天然适配画布旋转，无需额外处理；
- **30px 与现有路径命中带量级接近**（注意量纲不同：现有 `hitStrokeWidth` 是世界单位 `lineWidth * 3`、随缩放变化，30px 是屏幕恒定值，二者仅在常用缩放下量级相当）。

### 3.5 几何距离：采样点最近距离 ✅

- **直线边（LINE）**：鼠标屏幕点 P 到线段 `A—B` 的最短距离，其中 `A = worldToScreen(sx, -sy, stage)`、`B = worldToScreen(ex, -ey, stage)`（注意 edge 数据 y 取反，§2.8）。
- **贝塞尔边（BEZIER）**：复用 `bezierSamplePoints(sx, sy, cx, cy, dx, dy, ex, ey, 32)`（返回世界点，已含 y 取反），逐点 `worldToScreen` 转 32 个屏幕点，求 P 到 31 条相邻小线段的最短距离。**与 `BrushSelect.findShapesInRect` 的 BEZIER 命中逻辑完全同源**。

### 3.6 性能策略：AABB 粗筛 + 采样精筛 ✅

万级数据下直接对每条 BEZIER 边做 32 点采样距离计算（~30 万次运算）可能卡顿 30~50ms。采用两阶段：

1. **AABB 粗筛**（O(n)，1 次比较/元素）：对每条边计算其屏幕轴对齐包围盒（端点 / 采样点的 min/max x/y），与以鼠标为圆心 30px 的**外接正方形** `[px-30, py-30, px+30, py+30]` 做相交测试。不相交直接剔除。
2. **采样精筛**：仅对粗筛幸存者（通常 < 10 条）执行 §3.5 的精确距离计算，距离 ≤ 30px 则纳入候选。

> **AABB 缓存说明**：本期**不缓存**采样点 / AABB。右键是低频操作（秒级一次），每次实时计算即可；缓存需引入拖动/缩放/改属性等多编辑点的脏标记，复杂度不值。若后续 Overlook 监控视图高频复用，再评估缓存。

### 3.7 selectShapes 内容：仅路径 ✅

候选点击后，连通分量里的**所有可见路径**进 `selectShapes`（加 `state="selected"` 样式），**节点不进** `selectShapes`，**隐藏路径也不进**。

- 与用户原话「对路径加上选中状态，方便我批量修改」一致；
- `AttributePane` 自动进 `EdgeShape` 批量改面板（§2.12），**面板无需改动**；
- 节点不进选中集 → 不污染 `state="selected"` 选中判据（§2.7），避免「混合批量改」的复杂度；
- **连通分量内的隐藏路径（`!isVisible()`）不纳入**：BFS 建索引时过滤（§5.5），与候选搜索、`BrushSelect` 框选同一口径——隐藏路径若进选中集，批量改会静默修改用户看不见的路径。

### 3.8 连通范围：整个连通分量 ✅

从选中路径的两端节点（`snodeId` / `enodeId`）出发，做**无向 BFS**遍历所有可达节点和路径（不区分方向、不带折返守卫——与 `SPEC_brush_same_direction` 的有向同向遍历**不同**，本功能是纯连通分量，正反向边都纳入）。

- 选中「路径 2」（2→3）→ BFS 从节点 2、3 出发 → 命中组 A 全部：节点 1/2/3 + 路径 1/4/2/3；
- 用户示例的 3 组叠合子图互不连通，BFS 天然只扩散到选中边所在那一组，不会跨组污染。

### 3.9 万级保护：超阈弹确认框（阈值 500）✅

BFS 过程中实时计数，**超过 500 个元素时中止 BFS 并弹 `Modal.confirm`**「该连通分量含超过 500 个元素，选中后可能造成卡顿，是否继续？」（截断 BFS 拿不到精确总数，文案用「超过 500」口径，与 §5.7.4 实现一致）。用户确认后重新做一次**完整 BFS**（无上限）并选中；取消则不选中。

- 两阶段 BFS：第一阶段带 500 计数上限（防万级阻塞主线程），超限即止 → 弹确认 → 确认后第二阶段完整 BFS；
- 阈值 500 兼顾常见地图（连通分量多在百级以内）与极端大图（万级时给出拦截）。

### 3.10 顶层语义：同 Layer 内 moveToTop ✅

- 选中路径在 `EdgesLayer` 内 `moveToTop()`（盖住未选中路径）；
- 连通分量的节点在 `NodesLayer` 内 `moveToTop()`（盖住未选中节点，用于重叠节点场景）；
- **不新建临时 Layer**、不改变 Layer 声明顺序；
- 节点仍盖住路径（保持现有视觉惯例）。

> 备选与放弃理由：
> - **新建临时顶层 Layer**：选中路径会盖住所有未选中节点，与现有「节点遮路径端点」习惯相反；且破坏 `DeviceLayer`/`ActionBadgeLayer` 装饰关系，attrs 同步复杂；
> - **高亮 + 压暗非选中**：不动 z-index 仅改 opacity/样式，视觉聚焦强但不符合「顶层」字面语义，且需额外管理非选中元素的样式恢复。

### 3.11 节点视觉：不加标记，仅置顶 ✅

连通分量的节点**不进 selectShapes、不加任何视觉标记**（不描边、不光晕、不加角标）。仅靠 `moveToTop` 在 `NodesLayer` 内置顶。

- 用户需通过「选中路径的端点」自行推断哪些节点属于分量；
- 加独立标记会引入新的样式状态（与 `state="selected"` 并列），增加样式管理复杂度，且与「节点不进选中集」的简洁定位冲突；
- `moveToTop` 在节点无重叠时无视觉效果，仅在节点重叠时生效（正是重叠场景才需要）。

### 3.12 候选项点击语义：单击覆盖 ✅

在候选列表里点击某条路径 → **清空现有 `selectShapes`** → BFS 扩散该路径所在连通分量 → 仅路径进 `selectShapes`。

- 与现有左键单击「覆盖单选」语义一致；
- 不支持 Ctrl 式追加（连通分量已是批量多选，再叠加多分量追加易混乱）；
- 不支持悬停预览（避免 hover 时高频 BFS 的性能开销）。

### 3.13 候选规模：最多 30 项 ✅

候选列表按距离升序排列，**最多显示 30 项**；超出时截断并在末尾追加一条 `disabled` 的「还有 N 项未显示」提示项。30px 半径下 30 项覆盖绝大多数重叠场景。

### 3.14 生命周期：与现有选中同生命周期 ✅

选中连通分量等同**一次「批量多选」**，完全复用现有选中的清空/覆盖/toggle 机制，不引入额外状态：

| 操作 | 行为 |
| --- | --- |
| 左键空白 | 清空 selectShapes（含连通分量选中） |
| 左键点别的元素 | 覆盖（连通分量选中被替换） |
| Ctrl + 左键 | 追加/移除单元素（toggle） |
| 框选 | 覆盖 |
| 再次右键 → 候选 → 点别的路径 | 覆盖（新连通分量替换旧的） |
| 切换地图 | `selectShapes` 清空（现有逻辑） |

> **轻微不一致（可接受）**：选中连通分量后，若用户 Ctrl 取消了其中几条路径，`selectShapes` 会缩减，但分量节点的 `moveToTop` 不会回退（节点无 toggle 机制）。因节点不加视觉标记（§3.11），此不一致无可见副作用。

### 3.15 候选项显示字段 ✅

每项 label 格式：

```
◇ <路径名>  <snode名>→<enode名>  <LINE|BEZIER> <正向|反向>  <id末4位(仅重名时)>
```

- `◇`：路径图标（统一，不区分 LINE/BEZIER，几何类型已用文字标注）；
- `<路径名>`：`shape.attrs.data.name`；
- `<snode名>→<enode名>`：从 stage 查 `snodeId`/`enodeId` 对应节点 Shape 的 `attrs.data.name`，查不到则用 id 末 4 位兜底；
- `<LINE|BEZIER>`：`shape.attrs.data.edgeType`；
- `<正向|反向>`：`shape.attrs.data.isBackEdge ? "反向" : "正向"`；
- `<id末4位>`：仅当本次候选列表内存在**重名路径**时，在末尾附 `shape.id().slice(-4)` 以唯一识别（用户示例无重名，属锦上添花）。

---

## 4. 边界与异常

| 场景 | 行为 |
| --- | --- |
| 30px 内无任何路径 | 一级项「选择附近元素」`children = []` → `every` 空 = true → **置灰不可展开**（与区域项无区域时置灰同机制，§2.5） |
| 30px 内仅 1 条路径 | 候选列出该 1 条；点击 → 选中其连通分量 |
| 候选超 30 项 | 截断到 30 项 + 末尾 `disabled`「还有 N 项未显示」 |
| 连通分量 ≤ 500 | 直接 BFS 选中 |
| 连通分量 > 500 | 弹 `Modal.confirm`；确认 → 完整 BFS 选中；取消 → 不选中、菜单关闭 |
| 连通分量 = 整张图（选中枢纽边） | 触发 > 500 拦截，由用户决定是否继续 |
| 选中边所在连通分量含正反向边对（A↔B） | 正反向边都纳入（纯连通分量，**无折返守卫**，与 `SPEC_brush_same_direction` §4.7 不同） |
| 路径已隐藏（`!isVisible()`） | 不参与候选；连通分量 BFS 同样跳过（选中集与批量改不含隐藏路径，与 BrushSelect 框选同口径，§3.7） |
| 候选路径的端点节点已被删除（孤儿边） | BFS 时查不到节点 Shape 则跳过该节点，仅选中可达路径 |
| 只读模式（`!enableModify`） | 右键不弹菜单（现有守卫，§2.3），新功能不触发 |
| manualKey 非 box 模式右键 | 先退出模式 return（现有守卫，§2.2），不弹菜单 → 新功能不触发 |
| manualKey 框选模式右键 | 直接弹菜单（现有守卫），新功能可用 |
| 候选点击后菜单关闭 | 沿用现有 `window click` 关闭机制（§2.6），无需额外处理 |
| 画布旋转/缩放 | `worldToScreen` 含完整变换（§2.8），30px 屏幕半径天然适配 |
| `bezierSamplePoints` 控制点为 null（直线误标 BEZIER） | 退化为端点距离（防御性：`cx/cy/dx/dy` 任一为 null 时按直线处理） |
| 候选路径数据缺 `snodeId/enodeId`（异常数据） | BFS 把被点选路径本身强制纳入结果（§5.5），至少选中该 1 条，不静默清空现有选中 |

---

## 5. 技术实现方案

### 5.1 涉及文件

| 文件 | 改动 |
| --- | --- |
| `src/types/MapNestModify/index.d.ts` | `ContextMenuType` 新增可选字段 `nearbyCandidates?: NearbyCandidate[]`；新增 `NearbyCandidate` 接口 |
| `src/constants/mapThrough.ts` | `menuItems` 在「添加反向路径」后新增 `selectNearbyElements` 项 |
| `src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/index.tsx` | `onStageContextMenu` 在调 `setContextMenu` 前，计算 30px 内候选路径列表并存入 `contextMenu.nearbyCandidates` |
| `src/pages/MapThrough/MapNestModify/NestGraph/ContextMenu/index.tsx` | `itemsWithChildren` 给 `selectNearbyElements` 项挂 `children`（来自 `contextMenu.nearbyCandidates`），**所属 `useMemo` 依赖数组同步加入 `contextMenu.nearbyCandidates`**（§5.7.2）；`onContextMneuClick` 新增 `selectNearbyElement` 分派；新增 `onSelectNearbyElement`（BFS 连通分量 + 选中 + 置顶 + 超阈确认） |
| `src/utils/nearbyElements.ts`（新增） | 纯函数：`findNearbyEdges`（候选搜索，AABB 粗筛 + 采样精筛）、`collectConnectedComponent`（无向 BFS 连通分量） |

### 5.2 类型扩展（types/MapNestModify/index.d.ts）

```ts
/** 「选择附近元素」候选项：路径 Shape + 到鼠标的屏幕像素距离 */
export interface NearbyCandidate {
    /** 路径 Konva.Shape（enableSelect === "edge"） */
    shape: Konva.Shape;
    /** 鼠标到该路径的屏幕像素距离（用于升序排序与截断） */
    distance: number;
}

export interface ContextMenuType {
    open?: boolean;
    left?: number;
    top?: number;
    event?: Konva.KonvaEventObject<MouseEvent>;
    /** 「选择附近元素」候选列表（右键时计算，ContextMenu 直接消费，避免菜单渲染时鼠标已移走导致 getPointerPosition 失真） */
    nearbyCandidates?: NearbyCandidate[];
}
```

> **为何把候选存入 state 而非 ContextMenu 渲染时计算**：`onStageContextMenu` 触发时 `stage.getPointerPosition()` 返回右键位置；但 `Dropdown` 打开后鼠标移到菜单上，此时 `getPointerPosition()` 不再是右键位置。故在事件触发瞬间计算并暂存。

### 5.3 菜单项（constants/mapThrough.ts）

在 `menuItems` 的「添加反向路径」项之后插入：

```ts
{
    key: "selectNearbyElements",
    label: "选择附近元素",
    enable: ["stage", "node", "edge"]
},
```

> `ContextMenu` 的 `useMemo` filter 对 stage / node / edge 三种命中都会 `item.enable.includes(...)` 命中此项；robot 命中不命中（enable 不含 robot）。

### 5.4 候选搜索算法（src/utils/nearbyElements.ts，新增）

纯函数，输入 stage + 鼠标屏幕坐标 + 半径，返回 `NearbyCandidate[]`（按距离升序，已过滤 > 30px）。

```ts
/**
 * @description 「选择附近元素」候选搜索：以鼠标屏幕坐标为圆心、
 *              半径 radius 像素内搜索所有路径，返回按距离升序的候选列表。
 *              两阶段：AABB 粗筛（O(n)）→ 采样精筛（仅幸存者）。
 *              候选范围仅路径（节点不参与，SPEC §3.3）。
 */
import Konva from "konva";
import { worldToScreen } from "@/utils/bindStage";
import { bezierSamplePoints } from "@/utils/graph";
import type { NearbyCandidate } from "@/types/MapNestModify";

/** 默认搜索半径（屏幕像素，SPEC §3.4） */
const DEFAULT_RADIUS = 30;

/** 点 P 到线段 AB 的最短距离（屏幕坐标系） */
function pointToSegmentDistance(
    px: number, py: number,
    ax: number, ay: number,
    bx: number, by: number
): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    // AB 退化为点：直接返回 PA 距离
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t)); // 投影钳制到 [0,1]
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    return Math.hypot(px - cx, py - cy);
}

/**
 * 计算鼠标到一条路径的屏幕像素距离（直线 / 贝塞尔统一接口）。
 * 注意 edge 数据 y 与画布 y 反向（§2.8）：worldToScreen(sx, -sy, stage)。
 * BEZIER 控制点为 null 时退化为直线（防御性，§4 边界）。
 */
function edgeScreenDistance(
    shape: Konva.Shape,
    px: number, py: number,
    stage: Konva.Stage
): number {
    const d = shape.attrs.data || {};
    const { sx, sy, ex, ey, cx, cy, dx, dy } = d;
    // 直线 / 控制点缺失：用两端点
    if (cx == null || cy == null || dx == null || dy == null) {
        const a = worldToScreen(sx, -sy, stage);
        const b = worldToScreen(ex, -ey, stage);
        return pointToSegmentDistance(px, py, a.x, a.y, b.x, b.y);
    }
    // 贝塞尔：32 点采样（已含 y 取反）→ 逐段最短距离
    const worldPts = bezierSamplePoints(sx, sy, cx, cy, dx, dy, ex, ey, 32);
    let minDist = Infinity;
    for (let i = 0; i < worldPts.length - 1; i++) {
        const a = worldToScreen(worldPts[i].x, worldPts[i].y, stage);
        const b = worldToScreen(worldPts[i + 1].x, worldPts[i + 1].y, stage);
        const dist = pointToSegmentDistance(px, py, a.x, a.y, b.x, b.y);
        if (dist < minDist) minDist = dist;
    }
    return minDist;
}

/**
 * 候选搜索主函数。
 * @param stage    Konva.Stage
 * @param pointerX 鼠标屏幕坐标 x（stage.getPointerPosition().x）
 * @param pointerY 鼠标屏幕坐标 y
 * @param radius   搜索半径（默认 30px）
 * @returns        按距离升序的候选列表（已过滤 > radius）
 */
export function findNearbyEdges(
    stage: Konva.Stage,
    pointerX: number,
    pointerY: number,
    radius: number = DEFAULT_RADIUS
): NearbyCandidate[] {
    // 仅路径（§3.3），跳过已隐藏元素（§4 边界）
    const allEdges = stage.find(
        (s: Konva.Shape) => s.attrs?.enableSelect === "edge" && s.isVisible()
    ) as Konva.Shape[];
    if (!allEdges.length) return [];

    // AABB 粗筛：以鼠标为圆心 radius 的外接正方形
    const minX = pointerX - radius;
    const maxX = pointerX + radius;
    const minY = pointerY - radius;
    const maxY = pointerY + radius;

    const survivors: Konva.Shape[] = [];
    for (const edge of allEdges) {
        const d = edge.attrs.data || {};
        const { sx, sy, ex, ey, cx, cy, dx, dy } = d;
        // 计算边的屏幕 AABB：端点 + 控制点（若 BEZIER）转屏幕后取 min/max
        const pts = [worldToScreen(sx, -sy, stage), worldToScreen(ex, -ey, stage)];
        if (cx != null && cy != null) pts.push(worldToScreen(cx, -cy, stage));
        if (dx != null && dy != null) pts.push(worldToScreen(dx, -dy, stage));
        let bbMinX = Infinity, bbMaxX = -Infinity, bbMinY = Infinity, bbMaxY = -Infinity;
        for (const p of pts) {
            if (p.x < bbMinX) bbMinX = p.x;
            if (p.x > bbMaxX) bbMaxX = p.x;
            if (p.y < bbMinY) bbMinY = p.y;
            if (p.y > bbMaxY) bbMaxY = p.y;
        }
        // AABB 与外接正方形不相交 → 剔除
        if (bbMaxX < minX || bbMinX > maxX || bbMaxY < minY || bbMinY > maxY) continue;
        survivors.push(edge);
    }

    // 精筛：对幸存者算精确距离，过滤 > radius
    const candidates: NearbyCandidate[] = [];
    for (const edge of survivors) {
        const dist = edgeScreenDistance(edge, pointerX, pointerY, stage);
        if (dist <= radius) {
            candidates.push({ shape: edge, distance: dist });
        }
    }
    // 距离升序
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates;
}
```

> 算法复杂度：粗筛 O(n)（n = 全图边数）+ 精筛 O(m × 32)（m = 幸存者数，通常 < 10）。万级数据 < 5ms。

### 5.5 连通分量 BFS（src/utils/nearbyElements.ts，新增）

纯函数，输入选中路径 + stage，返回连通分量内的所有节点 Shape 与路径 Shape。支持计数上限（超限中止）。

```ts
/**
 * @description 从选中路径出发，无向 BFS 收集整个连通分量的节点与路径。
 *              与 SPEC_brush_same_direction 的有向同向遍历不同：本功能是纯连通分量，
 *              正反向边都纳入，不带折返守卫。
 *              支持计数上限：BFS 过程中超 limit 立即中止并返回 { truncated: true }，
 *              供调用方弹确认框（SPEC §3.9）。
 *              隐藏路径不参与连通分量（§3.7）；被点选路径始终纳入 edges（防御数据缺端点 id，§4）。
 * @param selectedEdge  起点：用户从候选列表点选的路径 Shape
 * @param stage         Konva.Stage（用于 find 全部 edge/node Shape）
 * @param limit         计数上限（默认 500）；超限中止
 * @returns             { nodes, edges, truncated, count }
 */
export interface ConnectedComponent {
    nodes: Konva.Shape[];
    edges: Konva.Shape[];
    /** 是否因超 limit 中止 */
    truncated: boolean;
    /** 中止前的计数（truncated=true 时为 limit+1） */
    count: number;
}

export function collectConnectedComponent(
    selectedEdge: Konva.Shape,
    stage: Konva.Stage,
    limit: number = 500
): ConnectedComponent {
    // 预收集全部 edge/node Shape，建 id→Shape 索引（O(n) 一次，避免 BFS 内反复 findOne）
    // 隐藏路径不参与连通分量（§3.7）：避免批量改静默修改不可见路径，与候选搜索 / BrushSelect 框选同口径
    const allEdges = stage.find((s: Konva.Shape) => s.attrs?.enableSelect === "edge" && s.isVisible()) as Konva.Shape[];
    const allNodes = stage.find((s: Konva.Shape) => s.attrs?.enableSelect === "node") as Konva.Shape[];

    // nodeId → 节点 Shape
    const nodeById = new Map<string, Konva.Shape>();
    for (const n of allNodes) {
        const id = n.attrs?.id;
        if (typeof id === "string") nodeById.set(id, n);
    }
    // nodeId → 关联路径（无向：snodeId / enodeId 都索引）
    const edgesByNode = new Map<string, Konva.Shape[]>();
    for (const e of allEdges) {
        const s = e.attrs?.data?.snodeId;
        const en = e.attrs?.data?.enodeId;
        if (typeof s === "string") {
            if (!edgesByNode.has(s)) edgesByNode.set(s, []);
            edgesByNode.get(s)!.push(e);
        }
        if (typeof en === "string") {
            if (!edgesByNode.has(en)) edgesByNode.set(en, []);
            edgesByNode.get(en)!.push(e);
        }
    }

    const selectedNodeId = selectedEdge.attrs?.data?.snodeId as string | undefined;
    const selectedEnodeId = selectedEdge.attrs?.data?.enodeId as string | undefined;
    const startNodeIds = [selectedNodeId, selectedEnodeId].filter((x): x is string => !!x);

    const visitedNodes = new Set<string>();
    const visitedEdges = new Set<string>();
    const resultNodes: Konva.Shape[] = [];
    const resultEdges: Konva.Shape[] = [];
    let count = 0;
    let truncated = false;

    // 防御：被点选路径始终纳入结果（§4 边界：data 缺 snodeId/enodeId 时 BFS 无起点，
    // 至少选中该路径本身，避免 applyConnectedSelection 静默清空现有选中）
    const selectedEdgeId = selectedEdge.attrs?.id;
    if (typeof selectedEdgeId === "string") {
        visitedEdges.add(selectedEdgeId);
        resultEdges.push(selectedEdge);
        count++;
    }

    const queue: string[] = [...startNodeIds];
    for (const id of startNodeIds) visitedNodes.add(id);

    while (queue.length) {
        const nodeId = queue.shift()!;
        const nodeShape = nodeById.get(nodeId);
        if (nodeShape) {
            resultNodes.push(nodeShape);
            count++;
            if (count > limit) { truncated = true; break; }
        }
        // 枚举该节点的所有关联路径（无向）
        const relEdges = edgesByNode.get(nodeId) || [];
        for (const e of relEdges) {
            const eid = e.attrs?.id;
            if (typeof eid !== "string" || visitedEdges.has(eid)) continue;
            visitedEdges.add(eid);
            resultEdges.push(e);
            count++;
            if (count > limit) { truncated = true; break; }
            // 把路径另一端节点入队
            const s = e.attrs?.data?.snodeId as string | undefined;
            const en = e.attrs?.data?.enodeId as string | undefined;
            const other = s === nodeId ? en : s;
            if (other && !visitedNodes.has(other)) {
                visitedNodes.add(other);
                queue.push(other);
            }
        }
        if (truncated) break;
    }

    return { nodes: resultNodes, edges: resultEdges, truncated, count };
}
```

> 算法复杂度：O(V + E)，V/E = 子图节点/边数。带 limit 中止后最坏 O(500)。

### 5.6 GraphStage：右键时计算候选（onStageContextMenu）

在 `onStageContextMenu`（GraphStage:339）内，**在 `setContextMenu(...)` 之前**插入候选计算：

```ts
const onStageContextMenu = (event: Konva.KonvaEventObject<MouseEvent>) => {
    event.cancelBubble = true;
    const { evt } = event;
    evt.preventDefault();
    if (evt.button === 0) return;
    // 框选模式直弹菜单，其余模式先退出（现有逻辑不变，§2.2）
    if (manualKey && !["brushSelect", "brushSelectNode", "brushSelectEdge", "brushSelectSameDir"].includes(manualKey)) {
        if (["forwardLine", "reverseLine", "forwardBezier", "reverseBezier"].includes(manualKey)) {
            setNodeDraggable(stageRef.current);
        }
        setManualKey("");
        return;
    }
    // —— 新增：右键瞬间计算「附近元素」候选 ——
    // 此时鼠标仍在右键位置，getPointerPosition() 准确；Dropdown 打开后鼠标移走会失真（§5.2）
    const stage = stageRef.current;
    let nearbyCandidates: NearbyCandidate[] = [];
    if (stage) {
        const pointer = stage.getPointerPosition();
        if (pointer) {
            nearbyCandidates = findNearbyEdges(stage, pointer.x, pointer.y);
        }
    }
    setContextMenu({
        open: true,
        left: evt.clientX,
        top: evt.clientY,
        event,
        nearbyCandidates      // 新字段
    });
};
```

> **不缓存候选**：每次右键实时计算（§3.6），右键是低频操作。

### 5.7 ContextMenu：挂子菜单 + 点击分派

#### 5.7.1 候选项 label 构造（含端点节点名查询）

在 `ContextMenu` 的 `useMemo`（或新增 `useMemo`）内，根据 `contextMenu.nearbyCandidates` 构造子菜单。端点节点名需从 stage 查：

```ts
/** 构造「选择附近元素」子菜单项 */
const buildNearbyChildren = (): MenuProps["items"] => {
    const stage = event?.target?.getStage?.();
    const candidates = (contextMenu as ContextMenuType).nearbyCandidates ?? [];
    if (!candidates.length || !stage) return [];  // 空 → 一级项置灰（§2.5）

    // 预建 nodeId → name（O(n) 一次，避免逐候选项 findOne）
    const allNodes = stage.find((s: Konva.Shape) => s.attrs?.enableSelect === "node");
    const nameById = new Map<string, string>();
    for (const n of allNodes) {
        const id = n.attrs?.id;
        if (typeof id === "string") nameById.set(id, n.attrs?.data?.name ?? id.slice(-4));
    }

    // 检测重名（§3.15）：本次候选内是否有同名路径
    const nameCount = new Map<string, number>();
    for (const c of candidates) {
        const nm = c.shape.attrs?.data?.name ?? "";
        nameCount.set(nm, (nameCount.get(nm) ?? 0) + 1);
    }

    const MAX = 30;  // §3.13
    const items = candidates.slice(0, MAX).map(c => {
        const d = c.shape.attrs?.data ?? {};
        const sname = nameById.get(d.snodeId) ?? String(d.snodeId ?? "").slice(-4);
        const ename = nameById.get(d.enodeId) ?? String(d.enodeId ?? "").slice(-4);
        const edgeType = d.edgeType === "BEZIER" ? "BEZIER" : "LINE";
        const dir = d.isBackEdge ? "反向" : "正向";
        const nm = d.name ?? "";
        const suffix = (nameCount.get(nm) ?? 0) > 1 ? `  ${String(c.shape.attrs?.id ?? "").slice(-4)}` : "";
        return {
            key: c.shape.attrs?.id,           // 子菜单 key = edge id
            label: `◇ ${nm}  ${sname}→${ename}  ${edgeType} ${dir}${suffix}`,
            danger: false,
            disabled: false
        };
    });
    // 超出截断提示（§3.13）
    if (candidates.length > MAX) {
        items.push({
            key: "__nearby_overflow__",
            label: `还有 ${candidates.length - MAX} 项未显示`,
            disabled: true
        } as any);
    }
    return items;
};
```

#### 5.7.2 itemsWithChildren 增加 nearby 分支

在 `ContextMenu` 的 `itemsWithChildren.map` 内增加：

```ts
const itemsWithChildren = filteredItems.map(item => {
    let children: any = undefined;
    if (item.key === "addToExclusiveGroup") {
        children = buildAreaChildren(exclusiveGroups, operateMembers, "add");
    } else if (item.key === "removeFromExclusiveGroup") {
        children = buildAreaChildren(exclusiveGroups, operateMembers, "remove");
    } else if (item.key === "addToTrafficGroup") {
        children = buildAreaChildren(trafficGroups, operateMembers, "add");
    } else if (item.key === "removeFromTrafficGroup") {
        children = buildAreaChildren(trafficGroups, operateMembers, "remove");
    } else if (item.key === "selectNearbyElements") {
        // 新增：附近元素候选（来自右键时计算的 nearbyCandidates）
        children = buildNearbyChildren();
    }
    const itemDisabled = children ? children.every((c: any) => c.disabled) : item.disabled;
    return { ...item, children: children as MenuProps["items"], disabled: itemDisabled };
});
```

> 空 `children` → `every` 空 = true → 一级项置灰不可展开（与区域项无区域时同机制）。
>
> **必须同步修改该 `useMemo` 的依赖数组**：现有 deps 为 `[selectShapes, event?.target?.getType(), exclusiveGroups, trafficGroups]`（ContextMenu:131），需加入 `contextMenu.nearbyCandidates`。否则「菜单未关闭时连续两次右键同类型目标」（`getType()` 不变、其余 deps 亦不变）会命中缓存，子菜单显示上一次右键位置的陈旧候选——候选是位置相关数据，比现有 `operateMembers` 的同款潜在问题更容易暴露。

#### 5.7.3 点击分派（onContextMneuClick）

```ts
const onContextMneuClick: MenuProps["onClick"] = ({ key, keyPath }) => {
    // ... 现有区域项分派不变 ...
    // 新增：附近元素（key = edge id，keyPath 含 selectNearbyElements）
    if (keyPath.indexOf("selectNearbyElements") !== -1) {
        onSelectNearbyElement(key);
        return;
    }
    switch (key) {
        // ... 现有 case 不变 ...
    }
};
```

#### 5.7.4 选中连通分量（onSelectNearbyElement）

```ts
/** 选中附近元素：BFS 连通分量 + 仅路径进 selectShapes + 节点/路径置顶 + 超阈确认 */
const onSelectNearbyElement = (edgeId: string) => {
    const stage = event?.target?.getStage?.() ?? null;
    if (!stage) return;
    const edgeShape = stage.findOne<Konva.Shape>("#" + edgeId);
    if (!edgeShape) return;

    // 第一阶段：带 500 上限的 BFS（防万级阻塞）
    const LIMIT = 500;
    const firstPass = collectConnectedComponent(edgeShape, stage, LIMIT);

    if (firstPass.truncated) {
        // 超阈弹确认框（§3.9）
        confirm({
            title: "连通分量范围过大",
            icon: <ExclamationCircleFilled />,
            content: `该连通分量含超过 ${LIMIT} 个元素，选中后可能造成卡顿，是否继续？`,
            onOk: () => {
                // 第二阶段：完整 BFS（无上限）
                const full = collectConnectedComponent(edgeShape, stage, Infinity);
                applyConnectedSelection(stage, full.nodes, full.edges);
            },
            onCancel() { /* 不选中，菜单已由 window click 关闭 */ }
        });
        return;
    }

    // 未超阈：直接选中
    applyConnectedSelection(stage, firstPass.nodes, firstPass.edges);
};

/**
 * 应用连通分量选中：
 * 1. unSelectShapeEvent 还原旧选中样式
 * 2. 仅路径进 selectShapes + 加 selected 样式（§3.7）
 * 3. 路径在 EdgesLayer 内置顶（由 updateShapeStyle 内部 moveToTop 完成，§3.10）
 * 4. 节点在 NodesLayer 内 moveToTop（不加标记，§3.11）
 * 5. 不 saveSnapshot（选中不改数据，§2.13）
 */
const applyConnectedSelection = (
    stage: Konva.Stage,
    nodes: Konva.Shape[],
    edges: Konva.Shape[]
) => {
    // 还原旧选中
    const prevSelected = stage.find((s: Konva.Shape) => s.attrs?.state === "selected");
    prevSelected.forEach(deselectShape);

    // 仅路径进 selectShapes + 样式（updateShapeStyle 内部已对路径 moveToTop，路径置顶无需重复，§3.10）
    edges.forEach(updateShapeStyle);
    setSelectShapes(edges);

    // 节点在 NodesLayer 内置顶（§3.10）
    nodes.forEach(n => n.moveToTop());
    stage.batchDraw();

    // 提示选中数量（仅批量时，避免单选打扰）
    if (edges.length > 1) {
        message.success(`已选中 ${edges.length} 条路径（连通分量）`);
    }
};
```

> **移动 Shape 的 Layer 归属**：`moveToTop` 在 Shape 所属 Layer 内生效。路径 Shape 属 `EdgesLayer`、节点 Shape 属 `NodesLayer`，分别置顶，符合 §3.10。**无需显式指定 Layer**。
>
> **moveToTop 与 React state 的关系**：`EdgesLayer`/`NodesLayer` 是命令式 Layer（`memo` + `useEffect` 内 `layer.add(shape)`），运行时 `moveToTop` 不触发 React 重渲染，与现有命令式操作范式一致（与 `updateShapeStyle`、`deselectShape` 同源）。

### 5.8 算法纯度

`findNearbyEdges` 与 `collectConnectedComponent` 均为**纯函数**（输入 stage + 参数，输出结果，无副作用、不依赖 React state），便于复用与单测：

- 不修改 `selectShapes`、不调 `setXxx`；
- 所有坐标变换通过 `worldToScreen`（含 rotation/scale）；
- BFS 索引在函数内一次性建立，无全局状态。

---

## 6. 交互与反馈

| 时机 | 反馈 |
| --- | --- |
| 右键 → 30px 内无路径 | 一级项「选择附近元素」置灰不可展开（静默，不打扰） |
| 右键 → 候选 ≥ 1 | 一级项可展开，hover 出二级候选列表（按距离升序） |
| 候选 > 30 | 末尾「还有 N 项未显示」灰字 |
| 点击候选项（连通分量 ≤ 500） | 路径进 selected + 置顶；节点置顶；菜单关闭；批量时 message「已选中 N 条路径」 |
| 点击候选项（连通分量 > 500） | 弹 Modal.confirm；确认 → 选中；取消 → 不选中 |
| 连通分量仅 1 条路径（孤立边） | 静默选中（不 message，避免单选打扰） |

> **不启用**的反馈（保持简洁）：
> - ❌ 候选项 hover 预览高亮（性能开销，§3.12）；
> - ❌ 节点连通高亮标记（§3.11）；
> - ❌ 候选距离数值显示（label 已足够区分）。

---

## 7. 验收用例

| # | 场景 | 预期 |
| --- | --- | --- |
| 1 | §1.2 数据：右键 3 组叠合中心 → 点「路径 2」 | 候选列出 12 条路径（距离升序）；点击后选中组 A 全部 4 条路径（1/4/2/3）；节点 1/2/3 置顶；AttributePane 进 EdgeShape 批量改 |
| 2 | 同上，点「路径 5」（属组 B） | 选中组 B 全部 4 条路径（5/6/7/8）；节点 4/6/5 置顶；组 A 选中被覆盖清除 |
| 3 | 右键空白区（30px 内无路径） | 一级项「选择附近元素」置灰不可展开 |
| 4 | 右键仅 1 条孤立路径附近 | 候选 1 项；点击 → 选中该 1 条（无 message） |
| 5 | 候选超 30 项（密集重叠） | 列出前 30 项 + 「还有 N 项未显示」灰字 |
| 6 | 选中含正反向边对的连通分量（A↔B） | 正反向边都选中（纯连通分量，无折返守卫） |
| 7 | 连通分量 > 500（选中枢纽边） | 弹 Modal「范围过大，是否继续？」；确认 → 全选；取消 → 不选 |
| 8 | 选中后左键空白 | selectShapes 清空，选中样式还原（与现有选中同生命周期） |
| 9 | 选中后 Ctrl + 左键其中一条路径 | 该路径 toggle 移除（节点置顶不回退，无可见副作用） |
| 10 | 选中后框选别的区域 | 覆盖（新框选替换连通分量选中） |
| 11 | 只读模式右键 | 不弹菜单（现有守卫），新功能不触发 |
| 12 | forwardLine 模式右键 | 先退出画线模式 return，不弹菜单（现有守卫） |
| 13 | brushSelect 模式右键 | 直接弹菜单，「选择附近元素」可用 |
| 14 | 画布旋转 90° 后右键 | `worldToScreen` 含 rotation，30px 圆天然适配，候选准确 |
| 15 | 缩放至 1000x 后右键 | 30px 屏幕半径 = 0.03m 世界，精确筛出紧凑重叠元素 |
| 16 | 候选路径已隐藏；连通分量内含隐藏路径 | 隐藏路径不出现在候选列表，也不进连通分量选中集（`isVisible()` 过滤，§3.7） |
| 17 | 重名路径（两条都叫「路径 2」） | 候选项末尾附 id 末 4 位区分 |
| 18 | BEZIER 控制点为 null（数据异常） | 退化为直线距离（防御性） |
| 19 | 路径数据缺 `snodeId/enodeId`（异常数据） | 至少选中该路径本身，不静默清空现有选中（§5.5 防御） |

---

## 8. 未决 / 后续

- **节点重叠选取**：本期候选仅含路径（§3.3）。节点重叠场景仍依赖「放大画布后左键」。若后续需独立解决，可新增「附近节点」入口或节点候选子菜单，但需先定义节点选中的后续语义（单选 / 批量 / 扩散）。
- **Overlook 监控视图复用**：`findNearbyEdges` / `collectConnectedComponent` 为纯函数，Overlook（`src/pages/Overlook/ForceGraph/`）若有同类重叠选取诉求可复用，但不在本期范围。
- **候选缓存**：本期不缓存 AABB / 采样点（§3.6）。若 Overlook 高频复用或地图规模持续增长导致右键可感知卡顿，再评估带脏标记的缓存方案（拖动节点 / 缩放 / 改属性时失效）。
- **悬停预览**：本期不支持候选 hover 预览连通分量（§3.12 性能考量）。若用户反馈「不确定点哪条」，可后续加 hover 时轻量高亮单条候选路径（不做全 BFS 预览）。
- **阈值可配**：500 与 30px / 30 项均为硬编码。若需用户可配，可挂到 `overlayVisible` 或独立设置面板，但当前无此诉求。

---

## 9. 候选菜单优化：按连通分量分组展示

> 日期：2026-08-03（初版实施同期追加）
> 关联代码：`src/utils/nearbyElements.ts`（新增 `groupCandidatesByComponent`）、`src/pages/MapThrough/MapNestModify/NestGraph/ContextMenu/index.tsx`（`buildNearbyChildren`）

### 9.1 背景

§3.13 / §5.7.1 的候选菜单原设计是**按到鼠标距离升序平铺**。在 §1.2 的典型重叠场景下（3 组叠合节点构成 3 个互不连通的子图，半径内 12 条路径），平铺顺序会被其他分量的路径穿插——例如组 A 的 4 条与组 B 的 4 条按距离交错排列，用户难以从菜单上判断「点这一条会一起选中哪几条」（实际选中范围由 §3.8 的连通分量决定）。

### 9.2 设计决策

候选项按**所属连通分量**聚拢展示：

- **维度选择**：候选都是路径、都挂在同一个 Konva `EdgesLayer`，不存在技术意义上的"图层"维度。真正贴合用户直觉的"图层"语义是**连通分量**——每个分量在视觉/拓扑上独立，点其中任意一条会带上整组，正是一个独立的"图层"。
- **分组载体**：antd Menu 的 `type: "group"`（带标题、不可点击、不出现在 `keyPath` 里），点击子项时 `onContextMneuClick` 的 `keyPath.indexOf("selectNearbyElements") !== -1` 仍成立，分派逻辑（§5.7.3）无需改动。
- **组标题**：`组 N（M 条）`，N 从 1 起按"组内最小距离"升序编号（最近的组排最前），M 为该组候选数。
- **单组不分组**：所有候选同属一个连通分量、或候选 ≤ 1 条时，保持平铺，避免冗余的"组 1（N 条）"标题。
- **截断口径不变**：先按 §3.13 截断到 30 项，再对截断后的列表分组；"还有 N 项未显示"提示追加在最末，不归属任何组。

### 9.3 实现

**`src/utils/nearbyElements.ts` — 新增 `groupCandidatesByComponent`**：

- 用**并查集（Union-Find）**对全图可见路径做一次连通聚类（O(V + E×α(V))），再把候选按其 `snodeId`/`enodeId` 的 root 归组。
- 为什么不复用 `collectConnectedComponent`（§5.5）：候选最多 30 条，逐个 BFS 会做 30 次全图扫描；并查集只需一次。
- **同口径**：仅可见路径（§3.7）、无向连通（正反向边都纳入，§3.8），与 `collectConnectedComponent`、`findNearbyEdges` 完全一致——保证"菜单上聚在一起的那组" === "点击后会一起进 selectShapes 的那组"。
- **孤儿边兜底**：缺 `snodeId`/`enodeId` 的候选用自身 shape id 作 key，独立成组，不会丢失。
- 返回 `NearbyCandidate[][]`：组内按距离升序，组间按"组内最小距离"升序。

**`ContextMenu/index.tsx` — `buildNearbyChildren` 改造**：

- 调用 `groupCandidatesByComponent` 分组；
- 单组（`groups.length <= 1`）走原平铺分支；多组用 `type: "group"` 包裹；
- 现有 `children.every(c => c.disabled)` 的一级项置灰判定（§2.5）不受影响：空候选返回 `[]` → every 空 = true → 置灰；分组结构每个 group 项 `disabled` 为 undefined → every 返回 false → 可展开。

### 9.4 不变项

§3.1-§3.15 的其余决策（30px 半径、仅路径候选、单击覆盖语义、超 30 截断、超 500 弹确认、moveToTop 置顶等）**均不变**；本次仅改候选菜单的**展示形态**，不改候选搜索、不改点击选中语义、不改生命周期。

### 9.5 验收补充

| # | 场景 | 预期 |
| --- | --- | --- |
| 20 | §1.2 数据：右键 3 组叠合中心 | 候选 12 条分 3 组（各 4 条），组标题"组 1/2/3（4 条）"；组内按距离升序；组间按最近距离升序 |
| 21 | 半径内仅 1 个连通分量（如 4 条全连通） | 不分组，平铺 4 条（无"组 1"标题） |
| 22 | 半径内仅 1 条孤立路径 | 不分组，平铺 1 条 |
| 23 | 候选超 30 项且分多组 | 先截断到 30 项再分组；"还有 N 项未显示"在最末，不属任何组 |
| 24 | 候选含孤儿边（缺端点 id） | 孤儿边独立成一组，不与其他候选合并 |
