# SPEC — Overlook 画布右键节点快捷创建任务

- 日期：2026-07-29
- 状态：已与需求方完成三轮访谈确认，待实施
- 涉及页面：`src/pages/Overlook/`（监控总览页）

---

## 1. 背景与目标

Overlook 监控页当前创建任务的唯一入口是画布顶部菜单「任务」→ `CreateOrderModal`（完整版弹窗），用户需手动选择地图与站点，操作路径长。

**目标**：在 Overlook 画布上**右键点击节点**，直接弹出**精简版创建任务弹窗**（`QuickCreateOrderModal`），自动预填：

| 字段 | 预填值 |
|---|---|
| `orderName` | `PointToPoint-年月日时分秒`（打开弹窗时动态生成，如 `PointToPoint-20260729143022`） |
| `mapId` | 当前画布展示的地图（`currentMapInfo.mapId`） |
| `stationId` | 被右键命中的节点 id |

用户确认/微调后一键提交，完成"点到点"任务的快速下发。

## 2. 现状关键事实（实施前必读）

1. **NodesLayer `listening={false}` 是刻意的性能优化**（`GraphStage/index.tsx` 注释明示）。节点不参与 Konva hit graph，`event.target` 在节点上右键时**永远是 Stage**，Konva 原生事件无法区分命中了哪个节点。
2. **Stage 现有右键行为**：`onContextMenu={e => e.evt.preventDefault()}`（`GraphStage/index.tsx:394`），仅阻止浏览器默认菜单，是干净的接入点。
3. **EdgesLayer 同样 `listening=false`**；RobotLayer `listening=true`（机器人可左键点击出 Tooltip，右键目前无功能）。
4. **站点 id 与节点 id 同源**：`CrossMapStation.id` ↔ `MapNode.id`（CrossMaps 页用法可证），右键节点可直接以其 `id` 预填 `stationId`。
5. **完整版弹窗 `CreateOrderModal`**：站点下拉为懒加载（`onOpenChange` → `getCrossMapStations({mapId})`）；`crossMapStations` 是全部子任务行共用的单一列表；车辆动作与动作组通过 `shouldUpdate` 互斥隐藏；提交前把 `agvAction`/`agvActionGroup` 转换为 `actions` 数组。
6. `mapId` 来源：`useModel("currentMapInfo")`。
7. 节点绘制坐标：`mountGraphNodes` 中 `y: -y`（世界坐标 = `(x, -y)`）；绘制半径 = `shapeStyle.radius * visualScale`（`visualScale` 存于 stage attr `MAP_NEST_STAGE_ATTR.visualScale`，GraphStage 内有 `visualScaleRef`）。
8. Stage `draggable`，右键拖拽可平移画布；Windows 下 `contextmenu` 在右键抬起时触发——**右键拖拽后抬起会误触发弹窗，必须防护**（见 D9）。

## 3. 访谈决策汇总

| 编号 | 决策点 | 结论 |
|---|---|---|
| D1 | 交互形式 | **右键节点直接打开弹窗**，无中间上下文菜单 |
| D2 | 命中检测 | **Stage 级 `contextmenu` + 手动几何命中**，不开启 NodesLayer listening（保持性能优化设计） |
| D3 | 弹窗实现 | **新建精简版 `QuickCreateOrderModal`**，不改动 `CreateOrderModal` |
| D4 | orderName | **每次打开弹窗时生成** `PointToPoint-YYYYMMDDHHmmss`，**可编辑** |
| D5 | 字段构成 | 任务名称、优先级、指定车辆、地图、站点、车辆动作/动作组（互斥）。**单子任务，无 Form.List、无指定车辆分组** |
| D6 | 地图/站点 | **均可更换**：地图 Select 预填当前图，换图清空站点；站点 Select 预填命中节点 |
| D7 | 未命中行为 | 右键空白画布/路径/机器人 → **静默不响应**（仅保留 `preventDefault`） |
| D8 | 优先级 | **留空**（`undefined`，由后端定默认值），与完整版一致 |
| D9 | 实现位置 | **逻辑集中在 GraphStage**：右键 handler、命中检测、弹窗状态管理；**NodesLayer 零改动** |
| D10 | 数据拉取 | 车辆/动作/动作组/地图列表：**首次打开弹窗时拉取并缓存**，之后不再重复请求；站点列表：**每次打开按当前 mapId 拉取**（保证预填站点显示名称而非裸 id） |
| D11 | 成功后行为 | `message.success` + 关闭弹窗 + 重置表单（与完整版一致） |
| D12 | 同名冲突 | 秒级时间戳即可，不加随机后缀；后端若拒绝重名，错误 message 直接展示，用户可手改 |

补充设计决策（实施细节，无需访谈）：

