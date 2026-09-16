# SPEC：constants / enum 国际化（组件层处理）

> 状态：已定稿（访谈确认）
> 日期：2026-06-18
> 关联：`docs/METHODOLOGY_i18n.md`（决策 #4）、`docs/glossary.md`、`docs/SPEC_evenly_insert_nodes.md`、`docs/SPEC_create_node_from_robot.md`
> 适用分支：`v2_dev`

---

## 一、目标与背景

### 目标

`src/constants/` 与 `src/utils/enum.ts` 中的中文展示文案，统一在**组件调用层**用 `useI18n().t()` 处理国际化。**不修改** constants / enum 文件本身的中文 label（保持纯数据），翻译在组件渲染时注入。

### 背景：当前状态（已核查）

1. **改造不一致**：部分调用点已用 ad-hoc 内联 `.map(o => ({...o, label: t(o.label)}))` 翻译（`Overlook/PanelTabs/OrderList`、`OrderRecord/RecordTable/SearchForm`、`OrderRecord/RecordTable`、`OrderRecord/OrderStatistics` 的 `t(order.title)`、`OrderInfo` 的 `t(item.label)`）；另一部分**直接把常量原样传入** antd：
   - `AnalyzeVisual/OrderStatistics/QuantityStatistics` → `options={orderTypeOptions}` / `options={orderStateOptions}`
   - `AnalyzeVisual/OrderStatistics/EfficiencyStatistics` → `options={orderTypeOptions}`
   - `VehicleDeploy/VehicleDisplay/VehicleModal` → `options={agvTypes}`
   - `MissionCluster/MissionFlow/FlowModal` → `options={triggerTypes}`
   - `MapThrough/.../EdgeShape/LoadType` → `options={loadTypes}`
   - `TriDevice/AutoDoor/.../AutodoorModal` → `options={readOptions}` / `options={writeOptions}`
   - `TriDevice/Elevator/.../ElevatorModal` → `options={readOptions}` / `options={writeOptions}`
2. **已存在的潜在 Bug（cron）**：`CronTabs` 父组件传 `text={t("秒")}`（**已翻译**的值），但子组件用 `cronIndex[text]` / `cornCountEnum[text]` 查表，而这两个常量的**键是中文**（秒/分/小时/日/月/周）。中文环境下 `cronIndex["秒"]=0` 正常；英文环境下 `t("秒")="Second"`，`cronIndex["Second"]=undefined`，**cron 表达式拼装失败**。
3. **既有冲突决策**：`mapThrough.ts` 的 `nodeTypeOptions` 带注释「决策 13：中文硬编码，不走 locales」（出自 `docs/SPEC_evenly_insert_nodes.md` 等）。本次**覆盖**该决策。

---

## 二、决策清单（访谈确认）

