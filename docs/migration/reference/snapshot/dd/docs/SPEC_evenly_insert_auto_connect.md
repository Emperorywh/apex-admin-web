# 等距插入节点 · 自动连线 规格说明

> 状态：已定稿（访谈 5 轮；D1–D21 边细分/默认建链 + B1–B19 链路等距化；D2/D5/D6/D13/D14/D17 于第 4 轮评审修订）
> 日期：2026-07-30
> 范围：`src/pages/MapThrough/MapNestModify/NestGraph/ContextMenu/EvenlyInsertModal/index.tsx` + `ContextMenu/createEdgeShape.ts`（新增链路等距化辅助函数）+ `ContextMenu/index.tsx`（仅新增 Modal props 透传）
> 不在范围：`createNodeShape.ts`（建点函数，仅复用不改）、ContextMenu 菜单逻辑/置灰/既有 props、AddEdge（交互式连边）、`onAddReverseEdge`、`alignTwoPointsLine`（两点对齐，仅复用其 `findSimplePaths`）
> 前置文档：`EvenlyInsertModal/index.tsx` 顶部注释引用的「等距插入节点」原决策（决策 2/7/8/9/11/12/16/17/18，本期全部沿用）；`src/utils/align.ts` 的 `findSimplePaths`（唯一简单链判定，本期复用）
> 第 4 轮修订说明：源码对照评审，修复 2 个实现级缺陷（reverseEdgeId 泄漏、label 锚点 t 值偏离全库约定），补拍 3 个语义决策（方向镜像、区域成员继承、设备/动作锚点段），订正若干事实性表述。
> 第 5 轮修订说明：新增「链路等距化」分支（B1–B19）——选中两端节点但二者之间无直连边、仅有经中间节点的间接路径时，沿 A→B 直线等距插入新点、并按投影顺序与旧中间节点交错串联成单链，避免静默新增平行路径。三态自动判定取代原「直连边 / 无连接」二态假设。修订溯源见 §9。

---

## 1. 背景与目标

### 1.1 现状

`EvenlyInsertModal` 已实现「等距插入节点」：选中恰好两个节点 A、B → 沿 A→B 欧氏直线均分 N+1 段、取中间 N 个分点 → 用 `createNodeShape` 批量创建 **N 个孤立节点（不连任何边）** → 一次 `saveSnapshot` → 清空选中。

插入后用户还需**手动逐段连边**（进入 AddEdge 模式，A→点1→点2→…→点N→B 逐个点击），N 大时操作繁琐。

### 1.2 目标

在等距插入节点的同时**自动连线**，按 A、B 之间的拓扑自动切换三种行为（**三态自动判定**，B4）：

1. **态一·边细分**：A、B 之间**有直连边** → 删除旧直连边，用新节点串成等距链路重建（镜像已有方向；仅单边有边时不凭空新增另一方向的通路）；旧边的区域成员资格同步迁移到新链段，设备/动作配置迁移到锚点所在段。
2. **态二·链路等距化**（第 5 轮新增）：A、B 之间**无直连边、但存在经中间节点的间接路径** → 沿 A→B 直线等距插入 N 个新点，删掉该路径上的旧边，把新点与旧中间节点**按 A→B 投影顺序交错串联成一条混合单链**重建（旧中间节点保留原位、不删除、不孤立）；方向逐段镜像原路径。
3. **态三·默认建链**：A、B 之间**既无直连边、也无间接路径** → 默认建一条等距链把二者连通。

> 三态优先级（B11）：先查直连边（命中→态一）；再查间接路径（命中→态二）；都没有→态三。即 A↔B 既有直连边又有间接路径时走态一，间接路径保留不动（原 D8「间接路径不动」的语义由此收窄到态一内部）。

### 1.3 核心洞察

- **直连边必须整体删除后重建**（态一）：A、B 之间的直连边（无论正向/反向/直线/贝塞尔）在插入 N 个中间节点后，其「端点不变、中间多了节点」的拓扑已不成立——旧边若保留会跨越新节点、几何不再贴合。因此 A↔B 直连边必须整体删除后重建为逐段链，不能只删其一留下孤儿跨段边。
- **间接路径必须收编、不能放任平行**（态二，第 5 轮）：当 A、B 之间只有经中间节点的间接路径时，若仍按「无连接」默认新建一条 A→…→B 链，会与原路径并存成两条平行通路、旧中间节点悬在其间——对调度系统是「静默新增通路 + 冗余拓扑」的双隐患。因此此时应**删除原路径旧边、把新点与旧中间节点重组为同一条混合单链**，让旧中间节点继续挂接在新链上而非孤立。

---

## 2. 现状回顾

### 2.1 等距建点流程（`handleOk`，沿用不改）

```
1. 数量校验（N ≥ 1 整数）
2. 选中态防御性校验（A、B 均为 node）
3. computeEvenlyPoints：算 N 个分点 + 与已有节点 x/y 严格判重（任一冲突整体中止）
4. saveSnapshot()  ← 一次（含 node/edge shape + traffic/exclusive groups 全量）
5. createNodeShape 逐个建点（A→B 顺序，命名基于 stage 最新节点自增）
6. unSelectedShape(stage) + setSelectShapes([])  ← 清空选中
7. message.success + onClose
```

本期在第 4 步（saveSnapshot）与第 5 步（建点）之间，**先插入「收集并删除旧边」**，在建点后插入「按方向镜像建边 → 区域成员继承」，并在第 6 步前补「命令式图层刷新」。

### 2.2 边的数据结构（`MapEdge`，参见 `defaultPathProperty.ts` 与 `utils/typing.d.ts`）

几何/拓扑字段（**绝不继承**，逐条重建）：`snodeId / enodeId / sx / sy / cx / cy / dx / dy / ex / ey / edgeType("LINE"|"BEZIER") / isBackEdge / arrowPoints / labelX / labelY / reverseEdgeId`。

> `reverseEdgeId`：后端配对外键，前端代码无任何消费方，但保存时随 `EnableModify` 的 `...rest` 原样提交后端——**继承它会把指向已销毁旧边的悬空 id 写库**（第 4 轮 P1 修复点，见 §4.3）。

业务字段（本期「属性继承」的取值对象，分两类，见 §4.3）：

- 标量偏好（逐段复制）：`loadType / allowVehicleGroup / avoidMap / forward_avoid / reverse_avoid / limitV / cost / enableLimitForkLiftReturn / maxFreeSpeed / maxLoadSpeed / sfacing / efacing`
- 实例绑定（仅锚点段）：`actions / userDefinedProperties`

### 2.3 坐标符号约定（关键陷阱）

- 节点 `shape.x()/y()` 与分点坐标一律为**画布世界坐标（米，正 y 向下）**。
- 边 `data` 中的 `sy / ey` 存的是**后端坐标（= −画布 y）**；`sx / ex` 不取反。
- `arrowPoints / labelX / labelY` 一律用**画布坐标（正 y）**计算与存储（与 `AddEdge.getCreateShapeAttribute` 一致）。

> 即：`data.sy = -fromShape.y()`，但 `computeLineArrowPoints([from.x(), from.y(), to.x(), to.y()])` 用正 y。两套符号不可混用。

### 2.4 边的视觉与锚点约定（第 4 轮补充，均为源码事实）

- 配色常量：`forwardPath`（正向）stroke/labelFill `#BDBDBD`、lineWidth 0.05；`reversePath`（反向）`#E57373`、0.05。地图加载（`createShapeConfig.ts`）与缩放重设（`applyVisualScale.ts`）均按 `isBackEdge` 取色——**红 ⇔ isBackEdge=true 是全库一致约定**。
- **正反两条边几何完全重合**：`edgeSceneFunc` 对正反边都直接 `moveTo(sx,-sy)→lineTo(ex,-ey)`，无任何平行偏移；带法线偏移的只是设备图标/动作角标（`iconSign = isBackEdge ? -1 : 1`）。后建的边盖住先建的边，点击命中顶层边。
- **标签锚点 t=1/3**：`computeLinePoint` 默认 `t=1/3`（`utils/math.ts`），`AddEdge`、`onAddReverseEdge`、`refreshDeviceLayer`（设备图标锚点，永远按 t=1/3 重算、**不读** labelX/labelY）三处同口径。动作角标与名称标签则锚在 `data.labelX/labelY`。因此新边的 `labelX/labelY` 必须也用默认 t=1/3 计算，否则图标与标签/角标错位（第 4 轮 P1 修复点）。

### 2.5 保留不变的基础设施