- **D13 右键拖拽防误触**：`onMouseDown` 记录右键按下时的 `clientX/Y`，`contextmenu` 时位移 > 5px 判定为拖拽平移，跳过弹窗。
- **D14 机器人优先**：`contextmenu` 时若 `event.target.attrs?.isRobot` 为真 → 直接返回（即使其下方几何命中节点也不弹窗），与 D7 一致。
- **D15 弹窗标题复用「创建任务」**，与完整版一致（如需区分可后续调整为「快捷创建任务」）。
- **D16 动作互斥交互沿用完整版**：选中 `agvAction` 则隐藏动作组 Select，反之亦然（`shouldUpdate` 模式），避免两字段同时有值。
- **D17 创建提交 loading（2026-07-29 评审确认）**：`confirmLoading` 保留（确定按钮转圈并禁用），**提交中同时锁定弹窗**——取消按钮禁用、右上角 X 隐藏、遮罩点击与 Esc 均不关闭（`cancelButtonProps.disabled` / `closable` / `maskClosable` / `keyboard` 随 `confirmLoading` 联动），防止提交中关弹窗导致状态错乱。比完整版严格，属有意增强。

## 4. 技术方案

### 4.1 命中检测（新增工具函数）

新增 `findHitNode`，建议放置于 `src/utils/graph.ts`（`mountGraphNodes` 旁，同属图计算）：

```typescript
/**
 * @description 手动几何命中检测：Overlook NodesLayer listening=false，
 *              Konva 事件无法命中节点，右键时以世界坐标遍历找最近节点
 * @param nodes 原始地图节点（MapNode[]，GraphStage state）
 * @param world 指针世界坐标（screenToWorld 转换结果）
 * @param visualScale 当前视觉缩放（visualScaleRef.current），保证命中半径与绘制半径一致
 * @returns 命中的最近节点，未命中返回 null
 */
export const findHitNode = (
  nodes: MapNode[],
  world: { x: number; y: number },
  visualScale: number,
): MapNode | null => {
  let hit: MapNode | null = null;
  let minDist = Infinity;
  nodes.forEach(node => {
    // 节点世界坐标为 (x, -y)（mountGraphNodes 翻转 y 轴）
    const dx = world.x - node.x;
    const dy = world.y - (-node.y);
    const dist = Math.hypot(dx, dy);
    // 命中半径 = 样式半径 × visualScale，与 sceneFunc 实际绘制半径一致（所见即所点）
    const radius = getNodeStyle(node.type).radius * visualScale;
    if (dist <= radius && dist < minDist) {
      minDist = dist;
      hit = node;
    }
  });
  return hit;
};
```

- 复杂度 O(n)，仅在右键瞬间执行一次，零常态开销。
- 性能模式（`enableOptimize`）下节点仍绘制圆形，命中逻辑不变。

### 4.2 GraphStage 改动（`src/pages/Overlook/ForceGraph/GraphStage/index.tsx`）

```typescript
// 新增 state：快捷创建弹窗
const [quickCreate, setQuickCreate] = useState<{
  open: boolean;
  mapId?: string;
  stationId?: string;
}>({ open: false });

// 新增 ref：右键按下位置（D13 防拖拽误触）
const rightDownPosRef = useRef<{ x: number; y: number } | null>(null);

// 右键按下记录位置
const onStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
  if (event.evt.button === 2) {
    rightDownPosRef.current = { x: event.evt.clientX, y: event.evt.clientY };
  }
};

// stage 的右键事件：命中节点则打开快捷创建弹窗
const onStageContextMenu = (event: Konva.KonvaEventObject<MouseEvent>) => {
  event.evt.preventDefault();
  // D14：机器人上右键静默（即使下方命中节点）
  if (event.target.attrs?.isRobot) return;
  // D13：右键拖拽平移后抬起不弹窗（位移阈值 5px）
  const down = rightDownPosRef.current;
  if (down && Math.hypot(event.evt.clientX - down.x, event.evt.clientY - down.y) > 5) return;
  const stage = stageRef.current;
  if (!stage) return;
  const pointer = stage.getPointerPosition();
  if (!pointer) return;
  // 手动几何命中（D2）
  const world = screenToWorld(pointer.x, pointer.y, stage);
  const hitNode = findHitNode(nodes, world, visualScaleRef.current);
  // D7：未命中静默
  if (!hitNode) return;
  setQuickCreate({ open: true, mapId: currentMapInfo.mapId, stationId: hitNode.id });
};
```

JSX 变更（注意：`QuickCreateOrderModal` 必须渲染在 `</Spin>` **之后**、与 `OrderInfoModal`/`VehicleInfoModal` 并列——**绝不能放进 `<Stage>` 内**，react-konva 的 Stage 子节点只允许 Konva 组件，放入会直接崩溃）：

