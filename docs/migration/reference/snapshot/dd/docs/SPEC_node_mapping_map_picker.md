# SPEC_node_mapping_map_picker — 节点映射·地图选点

> 访谈决策日期：2026-08-18。本文档是 `SPEC_node_mapping.md` 的增量规格，
> **修订其 §1 「不引入 Konva 画布选点」的范围约定**——本期在行内接入地图选点。

## 1. 背景与决策汇总

「AGV节点映射」弹窗（`MappingModal`）中，「地图节点」列是纯下拉框回显（`节点名（ID）`），
用户无法感知节点的空间位置，改点/核对时不直观。本期在下拉框右侧接入地图选点，
复用 config 仓库（`c:\code\config`）的 `src/components/KonvaMap` 选点组件。

访谈确认的决策（均为与需求方逐项确认的结论）：

| # | 决策点 | 结论 |
| --- | --- | --- |
| D1 | 组件引入方式 | **裁剪复制**到 dd `src/components/KonvaMap/`，剔除车辆监控层 |
| D2 | 入口与容器 | 行内图标按钮（Space.Compact）+ **二级 Modal**（80vw × 70vh） |
| D3 | 映射点回填 | **与下拉框一致**：X/Y 未手填时才回填节点坐标，已手填不覆盖 |
| D4 | 地图数据供给 | **每次打开独立拉取**（KonvaMap 自带 useMapData 零改动，destroyOnClose） |
| D5 | 上下文标记 | **只显示当前行选中**，不加其他行标记层（KonvaMap 零功能改动） |
| D6 | 空选确定 | **禁用确定按钮**，footer 信息行实时显示当前选中 |
| D7 | 映射点点图取坐标 | **本期不做**（映射点多半等于节点坐标，手填兜底） |
| D8 | 重复节点选择 | **保持允许**，与下拉框行为一致，不新增校验 |
| D9 | 回显定位 | initialSelectedIds 回显 + defaultFocus 自动定位**不闪烁** |
| D10 | 失效节点 | footer 常显当前行节点信息，失效时红色标注「已不在地图上」 |
| D11 | 组件位置 | `src/components/KonvaMap/`（与 config 结构对齐，通用组件不入页面私有目录） |

## 2. 组件迁移（裁剪复制）

### 2.1 文件清单