| # | 决策项 | 结论 |
|---|--------|------|
| D1 | constants / enum 文件 | **不改中文 label**，保持纯数据；翻译在组件层注入 |
| D2 | cron 中文键（cronIndex / cornCountEnum） | **保留中文键不动**；`text` prop 拆分职责——传**原始中文**作查找键，展示另走 `t(text)`（详见 §五） |
| D3 | 翻译机制 | **统一内联 `.map(o => ({...o, label: t(o.label)}))` / `t(item.xxx)`**，**不新增** helper hook（如 `useTranslatedOptions`） |
| D4 | 协议/技术英文术语 label | **不翻译**：`readOptions`/`writeOptions` 的 `COILS`/`DISCRETE_INPUTS`/`HOLDING_REGISTERS`/`INPUT_REGISTERS`、`blockingOptions` 的 `NONE`/`SOFT`/`HARD` 保持原样 |
| D5 | `nodeTypeOptions` / `menuItems` | **覆盖**历史「决策 13」，一并翻译；同步更新冲突注释与历史 SPEC |
| D6 | `utils/enum.ts`（8 个中文值枚举） | **纳入范围**，在渲染点用 `t(RobotStatus[status])` 等转换 |
| D7 | 非组件 util（`utils/public.ts` 的 `transformOrderInfo` / `transformVehicleInfo`） | **util 保持纯函数**，返回原始中文（label 来自 `orderRefer`、children 来自 enum/agvTypes）；由**消费组件**对 label 与 children 都走 `t()` |
| D8 | locale 文件同步 | **仅** `zh-CN.json` + `en-US.json`；`zh-TW`/`ja-JP`/`ko-KR` 缺失回退中文，后续补 |
| D9 | en-US 产出 | 按 `docs/glossary.md` 术语表产出**真实英文初稿**（标「待人工审校」） |
| D10 | 重复 key 策略 | 遵循 METHODOLOGY D1：**相同中文 → 共享同一 locale key**；仅当英文语义确实不同才加限定词；调和 cron hour「时」(label) 与「小时」(键) 的不一致 |
| D11 | 调用点对齐 | **全部对齐**到约定写法（含已改造点）；**分模块提交** |
| D12 | 英文溢出/布局适配 | **本次不做**，留作收尾阶段 |
| D13 | 验证 | **静态 grep + 关键页抽查**（OrderInfo / 车辆详情 / cron 表达式 / 避障表格），辅以 `tsc` |

---

## 三、范围

### ✅ 纳入

**A. `src/constants/` 展示 label（13 个文件）：**

| 文件 | 处理的常量（展示字段） | 不处理 / 说明 |
|------|----------------------|--------------|
| `index.ts` | — | `blockingOptions`（英文术语，D4 排除）、`IP_REGEXP`、`DEFAULT_NAME`（非文案） |
| `autodoor.ts` | `autodoorCommands[].label`（开门/关门） | `readOptions`/`writeOptions`（英文术语，D4 排除） |
| `chargePile.ts` | `chargePileCommands[].label`（开始充电/停止充电） | — |
| `elevator.ts` | `elevatorCommands[].label`（外部呼叫电梯/电梯开门/...） | `readOptions`/`writeOptions`（英文术语，D4 排除）；`theme`（配色非文案） |
| `mapThrough.ts` | `loadTypes`、`deviceTypes`、`chargeStationDeviceTypes`、`applyDeviceAutoDoorTypes`、`applyDeviceAirShowerDoorTypes`、`applyDeviceElevatorTypes`、`releaseDeviceAutoDoorTypes`、`releaseDeviceAirShowerDoorTypes`、`releaseDeviceElevatorTypes`、`avoidMapList`（label）、`avoidList[].name`、`menuItems[].label`、`nodeTypeOptions[].label` | `defaultAvoid`（纯数据）、`avoidList` 的 `id`/`sensor_index`（标识符，不动）、`menuItems` 的 `key`/`enable`/`danger`（逻辑，不动） |
| `MissionCluster/index.ts` | `operates[].label`、`triggerTypes[].label` | `cornCountEnum`/`cronIndex`：**键保留中文**（D2）；`cronRegex`（非文案） |
| `TriTraffic/index.ts` | `testControls[].label`（申请/释放） | — |
| `vehicle/index.ts` | `agvTypes[].label`、`eStops[].label`、`shuttleActions[].label`、`vehicleActions[].label` | value/key（PAUSE/CONTINUE 等，不动） |
| `OrderRecord/orderRecord.ts` | `orderStateUnfold[].chName`、`orderTypeOptions[].label`、`orderStateOptions[].label`、`orderOperates[].label` | `enum`/`value`/`key`/`color`/`enabled`（标识符与逻辑，不动） |
| `OrderRecord/Statistics.ts` | `defaultRecordList[].title` | key/value（不动） |
| `orderInfo/index.ts` | `orderRefer`（全部 value，约 60 条字段中文） | 键（英文/驼峰字段名，不动） |
| `AnalyzeVisual/orderStatistics.ts` | `quantityTranslate`、`efficiencyTranslate`（value） | **疑似当前无消费点**，实施前先核实；若已废弃则不处理 |
| `graph/tooltip.ts` | — | `DEFAULT_TOOLTIP` 仅 `visible:false`，无文案，排除 |