- `createNodeShape(stage, useMapId, x, y, type)`：建点函数（决策 14 通用化），本期复用；返回 `Konva.Shape | undefined`（stage/nodesLayer 缺失时）。
- `computeEvenlyPoints`：分点计算 + 判重，**完全不改**。
- `saveSnapshot`（`undoHistory.ts`）：基于 `getModifiableShapes` 全量捕获所有 node/edge shape 的 attrs + layerIndex，并深拷贝 `trafficGroups / exclusiveGroups`。操作前一次快照，`undo` 通过 id 对比增删回滚、`redo` 双栈恢复——能完整撤销「删 K 条旧边 + 建 N 点 + 建边 + 区域成员替换」。
- `nextNameByShapes`：边命名自增（查询当前所有 edge shape）。
- `unSelectedShape`：清空选中视觉态。
- `computeLineArrowPoints / computeLinePoint`（`utils/math`）：直线箭头点与标签位置（后者默认 t=1/3，见 §2.4）。
- `refreshDeviceIcons / refreshActionBadges`：三方设备图标 / 动作角标装饰图层全量重建（分别从 `@/plugins/konva/devices`、`@/plugins/konva/actions` 导出，与 `ContextMenu/index.tsx` 现有 import 同源）。
- `angles:refresh` 事件：夹角层重算（`AnglesLayer` 监听）。
- `findSimplePaths`（`utils/align.ts`）：无向邻接表 + DFS 枚举 start→end 简单路径，命中第 2 条即剪枝返回（只需判定「唯一 / 多条」），内置深度兜底 200。本期态二复用它做「唯一简单链」判定，与 `alignTwoPointsLine` 同源；其 `pathNodeIds.slice(1, -1)` 取中间节点、`pathNodeSet` 判定边是否在路径上的模式本期一并沿用。

---

## 3. 决策清单（D1–D20 边细分/默认建链 + B1–B19 链路等距化）

| # | 决策 | 选择 |
|---|---|---|
| **D1** | 连线行为开关 | **无开关，默认就连线**。彻底改变「只插孤立点」的旧行为 |
| **D2** | 连线方向与类型（**第 4 轮修订**） | **镜像已有方向**：双边都有 → 双向直线 2(N+1) 条；仅正向 → 只建正向链 N+1 条；仅反向 → 只建反向链 N+1 条；K=0 → 默认双向 2(N+1) 条。反向链 `isBackEdge=true`（红色） |
| **D3** | 连线拓扑 | 链式：A→新点1→…→新点N→B。正向链沿 A→B，反向链沿 B→A，相邻两点各一条边 |
| **D4** | 旧边删除范围 | A↔B **所有直连边全删**（`snodeId/enodeId` 恰为 {A,B} 的全部 edge，不分方向、不分 LINE/BEZIER、不分 isBackEdge） |
| **D5** | 属性继承（**第 4 轮修订**） | 正向新边继承旧正向边 P、反向新边继承旧反向边 R（各取各，不串方向）。字段分两类：标量 12 字段**逐段复制**；`actions / userDefinedProperties` **仅锚点所在段**继承（D21 语义，见 §4.3） |
| **D6** | 属性回退（**第 4 轮修订触发条件**） | 需建链但无来源边（仅 K=0 默认双向场景）→ 该方向用 `defaultPathProperty` 默认值。镜像策略下，无旧边的方向不再建链，自然无回退 |
| **D7** | 多条同向旧边 | 取**首条**作为该方向属性来源（数据异常兜底，正常情况至多一条） |
| **D8** | 间接路径 | A↔B 之间经其它节点的间接边**不动**；只处理直连边 |
| **D9** | 原子性 | 先算点（含判重）→ 判重通过才 saveSnapshot → 删旧边 → 建点 → 建边；判重失败整体中止，**不删旧边** |
| **D10** | 快照粒度 | 整个操作**一次 saveSnapshot**（操作前，含 groups），undo 一次全恢复 |
| **D11** | 生成后选中态 | 清空全部，不选中新元素（沿用原决策 11） |
| **D12** | 命令式图层刷新 | 建边/删边后 `refreshDeviceIcons` + `refreshActionBadges` + `fire("angles:refresh")` |
| **D13** | 预览呈现（**第 4 轮修订**） | 示意图按方向镜像：双向 → 灰+→ / 红+← 平行双线；仅正向 → 单灰线+→；仅反向 → 单红线+←。统计区提示「新增边 dirs×(N+1) 条 / 删除旧边 K 条」 |
| **D14** | 完成提示（**第 4 轮修订**） | 按**实际建成边数**合并报告：`已生成 N 个节点、连接 M 条边，删除 K 条旧边`；K=0 时略去「删除」分句 |
| **D15** | 新建边函数 | 抽 `createStraightEdge`（类比 `createNodeShape`），落地 `ContextMenu/createEdgeShape.ts`；同文件附带 `pickEdgeBusinessProps`、`findAnchorSegmentIndex` 两个辅助函数 |
| **D16** | 边命名 | `nextNameByShapes` 自增，每条边独立命名（建边时基于 stage 最新 edge shape；旧边已先删，名称可回收） |
| **D17** | 新边几何（**第 4 轮修正**） | `edgeType="LINE"`、`cx/cy/dx/dy=null`；`arrowPoints=computeLineArrowPoints`；`labelX/Y=computeLinePoint(…)` **用默认 t=1/3**（与 AddEdge/onAddReverseEdge/refreshDeviceLayer 同口径，见 §2.4） |
| **D18** | 坐标符号 | `data.sy/ey = -画布y`；`arrowPoints/label` 用画布正 y 计算（见 §2.3） |
| **D19** | 节点类型与边解耦 | 节点类型选择只影响新节点，不影响边 |
| **D20** | 区域成员继承（**第 4 轮新增**） | 旧边 id 在其所属 traffic/exclusive group 的 `edgeIds` 中**原位替换**为同向新链段 id 数组；无命中不 setState；undo 随 groups 快照整体回滚 |

**链路等距化决策（B1–B19，第 5 轮新增，仅在态二生效）**

| # | 决策 | 选择 |
|---|---|---|
| **B1** | 唯一链判定 | 复用 `findSimplePaths`：A↔B 之间必须存在且仅存在一条简单路径；多条/有环/有分叉 → warning 中止（与 `alignTwoPointsLine` 同源文案） |
| **B2** | 新点几何 | 沿 A→B 欧氏直线等距（沿用 `computeEvenlyPoints`，与态一/态三同算法） |
| **B3** | 旧中间节点 | **保留原位、不删除**；删的是路径上的旧边，不是节点 |
| **B4** | 三态自动判定 | 直连边→态一边细分；无直连边但有间接路径→态二链路等距化；都没有→态三默认建链 |
| **B5** | 连接拓扑 | **混合单链**：新点与旧中间节点按 A→B 投影顺序交错串联（如 `A→新1→旧7→新2→旧8→新3→B`），一条单链、无平行路径、旧点不孤立 |
| **B6** | 链路方向 | **逐段镜像原路径**：每段新边取其「段中点最近原边」的 `isBackEdge` 作为方向 |
| **B7** | N 的语义 | N = **新增**等距节点数（旧中间节点不计）；最终中间节点数 = N + 旧中间节点数 |
| **B8** | 分点撞旧点 | 沿用 `computeEvenlyPoints` 判重（含旧中间节点）：任一新点与已有节点坐标严格相等 → warning + return，**不删任何边**（B16 原子性） |
| **B9** | 属性继承 | **段中点最近原边**：每段新边继承几何上最近的原路径边的标量白名单业务属性；`actions/userDefinedProperties` 仅在该段同时为该原边的锚点段时附加（沿用 D21 语义） |
| **B10** | 投影排序 | 按节点在 A→B 有向直线上的投影参数 t 升序；t 并列（\|Δt\|<1e-9）时**旧点优先于新点**，同类按原路径拓扑顺序 / 等距序 |
| **B11** | 三态优先级 | 先查直连边（命中→态一），再查间接路径（命中→态二），都没有→态三；态一内间接路径仍按 D8 不动 |
| **B12** | 路径外分支边 | 旧中间节点上**非路径**的边（一端在路径、一端不在）**保留不动**；只删路径相邻对上的边 |
| **B13** | 搜索保护 | 复用 `findSimplePaths` 内置的「命中第 2 条剪枝 + 深度兜底 200」，无新增爆栈风险 |
| **B14** | 段→原边映射 | 段中点（画布世界坐标）到原路径边的**欧氏距离最近**那条；并列取靠 A 侧；原边端点坐标取自其 `snodeId/enodeId` 对应节点 shape 的 `x()/y()`（避免 sy/ey 后端坐标符号陷阱） |
| **B15** | 极端折线 | 旧点投影 t 落在 [0,1] 之外时仍按 t 排序纳入链（可能产生轻微回折），标注为已知限制，不特判 |
| **B16** | 原子性 | 路径搜索失败、判重失败均在 `saveSnapshot` **之前** return，无任何副作用（不删边、不建点） |
| **B17** | 快照粒度 | 整个操作一次 `saveSnapshot`（操作前，含 groups），undo 一次全恢复（沿用 D10） |
| **B18** | 装饰图层刷新 | 沿用 D12：`refreshDeviceIcons` → `refreshActionBadges` → `angles:refresh` |
| **B19** | 预览与提示 | 预览在态二下标注「链路等距化」并展示旧点+新点交错示意；完成提示按实际建成边数报告（沿用 D14） |

> **D2 两轮由来**：第 1 轮初选「仅正向直线」，但与 D4「全删旧边」叠加后，旧反向边被删却不重建 → B→A 通路丢失，第 2 轮升级为「一律双向」。第 4 轮评审发现「一律双向」在**仅单边有边**时会凭空新增一个从未存在的通行方向（对调度系统，静默新增通路比丢失更危险），遂修订为「镜像已有方向」——双边都有仍双向（保住第 2 轮成果），仅单边只重建该方向，K=0 无边时默认双向。详见 §9。

---

## 4. 核心设计

### 4.1 整体执行流程（改造后 `handleOk`，三态自动判定 B4）

