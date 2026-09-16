# SPEC：按车辆过滤交管信息（交管白名单筛选）

> 适用页面：调度监控 `src/pages/Overlook`、录制回放 `src/pages/RecordPlayback`
> 受影响组件：`TrafficGroup`（两页共用，RecordPlayback 的 RobotLayer 直接 import Overlook 的 TrafficGroup）

---

## 1. 背景与目标

当前 `TrafficGroup` 会把**所有车辆**的交管信息（申请区 `applyingPath` / 解锁区 `lockedPath`）全部渲染到画布上。车队规模大时（>100 台），排查交管异常会被大量无关车辆的交管矩形淹没。

**目标**：在 Overlook 与 RecordPlayback 两个页面新增一个控件，让用户**只展示选中的 N 台车的交管信息**（白名单），其余车辆的交管不渲染，从而快速聚焦问题车辆。车辆本身（车体矩形/位置/状态）不受影响，仍全部显示，保留全局态势感知。

---

## 2. 决策摘要（访谈结论）

| 维度 | 决策 |
|---|---|
| 筛选语义 | **白名单**：只显示选中车的交管；**未选任何车 = 显示全部（保持现状）** |
| 影响范围 | **仅交管（TrafficGroup）**，车体（RobotGroup）不变 |
| 控制形态 | **多选 Select**（`mode="multiple"`）：搜索 + tag 折叠 + 已选计数 + 一键清空 + 全选/反选 |
| 控件位置 | RecordPlayback：TopBar `left_section`，与「锁定车辆」Select 并列；Overlook：**顶部常驻 Select** |
| 全局开关联动 | 勾选任意车时**自动取消「隐藏所有交管信息」**（`overlayVisible.traffic = true`）；清空已选不影响全局开关 |
| 离线/不在帧的车 | **保留勾选且不置灰、完全不区分**（在线/离线在列表里外观一致） |
| 可选项数据来源 | **当前在线/在帧车辆 ∪ 已选（含离线）**，按 agvKey 合并去重 |
| 持久化 | **不持久化**：刷新页面 / 切换地图 / 重新查询时清空已选 |
| 组件归属 | **抽共享子组件** `TrafficFilterSelect`，两页统一嵌入；已选 state 各页面自持 |
| 与「锁定车辆」关系 | **完全独立**（锁定管相机跟随/高亮，交管白名单单独选，可同时使用） |

---

## 3. 功能详述

### 3.1 筛选语义（白名单 + 空选全显）

- `visibleTrafficAgvKeys` 为**空数组**时 → `TrafficGroup` 渲染全部交管（短路，等价现状，零性能损耗）。
- `visibleTrafficAgvKeys` **非空**时 → 仅渲染 `agvKey ∈ 集合` 的 `applyingPath` 与 `lockedPath`。
- 过滤同时作用于申请区与解锁区。

### 3.2 全局开关联动

现有「展示」菜单已有「隐藏所有交管信息」全局开关（`overlayVisible.traffic`）。为避免「选了车却因为全局开关勾着而什么都看不到」的困惑：

- 用户在交管筛选 Select 中**选中任意一辆车**时，页面级 `onChange` 同步执行 `setOverlayVisible(prev => ({ ...prev, traffic: true }))`。
- 用户**清空**已选时，**不改动** `overlayVisible.traffic`（保持当前显隐状态）。
- `overlayVisible.traffic === false`（全局隐藏）时，即便白名单非空，`TrafficGroup` 整体 `visible={false}` 仍生效——**全局隐藏优先级最高**（这是现有 `<Group visible={overlayVisible.traffic}>` 的自然行为，无需额外处理）。

### 3.3 影响范围

仅 `TrafficGroup` 过滤交管路径。`RobotGroup`（车体矩形、位置、电量、状态、Tooltip）**完全不变**，所有车照常显示。

### 3.4 离线 / 不在当前帧的车

- 已选集合只存 `agvKey`（`string[]`）。
- 车辆离线（Overlook WebSocket 不再推送）或不在当前回放帧（RecordPlayback）时，**已选 agvKey 保留**，不被移除、不置灰、不做任何视觉区分。
- 重新上线 / 拖回含该车的帧时，其交管自动恢复显示（因过滤只看 agvKey 是否在集合里）。

### 3.5 可选项数据来源（在线 ∪ 已选）

Select 的 `options` 必须同时包含「当前能看到的车辆」和「已选但已离线的车」，否则离线已选项无法在列表里单独取消：

```
options = uniqBy(
  [...当前车辆列表.map(v => ({ value: v.agvKey, label: v.agvName || v.agvKey })),
   ...已选 agvKey.filter(k => !当前车辆列表有该车).map(k => ({ value: k, label: k }))],
  "value"
)
```

