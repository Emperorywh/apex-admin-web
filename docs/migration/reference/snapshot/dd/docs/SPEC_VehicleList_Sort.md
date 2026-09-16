# 车辆列表（VehicleList）表格排序 — 规格说明

> 目标组件：`src/pages/Overlook/PanelTabs/VehicleList/index.tsx`
> 日期：2026-06-28
> 状态：**已定稿，待实现**（审阅矛盾与实现风险已修正；D1–D3 决策见 §0）
> 适用框架：Umi Max + Ant Design `^5.4.0` + react-konva（表格已开 `virtual` 虚拟滚动）

---

## 0. 决策记录（已定稿 2026-06-28）

| 编号 | 决策点 | 已定方案（✅ 采纳） | 备选（未采纳，留档） | 影响范围 |
|---|---|---|---|---|
| D1 | 并列项稳定次序的语义 | ✅ **主方案：跟随用户上次所见次序**（全文已据此统一） | 固定 `agvName` 字母序（**不满足**「保持上次次序」需求，语义不同） | §4.5、§5、§6.5、§7 |
| D2 | 状态列字典序对业务近乎无价值，是否保留该列排序 | ✅ **保留排序**，严格按 `vehicleProcStatus` 字典序，交付时明确告知用户；业务优先级序列入「范围之外」 | 该列不开放排序；或本次直接做业务优先级序 | §4.3、§8 |
| D3 | `agvName` 中英混合的中文段排序口径 | ✅ **沿用 `localeCompare`**（英文段忽略大小写的需求明确），接受中文段随运行环境 ICU 差异 | 中文段改用 Unicode 码点序，与状态列统一、跨端可预期 | §4.3、§6 |

---

## 1. 背景与现状

`VehicleList` 用 antd `Table` 渲染车辆清单，特征：

- `virtual`（虚拟滚动）、`sticky`、无分页、`rowKey="agvKey"`。
- 数据源 `vehicleList` 为组件内 `useState`，每次 websocket 推送就 `setVehicleList(vehicles)` **全量替换**（见 `useEffect([lastMessage])`）。
- 父级 `PanelTabs` 的 `Tabs` 设置了 `destroyOnHidden`，切换 tab 会**卸载** `VehicleList`。
- 当前表格无任何排序能力；全项目也尚无 `sorter` 先例。

待排序列（数据形态）：

| 列 | dataIndex | 类型 | 备注 |
|---|---|---|---|
| 车辆 | `agvName` | string | 中英混合，如 `中环大地图-bc9371…` |
| 状态 | `vehicleProcStatus` | enum | `IDLE\|TRAFFIC\|PROCESSING\|CHARGE\|AVOID\|ERROR\|BRAKE`；**显示**还受 `connectionState` 影响（离线车显示「离线/连接中断」，见 `getVehicleStatusText`） |
| 电量 | `["batteryState","batteryCharge"]` | number | 0–100 |
| 操作 | `dispatchState` | — | **不参与排序** |

---

## 2. 需求

为 `agvName`、`vehicleProcStatus`、`batteryState.batteryCharge` 三列新增「升序/降序」排序。
数据源是 websocket 高频推送的，**排序必须始终作用于最新数据源**，而非只在用户点击的那一次生效。

---

## 3. 决策摘要（访谈结论）

| 维度 | 决策 |
|---|---|
| 排序范围 | agvName、vehicleProcStatus、batteryCharge；操作列不排 |
| 落地方案 | **antd 表头排序 UI（受控）+ 渲染前 `useMemo` 对 `vehicleList` 预排序**再喂给 `dataSource` |
| 交互形态 | **三态**：升序 → 降序 → 取消排序（点击循环）；**初始无排序**（显示推送原序）；**单列排序**（点击新列自动取消旧列） |
| 推送协同 | 每次推送都重新应用当前排序；**并列项保持上次相对次序**（稳定次序，按 D1 主方案：跟随用户上次所见次序） |
| agvName 比较 | `localeCompare`，**忽略大小写** |
| 状态列比较 | **严格按 `vehicleProcStatus` 原始枚举 key 字典序**，**无视 `connectionState`** |
| 电量列比较 | 数值大小 |
| 空值/缺失 | **缺失视为最大值**，跟随排序方向沉底（升序末尾、降序首位） |
| 状态持久化 | **不持久化**；组件卸载即丢失，重建后回到「无排序」初始态 |

---

## 4. 详细规格

### 4.1 交互形态（三态）