```
1. 数量校验（N ≥ 1）                              ← 不变
2. 选中态防御性校验（A、B 均 node）                ← 不变
3. computeEvenlyPoints（沿 A→B 直线算 N 个新点 + 判重）← 不变；冲突 → warning + return（无副作用，B16/D9）
3.5 【三态判定 B4/B11】只读探测 A↔B 拓扑，决定走哪条分支：
     - 有直连边（snodeId/enodeId 恰为 {A,B}）         → 态一·边细分（§4.2，原 D 系列）
     - 无直连边、findSimplePaths 命中唯一简单路径     → 态二·链路等距化（§4.11，B 系列）
     - 无直连边、findSimplePaths 返回 0 条            → 态三·默认建链（K=0，§4.2 的 K=0 分支）
4. saveSnapshot()                                  ← 一次，操作前全量快照（含 groups）
5. 按所属态「收集并删除旧边」（态一删直连边 / 态二删路径边 / 态三无旧边）
6. 建 N 个节点（createNodeShape，收集 newNodeShapes）
7. 按所属态「组装节点链 chain」（态一/态三：[A,...新点,B]；态二：投影交错混合链，§4.11）
8. 逐段建边 createStraightEdge（方向 + 属性按所属态：态一/态三见 §4.6，态二见 §4.11）
9. 区域成员继承（D20 / B9）：groups.edgeIds 中旧边 id 原位替换为新链段 id
10. refreshDeviceIcons + refreshActionBadges + stage.fire("angles:refresh")  ← D12/B18
11. unSelectedShape(stage) + setSelectShapes([])   ← 不变（D11）
12. message.success(实际边数报告) + onClose         ← D14/B19
```

> **第 3.5 步为只读探测**：直连边查找与 `findSimplePaths` 均不改画布；判定为「多条路径」时 warning + return，此时第 4 步 saveSnapshot 尚未执行，无任何副作用（B16）。
> **态一优先**（B11）：先查直连边，命中即走态一，即便同时存在间接路径也不再进入态二；原 D8「间接路径不动」的语义由此收窄到态一内部成立。
> **第 5 步必须在第 3 步判重通过之后**：判重失败直接 return，旧边尚未删除，无副作用（D9/B8）。判重只查「新分点 vs 已有节点」（含态二的旧中间节点），旧边存在不影响判重结果。
> **删边（5）必须在建边（8）之前**：`nextNameByShapes` 在旧边销毁后自增，可回收旧名、避免跳号（D16）；删边在建点前或后功能等价，统一放建点前，与「先提取属性再 destroy」顺序衔接。
> 下文 §4.2–§4.10 为**态一/态三**的共用逻辑（原设计，保留）；§4.11 为**态二·链路等距化**的专属逻辑（第 5 轮新增）。

### 4.2 旧直连边的收集、删除与属性提取（D4 / D5 / D7 / D8）

```ts
/**
 * 收集 A↔B 之间的所有直连边，按方向分组（D4）。
 * 直连边定义：snodeId/enodeId 恰好为 {aId, bId}（双向匹配，不限 edgeType、不分 isBackEdge）。
 * 间接路径（A→C→B 等）的边两端不全是 A、B，天然不会被命中（D8）。
 */
const allEdges = stage.find(s => s.attrs?.enableSelect === "edge") as Konva.Shape[];
const forwardEdges: Konva.Shape[] = []; // A→B 方向组：snodeId=aId && enodeId=bId
const reverseEdges: Konva.Shape[] = []; // B→A 方向组：snodeId=bId && enodeId=aId
allEdges.forEach(e => {
    const d = e.attrs?.data;
    if (!d) return;
    if (d.snodeId === aId && d.enodeId === bId) forwardEdges.push(e);
    else if (d.snodeId === bId && d.enodeId === aId) reverseEdges.push(e);
});
// 属性来源取各组首条（D7 兜底：正常至多一条）
const forwardSource = forwardEdges[0];
const reverseSource = reverseEdges[0];
const toDestroy = [...forwardEdges, ...reverseEdges];

// 先提取白名单属性，再 destroy（destroy 不清空 attrs，但先取后删顺序更稳）
// 标量白名单（§4.3）：显式 pick，绝不传整个 data —— 防止 reverseEdgeId 等拓扑字段漏入新边
const propsP = forwardSource ? pickEdgeBusinessProps(forwardSource.attrs.data) : undefined;
const propsR = reverseSource ? pickEdgeBusinessProps(reverseSource.attrs.data) : undefined;
toDestroy.forEach(e => e.destroy());
```

> `aId = aShape.attrs.id`、`bId = bShape.attrs.id`。A、B 节点本身不删，只删它们之间的边。

### 4.3 属性继承字段清单（D5 / D6 / D21，第 4 轮重构）

**三类字段，三种命运：**

**(a) 标量偏好（逐段复制，12 字段）** —— 方向内每段新边都继承：

```
loadType, allowVehicleGroup, avoidMap, forward_avoid, reverse_avoid,
limitV, cost, enableLimitForkLiftReturn, maxFreeSpeed, maxLoadSpeed,
sfacing, efacing
```

> 注：`sfacing / efacing` 保存时被强制置 null、`cost` 保存时由 `computeEdgeLength` 按几何重算（`EnableModify/index.tsx:164-170`）——三者继承与否对落库无影响，保留在白名单内仅为会话期间属性面板显示一致，无害。

**(b) 实例绑定（仅锚点段，2 字段）** —— `actions`（含 blockingType 执行语义）与 `userDefinedProperties`（三方设备实例）是**位置/实例绑定**配置：旧边 1 个设备/动作若逐段复制，会变成 N+1 个设备图标、每段各执行一次动作。因此仅**锚点所在段**继承（D21）：

- 锚点 = 旧边 `data.labelX / labelY`（画布坐标，直线边为 t=1/3 处、贝塞尔边为曲线标签点）；
- 归属段 = 新链上**中点距锚点最近**的那一段（`findAnchorSegmentIndex`，并列取靠前段）；正向旧边锚点映射到正向链，反向旧边锚点映射到反向链；
- 其余段的这两字段用默认值（`actions: []`、`userDefinedProperties: null`）。

**(c) 几何/拓扑（绝不继承）**：`id / name / mapId / reverseEdgeId / edgeType / sx / sy / cx / cy / dx / dy / ex / ey / isBackEdge / snodeId / enodeId / arrowPoints / labelX / labelY` —— 全部逐条重建。

**白名单提取函数**（落地 `createEdgeShape.ts`）：

```ts
/**
 * 从旧边 data 显式提取「标量偏好」白名单字段（§4.3-a）。
 * 刻意显式 pick 而非整体展开旧 data：防止 reverseEdgeId 等拓扑字段漏入新边
 * （reverseEdgeId 前端无消费方，但保存时随 EnableModify 的 ...rest 提交后端，
 *  继承它会把指向已销毁旧边的悬空 id 写库）。
 * undefined 值被剔除：避免旧数据缺字段时把 defaultPathProperty 的有效默认
 * （如 maxFreeSpeed=1）冲掉（与 onAddReverseEdge 的 `loadType ?? 0` 同理）。
 */
export const pickEdgeBusinessProps = (data: MapEdge): Partial<MapEdge> => {
    const picked: Partial<MapEdge> = {
        loadType: data.loadType,
        allowVehicleGroup: data.allowVehicleGroup,
        avoidMap: data.avoidMap,
        forward_avoid: data.forward_avoid,
        reverse_avoid: data.reverse_avoid,
        limitV: data.limitV,
        cost: data.cost,
        enableLimitForkLiftReturn: data.enableLimitForkLiftReturn,
        maxFreeSpeed: data.maxFreeSpeed,
        maxLoadSpeed: data.maxLoadSpeed,
        sfacing: data.sfacing,
        efacing: data.efacing
    };
    return Object.fromEntries(
        Object.entries(picked).filter(([, v]) => v !== undefined)
    ) as Partial<MapEdge>;
};
```

> `forward_avoid / reverse_avoid` 原样继承、不随方向翻转互换——与 `onAddReverseEdge` 的处理一致。但注意：`onAddReverseEdge` 建反向边用的是 `isBackEdge=false`（灰边），本特性**刻意不同**（反向链 `isBackEdge=true` 红边），理由与连带影响见 §9「isBackEdge 分歧记录」。

### 4.4 新建直线边函数 `createStraightEdge`（D15）

落地 `ContextMenu/createEdgeShape.ts`，签名与 `createNodeShape` 风格对齐：

```ts
/**
 * 按起点/终点 node shape 创建一条直线(LINE)边并挂到 edgesLayer。
 * - 坐标：from/to 用画布世界坐标；data.sy/ey 存 -y（后端），arrowPoints/label 用画布正 y（D18）。
 * - 方向：isBackEdge=false 正向(forwardPath 样式)、true 反向(reversePath 样式)。
 * - 属性：inheritedProps 只接受 §4.3 白名单子集（标量 12 字段，锚点段另加 actions/userDefinedProperties），
 *   未提供字段用 defaultPathProperty。
 * - 命名：nextNameByShapes 基于 stage 当前所有 edge 自增（D16）。
 * - 不在此处 saveSnapshot / 弹提示，由调用方处理（与 createNodeShape 一致）。
 * @returns 创建成功的 edge Shape；stage/edgesLayer 不存在时 undefined
 */
export const createStraightEdge = (
    stage: Konva.Stage | null | undefined,
    useMapId: string,
    from: Konva.Shape,
    to: Konva.Shape,
    isBackEdge: boolean,
    inheritedProps?: Partial<MapEdge>
): Konva.Shape | undefined => { /* 见 §4.5 */ };
```