- 在线车 label 取 `agvName || agvKey`；离线已选车无 agvName，label 回退为 `agvKey`。
- 用户决定**完全不区分**在线/离线，故列表内不附加任何状态文字/排序/置灰。

---

## 4. UI 设计

### 4.1 多选 Select 特性清单

| 特性 | 说明 |
|---|---|
| `mode="multiple"` | 多选 |
| `showSearch` + `optionFilterProp="label"` | 按 agvName / agvKey 模糊搜索（label 已含两者） |
| `maxTagCount="responsive"` | tag 超宽时折叠为 `+N`，避免撑爆工具栏 |
| `placeholder` | `t("交管筛选")` |
| `allowClear` | 不用 Select 自带 allowClear（用下拉里的「清空」按钮统一，语义更明确） |
| `notFoundContent` | `t("暂无车辆")` |
| `dropdownRender` | 下拉底部追加：`已选 {n}/{m}` 计数 + `全选` + `反选` + `清空` |
| `getPopupContainer` | 全屏兼容（RecordPlayback 传 `getPopupContainer`；Overlook 传顶部容器） |

- **全选**：`onChange(options.map(o => o.value))`（作用于当前 options 全集 = 在线 ∪ 已选）。
- **反选**：`onChange(options.map(o => o.value).filter(k => !value.includes(k)))`。
- **清空**：`onChange([])` → 触发 3.1 的空选全显。

### 4.2 RecordPlayback 放置

`TopBar` 的 `left_section`，紧挨现有「锁定车辆」Select 之后：

```
[地图▼][时间范围][查询] | [锁定车辆▼] [交管筛选 AGV-001✕ +2 ▼]
```

- options 数据源：`currentFrame.vehicles`（已在顶层 `RecordPlayback/index.tsx`，TopBar 现有 `vehicleOptions` 即由此生成，可复用同源逻辑）。
- 与 `selectedVehicle`（锁定）**互不影响**。

### 4.3 Overlook 放置（顶部常驻 Select）

Overlook 工具栏是图标式 `GraphMenu`，没有「锁定车辆」那种常驻 Select。按访谈结论采用**顶部常驻 Select**：

- 放在 `ForceGraph/index.tsx` 顶部工具区，与 `ChangeMap` / `GraphMenu` 同区域（不塞进图标 Menu，避免破坏图标菜单节奏）。
- tag 始终可见，排查时可随时看到当前过滤范围并调整。

```
┌─────────────────────────┐
│🚦 AGV-001✕ AGV-003✕ +2 ▼│  ← 常驻
└─────────────────────────┘
[搜索][展示][校验][任务][全屏]
```

---

## 5. 技术方案

### 5.1 共享子组件 `TrafficFilterSelect`

**新建** `src/components/TrafficFilterSelect/index.tsx`：

```ts
interface TrafficFilterSelectProps {
  /** 选中的 agvKey 数组（白名单） */
  value: string[];
  /** 选中集合变更回调 */
  onChange: (value: string[]) => void;
  /** 可选项：当前在线/在帧车辆 ∪ 已选(含离线)，按 value 去重 */
  options: { value: string; label: string }[];
  /** 全屏兼容弹层挂载容器 */
  getPopupContainer?: () => HTMLElement;
  /** 宽度，默认 220 */
  width?: number;
}
```

组件内部负责：多选/搜索/tag 折叠/dropdownRender（计数+全选+反选+清空）。**不负责**全局开关联动——那是页面级逻辑（见 3.2），由各页面在自己的 `onChange` 包装函数里做。

### 5.2 过滤层：`TrafficGroup` 新增 `visibleAgvKeys`

`TrafficGroup` 是两页**共用**组件（RecordPlayback 的 RobotLayer 直接 `import .../Overlook/.../TrafficGroup`），故**只改这一处**即覆盖两页：

```tsx
interface TrafficGroupProps {
  applyingPath: TrafficPath[];
  lockedPath: TrafficPath[];
  overlayVisible: OverlayVisible;
  /** 交管白名单：仅渲染 agvKey ∈ 此集合的交管；空/undefined = 全显（短路，等价现状） */
  visibleAgvKeys?: string[];
}

// 组件内：
const visibleSet = useMemo(
  () => (visibleAgvKeys?.length ? new Set(visibleAgvKeys) : null),
  [visibleAgvKeys]
);
const filteredApplying = visibleSet
  ? applyingPath.filter(p => visibleSet.has(p.agvKey))
  : applyingPath; // 空选短路，避免无谓 filter
const filteredLocked = visibleSet
  ? lockedPath.filter(p => visibleSet.has(p.agvKey))
  : lockedPath;
```