- 通过 `sortDirections={['ascend', 'descend']}` 实现「升序 → 降序 → 取消」三态循环。
  > 注意：antd 默认 `sortDirections` 是 `['ascend','descend','ascend']`（升→降→升循环，无取消态）。**必须改为 `['ascend','descend']`**，第三次点击才会回到无序（取消）。
- 排序状态受控：维护 `sortedInfo`（`SorterResult<VehicleType>`），每列 `sortOrder` 绑定为 `sortedInfo.columnKey === 'xxx' ? sortedInfo.order : null`，保证单列高亮正确。
- 初始 `sortedInfo = {}`（无 `order`），`dataSource` 直接等于推送原序。
- 建议 `showSorterTooltip: false`（表头已是中文，提示气泡冗余；可选保留）。

### 4.2 数据流与排序落点

```
websocket lastMessage
   └─ useEffect ──> setVehicleList(vehicles)   // 仅写入"推送原序"，不排序
                          │
                          ▼
              useMemo([vehicleList, sortedInfo])
                  ├─ 无 order  → 直接返回 vehicleList（原序）
                  └─ 有 order  → 以"上次顺序"为基准做稳定排序 → 返回
                          │
                          ▼
                 <Table dataSource={sortedDataSource} />
```

- **排序逻辑全部在 `useMemo` 里完成**，`useEffect` 保持原样只负责写入数据。这样「无排序」与「有排序」两种态都从同一数据源派生，排序始终作用于最新推送。
- 之所以**不用纯 antd 内置 `column.sorter`**：antd 在 `dataSource` 高频变化时不会自动对新数据重排，排序会随推送间歇失效。预排序 `dataSource` 才能保证「排序始终生效」。

### 4.3 各列比较器规格

| columnKey | 取值 | baseCompare（升序语义） |
|---|---|---|
| `agvName` | `a.agvName` | `String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })`（忽略大小写）。**中文段顺序依赖运行环境 ICU，跨浏览器/Node 可能不一致**，见 D3 |
| `vehicleProcStatus` | `a.vehicleProcStatus` | 字符串**码点字典序**：`String(a) < String(b) ? -1 : > ? 1 : 0` |
| `batteryCharge` | `a.batteryState?.batteryCharge` | `Number(a) - Number(b)` |

**状态列行为说明（务必告知最终用户）**：

- 严格按 `vehicleProcStatus` 字典序，**离线车混在对应业务态组里**（一辆 `vehicleProcStatus=IDLE` 的离线车，显示「离线」但仍排在 `IDLE` 组）。
- 升序实际顺序为：`AVOID → BRAKE → CHARGE → ERROR → IDLE → PROCESSING → TRAFFIC`（字典序，与业务直觉不同）。
- ⚠️ 该字典序对业务几乎无价值；经 **D2** 确认**保留此列排序**并在交付时告知用户，业务优先级序列入「范围之外」。
- 若最终希望离线车单独成组/钉底，需回到「状态列离线车处理」重新决策（当前选定为「严格按 vehicleProcStatus」）。

### 4.4 空值/缺失处理（缺失视为最大值）

缺失定义：`batteryState` 缺失导致 `batteryCharge` 取不到。

> 注：按 `typing.d.ts` 契约，`vehicleProcStatus`（7 个固定字面量之一）与 `agvName`（`string`）均为**必填非空**，类型上不会缺失；下方比较器对它们仍保留 `null/undefined` 防御分支，仅为兼容运行时异常数据。若团队倾向严格遵循类型契约，可移除这两列的空值分支，仅保留电量列的 `batteryState?.` 穿透。

比较器统一约定：

```text
va、vb 为两行对应字段值
若 va、vb 均缺失  → 0
若 va 缺失        → +1   // 视为最大值，升序时排在后面（末尾）
若 vb 缺失        → -1
否则              → baseCompare(va, vb)
降序 = 对上述结果取反
```

- 升序（小→大）：缺失视为最大值 → **排末尾** ✓
- 降序（大→小）：取反后缺失 → **排首位** ✓
- 符合「跟随排序方向沉底」。
- **安全取值**：电量须用 `a.batteryState?.batteryCharge`，避免 `batteryState` 为 `undefined` 时抛错。

### 4.5 推送协同与稳定次序（核心难点）

**问题**：每次推送是**全新数组**（对象引用全变）。仅靠 `Array.prototype.sort` 的稳定性（ES2019+ 已稳定），只能保证「本次输入里相同键项的相对顺序」。若后端在两次推送间改了输入顺序，相同键项的展示顺序仍会**跳动**。