**B. `src/utils/enum.ts`（8 个枚举，值是中文）：** `RobotStatus`、`OrderStatus`、`OrderTypes`、`MissionState`、`NodeType`、`ChargeState`、`FlowState`、`ActionStatus`。在渲染点 `t(Enum[key])` 转换。`BlockingTypes` 值为空字符串，跳过。

> 另：`enum.ts::getVehicleStatusText` 也属此类（返回单个中文状态串，非 items 数组），由消费组件 `t()` 翻译（见 §三C、§七模块2，**易遗漏**）。

**C. `src/utils/` 消费点：**
- `public.ts::transformOrderInfo` / `transformVehicleInfo` 的 `label`（来自 `orderRefer`）与 `children`（来自 `RobotStatus`/`OrderStatus`/`OrderTypes`/`agvTypes.label`），由消费组件（`OrderInfo`、`VehicleInfo`、`VehicleInfoModal`）在渲染时翻译。
- `public.ts::enumToObject` + `objectToOptions`（把 enum 中文值塞进 `options[].label`）——**间接转换路径**，消费组件（如 `MapNestModify/NestPanel/.../NodeShape/TypeItem`）需对生成的 options 再 `.map(o => ({...o, label: t(o.label)}))`（见 §4.6，**易遗漏**）。
- `enum.ts::getVehicleStatusText`（返回单个中文状态串），消费组件渲染 `t(getVehicleStatusText(...))`。

### ❌ 排除（不动）

- 协议/技术英文术语 label（D4）：Modbus 寄存器类型、`NONE`/`SOFT`/`HARD`
- cron 的中文键 `秒/分/小时/日/月/周`（D2：作为标识符保留，见 §五）
- 所有标识符字段：`value`/`key`/`enum`/`id`/`sensor_index`/`as_index`/`enable`/`enabled`/`color`/`danger`
- 非文案常量：`theme`、`cronRegex`、`IP_REGEXP`、`DEFAULT_NAME`、`DEFAULT_TOOLTIP`、`defaultAvoid`
- `console.*`、注释、API 返回的 `message`（遵循既有方法论）
- 英文溢出/布局适配（D12，留作收尾）

---

## 四、组件层翻译模式（统一写法）

> 原则：内联、不加 helper（D3）。以下为各场景的标准写法，所有调用点对齐至此。

### 4.1 Select / Checkbox / Radio 的 `options`（`label` + `value`）

```tsx
const { t } = useI18n();

<Select
  options={orderTypeOptions.map(o => ({ ...o, label: t(o.label) }))}
/>

// 带过滤时：先按 value 过滤，再 map label
<Select
  options={
    orderStateOptions
      ?.filter(o => !["SUCCEEDED", "CANCELLED", "FAILED"].includes(o.value as string))
      ?.map(o => ({ ...o, label: t(o.label) })) || []
  }
/>
```

### 4.2 菜单项 `MenuProps["items"]` / 自定义菜单（`label` + `key`）

```tsx
const translated = autodoorCommands?.map(op =>
  op && "label" in op ? { ...op, label: t(op.label as string) } : op
) || [];
```

### 4.3 非 `label` 的展示字段（`name` / `title` / `chName`）

```tsx
// 表格列 dataIndex 直接渲染时，改用 render
{ title: t("名称"), dataIndex: "name", render: (name: string) => t(name) }
// avoidList[].name 同理

// Statistic 标题
<Statistic title={t(item.title)} value={item.value} />

// Tag/状态色（orderStateUnfold）
const target = orderStateUnfold.find(i => i.enum === orderState);
// 渲染：t(target.chName)（color 用 target.color，不翻译）
```