- 空集合短路：白名单未启用时**零开销**，完全等价现状。
- `TrafficPath` 已带 `agvKey`（`src/utils/typing.d.ts`），过滤无需改数据结构。

### 5.3 状态归属：各页面自持 `visibleTrafficAgvKeys`

两个页面的车辆上下文不同（实时 WebSocket vs 回放帧），**不共享**同一份已选：

- `Overlook/ForceGraph/index.tsx`：`const [visibleTrafficAgvKeys, setVisibleTrafficAgvKeys] = useState<string[]>([]);`
- `RecordPlayback/index.tsx`：同上。

共享的是「`TrafficFilterSelect` 组件 + `TrafficGroup` 过滤逻辑」。

**【关键】重置时机（切图 / 重查清空已选）**：`visibleTrafficAgvKeys` 用 `useState` 持有，组件**不卸载时不会自动清空**。而 Overlook 切换地图（走 `currentMapInfo` model，`ForceGraph` 常驻、`GraphStage` 仅内部重拉数据）、RecordPlayback 重新查询（`handleQuery` 仅重置部分 state，顶层不卸载）**都不会卸载持有该 state 的组件**。故「切图/重查清空已选」必须**显式 reset**，否则验收清单第 9 条失败：

- Overlook：`ForceGraph/index.tsx` 内 `useEffect(() => setVisibleTrafficAgvKeys([]), [currentMapInfo?.mapId])`。
- RecordPlayback：`handleQuery` 内与 `setCurrentFrame(null)` 并列 `setVisibleTrafficAgvKeys([])`（`RecordPlayback/index.tsx` 约 160 行）。

> 「刷新页面清空」无需处理——组件重新挂载，state 自然回归 `[]`。

### 5.4 【关键】Overlook 车辆列表上提

**问题**：Overlook 的 WebSocket 数据在 `RobotLayer` 内部解析（`useWebSocketContext` + `transformTrafficInfo`），车辆列表（`robotsState`）**没有上提到 `ForceGraph`**。而顶部 Select 在 `ForceGraph` 层，需要车辆列表构建 options。

RecordPlayback **无此问题**：`currentFrame.vehicles` 已在顶层。

**推荐方案（最小改动）**：`RobotLayer` 新增回调 prop，把当前车辆列表上报：

```ts
// Overlook RobotLayer 新增 prop
interface RobotLayerProps {
  overlayVisible: OverlayVisible;
  visibleAgvKeys?: string[];            // 下传给 TrafficGroup 做过滤
  onVehiclesChange?: (vehicles: { agvKey: string; agvName?: string }[]) => void;
}
// 在 transformTrafficInfo 后调用 onVehiclesChange(robots.map(r => ({ agvKey: r.agvKey, agvName: r.agvName })))
```

`ForceGraph` 用一个 state 接住，喂给 `TrafficFilterSelect` 的 options（合并已选，见 3.5）。

**【关键】`onVehiclesChange` 引用必须稳定 + 内容去抖**：

- `RobotLayer` 是 `memo`（默认浅比较）。`ForceGraph` 传给它的 `onVehiclesChange` **必须用 `useCallback` 稳定引用**，否则每次 `ForceGraph` 重渲染都会击穿 memo、触发 `RobotLayer` 无谓重渲染。
- WebSocket 每条消息都会触发该回调。`ForceGraph` 侧 `setVehicles` 前**应判断车辆 agvKey 集合是否变化**（集合不变则跳过 set），避免高频 WS 推送下 `ForceGraph` 反复重渲染、options `useMemo` 反复去重：

```ts
// ForceGraph 内：稳定引用 + 集合指纹去抖
const prevKeysRef = useRef<string>("");
const handleVehiclesChange = useCallback((vehicles: { agvKey: string; agvName?: string }[]) => {
    // 仅当车辆集合真正增减 / 换序时才更新，过滤掉纯位置、状态的高频变化
    const keys = vehicles.map(v => v.agvKey).sort().join(",");
    if (keys === prevKeysRef.current) return;
    prevKeysRef.current = keys;
    setVehicles(vehicles);
}, []);
```

> 用 agvKey 集合指纹（排序串）比较，覆盖「车辆增减 / 换序」两类变化；同集合下 agvName / 位置变化不影响 options，无需更新。

> 备选（不采用）：把 WebSocket 订阅整体上提到 `ForceGraph`——改动面大、要搬走错误处理与 `sendMessage` 逻辑，违背最小改动原则。
> 备选（不采用）：像 `GlobalSearch` 那样用 `stage.find(isRobot)` 命令式读 Konva 节点取车辆列表——对单选定位可行，但作为多选 options 源不可靠（节点时序、卸载重建）。