```tsx
<Stage
  ...
  onMouseDown={onStageMouseDown}          // 新增
  onContextMenu={onStageContextMenu}      // 替换原 e => e.evt.preventDefault()
>
  ...（各 Layer 不变）
</Stage>
...
{/* 右键节点快捷创建任务弹窗（渲染位置与 OrderInfoModal/VehicleInfoModal 并列） */}
<QuickCreateOrderModal
  open={quickCreate.open}
  defaultMission={{ mapId: quickCreate.mapId, stationId: quickCreate.stationId }}
  onClose={() => setQuickCreate({ open: false })}
/>
```

**NodesLayer 零改动**（D9）。

### 4.3 新组件 `QuickCreateOrderModal`

位置：`src/components/QuickCreateOrderModal/index.tsx`（与 `CreateOrderModal` 同级）。

**Props：**

```typescript
interface QuickCreateOrderModalProps {
  open: boolean;
  /** 右键命中的预填值；mapId 为当前地图，stationId 为命中节点 id */
  defaultMission: { mapId?: string; stationId?: string };
  onClose: () => void;
}
```

**表单字段（D5/D6/D8）：**

| 字段 | 控件 | 必填 | 预填/默认 | 说明 |
|---|---|---|---|---|
| `orderName` | Input | 是 | 打开时生成 `PointToPoint-` + `dayjs().format("YYYYMMDDHHmmss")` | 可编辑（D4） |
| `priority` | InputNumber(0-999) | 否 | 留空（D8） | 与完整版一致 |
| `appointVehicleKey` | Select | 否 | 无 | `simpleVehicles`，`fieldNames: { label: "name", value: "key" }`，allowClear + showSearch |
| `mapId` | Select | 是 | `defaultMission.mapId` | `simpleMaps`，换图清空 `stationId`（沿用完整版 `onMissionMapIdChange` 语义，单字段版） |
| `stationId` | Select | 是 | `defaultMission.stationId` | 当前 mapId 的站点列表，`fieldNames: { label: "name", value: "id" }` |
| `agvAction` | Select | 否 | 无 | 与动作组互斥隐藏（D16） |
| `agvActionGroup` | Select | 否 | 无 | 与车辆动作互斥隐藏（D16） |

**打开时的副作用（`useEffect` 依赖 `open`）：**

1. `open === true` 时：
   - 生成并 `setFieldsValue({ orderName: "PointToPoint-..." , mapId, stationId })`；
   - 若 `mapId` 存在，立即调 `getCrossMapStations({ mapId })` 拉站点列表（D10，保证预填站点显示名称）；结果按 `name` 升序排序（`localeCompare` + `numeric: true`，与完整版一致）；
   - 首次打开（`fetchedRef.current === false`）时，并行拉取 `getSimpleVehicles` / `getSimpleMaps` / `getAgvActions` / `getAGVActionGroups` 并置位缓存标记（D10）。
2. 换图：`onMapIdChange` → `stationId` 置 `undefined`；站点下拉 `onOpenChange` 懒加载新图站点（沿用完整版模式）。
3. 各请求失败提示沿用完整版文案（`查询车辆列表出错` / `查询地图列表出错` / `查询车辆动作出错` / `查询车辆动作组出错` / `查询跨地图节点出错`）。

**提交（`handleOk`）：**

1. `form.validateFields().catch(() => null)`，校验失败（返回 `null`）直接 return——**必须 catch**，antd 校验失败是 reject，不 catch 会产生 unhandled rejection（完整版此处有同款小瑕疵，新组件不继承）；通过后 `confirmLoading` 置真；
2. `actions` 转换（与完整版完全一致）：
   - `agvAction` 为有效 number → `actions = agvActions.filter(a => a?.id === agvAction)`；
   - 否则若 `agvActionGroup` 有值 → `actions = agvActionGroups.find(g => g?.id === agvActionGroup)?.agvActions`；
   - 均无 → `actions = undefined`；
3. 提交体：

```typescript
createOrderRecord({
  orderName,
  priority,              // 可 undefined（D8）
  appointVehicleKey,     // 可 undefined
  orderMissions: [{ mapId, stationId, actions }],
})
```

   类型注意项：`CreateOrderRecord.priority` 与 `OrderMission.actions`/`extendParameters` 在类型定义上是必填，而运行时均可缺省。实施时沿用完整版的 `form.getFieldsValue()` 展开构造（或对提交体加 `as CreateOrderRecord` 断言），避免字面量构造触发 TS 报错。

4. 成功（`code === 200 && message === "success"`）：`form.resetFields()` → 关闭 → `message.success(t("创建订单成功"))`（D11）；失败：`message.warning(t("创建订单出错") + res?.message)`；异常：`message.error(...)`；`finally` 复位 `confirmLoading`。

**提交中 loading 与弹窗锁定（D17）：**