### 4.4 字段对照表 `orderRefer`（经 util 返回的 Descriptions items）

```tsx
// 消费组件对 label 与 children 都翻译
const translated = infos.map(item => ({
  ...item,
  label: t(item.label as string),
  children: typeof item.children === "string" ? t(item.children) : item.children,
}));
```

> 注意：`children` 可能是 dayjs 格式化串、JSON.stringify 结果等非枚举值——**仅当为字符串且命中 locale key 时翻译**，否则原样（`t()` 未命中回退原文，天然安全）。

### 4.5 enum 值

```tsx
<Tag>{t(RobotStatus[status])}</Tag>
<span>{t(OrderTypes[orderType])}</span>
```

> 边界：`Enum[key]` 当 key 非法时返回 `undefined`，传给 `t()` 会异常。消费点需先确保取到非空值（如 `getVehicleStatusText` 内部已用 `??` 回退保护）。

### 4.6 经 `enumToObject` / `objectToOptions` 间接生成的 options

> 转换链：`objectToOptions(enumToObject(NodeType))` → `label` 为 enum 中文值。这类 label 不会落入 §4.1 的直接 `.map`，需在 `setNodeTypes` 之后、传给 Select 之前补一层翻译。

```tsx
// TypeItem：对 objectToOptions 产出的 options 再 map
const options = objectToOptions(enumToObject(NodeType)).map(o => ({
  ...o,
  label: t(o.label as string),
}));
setNodeTypes(options);
```

---

## 五、cron 中文键 Bug 修复（D2，关键）

### 根因

`CronTabs/index.tsx` 把 `text={t("秒")}` 传入子组件，子组件（`SecondTab`/`MinuteTab`/`HourTab`/`DayTab`/`MonthTab`/`WeekTab`，`components/FromToInput`/`FromToInterval`/`FromToChecbox`，以及 `WeekTab` 下的 `FromToWhich`/`FromToLast`）用 `cronIndex[text]` / `cornCountEnum[text]` 查表，而表键是中文。英文环境下查表得到 `undefined`。

### 修复方案（不改 constants）

**职责拆分**：`text` 始终是**原始中文 cronIndex 键**（查找用），展示统一走 `t(text)`。

```tsx
// CronTabs/index.tsx —— text 传原始中文（不再 t()）
<SecondTab text="秒" cronValue={cronValue} triggerChange={triggerChange} />
// Tabs 的 label 仍可独立用短词展示：label: t("秒")
```

```tsx
// 子组件内 —— 查表用 text（中文），展示用 t(text)
const range = splitCron.toSpliced(cronIndex[text], 1, ...);   // ✓ cronIndex["秒"]=0
<Typography.Text>{t("每{text}执行一次", { text: t(text) })}</Typography.Text>  // ✓ t("秒")
```

### 校验清单（实施时逐项确认）

- [ ] `CronTabs/index.tsx`：6 个 tab 的 `text` 改为原始中文（`"秒"/"分"/"小时"/"日"/"月"/"周"`），**与 `cronIndex` 键完全一致**
- [ ] `hour` tab：查找键用 `"小时"`（与 cronIndex 键一致），tab 的展示 `label` 可保留短词 `t("时")`（D10：展示与查找解耦，二者可不同）
- [ ] 审计 6 个 tab + **5 个子组件**（`components/FromToInput`、`FromToInterval`、`FromToChecbox`，以及 `CronTabs/WeekTab/FromToWhich`、`CronTabs/WeekTab/FromToLast`——**易遗漏**）：**所有 `{text}` 的展示点都经过 `t(text)`**，不得裸渲染 `{text}`
- [ ] `FromToChecbox` 的 `cornCountEnum[text]`（生成 checkbox 数量）在英文下也返回正确数值（修复后 `text` 恢复中文、查表正常；其 checkbox `label` 为数字，无需翻译）

---

## 六、locale JSON 规则

