# SPEC_node_mapping — AGV节点映射页面

## 1. 背景与范围

车辆部署模块新增「AGV节点映射」页面（`src/pages/VehicleDeploy/NodeMapping/`），
用于维护「调度地图节点 ↔ AGV实际点位」的映射关系，并将映射绑定到一组 AGV。

本期范围（已与需求方确认）：

- 纯 AntD 表格 + 弹窗表单；~~不引入 Konva 画布选点~~（2026-08-18 修订：行内接入地图选点，见 `SPEC_node_mapping_map_picker.md`）；
- 「获取采集点位建议」以编辑弹窗内的按钮形式提供；
- **只实现页面组件**，不注册路由、不接菜单/按钮权限码（后端权限码下发后另起任务接入）。

## 2. 接口与类型

接口层已落地（见 `src/api/api.ts` 末尾「AGV节点映射」分区、`src/api/index.ts` 同名分区）：

| 函数 | 方法 | 说明 |
| --- | --- | --- |
| `pageAGVNodeMappings` | GET | 分页查询（pageNo/pageSize/mappingName） |
| `saveAGVNodeMapping` | POST | 新增：mappingName + 按地图分组的 nodeMappings + agvKeys |
| `updateAGVNodeMapping` | POST | 更新：mappingKey + mappingName + 按地图分组的 nodeMappings + agvKeys（2026-08-19 起与 save 结构对齐，整体替换语义） |
| `deleteAGVNodeMapping` | POST | 删除：mappingKey |
| `getSuggestionsForCollectionNodes` | GET | 采集点位建议：mapId 必传，expectedCount 可选 |

类型集中在 `src/types/VehicleDeploy/NodeMappingType.d.ts`。

### 2.1 后端接口结构（2026-08-19 修订）

- **save 与 update 结构一致**：`nodeMappings: MapNodeMapping[]`（每组 mapId/mapName/NodeMapping[]）+ `agvKeys`，update 额外携带 `mappingKey`。

由此得出编辑语义（2026-08-19 与用户确认完全放开）：

1. 编辑提交时，**一次 `updateAGVNodeMapping` 调用**提交全量草稿（mappingKey + mappingName + 分组 nodeMappings + agvKeys），整体替换语义；
2. 编辑弹窗中「关联AGV」**可编辑**；
3. 编辑弹窗中**可增删地图组、可改组内地图**，与新增模式交互完全一致。

> 历史背景：2026-08-19 之前 update 是单地图平铺结构（mapId + nodeMappings，无 agvKeys），
> 当时编辑需按组各调一次 update、禁用关联AGV、锁死地图组结构；接口升级为分组结构后上述限制全部解除。

### 2.2 分页响应字段

记录字段：`mappingKey / mappingName / mapNodeMapping(按地图分组数组, 单数命名) / agvKeys / createTime` 等。
分页体只消费 `records / total / size / current / pages`，忽略 MyBatis-Plus 内部字段。

## 3. 列表页（index.tsx）

参照 `VehicleType`（载具类型）页面结构与 less 布局：

- 头部：映射名称搜索 Input + 查询/重置 + 右侧「新增节点映射」；
- 表格列：
  - 映射名称（mappingName）
  - 关联AGV数（agvKeys.length，Tooltip 展示全部 key）
  - 映射地图（mapNodeMapping 的 mapName 渲染为 Tag 列表）
  - 映射点数（各组 nodeMappings 长度求和，居中）
  - 创建时间（createTime）
  - 操作：编辑 / 删除（Popconfirm，按 mappingKey 删除）
- 展开行（expandable）：只读明细，按地图分组展示「节点名称 / 节点ID / 映射点X / 映射点Y」小表格；
- 服务端分页，`res.code === 200 && res.message === "success"` 判定与项目惯例一致。

## 4. 新增/编辑弹窗（MappingModal/index.tsx）

### 4.1 字段

- 映射名称：Input，必填，maxLength 64；
- 关联AGV：Select multiple，选项来自 `getSimpleVehicles`（value=key，label=name）；编辑模式同样可改（2026-08-19 update 接口支持 agvKeys）；
- 节点映射：地图组列表（本地 state 驱动，不用 Form.List —— 组内是动态表格，受控 state 更直观）。

### 4.2 地图组（MapGroupDraft）