源：`c:\code\config\src\components\KonvaMap\` → 目标：`c:\code\dd\src\components\KonvaMap\`

**保留（13 个，原样复制为主）：**

| 文件 | 说明 |
| --- | --- |
| `KonvaMap.tsx` | 主组件（需剔除车辆相关代码，见 §2.2） |
| `KonvaMap.types.ts` | 类型（需剔除车辆类型，见 §2.2） |
| `index.ts` | 导出（同步精简） |
| `hooks/useMapData.ts` | getMapInfo 拉取 nodes+edges，加载/错误态 |
| `hooks/useSelection.ts` | 选中状态（单选/多选/回显静默忽略失效 ID） |
| `hooks/useStageInteraction.ts` | 缩放/拖拽/fitView/focusToPoint |
| `hooks/useBlink.ts` | 定位后闪烁 |
| `utils/math.ts` | 贝塞尔/箭头几何计算 |
| `utils/mountGraph.ts` | 接口数据 → 渲染模型（y 取反） |
| `utils/styles.ts` | 节点/路径样式常量 |
| `layers/NodesLayer.tsx` | 节点层（自定义 sceneFunc 绘制） |
| `layers/EdgesLayer.tsx` | 路径视觉层 |
| `layers/EdgeHitLayer.tsx` | 路径点击命中层 |

**剔除（7 个）：** `layers/RobotLayer/`（index/TrafficGroup/XcGroup/XpGroup 共 4 个）、
`hooks/useFollowRobot.ts`、`utils/transformRobots.ts`、`constants/robotStyles.ts`。

剔除理由（两条都成立，缺一不可忽视）：

1. **角度制冲突（硬性原因）**：`XcGroup.tsx`/`XpGroup.tsx` 使用 `rotation={(-theta * 180) / Math.PI}`，
   按 Konva 默认角度制书写；dd 在 `app.tsx` 全局设置 `Konva.angleDeg = false`（弧度制），
   复制进来车辆朝向会全部错误。config 项目未设 angleDeg，故其原实现无误。
2. **选点场景无车辆需求**：节点/路径层全部是自定义 `sceneFunc` 几何绘制，不经过 Konva rotation API，
   不受弧度制影响，裁剪后选点功能完整。

### 2.2 复制时的代码修改点

`KonvaMap.tsx`：

- 删除 props：`robots / highlightRobotKey / followRobotKey / showTraffic / onRobotClick / onViewportManualChange`；
- 删除 `useFollowRobot` 调用、`RobotLayer` 渲染分支；
- `onViewportManualChange` 仅服务于「解除车辆跟随」，随之删除：
  `handleWheelWithManualChange` 回退为直接 `handleWheel`，删除 `handleStageDragStart`；
- 删除未实现的预留 props `enableBoxSelect`（本仓库不保留预留式抽象）；
- 保留：`mapId / selectMode / multiple / onChange / width / height / showNodeLabels /
  showEdgeLabels / showArrows / initialSelectedIds / defaultFocus / className / style /
  disabledNodeTypes / onBlankClick / onLoadError`，以及全部命令式 API（KonvaMapRef）。

`KonvaMap.types.ts`：删除 `VehicleType / VehicleErrorEntry / SocketDispatcherState /
RobotRect / TrafficPath` 及上述 props 字段；保留节点/路径/选中/缩放常量。

`index.ts`：导出同步精简。

### 2.3 依赖与运行时兼容性（已核实）

- **konva 版本**：dd 未直接声明 konva，实装 `konva@9.3.20`（react-konva `^18.2.10` 的 peer 传递依赖）；
  config 侧为 `^10.3.0`。KonvaMap 仅用 Stage/Layer/Shape/Tween 等基础 API，9.x 完全覆盖，无需升级。
- **`react-konva/lib/ReactKonvaCore` 子路径导入**：ReactKonvaCore 自身不注册 Konva 图形类，
  依赖宿主全量加载 konva。dd 的 `app.tsx` 启动即 `import Konva from "konva"`（全量注册），
  且 Overlook/MapNestModify 使用 react-konva 完整构建，子路径导入可安全工作。
- **API 同源**：`useMapData` 调 `@/api` 的 `getMapInfo({ mapId })`，
  取 `res.data.currentMapInfoVersion.mapJson.{nodes,edges}`——与 dd 现有 `MappingModal.loadMapNodes`
  的响应路径完全一致（仅多消费 edges 字段），两仓库 `@/hooks/useI18n` 同名同签名。
- **坐标系**：`mountGraph` 对节点/路径 y 取反（米制世界坐标 → 画布坐标），与 dd 地图渲染体系一致。

## 3. 功能设计

### 3.1 行内入口

「地图节点」列（宽 600 不变）内改为 `Space.Compact` 布局：

```
[ Select（flex:1，现状不变） ][ 📍图标按钮 ]
```

- 按钮：`Button` + `EnvironmentOutlined`，点击打开选点弹窗；
- **组未选地图时禁用**，Tooltip「请先选择地图」（沿 config ElementsModal 模式）；
- 编辑模式可用（编辑锁组不锁行，行节点允许改）。

### 3.2 选点弹窗（二级 Modal）

独立子组件 `MappingModal/MapPickerModal.tsx`，MappingModal 只新增一个 state：

```ts
/** 选点目标行：null 表示弹窗关闭；弹窗打开期间外层 Modal 被遮罩阻隔，行数据不会变化 */
const [pickerTarget, setPickerTarget] = useState<{ groupKey: string; rowKey: string } | null>(null);
```

弹窗属性：

- `title`：`地图选点（地图名）`；`width: "80vw"`，内容区 `height: 70vh`；
- `destroyOnClose`：每次打开重新拉图（D4），视角/选中态不残留；
- `maskClosable: false`：与外层 MappingModal 一致，避免误点遮罩丢失正在进行的点选。

KonvaMap 用法：

```tsx
<KonvaMap
    ref={mapRef}
    mapId={group.mapId}
    selectMode="node"
    multiple={false}
    showNodeLabels
    showEdgeLabels={false}
    showArrows
    initialSelectedIds={...}   // §3.4
    defaultFocus={...}         // §3.4
    onChange={onPickedChange}  // 驱动确定按钮禁用态
    onLoadError={...}          // §4
/>
```

- 保留 KonvaMap 内建的左上角「搜索节点或路径」定位框（找点刚需）；
- `selectMode="node"` 下路径仅可定位不可选中；节点类型不做禁选（与下拉框全集一致）。

footer 信息行（Modal body 底部、按钮行之上）：

```
当前行：节点名（ID） [已不在地图上]（红色，仅失效时）    已选：节点名（ID）  X: 1.23  Y: 4.56
```

- 「当前行」：打开时行内 `mapNode` 的回显信息，**无论是否失效都显示**（用户始终知道在改哪一行）；
- 「已选」：弹窗内实时选中（`onChange` 驱动），未选显示占位 `-`；
- 「确定」`disabled = 当前无选中`（D6）。打开时若有回显选中则立即可点（等价于不改）；
- 点地图空白会清除选中（KonvaMap 内建行为）→ `onChange([])` → 确定自动禁用，无歧义。

### 3.3 确认回填

- `onChange(selectedItems)` 取 `[0]`（`type: "node"`），弹窗内持有 `picked: MapNode | null`；
- 确定时转换 `MapNode → MappingNode`：`{ nodeId: id, nodeName: name, x, y }`；
- **回填逻辑直接复用现有 `onRowNodeChange(group, row, node)`**（D3）：
  `mapNode` 整体回填；`mappingPoint.x/y` 仅在未手填时回填节点坐标，已手填不覆盖——
  与下拉框选节点语义完全一致；
- 确认后关闭弹窗（`setPickerTarget(null)`）。取消/遮罩外关闭不写回任何内容。

### 3.4 回显与定位（D9/D10）

打开弹窗时按当前行计算：

- `initialSelectedIds = row.mapNode?.nodeId ? [row.mapNode.nodeId] : undefined`；
- `defaultFocus = row.mapNode?.nodeId ? \`node:${row.mapNode.nodeId}\` : undefined`；
  KonvaMap 对 defaultFocus 的首次定位**不闪烁**（其内建行为），用户打开即看到当前节点在地图中的位置；