1. **Key 设计**：中文原文作 key，平面结构（遵循 METHODOLOGY）。
2. **共享 key（D10）**：`开门`/`关门`/`取消`/`暂停`/`继续`/`队列中` 等跨 constants 重复出现的中文，**合并为同一个 key**。仅当英文语义确实不同（如 `开门`=Open Door vs `电梯开门`=Elevator Open）才用不同中文原文（天然不同 key）。
3. **新增 key 同步到**：
   - `zh-CN.json`：值 = 中文原文
   - `en-US.json`：值 = 按 `docs/glossary.md` 的英文翻译（初稿，待审校）
   - `zh-TW`/`ja-JP`/`ko-KR`：本次不补（回退中文）
4. **变量插值**：如 `t("每{text}执行一次", { text: t("秒") })` → locale key 为 `"每{text}执行一次"`。
5. 新增 key 量大（`orderRefer` 约 60 条、`avoidList` 15 条、各设备命令若干），按模块提交时同步对应批次。

---

## 七、调用点映射（实施清单）

> 已核查的主要消费点。实施时以实际 grep 为准补全。

### 模块 1：cron 表达式（先做，风险最高，单独提交）
- `pages/MissionCluster/MissionFlow/FlowModal/CronExpress/CronTabs/index.tsx`（`text` 去翻译）
- `CronTabs/{Second,Minute,Hour,Day,Month,Week}Tab/index.tsx`（展示走 `t(text)`）
- `components/FromToInput`、`FromToInterval`、`FromToChecbox`（展示走 `t(text)`）
- `CronTabs/WeekTab/FromToWhich`、`CronTabs/WeekTab/FromToLast`（同样 `cronIndex[text]` 查表 + `{text}` 展示点走 `t(text)`；**易遗漏**）
- `operates`、`triggerTypes` 在 `FlowModal` 的渲染点

### 模块 2：车辆
- `vehicle/index.ts`：`agvTypes`/`eStops`/`shuttleActions`/`vehicleActions`
- 消费点：`VehicleDeploy/VehicleDisplay/VehicleModal`（`options={agvTypes}` 待翻译）、车辆列表/详情的状态 Tag（`RobotStatus`）
- `utils/public.ts::transformVehicleInfo` 的消费组件 `VehicleInfo`、`VehicleInfoModal`：label + children 翻译
- `enum.ts::RobotStatus`/`ChargeState` 各渲染点
- `enum.ts::getVehicleStatusText` 的 3 个消费点（**易遗漏**）：`Overlook/PanelTabs/VehicleList`、`Overlook/ForceGraph/Tooltip`、`RecordPlayback/components/VehicleInformation`——渲染 `t(getVehicleStatusText(...))`

### 模块 3：三方设备 / 交管
- `autodoor.ts`/`chargePile.ts`/`elevator.ts`/`TriTraffic/index.ts`
- 消费点：`TriDevice/AutoDoor`、`TriDevice/Elevator`、`TriDevice/ChargePile`、`TriTraffic` 页面的命令菜单与下拉
- `readOptions`/`writeOptions` **不改**（D4）

### 模块 4：订单 / 任务
- `OrderRecord/orderRecord.ts`（`orderStateUnfold.chName`/`orderTypeOptions`/`orderStateOptions`/`orderOperates`）、`OrderRecord/Statistics.ts`（`defaultRecordList.title`，已 `t()`，核实）、`orderInfo/index.ts`（`orderRefer`）、`AnalyzeVisual/orderStatistics.ts`（先核实是否在用）
- 消费点：`OrderRecord/RecordTable`（已部分）、`Overlook/PanelTabs/OrderList`（已部分）、`OrderInfo`（label 已翻译，**补 children 翻译**）、`AnalyzeVisual/OrderStatistics/{Quantity,Efficiency}Statistics`（待翻译）
- `enum.ts::OrderStatus`/`OrderTypes`/`MissionState`/`FlowState`/`ActionStatus` 各渲染点