### 5.5 【关键】`GraphStage` 自定义比较函数必须同步更新

`Overlook/ForceGraph/GraphStage/index.tsx` 末尾：

```tsx
export default memo((props: GraphStageProps) => { ... }, propsForceGraphIsEqual);
```

文件头注释已警示：**「增加 props 的时候请在优化中添加判断」**。新增 `visibleTrafficAgvKeys` prop 透传给 `RobotLayer` 后，**必须**在 `src/utils/memoFn.ts` 的 `propsForceGraphIsEqual` 中加入对该字段的比较，否则选择变化不会触发 `GraphStage` 重渲染、画布交管不更新。

> RecordPlayback 的 `KonvaRender` 未用自定义比较（普通函数组件），无此坑。

### 5.6 数据流

**Overlook**：
```
ForceGraph (state: visibleTrafficAgvKeys, vehicles)
  ├─ TrafficFilterSelect (value/onChange/options) ── 顶部常驻
  │     └─ onChange 包装：setVisibleTrafficAgvKeys + 非空时 setOverlayVisible(traffic=true)
  └─ GraphStage (overlayVisible, visibleTrafficAgvKeys)  ← 需更新 propsForceGraphIsEqual
        └─ RobotLayer (overlayVisible, visibleAgvKeys, onVehiclesChange)
              ├─ transformTrafficInfo → onVehiclesChange 上报车辆列表
              └─ TrafficGroup (applyingPath, lockedPath, overlayVisible, visibleAgvKeys) ← 过滤在此
```

**RecordPlayback**：
```
RecordPlayback (state: visibleTrafficAgvKeys; currentFrame 已在顶层)
  ├─ TopBar
  │    └─ TrafficFilterSelect (value/onChange/options=currentFrame.vehicles 合并已选) ← 与「锁定车辆」并列
  │         └─ onChange 包装：setVisibleTrafficAgvKeys + 非空时 setOverlayVisible(traffic=true)
  └─ KonvaRender (overlayVisible, visibleTrafficAgvKeys, focusId, currentFrame)
        └─ RobotLayer (overlayVisible, currentFrame, focusId, visibleAgvKeys)
              └─ TrafficGroup (... visibleAgvKeys) ← 过滤在此（共用 Overlook 的 TrafficGroup）
```

### 5.7 性能

- 过滤是 O(n) 级（n = 当前交管矩形总数），单次 `Set.has` 查找 O(1)，可忽略。
- 空选短路：白名单未启用时**不执行 filter**，等价现状。
- **白名单反而减少渲染**：选中少数车时，`TrafficGroup` 渲染的 `<Path>` 数量大幅下降，性能优于现状。
- options 构建用 `useMemo`，依赖车辆列表引用 + 已选引用；WebSocket / 帧高频更新时去重成本 O(n)，可忽略。
- `onVehiclesChange` 经 `useCallback` 稳定引用 + agvKey 集合指纹去抖（见 §5.4），高频 WS 推送下不会反复触发 `ForceGraph` 重渲染。

---

## 6. 改动文件清单

| 文件 | 改动 |
|---|---|
| `src/components/TrafficFilterSelect/index.tsx` | **新建**：共享多选 Select 子组件 |
| `src/pages/Overlook/ForceGraph/GraphStage/RobotLayer/TrafficGroup/index.tsx` | 新增 `visibleAgvKeys` prop + 过滤逻辑（**两页共用，改这一处**） |
| `src/pages/Overlook/ForceGraph/GraphStage/RobotLayer/index.tsx` | 新增 `visibleAgvKeys`、`onVehiclesChange` prop；`transformTrafficInfo` 后上报车辆列表；透传 `visibleAgvKeys` 给 TrafficGroup |
| `src/pages/Overlook/ForceGraph/GraphStage/index.tsx` | `GraphStageProps` 加 `visibleTrafficAgvKeys`；透传给 RobotLayer |
| `src/utils/memoFn.ts` | **`propsForceGraphIsEqual` 加上 `visibleTrafficAgvKeys` 比较**（否则不触发重渲染） |
| `src/pages/Overlook/ForceGraph/index.tsx` | 新增 `visibleTrafficAgvKeys` state + `vehicles` state；顶部放置 `TrafficFilterSelect`；onChange 包装（联动全局开关）；下传 GraphStage / 接 RobotLayer 上报；**`onVehiclesChange` 用 `useCallback` + agvKey 集合去抖**（见 §5.4）；**切图 reset** `useEffect([mapId])`（见 §5.3） |
| `src/pages/RecordPlayback/components/KonvaRender/RobotLayer/index.tsx` | 新增 `visibleAgvKeys` prop；透传给 TrafficGroup |
| `src/pages/RecordPlayback/components/KonvaRender/index.tsx` | `Props` 加 `visibleTrafficAgvKeys`；透传给 RobotLayer |
| `src/pages/RecordPlayback/index.tsx` | 新增 `visibleTrafficAgvKeys` state；下传 KonvaRender / TopBar；onChange 包装（联动全局开关）；**`handleQuery` 内 reset 已选**（见 §5.3） |
| `src/pages/RecordPlayback/components/TopBar/index.tsx` | `left_section` 放 `TrafficFilterSelect`（与「锁定车辆」并列）；options 由 `currentFrame.vehicles` 合并已选生成 |
| `src/locales/zh-CN.json`、`src/locales/en-US.json` | 新增文案（见 §8） |