例：电量同为 80 的 A、B 两车——
推送1 输入 `[A80, B80, C90]` → 稳定排序后 `[A80, B80, C90]`；
推送2 输入 `[B80, C90, A80]`（后端换序）→ 稳定排序后 `[B80, A80, C90]`。
A、B 顺序由 `[A,B]` 跳到 `[B,A]`。

**主方案（已选定，全文据此统一）— 以「上次渲染顺序」为稳定基准**：

- 用 `lastOrderRef: useRef<string[]>` 缓存上一次**已提交渲染**后的 `agvKey` 顺序。
- 每次预排序前，先把 `vehicleList` 按 `lastOrderRef` 重排成「上次的顺序」作为基准输入，再做稳定排序。
- 因 `Array.sort` 稳定，相同排序键的项会**保持基准输入里的相对次序 = 上次的相对次序** → 不跳动。
- 新增车辆（`agvKey` 不在 `lastOrderRef`）排到基准末尾；消失的车辆自然剔除。
- ⚠️ **同时新增多辆车的并列处理**：若两辆都是新增车，基准位都取不到，直接 `Infinity - Infinity = NaN`，`sort` 对 `NaN` 的处理是实现定义的、相对顺序未定义。比较器须在两者都缺基准时**兜底返回 `0`**（见 §5 骨架），由 `Array.sort` 稳定性维持本次输入的原序；此时「上次次序」本就不存在，跳动可接受。
- ⚠️ **`lastOrderRef` 必须在 `useEffect`（提交后）更新，不能写在 `useMemo` 里**：React 18 并发渲染下 `useMemo`（render 阶段）可能被打断、重跑或本次 render 未提交，若在其中写 `ref.current`，缓存进去的顺序可能与最终渲染结果不一致，导致稳定基准漂移、偶发跳动。详见 §6。

**备选方案（退化项，仅在主方案 review 受阻时启用）— 次级键 `agvName` 锁定**：

- 并列项一律用 `agvName`（`localeCompare` 忽略大小写）作次级排序键，顺序完全确定、实现简单。
- ⚠️ **语义不同**：次级序固定为字母序，**不跟随用户上次所见**，因此**不满足** §2「并列项保持上次相对次序」需求。若改用本方案，须同步修改 §2 需求与 §7 验收口径（「不跳动」对两方案都成立，但「跟随上次次序」仅主方案成立）。
- D1 已选定主方案，本备选**不采纳**，仅作退化选项留档。

### 4.6 状态持久化

- **不持久化**。`PanelTabs` 的 `Tabs destroyOnHidden` 会卸载 `VehicleList`，排序状态随之销毁；重建后回到「无排序」初始态。
- 无需 `sessionStorage` / Umi model。

---

## 5. 实现方案（代码骨架）

仅改动 `src/pages/Overlook/PanelTabs/VehicleList/index.tsx`，无新增文件、无接口/常量改动。