- **失效节点**（编辑老数据，节点已从地图删除）：
  KonvaMap 的 `setSelectedIdsExternal` 静默忽略不存在的 ID → 地图无高亮、确定禁用；
  前端兜底感知：以 MappingModal 侧 `nodeOptionCache.idSets[group.mapId]` 判定——
  **idSet 已加载且不含该 nodeId** 时，footer「当前行」追加红色「已不在地图上」。
  idSet 尚未加载（加载中/加载失败）时不标注，避免误标。

### 3.5 与既有机制的关系（均不受影响）

- 下拉框仍是主录入方式，选点按钮只是新增入口；`loadMapNodes` 节点缓存逻辑不变
  （下拉选项用简化节点，选点弹窗独立拉完整 mapJson，两者互不消费——D4 的代价是每次打开重新拉图，
  换取 KonvaMap 零数据层改动与数据始终最新）；
- 行三态（空白/半填/完整）、过滤、前端分页、提交校验、「获取建议」合并逻辑全部不变；
- 组切换地图时 `onGroupMapChange` 重置行的逻辑不变（此时行已清空，选点按钮因无有效行而不可达过期数据）。

## 4. 边界与异常

| 场景 | 行为 |
| --- | --- |
| 组未选地图 | 行内选点按钮禁用 + Tooltip「请先选择地图」 |
| 行已有节点（回显） | 地图自动定位到该节点（不闪烁），确定可用，点确定=不改 |
| 行节点已失效 | 地图无高亮、确定禁用；footer「当前行」红色标注「已不在地图上」 |
| 弹窗内点空白 | 清除选中 → 确定禁用（D6） |
| 重复节点选择 | 允许，与下拉框一致，无校验无提示（D8） |
| 地图加载失败 | useMapData 内建 message 提示 + `onLoadError` 上报；弹窗内渲染错误占位与「重试」按钮（调 `mapRef.current.reload()`） |
| 地图数据为空 | useMapData 内建提示「地图数据为空」，画布空白，确定禁用 |
| 二级弹窗与外层交互 | antd Modal 嵌套 z-index 自增天然支持；外层 maskClosable=false 不受内层影响 |
| 万行规模 | 选点是逐行单点操作，无批量路径；Konva 渲染万级节点+路径无压力（config 已验证） |

## 5. i18n

所有文案走 `useI18n().t()`，中文原文作 key。KonvaMap 内建 key 与 picker 新增 key
**先查重 `zh-CN.json`，已存在则复用**，缺失的追加到 `zh-CN.json` / `en-US.json` 末尾：

- KonvaMap 内建：`请传入地图ID` / `地图加载中...` / `地图数据为空` / `地图数据加载失败` /
  `未知错误` / `网络错误` / `节点` / `路径` / `搜索节点或路径...`
- picker 新增：`地图选点` / `请先选择地图` / `当前行` / `已不在地图上` / `已选` / `重试`

## 6. 本期不做（已确认的排除项）

1. 本组其他行已录节点的地图标记层（D5）——后续若需要，以为 KonvaMap 增加 `markedNodeIds` props 的方式另起任务；
2. 映射点 X/Y 的「点地图空白取坐标」（D7）；
3. 组级多选批量生成映射行（保持「获取建议为主、人工微调为辅」的录入模式，SPEC_node_mapping §4.7）；
4. 地图数据外层缓存注入 / 弹窗保活（D4 的替代方案）；
5. 重复节点校验（D8）。

## 7. 文件改动清单

| 文件 | 改动 |
| --- | --- |
| `src/components/KonvaMap/**` | 新增 13 个文件（§2.1），按 §2.2 剔除车辆代码 |
| `src/pages/VehicleDeploy/NodeMapping/MappingModal/MapPickerModal.tsx` | 新增：选点二级弹窗（含 footer 信息行、确定禁用、错误重试） |
| `src/pages/VehicleDeploy/NodeMapping/MappingModal/index.tsx` | 「地图节点」列加 Space.Compact 选点按钮；新增 `pickerTarget` state；渲染 MapPickerModal |
| `src/locales/zh-CN.json` / `en-US.json` | 追加缺失 key（§5） |
| `docs/SPEC_node_mapping.md` | §1 范围行更新，指向本文档 |

验证方式：本仓库无测试；`npm run format` + 用 `node` 直接调 `tsc` 做类型检查
（不要用 `pnpm exec`，会破坏 npm 结构的 node_modules）。