- 确定按钮 `confirmLoading` 转圈并禁用（防重复提交）；
- Modal 增加联动 props：提交中取消按钮禁用、X 隐藏、遮罩点击与 Esc 不关闭：

```tsx
<Modal
  confirmLoading={confirmLoading}
  cancelButtonProps={{ disabled: confirmLoading }}
  closable={!confirmLoading}
  maskClosable={!confirmLoading}
  keyboard={!confirmLoading}
  ...
>
```

**取消（`handleCancel`）：** `form.resetFields()` → 关闭。（提交中不可触发，见 D17。）

### 4.4 i18n

全部文案 key 在完整版 `CreateOrderModal` 中已存在（`创建任务` / `任务名称` / `优先级` / `指定车辆` / `地图名称` / `站点名称` / `车辆动作` / `动作分组` / `请输入订单名称` / `创建订单成功` / `创建订单出错` / 各查询出错提示 / `确定` / `取消`），**无需新增 locale key**。实现时逐条核对 `zh-CN.json` / `en-US.json` 已有 key 直接复用；若有遗漏按项目规范补齐两文件。

## 5. 边界情况清单

| 场景 | 行为 |
|---|---|
| 右键空白画布 / 路径边 | 静默，仅 `preventDefault`（D7） |
| 右键机器人（即使下方有节点） | 静默（D14，`isRobot` 优先短路） |
| 右键拖拽平移画布后抬起 | 不弹窗（D13，位移 > 5px 判定拖拽） |
| 性能模式 `enableOptimize` | 节点仍画圆，命中检测照常工作 |
| 高缩放级别下节点视觉很小 | `visualScale` 自适应已使节点屏幕尺寸近似恒定，命中半径 = 绘制半径，所见即所点 |
| 节点重叠 | 取圆心距离最近者 |
| 预填的 `stationId` 不在后端站点列表中 | Select 短暂显示裸 id，站点列表返回后若能匹配则显示名称；提交由后端校验兜底 |
| 换地图后未重选站点 | 表单必填校验拦截（`请选择站点`） |
| 同秒连续创建 → orderName 重名 | 不预防；后端拒绝时错误 message 直接展示，用户手改（D12） |
| 车辆动作与动作组同时有值 | 交互上互斥隐藏，不可能同时有值（D16） |
| 弹窗打开中切换 Overlook 地图 | 弹窗不自动跟随换图；`defaultMission` 是打开瞬间快照，用户可自行换地图字段 |
| 提交中重复点击确定 | `confirmLoading` 禁用确定按钮（D17） |
| 提交中点取消 / X / 遮罩 / Esc | 均不生效，弹窗锁定直至请求结束（D17），避免关闭后 `resetFields`/状态错乱 |
| 创建成功后订单展示 | 左侧订单列表经 WebSocket 自动刷新，无需额外处理 |

## 6. 影响面

**改动文件：**

1. `src/pages/Overlook/ForceGraph/GraphStage/index.tsx` — 新增右键 handler / 命中调用 / 弹窗 state；替换 Stage 的 `onContextMenu`、新增 `onMouseDown`
2. `src/utils/graph.ts` — 新增 `findHitNode` 工具函数
3. `src/components/QuickCreateOrderModal/index.tsx` — 新建（可能附带 `index.less`，如需样式微调）

**明确不改动：**

- `src/pages/Overlook/ForceGraph/GraphStage/NodesLayer/index.tsx`（D9，保持 `listening=false` 性能设计）
- `src/components/CreateOrderModal/index.tsx` 及 GraphMenu 顶部「任务」入口（D3）
- RobotLayer / EdgesLayer / DeviceLayer / ActionBadgeLayer
- locale 文件（预期零新增，见 §4.4）

## 7. 验收标准

1. Overlook 画布右键节点 → 弹出「创建任务」弹窗，`orderName`（`PointToPoint-` + 14 位时间戳）、`mapId`（当前图）、`stationId`（命中节点，显示站点名称）已预填；
2. 直接点确定 → 创建成功提示，弹窗关闭；再次右键另一节点 → orderName 重新生成、站点更新；
3. 提交中：确定按钮转圈禁用，取消按钮禁用、X 隐藏、遮罩点击与 Esc 均不关闭弹窗；请求结束后（无论成败）锁定解除（D17）；
3. 弹窗内可修改名称/优先级/指定车辆/地图/站点/车辆动作，校验规则（名称必填、站点必填、换图清空站点）生效；
4. 右键空白处/路径/机器人不弹窗，浏览器默认菜单仍被阻止；
5. 右键拖拽平移画布后抬起不弹窗；
6. 完整版「任务」入口行为与之前完全一致；
7. 性能模式开关、画布缩放/拖动、机器人点击 Tooltip 等既有交互无回归。