```ts
interface MappingRowDraft {
    rowKey: string;              // 前端行标识（渲染 key）
    mapNode?: MappingNode;       // 选中节点后整体回填 {nodeId,nodeName,x,y}
    mappingPoint?: MappingPoint; // 映射点 {x,y}
}
interface MapGroupDraft {
    groupKey: string;            // 前端组标识
    mapId?: string;
    mapName?: string;            // save 时需要
    rows: MappingRowDraft[];
}
```

- 组头（Card title/extra）：地图 Select（选项 `getSimpleMaps`；编辑模式禁用）+ 行搜索 Input（按节点名称/ID 模糊过滤）
  +「只看未填完整」Checkbox + 期望点位数量 InputNumber（可选）
  +「获取建议」+「清空」（Popconfirm，清掉本组全部行；编辑模式亦可用）+「删除地图组」（仅新增模式）；
- 组内统计行（表格上方一行，仅右对齐统计文本）：`共 X 行`；过滤激活时 `显示 Y / X 行`；有半填行时红色 `未填完整 Z 行`；
- 组体：映射行表格，**前端分页**（默认 10 条/页，可切 20/50/100，见 §4.7），
  列：#（原始行号，60）/ 地图节点（Select showSearch，600）/ 映射点X（180）/ 映射点Y（180）/ 删除行（60）——
  **列全部固定宽、总和 ≈ 内容区宽，无横向滚动条**；
- 组尾：「添加映射行」（添加时清空本组过滤并跳到最后页，保证新行可见）；弹窗底部：「添加地图」（仅新增模式）。
- 过滤状态（keyword/onlyInvalid）存于独立的 `groupViews`（按 groupKey 索引），**纯视图状态**，不进入提交数据；
  删除行/清空始终作用于完整 rows，与过滤无关。

### 4.3 地图节点选项加载

- 组内选定 mapId 后调 `getMapInfo({ mapId })`，从 `res.data.currentMapInfoVersion.mapJson.nodes` 取节点，
  转换为 `MappingNode`（id→nodeId，name→nodeName），按 mapId 缓存（`Record<mapId, MappingNode[]>`），避免重复请求；
- 选中节点时将该节点的 x/y 一并回填进 `mapNode`（后端 MappingNode 需要坐标）；
- **选节点自动回填映射点**（2026-08-18 确认）：mappingPoint 的 x/y 在未手填时回填节点坐标，已手填的值不覆盖
  （映射点多半等于节点坐标，万行场景省去逐行输入）；
- 编辑回填时若行内 nodeId 不在已拉取的节点列表中（节点可能已在地图上删除），
  把行内 mapNode 合并进选项，保证 Select 正常显示节点名称；
- 性能：Select options（label 一次算好，附带原始节点对象免二次查找）与 nodeId Set 按 mapId `useMemo` 缓存；
  行内 extras 合并用 Set 判定 + seen 去重，O(节点数+行数)。
  **禁止**逐行 `fetched.some(...)`（O(行×节点)，万行万节点下每次渲染上亿次比较）。

### 4.4 「获取建议」

- 需先选择地图；调用 `getSuggestionsForCollectionNodes({ mapId, expectedCount? })`；
- 返回的 `controlPoints` **按节点 id 合并**进当前组，不整组覆盖（2026-08-18 由「覆盖」改为「合并」，避免误清已录入行）：
  - 已录入行的 `mapNode.nodeId` 命中控制点 id → 只更新该行的 mapNode（节点信息）与 mappingPoint（= point），保留 rowKey；
  - 未命中 → 以控制点追加新行（mapNode 整体回填，mappingPoint = point）；
  - 未匹配到任何控制点的已录入行保持原样；
  - 合并前剔除完全未填写的占位空行（未选节点且未填坐标），避免新建组自带的初始空行残留并卡在提交校验；
- 合并成功后**清空该组过滤状态并跳到最后页**，让新合并的行立即可见；
- 合并语义不删除已录入数据，无需 Modal.confirm 确认；
- 覆盖率等字段本期不展示（需求方已确认）。

### 4.5 提交校验与提交

行三态（组件外纯函数，校验/过滤/高亮共用）：

- **完整行**：已选节点且 x/y 均为数字；
- **空白行**：未选节点且 x/y 均未填 —— 视为占位行，**提交时自动剔除**，不高亮、不算错误；
- **半填行**：非空白但不完整（选了节点缺坐标 / 填了坐标缺节点）—— 常显淡红行高亮，校验拦截。

校验（不通过则 message.warning 并阻断）：