### 4.5 `createStraightEdge` 内部实现要点（D16 / D17 / D18）

```ts
if (!stage) return;
const visualScale = stage.getAttr(MAP_NEST_STAGE_ATTR.visualScale) ?? 1;
const stroke = isBackEdge ? reversePath.stroke : forwardPath.stroke;
const labelFill = isBackEdge ? reversePath.labelFill : forwardPath.labelFill;
const lineWidth = (isBackEdge ? reversePath.lineWidth : forwardPath.lineWidth) * visualScale;

// 几何：画布正 y 算箭头/标签；标签用默认 t=1/3（D17 修正，与 AddEdge/
// onAddReverseEdge/refreshDeviceLayer 同口径——设备图标锚点永远按 t=1/3 重算，
// 若此处用 1/2，名称标签与角标（锚 labelX/labelY）会和设备图标纵向错位）
const linePoints: LinePoint = [from.x(), from.y(), to.x(), to.y()];
const arrowPoints = computeLineArrowPoints(linePoints);
const label = computeLinePoint(linePoints); // 默认 t=1/3，勿传 1/2

// 命名
const edgeShapes = stage.find(s => s.attrs?.enableSelect === "edge") as Konva.Shape[];
const nextName = nextNameByShapes(edgeShapes);

// 深拷贝继承属性：调用方传入的白名单对象被 N+1 条边共用，浅展开会让各边
// 共享同一 actions/allowVehicleGroup 数组引用；JSON 深拷贝（undoHistory 同款
// 手法）使每条边持有独立副本，杜绝日后原地改数组时的串扰
const inherited = inheritedProps
    ? (JSON.parse(JSON.stringify(inheritedProps)) as Partial<MapEdge>)
    : {};

const data = {
    ...defaultPathProperty,
    ...inherited,                           // 白名单业务字段覆盖默认（D5/D6）
    id: getRandomString(),
    name: nextName,
    mapId: useMapId,
    reverseEdgeId: null,                    // 显式置空，双保险（§4.3-c）
    edgeType: "LINE",                       // 直线（D17）
    sx: from.x(),
    sy: -from.y(),                          // 后端 y（D18）
    cx: null, cy: null, dx: null, dy: null, // 直线无控制点（D17）
    ex: to.x(),
    ey: -to.y(),
    isBackEdge,
    snodeId: from.attrs.id,
    enodeId: to.attrs.id,
    arrowPoints,
    labelX: label.x,
    labelY: label.y
};

const edgesLayer = stage.findOne(`.${MAP_NEST_LAYER_NAME.edges}`) as Konva.Layer | undefined;
if (!edgesLayer) return;
const shape = new Konva.Shape({
    id: data.id,
    shapeStyle: { labelFill, stroke, lineWidth },
    data,
    state: "",                          // 不选中（D11）
    enableSelect: "edge",
    hitStrokeWidth: Math.max(lineWidth * 5, 0.1),
    perfectDrawEnabled: false,
    shadowForStrokeEnabled: false,
    sceneFunc: edgeSceneFunc,
    hitFunc: edgeHitFunc
});
edgesLayer.add(shape);
edgesLayer.batchDraw();
return shape;
```

> `...inherited` 展开在前、几何/拓扑字段在后，即使调用方误传拓扑字段也会被后者覆盖（`reverseEdgeId` 另有显式置空双保险）。shape 构造参数（`state`/`hitStrokeWidth`/`perfectDrawEnabled`/`sceneFunc` 等）与 `AddEdge` 逐项一致。

### 4.6 建边调用：方向镜像 + 锚点段（handleOk 第 8/9 步，D2 / D21）

```ts
// chain = [aShape, ...newNodeShapes, bShape]
const chain = [aShape, ...newNodeShapes, bShape];
const K = toDestroy.length;
// D2 镜像：某方向建链 ⇔ 该方向有旧边，或 K=0（无边默认双向）
const buildForward = !!forwardSource || K === 0;
const buildReverse = !!reverseSource || K === 0;

/**
 * 建一条方向的链，返回新边 id 数组（D20 区域替换用）。
 * 有来源边时：锚点段（旧 labelX/labelY 最近段）附加 actions/userDefinedProperties（D21）。
 * 实例字段仅在非空时附加——避免 {actions: undefined} 展开后冲掉默认 []。
 */
const buildChain = (
    isBackEdge: boolean,
    source: Konva.Shape | undefined,
    baseProps: Partial<MapEdge> | undefined
): string[] => {
    const ids: string[] = [];
    // 实例绑定字段（仅来源边确实配置时才需要找锚点段）
    const instProps: Partial<MapEdge> = {};
    const sd = source?.attrs?.data;
    if (sd?.actions?.length) instProps.actions = sd.actions;
    if (sd?.userDefinedProperties) instProps.userDefinedProperties = sd.userDefinedProperties;
    const anchorIdx =
        source && Object.keys(instProps).length > 0
            ? findAnchorSegmentIndex(sd.labelX, sd.labelY, chain)
            : -1;
    for (let i = 0; i < chain.length - 1; i++) {
        // 正向链沿 A→B，反向链沿 B→A（D3）
        const from = isBackEdge ? chain[i + 1] : chain[i];
        const to = isBackEdge ? chain[i] : chain[i + 1];
        const props = i === anchorIdx ? { ...baseProps, ...instProps } : baseProps;
        const edge = createStraightEdge(stage, useMapId, from, to, isBackEdge, props);
        if (edge) ids.push(edge.id());
    }
    return ids;
};

const forwardIds = buildForward ? buildChain(false, forwardSource, propsP) : [];
const reverseIds = buildReverse ? buildChain(true, reverseSource, propsR) : [];
```

> `newNodeShapes` 是第 6 步 `createNodeShape` 返回值数组（过滤 undefined 后按 A→B 顺序排列）。建边总数 = 正向段数 + 反向段数，镜像策略下为 (buildForward + buildReverse) × (N+1)，最大 2(N+1)。
> **z-order 事实**：正反边几何重合无偏移（§2.4），反向链后建 → 红边盖住灰边，与手动画正向再画反向的最终效果一致；要选灰边可借右键「选中反向路径」跳转。此为沿用现状，非新引入问题。

**`findAnchorSegmentIndex`**（落地 `createEdgeShape.ts`）：

```ts
/**
 * 返回链上「中点距 (labelX, labelY) 最近」的段索引（并列取靠前段）。
 * 锚点与段中点同为画布坐标（旧边 labelX/labelY 存的就是画布正 y，§2.3），空间一致。
 * 对贝塞尔旧边同样成立：其 labelX/labelY 是曲线标签点，最近段即配置应归属的段。
 */
export const findAnchorSegmentIndex = (
    labelX: number,
    labelY: number,
    chain: Konva.Shape[]
): number => {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < chain.length - 1; i++) {
        const mx = (chain[i].x() + chain[i + 1].x()) / 2;
        const my = (chain[i].y() + chain[i + 1].y()) / 2;
        const dist = (mx - labelX) ** 2 + (my - labelY) ** 2;
        if (dist < bestDist) {
            bestDist = dist;
            best = i;
        }
    }
    return best;
};
```

### 4.7 区域成员继承（handleOk 第 10 步，D20）

旧直连边可能属于独占区/三方交管（`group.edgeIds`）。删除重建后若不迁移，**该走廊整段静默失去区域管制**，且旧 id 残留 group 随保存入库。因此把旧边 id 原位替换为同向新链段 id：

```ts
/**
 * D20：旧边 id → 同向新链段 id 数组。镜像策略保证「被删的方向必然被重建」，
 * 因此每条被删旧边都有同向替换目标，不会出现无处可迁的残留。
 */
const replacement = new Map<string, string[]>();
forwardEdges.forEach(e => replacement.set(e.id(), forwardIds));
reverseEdges.forEach(e => replacement.set(e.id(), reverseIds));
if (replacement.size > 0) {
    // 原位替换并保持顺序；Set 去重（多条同向旧边异常场景会替换出重复 id）
    const migrate = (groups: NodeEdgeGroup[]): NodeEdgeGroup[] =>
        groups.map(g =>
            g.edgeIds.some(id => replacement.has(id))
                ? { ...g, edgeIds: [...new Set(g.edgeIds.flatMap(id => replacement.get(id) ?? [id]))] }
                : g
        );
    // 函数式更新；无命中的 group 原样返回（引用不变）。快照已在第 4 步捕获旧 groups，undo 整体回滚
    setTrafficGroups(prev => migrate(prev));
    setExclusiveGroups(prev => migrate(prev));
}
```

> Modal 需新增 4 个 props：`trafficGroups / exclusiveGroups / setTrafficGroups / setExclusiveGroups`（类型 `NodeEdgeGroup`，来自 `@/types/MapNestModify`），由 `ContextMenu/index.tsx` 透传（与 `handleAreaClick` 同源）。`updateGroupsRef` 由既有 effect 在 groups 变化后同步，后续快照取到的是迁移后状态，undo 链一致。
> 节点侧无工作：A、B 未删，新节点不进任何区域（沿用原「等距插入节点」语义）。