> MapNestModify 编辑器（`src/pages/MapThrough/.../TrafficGroup`）**不在本次范围**，其 TrafficGroup 是独立副本，不受影响。

---

## 7. 边界与决策清单

- [x] 空选 = 显示全部（短路，等价现状）
- [x] 全局「隐藏所有交管信息」优先级最高（`Group visible` 自然生效）
- [x] 选任意车自动取消全局隐藏；清空不动全局开关
- [x] 离线/不在帧的车：保留已选、不置灰、不区分
- [x] 可选项 = 在线 ∪ 已选（含离线），按 agvKey 去重
- [x] 不持久化（刷新自然清空；切图/重查**显式 reset**，见 §5.3）
- [x] 与「锁定车辆」完全独立
- [x] 全选/反选作用于当前 options（在线 ∪ 已选）
- [x] 过滤放共用 `TrafficGroup` 内，改一处覆盖两页
- [x] Overlook 车辆列表经 `onVehiclesChange` 回调上提（最小改动）
- [x] Overlook `GraphStage` 新增 prop 必须同步 `propsForceGraphIsEqual`

---

## 8. i18n 文案

新增 key（中文原文作 key，同步 `zh-CN.json` 与 `en-US.json`；zh-TW/ja-JP/ko-KR 后续补译，先中文回退）：

| 中文 key | en-US 建议 |
|---|---|
| 交管筛选 | Traffic Filter |
| 搜索车辆 agvName/agvKey | Search vehicle name/id |
| 已选 {n}/{m} | Selected {n}/{m} |
| 全选 | Select All |
| 反选 | Invert |
| 清空 | Clear |
| 暂无车辆 | No vehicles |

> Select 内 tag 显示 `agvName || agvKey`，属动态数据，不经 `t()`。

---

## 9. 不做的事（Out of Scope）

- ❌ 不改 `RobotGroup`（车体显示/位置/状态/Tooltip 全部不变）
- ❌ 不改 MapNestModify 编辑器的 TrafficGroup
- ❌ 不持久化已选（刷新即清空）
- ❌ 不在车辆 Tooltip 信息卡加「加入筛选」快捷按钮（访谈中未采纳）
- ❌ 不记忆「最近一次清空前的选择」
- ❌ 不在列表里标注/排序区分在线与离线车（访谈明确「完全不区分」）
- ❌ 不与「锁定车辆」联动

---

## 10. 验收清单

- [ ] 两页面顶部/工具栏出现「交管筛选」多选 Select，可搜索、tag 折叠
- [ ] 选中若干车 → 画布仅显示这些车的申请区/解锁区，其余车的交管消失；车体照常显示
- [ ] 未选任何车 → 交管全部显示（等价改造前）
- [ ] 选中车时，「展示」菜单里「隐藏所有交管信息」自动取消勾选
- [ ] 手动勾「隐藏所有交管信息」→ 即便白名单非空，交管也全部隐藏
- [ ] 清空已选 → 回到显示全部，全局开关保持原状
- [ ] 全选/反选/清空按钮工作正常，计数 N/M 正确
- [ ] Overlook：某选中车离线后再上线，其交管自动恢复；离线期间该项仍在列表可单独取消
- [ ] RecordPlayback：拖动帧时，选中车时有时无，已选 agvKey 始终保留；不在帧的车交管不显示但勾选不丢
- [ ] 刷新页面/切换地图/重新查询 → 已选清空
- [ ] 「锁定车辆」与交管筛选互不影响
- [ ] Overlook 选中车后画布交管立即更新（验证 `propsForceGraphIsEqual` 已正确更新）
- [ ] 新增文案在 zh-CN / en-US 下正确显示