```tsx
import { memo, useState, useEffect, useMemo, useRef } from "react";
import { Table, Space, Switch, message, Typography, Tooltip } from "antd";
import type { TableProps, SorterResult } from "antd";
// ...其余 import 不变

// 列 key 常量，便于受控判断
const COL = {
    name: "agvName",
    status: "vehicleProcStatus",
    battery: "batteryCharge"
} as const;

/**
 * 读取某行指定列的排序原始值（与显示文本无关）
 * - agvName / vehicleProcStatus：直接取字符串
 * - batteryCharge：安全穿透 batteryState，缺失返回 undefined
 */
const readSortValue = (record: VehicleType, columnKey: string) => {
    switch (columnKey) {
        case COL.name:
            return record.agvName;
        case COL.status:
            return record.vehicleProcStatus;
        case COL.battery:
            return record.batteryState?.batteryCharge;
        default:
            return undefined;
    }
};

/**
 * 升序语义下的基础比较（不含空值处理）
 * - agvName：localeCompare 忽略大小写
 * - vehicleProcStatus：字符串码点字典序
 * - batteryCharge：数值差
 */
const baseCompare = (va: any, vb: any, columnKey: string): number => {
    switch (columnKey) {
        case COL.name:
            return String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
        case COL.status:
            return String(va) < String(vb) ? -1 : String(va) > String(vb) ? 1 : 0;
        case COL.battery:
            return Number(va) - Number(vb);
        default:
            return 0;
    }
};

/**
 * 带空值沉底的比较器
 * 缺失视为最大值：升序缺失排末尾、降序缺失排首位（跟随排序方向沉底）
 */
const compareRows = (
    a: VehicleType,
    b: VehicleType,
    columnKey: string,
    order: "ascend" | "descend"
): number => {
    const va = readSortValue(a, columnKey);
    const vb = readSortValue(b, columnKey);
    let r = 0;
    if (va == null && vb == null) r = 0;
    else if (va == null) r = 1;   // 缺失视为最大
    else if (vb == null) r = -1;
    else r = baseCompare(va, vb, columnKey);
    return order === "descend" ? -r : r;
};

export default memo((props: VehicleListProps) => {
    const { panelHeight } = props;

    const [vehicleList, setVehicleList] = useState<VehicleType[]>([]);
    const { lastMessage } = useWebSocketContext();

    // 受控排序状态：columnKey + order（order 为 undefined 表示无排序）
    const [sortedInfo, setSortedInfo] = useState<SorterResult<VehicleType>>({});
    // 上一次渲染顺序的 agvKey 列表，作为"稳定次序"基准
    const lastOrderRef = useRef<string[]>([]);

    useEffect(() => {
        if (lastMessage) {
            try {
                const data: SocketDispatcherState = JSON.parse(lastMessage.data);
                const { vehicles } = data;
                setVehicleList(vehicles); // 仅写入推送原序，排序交给下面的 useMemo
            } catch (error) {
                message.warning("解析车辆数据失败" + error);
            }
        }
    }, [lastMessage]);

    // 预排序数据源：排序始终作用于最新推送数据。
    // 本函数为纯计算，**只读** lastOrderRef.current 作为稳定基准；
    // 对 lastOrderRef 的写入统一放到下方 useEffect（提交后执行），
    // 避免在 React 18 并发渲染的 render 阶段写 ref 导致基准漂移。
    const sortedDataSource = useMemo(() => {
        const columnKey = sortedInfo.columnKey as string | undefined;
        // 无排序：直接返回推送原序（基准更新交给 useEffect）
        if (!sortedInfo.order || !columnKey) {
            return vehicleList;
        }
        // 以"上次已提交渲染顺序"为基准重排输入，保证并列项保持上次相对次序
        const orderMap = new Map(lastOrderRef.current.map((k, i) => [k, i]));
        const base = [...vehicleList].sort((a, b) => {
            const ia = orderMap.get(a.agvKey);
            const ib = orderMap.get(b.agvKey);
            // 两车基准位都已知：按上次次序
            if (ia !== undefined && ib !== undefined) return ia - ib;
            // 仅一方为新增车：新增车排到基准末尾
            if (ia !== undefined) return -1;
            if (ib !== undefined) return 1;
            // 两者都为新增车：兜底返回 0，避免 Infinity - Infinity = NaN，
            // 由 Array.sort 稳定性维持本次输入的原序
            return 0;
        });
        // 稳定排序（ES2019+ Array.sort 稳定）：相同排序键项保持上面建立的上次相对次序
        base.sort((a, b) => compareRows(a, b, columnKey, sortedInfo.order!));
        return base;
    }, [vehicleList, sortedInfo]);

    // 提交后再更新稳定基准：保证缓存的顺序与最终渲染结果一致
    useEffect(() => {
        lastOrderRef.current = sortedDataSource.map(v => v.agvKey);
    }, [sortedDataSource]);

    const handleDispatchChange = (record: VehicleType) => {
        /* 原样保留 */
    };

    const columns: TableProps<VehicleType>["columns"] = [
        {
            title: "车辆",
            dataIndex: "agvName",
            key: COL.name,
            // 受控：当前列才显示排序方向
            sortOrder: sortedInfo.columnKey === COL.name ? sortedInfo.order : null,
            sorter: true,
            sortDirections: ["ascend", "descend"], // 升→降→取消 三态
            showSorterTooltip: false,
            ellipsis: { showTitle: false },
            render: (value: string) => (
                /* 原样保留 */
                <></>
            )
        },
        {
            title: "状态",
            dataIndex: "vehicleProcStatus",
            key: COL.status,
            sortOrder: sortedInfo.columnKey === COL.status ? sortedInfo.order : null,
            sorter: true,
            sortDirections: ["ascend", "descend"],
            showSorterTooltip: false,
            width: 80,
            render: (value, record) => getVehicleStatusText(record.connectionState, value)
        },
        {
            title: "电量",
            dataIndex: ["batteryState", "batteryCharge"],
            key: COL.battery,
            sortOrder: sortedInfo.columnKey === COL.battery ? sortedInfo.order : null,
            sorter: true,
            sortDirections: ["ascend", "descend"],
            showSorterTooltip: false,
            width: 80
        },
        {
            title: "操作",
            width: 70,
            fixed: "right",
            dataIndex: "dispatchState",
            render: (value, record) => (
                /* 原样保留 */
                <></>
            )
        }
    ];

    // 表头点击排序：更新受控状态（单列排序）
    const onTableChange: TableProps<VehicleType>["onChange"] = (_pg, _fil, sorter) => {
        const s = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<VehicleType>;
        setSortedInfo({
            columnKey: s.columnKey,
            order: s.order
        } as SorterResult<VehicleType>);
    };

    return (
        <Table<VehicleType>
            columns={columns}
            dataSource={sortedDataSource}
            size="small"
            sticky={true}
            pagination={false}
            rowKey={r => r.agvKey}
            virtual
            scroll={{ x: 100, y: panelHeight.current }}
            onChange={onTableChange}
        />
    );
});
```