1. 映射名称必填（Form rule）；
2. 至少一个地图组；
3. 每组必须选择地图；
4. 每组剔除空白行后至少剩一行有效映射；
5. 存在半填行 → **给所有问题组自动开启「只看未填完整」过滤**（万行下的定位手段），提示后由用户逐组修完再提交。

提交：

- 新增：一次 `saveAGVNodeMapping`（组装 MapNodeMapping[] + agvKeys，各行过滤空白行）；
- 编辑：一次 `updateAGVNodeMapping`（mappingKey + 与新增相同的全量分组结构 + agvKeys，整体替换语义），
  失败则提示失败、不关闭弹窗；成功才刷新列表并关闭。

### 4.6 编辑回填

- mappingName / agvKeys 回填表单；
- `modifyRow.mapNodeMapping` → groups（补 groupKey/rowKey）；
- 按组内 mapId 预拉节点选项（同 §4.3）。

### 4.7 万行级性能与交互设计（2026-08-18）

单地图映射行可达数千至数万。设计前提（已与需求方确认）：**行主要由「获取建议」批量生成，人工只做微调，
不做批量导入（粘贴/CSV）**；编辑载体保持弹窗（加宽至 1200），不改为 Drawer/独立页。

性能手段：

- 行表格**前端分页**（默认 10 条/页，pageSizeOptions 10/20/50/100），只有当前页 ~10 行进 DOM——
  分页替代虚拟滚动（2026-08-18 调整：虚拟滚动改为分页，横纵滚动条都不要），
  列全部固定宽、总和 ≈ 内容区宽，横向不出现滚动条；
- 每次按键的渲染路径：patchRow O(R) 浅拷贝 → 过滤/行号/半填统计合并为一次 O(R) 遍历 → 仅渲染当前页行，
  万行下每次按键开销在毫秒级；
- 节点 options 引用稳定（useMemo 按 mapNodesMap 缓存），Select 内部 rc-virtual-list 自虚拟，万级选项无压力；
- 弹窗 body 限高（calc(100vh - 220px)）内部滚动，多地图组时不撑破屏幕。

分页状态维护（groupViews.pageNo/pageSize，纯 UI 状态）：

- 「添加映射行」/「获取建议」后清空过滤并跳到最后页，保证新内容可见；
- 删除行/过滤收缩导致 maxPage 变小时，渲染侧派生 `min(current, maxPage)` 钳制，不停留在空页（无需额外 setState）；
- 搜索、切换「只看未填完整」、改每页条数时回到第 1 页；
- 行数统计已由统计行承担，分页器不再重复 showTotal。

定位手段：

- 组内搜索（节点名称/ID 模糊）+「只看未填完整」过滤 + 半填行常显淡红高亮 + 校验失败自动开过滤；
- `#` 列显示原始行号（在完整 rows 中的序号），过滤/翻页后仍可对照定位。

## 5. i18n

- 页面文案全部走 `useI18n().t()`，新 key 追加到 `zh-CN.json` / `en-US.json` 末尾（其余语言中文回退）；
- 复用已存在的 key：查询/重置/编辑/删除/操作/确定/取消/创建时间/选择地图/请选择地图/节点名称/节点ID/
  查询车辆列表出错/查询简单地图列表出错/总数{total}条 等。

## 6. 权限与路由

路由：`.umirc.ts` 车辆管理分组下 `/vehicle-deploy/node-mapping`，`access: PERM.NODE_MAPPING_VIEW`；
菜单文案 key：`menu.车辆管理.节点映射`（zh-CN / en-US 已加，其余语言中文回退）。

权限码（2026-08-19 后端下发，已接入完成）：

- 菜单码：`node-mapping:view`（`PERM.NODE_MAPPING_VIEW`），已同步 `MENU_TREE` 车辆管理分组
  （位于载具类型与告警码管理之间，与后端 sort=40 一致）；
- 按钮码：`node-mapping:add / update / delete`（`PERM_BUTTON.NODE_MAPPING_ADD / _UPDATE / _DELETE`），
  页面新增/编辑/删除按钮按 `SPEC_button_permission` 约定以「无权限隐藏」方式接 `hasPerm`。

## 7. 已知限制

~~1. update 不支持修改 agvKeys → 编辑禁用（§2.1）；~~
~~2. update 无删除地图组语义、新增 mapId 行为未明确 → 编辑锁组（§2.1）；~~

2026-08-19 update 接口升级为与 save 一致的分组结构（含 agvKeys），上述限制已全部解除（§2.1）。