### 4.8 命令式图层刷新（D12）

建点/建边/删边均为命令式 `shape.add/destroy`，不触发 React 重渲染，三个独立装饰图层感知不到变化。与 `doBatchDelete` 完全同口径，在第 11 步统一刷新：

```ts
refreshDeviceIcons(stage);   // 清理被删边上的三方设备图标 + 为锚点段新边重建
refreshActionBadges(stage);  // 清理被删边上的动作角标 + 为锚点段新边重建
stage.fire("angles:refresh", {} as any); // 夹角层基于新拓扑重算
```

### 4.9 预览面板改造（D13，第 4 轮修订）

预览在 `twoNodesReady` 为真时渲染。改动两点：

**(a) 线段示意图按方向镜像**

现有示意图为单条灰色横线 `A●──○──○──●B`。改为按「将建方向」渲染：

- 双向（双边都有旧边，或 K=0）：`lineWrapStyle` 内画**两条平行横线**——上线 `forwardPath.stroke`(#BDBDBD) + 右端 `→`（正向 A→B），下线 `reversePath.stroke`(#E57373) + 左端 `←`（反向 B→A）；
- 仅正向：单条灰线 + 右端 `→`；仅反向：单条红线 + 左端 `←`；
- 中间分点（`midDot`）保持强调色实心圆，线从其穿过，表示「插入节点位置不变，按已有方向各连一段」。

> 示意图是**拓扑示意**而非几何写实：画布上正反边实际几何重合、无偏移（§2.4），双线画法只为表达「两条方向相反的边」这一拓扑事实。箭头用 `▶`/`◀` 字符或 CSS 三角，HTML/CSS 绝对定位实现。

**(b) 统计区增加边数 / 删边数提示**

在现有「平均间距 / 生成数量 / 节点类型」三列后追加：

```
新增边：dirs×(N+1) 条    （dirs = 将建方向数，K=0 时 2，单边时 1，双边时 2）
删除旧边：K 条           （K 实时从 stage 算 A↔B 直连边数；K=0 显示 0）
```

`K` 与方向数的实时计算（渲染期，与平均间距同源）：

```ts
let oldEdgeCount = 0;
let hasForwardOld = false;
let hasReverseOld = false;
if (twoNodesReady) {
    const aId = aShape!.attrs?.id, bId = bShape!.attrs?.id;
    stage?.find(s => s.attrs?.enableSelect === "edge").forEach(s => {
        const d = s.attrs?.data;
        if (!d) return;
        if (d.snodeId === aId && d.enodeId === bId) { oldEdgeCount++; hasForwardOld = true; }
        else if (d.snodeId === bId && d.enodeId === aId) { oldEdgeCount++; hasReverseOld = true; }
    });
}
const dirs = oldEdgeCount === 0 ? 2 : (hasForwardOld ? 1 : 0) + (hasReverseOld ? 1 : 0);
const newEdgeTotal = dirs * (count + 1);
```

> Modal 带遮罩，打开期间画布不可编辑，渲染期读取 stage 是稳定的；count 变化触发重渲染时同步刷新。

**(c) 态二·链路等距化预览（B19，第 5 轮新增）**

当渲染期探测到「A↔B 无直连边、但 `findSimplePaths` 命中唯一简单路径」时，预览切换为态二模式：

- 示意图标题旁标注「链路等距化」徽标；分点改为**空心圆**（表示已有旧中间节点）与**实心圆**（表示将新建的等距点）按 A→B 投影顺序交错，直观表达混合单链（B5）。
- 统计区「删除旧边」= 路径边数（路径相邻对数）；「新增边」= 混合链段数 = `count + 旧中间节点数 + 1`（B7）；并新增一行「保留旧节点：m 个」提示旧中间节点不删。

```ts
// 渲染期态二探测（与 handleOk 第 3.5 步同口径，只读）
let mode: "edge" | "chain" | "new" = "new"; // 默认态三
if (twoNodesReady) {
    const hasDirect = stage!.find(s => s.attrs?.enableSelect === "edge").some(s => {
        const d = s.attrs?.data;
        return d && ((d.snodeId === aId && d.enodeId === bId) || (d.snodeId === bId && d.enodeId === aId));
    });
    if (hasDirect) mode = "edge";
    else mode = findSimplePaths(stage!, aId, bId).length === 1 ? "chain" : "new";
}
```

> 态二下若 `findSimplePaths` 返回 ≥2（多条路径），预览降级为 warning 占位「两点间存在多条路径，无法确定唯一等距目标」；点击生成仍由 handleOk 第 3.5 步再次拦截（渲染期探测与 handleOk 判定同口径，B16）。

### 4.10 完成提示文案（D14，第 4 轮修订）

按**实际建成边数**报告（edgesLayer 缺失等异常下不虚报）：

```ts
const edgeTotal = forwardIds.length + reverseIds.length;
if (toDestroy.length > 0) {
    message.success(`已生成 ${count} 个【${typeLabel}】节点、连接 ${edgeTotal} 条边，删除 ${toDestroy.length} 条旧边`);
} else {
    message.success(`已生成 ${count} 个【${typeLabel}】节点、连接 ${edgeTotal} 条边`);
}
```

> 区域成员继承（D20）不进提示文案：属预期内的静默迁移，避免噪音；验证清单 §8 覆盖其核对。

---

### 4.11 态二·链路等距化（B1–B19，第 5 轮新增）

当 §4.1 第 3.5 步判定 A、B 之间「无直连边、有唯一简单路径」时进入本分支。典型场景：`A→旧m1→旧m2→B` 一条链，选中两端 A、B 插入 N 个等距新点，期望结果 `A→新1→旧m1→新2→旧m2→新3→B`（旧点保留原位、新点等距、按投影交错）。

**(a) 唯一简单链探测（B1/B13）**

```ts
const paths = findSimplePaths(stage, aId, bId);     // 复用 utils/align.ts
// 三态判定已保证 paths.length ≥ 1（0 条走态三）；此处只需排除多条
if (paths.length >= 2) {
    message.warning("两点间存在多条路径，无法确定唯一等距目标");
    return;                                          // 无副作用（B16）
}
const pathNodeIds: string[] = paths[0];              // [aId, m1Id, m2Id, ..., bId]
const middleIds = pathNodeIds.slice(1, -1);          // 旧中间节点 id（原路径拓扑顺序）
```

> `middleIds` 为空意味着 A、B 直接连通却无直连边（数据异常），此时退化为态三处理。`findSimplePaths` 把边视为无向（snodeId↔enodeId 互通），与链路的无向连通语义一致；方向在 (d) 步逐段恢复。

**(b) 收集路径旧边并删除（B3/B12）**

路径边 = `snodeId/enodeId` 恰为路径某相邻对的所有边（双向匹配，不分 isBackEdge、不分 LINE/BEZIER）。旧中间节点上**非路径**的分支边（一端不在 pathNodeSet）**保留不动**（B12）。

```ts
const pathNodeSet = new Set(pathNodeIds);
const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
const pathPairs = new Set(pathNodeIds.slice(0, -1).map((id, i) => pairKey(id, pathNodeIds[i + 1])));
const pathEdges = allEdges.filter(e => {
    const { snodeId, enodeId } = e.attrs.data;
    return pathPairs.has(pairKey(snodeId, enodeId)); // 恰为路径相邻对（隐含两端都在路径上）
});
// 节点 id → shape（A、B、旧中间节点均未删除），用于取画布坐标
const nodeIdToShape = new Map<string, Konva.Shape>();
[aShape, bShape, ...middleShapes].forEach(s => nodeIdToShape.set(s.attrs.id, s));
// 先从每条路径边提取业务属性 + 锚点 + 端点画布坐标，再 destroy
const pathEdgeMeta = pathEdges.map(e => {
    const d = e.attrs.data;
    const fromS = nodeIdToShape.get(d.snodeId)!, toS = nodeIdToShape.get(d.enodeId)!;
    return {
        id: e.id(), isBackEdge: !!d.isBackEdge,
        labelX: d.labelX, labelY: d.labelY,
        props: pickEdgeBusinessProps(d),
        actions: d.actions?.length ? d.actions : undefined,
        udp: d.userDefinedProperties ?? undefined,
        ax: fromS.x(), ay: fromS.y(), bx: toS.x(), by: toS.y() // B14：取自节点 shape，不读 sy/ey
    };
});
pathEdges.forEach(e => e.destroy());
if (pathEdges.length > 0) {
    stage.findOne(`.${MAP_NEST_LAYER_NAME.edges}`)?.batchDraw(); // 立即清旧边视觉
}
```

> 端点坐标取自节点 shape 的 `x()/y()`（画布世界坐标），**不读** `data.sy/ey`（后端坐标 = −画布 y，见 §2.3）。

**(c) 组装混合单链（B5/B10）**

把 A、B、新点、旧中间节点统一按「在 A→B 有向直线上的投影参数 t」升序排列；t 并列时旧点优先。

```ts
const abx = bShape.x() - aShape.x(), aby = bShape.y() - aShape.y();
const abLen2 = abx * abx + aby * aby;
const projT = (x: number, y: number) =>
    abLen2 < 1e-12 ? 0 : ((x - aShape.x()) * abx + (y - aShape.y()) * aby) / abLen2;
const candidates = [
    { shape: aShape, t: 0, isOld: true, topo: -1 },
    ...newNodeShapes.map((s, i) => ({ shape: s, t: (i + 1) / (count + 1), isOld: false, topo: i })),
    ...middleShapes.map((s, i) => ({ shape: s, t: projT(s.x(), s.y()), isOld: true, topo: i })),
    { shape: bShape, t: 1, isOld: true, topo: middleShapes.length }
];
candidates.sort((p, q) =>
    Math.abs(p.t - q.t) < 1e-9
        ? (p.isOld === q.isOld ? p.topo - q.topo : p.isOld ? -1 : 1) // 并列：旧点优先(B10)
        : p.t - q.t
);
const chain = candidates.map(c => c.shape);
// 预算每条原边的锚点段（D21），用于建边时定位 actions/udp 附加段
pathEdgeMeta.forEach(m => { m.anchorSeg = findAnchorSegmentIndex(m.labelX, m.labelY, chain); });
```

> 投影用画布世界坐标（与建点/建边同空间），不用屏幕坐标（那是 `alignTwoPointsLine` 为兼容地图旋转才用的）。极端折线下旧点 t 可能落在 [0,1] 之外，仍按 t 排序纳入，链可能轻微回折（B15 已知限制）。

**(d) 逐段建边：方向 + 属性镜像（B6/B9/B14）**

对 chain 每段，取段中点在原路径边里找**欧氏距离最近**那条，用其 `isBackEdge` 作方向、白名单 props 作属性；若本段索引等于该原边的 `anchorSeg` 则附加 actions/udp（D21）。

```ts
const oldToNew = new Map<string, string[]>(); // 区域成员替换用
for (let i = 0; i < chain.length - 1; i++) {
    const mx = (chain[i].x() + chain[i + 1].x()) / 2;
    const my = (chain[i].y() + chain[i + 1].y()) / 2;
    let best = pathEdgeMeta[0], bestD = Infinity;
    pathEdgeMeta.forEach(m => {
        const d = pointToSegmentDist(mx, my, m.ax, m.ay, m.bx, m.by); // 新增辅助，见 §5.1
        if (d < bestD) { bestD = d; best = m; }                        // 严格<：并列保留靠A侧
    });
    const props: Partial<MapEdge> = { ...best.props };
    if (i === best.anchorSeg) {
        if (best.actions) props.actions = best.actions;
        if (best.udp) props.userDefinedProperties = best.udp;
    }
    const edge = createStraightEdge(stage, useMapId, chain[i], chain[i + 1], best.isBackEdge, props);
    if (edge) {
        oldToNew.set(best.id, [...(oldToNew.get(best.id) ?? []), edge.id()]);
    }
}
```

> 方向完全由原路径边决定（B6）：原段是反向红边则对应新段也建反向红边，保留原通行方向结构；态二**不引入**态三那种凭空默认方向。`pointToSegmentDist` 与 `findAnchorSegmentIndex` 同为「点→线段最近」族几何，落地 `createEdgeShape.ts`。

**(e) 区域成员继承（B9/D20）**

`oldToNew`（原边 id → 其映射到的新段 id 数组）已在建边循环中收集，复用 §4.7 的 `migrate` 函数式替换（`Set` 去重、无命中不 setState）；undo 随第 4 步 groups 快照整体回滚。

**(f) 与态一/态三共用的部分**

建点（`createNodeShape`）、建边（`createStraightEdge`）、属性白名单（`pickEdgeBusinessProps`）、锚点段定位（`findAnchorSegmentIndex`）、装饰层刷新、saveSnapshot/undo 均与态一/态三**完全共用**；本节只描述链组装（c）与段→原边映射（d）的差异。

---

## 5. 改动点

### 5.1 新增 `ContextMenu/createEdgeShape.ts`（D15）

导出 `createStraightEdge`（§4.4/§4.5）、`pickEdgeBusinessProps`（§4.3）、`findAnchorSegmentIndex`（§4.6）、`pointToSegmentDist`（§4.11，点到线段距离——态二「段中点→最近原边」欧氏映射用，与 `findAnchorSegmentIndex` 同族几何）。import 清单：

```ts
import Konva from "konva";
import type { MapEdge } from "@/utils/typing";
import type { LinePoint } from "@/utils/typing";
import { defaultPathProperty } from "@/plugins/konva/path/defaultPathProperty";
import { forwardPath } from "@/plugins/konva/path/forwardPath";
import { reversePath } from "@/plugins/konva/path/reversePath";
import { nextNameByShapes } from "@/utils/graph";
import { getRandomString } from "@/utils/public";
import { computeLineArrowPoints, computeLinePoint } from "@/utils/math";
import { edgeSceneFunc, edgeHitFunc } from "@/plugins/konva/path/edgeDrawFuncs";
import { MAP_NEST_STAGE_ATTR, MAP_NEST_LAYER_NAME } from "@/plugins/konva/runtime/constants";
```

文件顶部多行中文注释：说明用途、坐标符号约定（§2.3）、t=1/3 锚点约定（§2.4）、白名单继承约定（§4.3）、与 `createNodeShape` 的对称关系、不在此处 saveSnapshot/弹提示的约定。

### 5.2 改 `EvenlyInsertModal/index.tsx`

**(a) `handleOk`**（§4.1 三态流程）：`computeEvenlyPoints` 判重通过后、`saveSnapshot` **之前**插入「**三态判定**」（§4.1 第 3.5 步）：查直连边 → 命中走**态一**（原 §4.2 收集直连边 + P/R 白名单 + destroy）；否则 `findSimplePaths` → 唯一路径走**态二·链路等距化**（§4.11：收集路径边 + 投影交错混合链 + 段中点最近原边建边）；0 条走**态三**（K=0 默认建链）。三条分支共用 `saveSnapshot` → `createNodeShape` 收集 `newNodeShapes` → 建边 → 区域成员继承（§4.7 / §4.11-e）→ 刷新装饰层（§4.8）→ 按实际边数 message（§4.10）。

**(b) props 新增 4 个**（D20）：`trafficGroups: NodeEdgeGroup[]`、`exclusiveGroups: NodeEdgeGroup[]`、`setTrafficGroups`、`setExclusiveGroups`（setter 类型 `(value: React.SetStateAction<NodeEdgeGroup[]>) => void`），`NodeEdgeGroup` 来自 `@/types/MapNestModify`。

**(c) import 新增**：`createStraightEdge / pickEdgeBusinessProps / findAnchorSegmentIndex / pointToSegmentDist`（来自 `../createEdgeShape`）、`findSimplePaths`（`@/utils/align`，态二唯一链判定）、`refreshDeviceIcons`（`@/plugins/konva/devices`）、`refreshActionBadges`（`@/plugins/konva/actions`）、`forwardPath`、`reversePath`（预览配色用）、`NodeEdgeGroup` 类型。

**(d) 预览面板（§4.9 / §4.11，B19）**：单横线改为按方向镜像的示意线 + 箭头；统计区追加「新增边 / 删除旧边」两列；渲染期计算 `oldEdgeCount / hasForwardOld / hasReverseOld / dirs / newEdgeTotal`。**态二下**（无直连边但有间接路径）示意图标注「链路等距化」并区分旧点（空心圆）与新点（实心圆）交错；统计区「删除旧边」显示路径边数、「新增边」显示混合链段数 = N + 旧中间节点数 + 1。

**(e) 文件顶部注释**：更新「关键决策」段，补充 D1（默认连线）、D2（方向镜像）、D4（全删旧边）、D5（白名单+锚点段）、D13（预览）、D14（提示）、D20（区域继承），以及第 5 轮 B4（三态判定）、B5（混合单链）、B6（逐段镜像方向）、B9（段中点最近原边），并指向本 SPEC。

### 5.3 改 `ContextMenu/index.tsx`（仅 props 透传）

菜单入口 `case "evenlyInsertNodes"` 与既有 props 透传（`open/stage/useMapId/selectShapes/setSelectShapes/onClose`）不变；**仅新增**向 `EvenlyInsertModal` 透传 `trafficGroups / exclusiveGroups / setTrafficGroups / setExclusiveGroups`（组件内与 `handleAreaClick` 同源，无需新引入）。菜单项、置灰条件、其它 case 一律不动。

---

## 6. 不改的部分

- `createNodeShape.ts`：建点函数，仅复用。
- `computeEvenlyPoints`：分点计算 + 判重逻辑、判重中止语义（原决策 7/8）完全保留。
- 菜单置灰条件（`twoNodesSelected`）、Modal 重置逻辑（`COUNT_DEFAULT`、`nodeType="work"`）、快捷胶囊、节点类型选择。
- AddEdge（交互式逐段连边）、`onAddReverseEdge`（单边反向，灰边旧口径不改）、`alignTwoPointsLine`（两点对齐）。
- `undoHistory.ts`、`defaultPathProperty.ts`、forward/reverse 配色常量、`edgeDrawFuncs`、装饰图层刷新函数。

---

## 7. 边界与容错

| 场景 | 处理 |
|---|---|
| A、B 间无直连边（K=0） | 不删任何边；默认建双向 2(N+1) 条（全默认属性）；提示略去「删除」分句（D14） |
| A→B 有正向边、B→A 有反向边 | 两者都删；双向链重建；正向继承 P、反向继承 R（D5）；区域成员双边迁移（D20） |
| 只有正向边、无反向边（**第 4 轮修订**） | 删正向旧边；**只建正向链** N+1 条（继承 P）；**不新增 B→A 反向通路**（D2 镜像） |
| 只有反向边、无正向边（**第 4 轮修订**） | 对称：只建反向链 N+1 条（继承 R，`isBackEdge=true` 红边）；不新增 A→B 正向通路 |
| A↔B 有 BEZIER 曲线边 | 一并删除（D4 不分类型）；新边统一为 LINE，旧曲线的 cx/cy/dx/dy 丢弃（D17）；锚点按旧 `labelX/labelY` 最近段归属（D21） |
| A↔B 有多条同向边（数据异常） | 全部删除；属性取首条（D7）；区域替换后 `Set` 去重（§4.7） |
| A↔B 经中间节点的间接路径（A→C→B） | 不动（D8，直连边定义天然排除） |
| 某分点与已有节点重合 | `computeEvenlyPoints` 判重 → warning + return，**此时尚未删旧边**（D9），无副作用 |
| Modal 打开期间选中被改动 | 第 2 步防御性校验拦截（沿用原逻辑） |
| `edgesLayer` 不存在 | `createStraightEdge` 返回 undefined，该条边不建（与 `createNodeShape` 同口径）；提示按实际建成数报告，不虚报（D14） |
| `stage` 为 null | 第 2 步校验拦截 |
| A、B 同 id（理论异常） | 第 2 步后取 aId/bId；若相同，直连边匹配退化，建出 0 长度边——沿用现状不做特判（原 `computeEvenlyPoints` 亦未防） |
| 撤销（undo） | 操作前一次 `saveSnapshot` 全量捕获（含 groups）；undo 一次回退：旧边复原、新点新边消失、区域成员复原（D10/D20） |
| 新边命名冲突 | `nextNameByShapes` 每条边建时基于 stage 最新 edge 自增；旧边已先删，名称可回收（D16） |
| 旧边属于独占区/三方交管 | `edgeIds` 中旧边 id 原位替换为同向新链段 id（D20）；不再依赖懒清理 |
| 历史遗留的区域残留 id（手工删除等造成） | 沿用现状：渲染降级显示原始 id（`CollapseChildren` 的 `|| edgeId`），不崩溃；本期不引入新残留 |
| 旧边绑定三方设备/动作 | 仅锚点段继承（D21）；`refreshDeviceIcons`/`refreshActionBadges` 重建后，设备图标（t=1/3 锚点）与名称标签/角标（labelX/labelY，同 t=1/3）不错位（D12/D17） |
| 旧边是 `onAddReverseEdge` 产物（isBackEdge=false 的灰反向边） | 按方向组正常识别（§4.2 按 snodeId/enodeId 分组，与 isBackEdge 无关）；重建反向链为红边（D2 口径）；其 `forward_avoid` 继承到红边上后在 Avoid 面板不展示（面板对 back 边只展示 `reverse_avoid`）——已知连带现象，见 §9 |
| **【态二】A、B 仅间接路径、无直连边** | 走链路等距化（§4.11）：删路径边、新点与旧中间节点按投影交错成混合单链；旧中间节点保留原位不删（B3/B5） |
| 【态二】A、B 间接路径有多条/有环/有分叉 | `findSimplePaths` 命中 ≥2 → warning「两点间存在多条路径，无法确定唯一等距目标」+ return，无副作用（B1/B16） |
| 【态二】旧中间节点带路径外分支边 | 分支边保留不动，只删路径相邻对边（B12）；旧节点经新链继续连通，不孤立 |
| 【态二】某新分点与某旧中间节点坐标严格重合 | `computeEvenlyPoints` 判重 → warning + return，**旧边未删**（B8/B16），用户改 N 重试 |
| 【态二】原链各段方向/属性不同 | 逐段按「段中点最近原边」镜像方向、继承属性（B6/B9）；段中点到多原边等距时取靠 A 侧（B14） |
| 【态二】极端折线（旧点投影 t 在 [0,1] 外） | 仍按 t 排序纳入混合链，可能轻微回折；不特判，已知限制（B15） |
| 【态二】旧路径边属某区域 / 旧边绑设备·动作 | 区域成员按 `oldToNew` 原位替换（§4.11-e）；设备/动作仅锚点段继承（D21），由 `refreshDeviceIcons/refreshActionBadges` 重建 |
| A↔B 既有直连边又有间接路径 | 走态一（边细分），间接路径保留不动（B11；D8 收窄到态一内） |

---

## 8. 验证清单（手动）

项目无自动化测试，以下场景需手动验证：

**基础连线（无旧边）**
1. **选中两孤立节点 A、B（无边）→ 等距插入 N=2** → 生成 2 个新点 + 6 条边（正向 3 + 反向 3）；A→点1→点2→B 正向链、B→点2→点1→A 反向链；提示 `已生成 2 个【…】节点、连接 6 条边`（无「删除」分句）。
2. **N=1** → 正向 2 条 + 反向 2 条，共 4 条边。
3. **新边样式**：正向 `#BDBDBD`、反向 `#E57373`；方向箭头正确；名称标签在线段 t=1/3 处（与全图既有边位置一致）。

**旧边删除与镜像重建（第 4 轮修订重点）**
4. **A→B 已有正向直线边 → 插入 N=2** → 旧正向边删除；**只建正向 3 条**（继承旧边 loadType 等属性）；**不建反向边，B→A 仍无通路**；提示 `连接 3 条边，删除 1 条旧边`。
5. **A↔B 已有正向 + 反向边 → 插入 N=1** → 2 条旧边删除；双向各 2 条；正向新边继承旧正向属性、反向新边继承旧反向属性（属性不同时分别核对）。
6. **B→A 仅有反向边 → 插入** → 只建反向链（红边），不新增正向通路。
7. **A↔B 已有 BEZIER 曲线边 → 插入** → 旧曲线删除，新边为直线（cx/cy/dx/dy=null），曲线弧度消失。
8. **A→C→B 间接路径 + A→B 直连边 → 插入** → 仅 A→B 直连边删除重建；A→C、C→B 间接边保留不动。

**属性继承**
9. **旧正向边 loadType=1 → 插入** → 各正向新边均 loadType=1。
10. **只有反向边（loadType=2）→ 插入** → 反向新边 loadType=2。
11. **旧边带三方设备 + 动作 → 插入** → **仅锚点段**（旧 label 位置最近段）有设备图标与动作角标，其余段没有；且图标、名称标签、角标三者同锚（t=1/3）不错位（D17/D21 联合核对）。
12. **旧边 maxFreeSpeed 缺字段（旧数据）→ 插入** → 新边 maxFreeSpeed 为默认 1，不被 undefined 冲掉。

**区域成员继承（D20）**
13. **旧正向边属于某独占区/三方交管 → 插入** → 区域成员中新正向链各段 id 就位、旧边 id 消失；区域高亮/成员列表正确；undo 后区域成员整体复原。
14. **正反旧边同在一个区域 → 插入** → 两方向新链段 id 都进入该区域，无重复 id。

**原子性与撤销**
15. **某分点与已有节点重合 → 点生成** → warning `第 X 个插入点与已有节点【…】重合，已中止`；**旧边未被删除**（核对 A↔B 边仍在）。
16. **正常插入后 undo** → 一次回退：N 个新点消失、全部新边消失、K 条旧边复原、区域成员复原。
17. **undo 后 redo** → 重新出现新点新边、旧边再次消失、区域成员再次迁移。

**装饰图层刷新**
18. **旧边上有三方设备图标 → 插入** → 图标不残留为孤儿；锚点段新边上重建（`refreshDeviceIcons`）。
19. **旧边上有动作角标 → 插入** → 角标不残留；锚点段新边重建（`refreshActionBadges`）。
20. **插入后夹角层** → 新节点处的夹角立即正确显示（`angles:refresh`）。

**预览面板（第 4 轮修订重点）**
21. **选中 A、B（有 2 条旧边）→ 改 N** → 示意图显示双向平行线（灰+→、红+←）+ 分点；统计区 `新增边 2(N+1)`、`删除旧边 2`。
22. **选中 A、B（仅 1 条正向旧边）** → 示意图只显示单灰线+→；统计区 `新增边 N+1`、`删除旧边 1`。
23. **选中无边 A、B** → 示意图双向平行线；`删除旧边 0`、`新增边 2(N+1)`。
24. **未选中两节点** → 预览降级为「请先在画布上选中两个节点」。

**保存往返（reverseEdgeId 修复核对）**
25. **A↔B 有旧边 → 插入后立即保存地图 → 重新打开** → 新边无 `reverseEdgeId` 残留（后端数据核对）、区域成员正确、各边标签位置与全图一致、设备/动作仅在锚点段。

**生成后选中态**
26. **插入完成** → 原 A、B 选中高亮清除；新点、新边均不处于选中态（D11）。

**链路等距化（态二，第 5 轮新增）**
27. **选中链路两端 A、B（中间有旧节点 m1、m2，无直连边）→ 等距插入 N=3** → 进入态二；旧路径边全删；生成 `A→新1→m1→新2→m2→新3→B` 混合单链（共 6 段边）；旧节点 m1、m2 保留原位且仍连通、不孤立；无平行路径。
28. **N=1、中间 2 旧点** → 混合链按投影交错决定新点与旧点的相对顺序（投影并列时旧点优先，B10）。
29. **原链含反向段（如 m1→m2 是红边）→ 插入** → 该段对应的新混合段也建为红边（isBackEdge=true）；其余正向段保持灰边（B6 逐段镜像）。
30. **原链各段 loadType 不同 → 插入** → 每段新边继承「段中点最近原边」的 loadType（B9），分段核对差异。
31. **旧中间节点 m1 另连路径外分支边 m1→X → 插入** → m1→X 保留不动；m1 经新链继续连通（B12）。
32. **链路两端间存在多条路径 → 插入** → warning「两点间存在多条路径，无法确定唯一等距目标」；**无任何副作用**（旧边未删、未建点，B16）。
33. **某新分点与旧中间节点坐标严格重合 → 插入** → warning「第 X 个插入点与节点【…】重合，已中止」；旧边未删（B8）。
34. **态二正常插入后 undo** → 一次回退：新点消失、混合链新边消失、旧路径边与旧中间节点复原、区域成员复原（B17）。

---

## 9. 决策溯源（访谈轮次）

| 轮次 | 决策项 |
|---|---|
| 第 1 轮 | D1 连线行为（默认就连线）、D2 方向（初选「仅正向直线」）、D4 旧边范围（全删）、D5 属性继承（全部继承） |
| 第 2 轮 | **D2 修正为双向**（反向边命运：反向一并重建）、D5 细化（正取 P 反取 R）、D13 预览（加连线+提示删边）、D14 提示（详细报告） |
| 第 3 轮 | D6 属性回退（取默认值）、D13 预览视觉（横线改边配色+箭头）、D11 生成后选中（清空不选中）、D14 文案（合并报边数） |
| 第 4 轮（源码对照评审修订） | **D2 修订为方向镜像**（仅单边不新增通路）、**D5 修订为白名单+实例字段锚点段**（修 reverseEdgeId 泄漏与设备/动作倍增）、**D17 修正 label t=1/3**、**D20 新增区域成员继承**、D6/D13/D14 联动修订；订正「正反边带偏移平行线」等事实性表述 |
| 第 5 轮（链路等距化扩展） | 新增 B1–B19：原「直连边 / 无连接」二态扩展为**三态自动判定**（B4/B11），补齐「无直连边但有间接路径」场景（态二）；混合单链按投影交错（B5/B10）、旧中间节点保留不删（B3）、逐段镜像方向（B6）、段中点最近原边继承属性（B9）；复用 `findSimplePaths`（B1/B13）。触发场景：选中链路两端节点等距插入时旧路径未清理、形成平行路径 |

> **第 5 轮链路等距化的由来**：第 4 轮 SPEC 的 D4「只删直连边」+ D8「间接路径不动」+ K=0「默认建链」三者叠加，使「选中链路两端 A、B 插入」（A、B 间仅间接路径、无直连边）走入 K=0 分支，新建一条与原链并行的 A→…→B 链、旧中间节点悬空——实测数据确认会产生两条平行路径，对调度系统是「静默新增通路 + 冗余拓扑」双隐患。第 5 轮补入态二：删间接路径旧边、把新点与旧中间节点重组为同一条混合单链（旧点保留原位、按投影交错），并用 `findSimplePaths` 的「唯一简单链」约束保证确定性；方向与属性逐段镜像原路径（B6/B9），不引入凭空通路。
> **D2 两次修正的完整推理**：第 1 轮「仅正向 + 全删旧边」组合下，旧反向边被删却不重建 → B→A 通路永久丢失；第 2 轮升级为「一律双向」。第 4 轮发现其对称漏洞：仅单边有边时「一律双向」会**凭空新增**一个从未存在的通行方向（如单行巷道被静默双向化）——对调度系统，新增未授权通路比丢失通路更危险。最终定为「镜像已有方向」：双边都有 → 双向（保住第 2 轮成果）；仅单边 → 只重建该方向；K=0 无边 → 默认双向（此前无通路可言，双向为新连通的最常用默认）。镜像策略还带来一个结构性红利：**被删的方向必然被重建**，D20 的区域成员替换永远有同向目标段。

> **reverseEdgeId 泄漏的成因与修复（第 4 轮 P1）**：初稿 §4.2 把旧边**整个 data 对象**作为继承源传入，而 §4.5 的尾部覆盖清单不含 `reverseEdgeId` → N+1 条新边继承指向已销毁旧边的悬空 id，且保存时随 `EnableModify` 的 `...rest` 提交后端。修复：继承一律走 `pickEdgeBusinessProps` 显式白名单（§4.3），`createStraightEdge` 内再显式 `reverseEdgeId: null` 双保险。同类字段（`sfacing/efacing/cost`）经核实为保存时废弃/重算字段，保留继承无害（§4.3 注）。

> **label 锚点 t 值修正（第 4 轮 P1）**：初稿 D17 写 `computeLinePoint(…, 1/2)`，但全库约定为默认 `t=1/3`（`utils/math.ts` 默认值；`AddEdge`、`onAddReverseEdge`、`refreshDeviceLayer` 三处同口径）。且设备图标锚点永远按 t=1/3 重算、不读 labelX/labelY，而名称标签与动作角标锚在 labelX/labelY——t=1/2 会导致二者在「继承设备的新边」上必然错位，「标签给图标让位」逻辑失效。修正为不传参用默认 t=1/3。

> **isBackEdge 分歧记录（第 4 轮）**：`onAddReverseEdge` 建反向边用 `isBackEdge=false`（灰边），本特性反向链用 `isBackEdge=true`（红边）——**刻意分歧**，本特性口径与 AddEdge reverseLine 模式及地图加载配色（`createShapeConfig`：红 ⇔ isBackEdge=true）一致，`onAddReverseEdge` 是库内异类（不在本期改动范围）。连带已知现象：旧灰反向边的 `forward_avoid` 继承到红边后，Avoid 属性面板只展示 `reverse_avoid`，原配置在面板上不可见（数据仍在）。实现者请勿以「对齐 onAddReverseEdge」为由改动 D2 的 isBackEdge 口径。

> **「正反边带偏移平行线」订正（第 4 轮）**：初稿 §4.8(a) 称画布上正反边「本就是带偏移的两条平行线」，不属实——`edgeSceneFunc` 对正反边都直接起终点连线，几何完全重合，后建者盖先建者；带法线偏移的只是设备图标/动作角标。预览的双线画法定性为「拓扑示意」（§4.9）。

> **技术沿用项（D9/D10/D11/D12/D15–D19）**：不涉及访谈拍板，为沿用既有实现或无歧义的技术约定：
> - D9/D10 沿用 `saveSnapshot` 全量快照（含 groups）+ 原子中止语义。
> - D11 沿用原决策 11。
> - D12 沿用 `doBatchDelete`/`destroyShape` 的命令式图层刷新口径（逐字一致：`refreshDeviceIcons` → `refreshActionBadges` → `angles:refresh`）。
> - D15 对齐 `createNodeShape` 的函数抽取先例。
> - D16/D17/D18/D19 为几何/命名/坐标的既定约定（D17 经第 4 轮修正）。

---

## 10. 实施顺序建议

1. 新建 `ContextMenu/createEdgeShape.ts`：实现 `createStraightEdge`（§4.4/§4.5，含 JSON 深拷贝与 `reverseEdgeId: null`）、`pickEdgeBusinessProps`（§4.3，含 undefined 剔除）、`findAnchorSegmentIndex`（§4.6），均含多行简体中文注释（用途、坐标符号、t=1/3 约定、白名单约定、与 createNodeShape 对称、不 saveSnapshot/弹提示）。核对 import 路径与 `MapEdge`/`LinePoint` 类型。
2. 改 `ContextMenu/index.tsx`：向 `EvenlyInsertModal` 透传 `trafficGroups / exclusiveGroups / setTrafficGroups / setExclusiveGroups`（仅新增 props，不动菜单逻辑）。
3. 改 `EvenlyInsertModal/index.tsx` 的 `handleOk`：在第 3 步判重通过、第 4 步 `saveSnapshot` 之后，**先**「收集旧边分组 + 提取 P/R 白名单 + destroy」，**再** `createNodeShape` 循环（收集 `newNodeShapes`），然后「方向镜像判定 + buildChain 建边 + 收集各向 id」「区域成员继承（§4.7）」「刷新装饰层（§4.8）」；message 改按实际边数报告（§4.10）。新增 4 个 props 的类型定义。
4. 改 `EvenlyInsertModal/index.tsx` 预览面板：单横线 → 按方向镜像的示意线 + 箭头（§4.9）；统计区加「新增边 / 删除旧边」；渲染期算 `oldEdgeCount / hasForwardOld / hasReverseOld / dirs / newEdgeTotal`。
5. 更新 `EvenlyInsertModal/index.tsx` 顶部注释的「关键决策」段，指向本 SPEC。
6. 按 §8 验证清单逐项手动验证（重点：仅单边场景的镜像不新增通路、区域成员迁移与 undo 回滚、设备/动作仅锚点段且三者不错位、判重中止不删旧边、保存往返无 reverseEdgeId 残留）。