> 注：`sorter: true` 仅作交互开关，真正的排序由 `sortedDataSource` 完成；`onChange` 只用来采集 `columnKey/order`。

---

## 6. 边界与风险

1. **三态交互配置**：务必用 `sortDirections: ['ascend', 'descend']`，否则默认值会导致无「取消」态。
2. **`columnKey` 受控**：电量列 `dataIndex` 是数组，antd 给出的 `field` 不直观，**统一用 `key` + `columnKey` 判断**，避免错位。
3. **virtual + sorter 兼容**：antd `^5.4.0` 的虚拟表格支持 `sorter`，但需在真实数据下实测表头图标位置与三态切换无异常。
4. **高频推送性能**：每秒级全量 `sort` + `setState`。`useMemo` 仅在 `vehicleList`/`sortedInfo` 变化时重算；常规车队规模（数十~数百辆）`O(n log n)` 可忽略。若实际车队上千且推送 >2Hz，再评估节流。
5. **稳定次序的退化**：主方案以 `lastOrderRef` 为基准（语义=跟随上次所见）；退化为「次级键 `agvName` 锁定」会**改变语义**（固定字母序，不满足 §2 需求），须同步改 §2/§7，见 §4.5 备选与 D1。
6. **离线车显示与排序不一致**：当前「严格按 `vehicleProcStatus`」会让离线车混在业务态组里、显示却为「离线」。属预期行为，需在交付时向用户说明。
7. **稳定基准须在 `useEffect` 更新**：`lastOrderRef` 写入不能放在 `useMemo`（render 阶段），否则 React 18 并发渲染下可能写入与最终渲染不一致的顺序，偶发跳动。§5 骨架已将写入移至 `useEffect([sortedDataSource])`。
8. **新增车并列时的 `NaN` 兜底**：两辆同时新增的车基准位均缺失，直接相减为 `NaN`，须兜底返回 `0`（§5 骨架已处理）。
9. **`agvName` 中文段跨端一致性**：`localeCompare` 的中文排序依赖运行环境 ICU，不同浏览器/Node 结果可能不同（见 D3）；若需跨端严格一致，中文段改用 Unicode 码点序。

---

## 7. 验收要点（手动）

- [ ] 三列表头均可点击，三态循环：升序 → 降序 → 取消；取消后回到推送原序。
- [ ] 点新列后旧列排序图标消失（单列排序）。
- [ ] 选定某列后，websocket 每次推送，列表都按当前方向保持有序（排序始终生效）。
- [ ] 同电量、同状态的车辆，在连续推送中**相对位置不跳动**（基础稳定次序，主/备方案均须满足）。
- [ ] **主方案专项**：切换排序方向或换列后，并列项保持切换前所见的相对次序（验证 D1 主方案「跟随上次所见」；备选方案不适用本条）。
- [ ] 缺失电量的车辆：升序在末尾、降序在首位。
- [ ] 切到其他 tab 再切回，排序状态重置为无排序。
- [ ] 状态列离线车按其 `vehicleProcStatus` 排序，与显示文本无关。
- [ ] `agvName` 大小写差异不影响相对顺序（忽略大小写）。
- [ ] 虚拟滚动下表头排序图标与交互正常。

---

## 8. 范围之外（本次不做）

- 状态列按业务优先级/中文文本排序（当前为原始枚举字典序）。
- 多列排序、排序状态持久化。
- 推送节流/防抖。
- 操作列排序。