### 模块 5：地图编辑
- `mapThrough.ts`：`menuItems`/`nodeTypeOptions`/`avoidList.name`/`loadTypes`/`deviceTypes`/`chargeStationDeviceTypes`/`applyDevice*`/`releaseDevice*`/`avoidMapList`
- 消费点：`MapNestModify/NestGraph/ContextMenu`（`menuItems`）、`ContextMenu/{EvenlyInsertModal,CreateNodeByRobotModal}`（`nodeTypeOptions`）、`EdgeShape/Avoid`（`avoidList` 加 `render: t(name)`）、`EdgeShape/LoadType`（`loadTypes`）、`MapNestModify/NestPanel/.../NodeShape/TypeItem`（`objectToOptions(enumToObject(NodeType))` 间接 options，见 §4.6，**易遗漏**）、相关设备申请/释放下拉
- **更新历史 SPEC**：`docs/SPEC_evenly_insert_nodes.md`、`docs/SPEC_create_node_from_robot.md` 中「决策 13：中文硬编码」相关条目，标注已被本 SPEC 覆盖；同步删除/改写 `mapThrough.ts` 中 `nodeTypeOptions` 上方的「决策 13：中文硬编码，不走 locales」注释。

---

## 八、执行与提交

- **顺序**：模块 1（cron，单独）→ 模块 2 → 模块 3 → 模块 4 → 模块 5。
- **每模块一个提交**（commit message 用简体中文），格式示例：`feat: 车辆相关常量国际化`。
- 每个提交内：① 改组件调用点 ② 同步 `zh-CN.json` + `en-US.json` 本批次新 key。
- 模块 5 提交需一并更新历史 SPEC 与注释。

---

## 九、验证（D13）

1. **静态 grep**（确认无遗漏、无回退）：
   - `grep -rn "options={\(agvTypes\|loadTypes\|orderTypeOptions\|orderStateOptions\|triggerTypes\|readOptions\|writeOptions\|deviceTypes\)" src` —— 命中的 `readOptions`/`writeOptions`（D4 排除）外，其余应均已 `.map(... t())`。
   - `grep -rn "text={t(" src/pages/MissionCluster` —— CronTabs 的 `text` 不应再被 `t()` 包裹。
2. **`tsc` 类型检查**无报错（`no-unused-vars` 为 error）。
3. **关键页抽查**（切 en-US）：OrderInfo（字段名 + 值）、车辆详情/列表（状态）、cron 表达式编辑器（切各 tab 改值，确认 cron 串正确生成）、避障表格（传感器名称）。
4. 列出本批次新增 locale key 清单，供审校。

---

## 十、风险与遗留

| 项 | 说明 |
|----|------|
| `quantityTranslate`/`efficiencyTranslate` 疑似未用 | 实施前核实；若废弃则跳过，避免引入无用 key |
| 英文溢出（D12） | 本次不处理，留收尾阶段统一加 `min-width`/`ellipsis` |
| `children` 翻译误伤 | `transformOrderInfo` 的 `children` 含 dayjs 串/JSON——靠 `t()` 未命中回退原文保证安全，但需抽查确认非枚举值不被改动 |
| 共享 key 耦合（D10） | 同一中文跨模块共享翻译，后续若需差异化需拆 key——可接受，符合 METHODOLOGY D1 |
| enum 值翻译面广 | `utils/enum.ts` 8 枚举渲染点分散，需逐模块 grep 补全，遗漏即出现局部中文残留 |

---

## 十一、不在本 SPEC 范围（明确边界）

- 新增 helper hook / 抽象层（D3 明确不加）
- 修改 constants / enum 文件的中文 label（D1）
- cron 键的标识符化重构（D2 选择保留中文键）
- 技术英文术语翻译（D4）
- 英文布局适配（D12）
- `zh-TW`/`ja-JP`/`ko-KR` 翻译补齐（D8）
- Canvas 画布上的节点标签（Konva Text，遵循既有方法论排除）
