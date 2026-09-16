/**
 * @description 地图编辑里面的静态文件
 * @date 2025-7-23
 *  autoDoor  => OPEN_DOOR, airShowerDoor:   OPEN_FONT_DOOR/OPEN_BACK_DOOR/SHOWER , elevator: OUTER_CALL
 */
import type { SelectProps, MenuProps } from "antd";
import type { AvoidType, AvoidMap } from "@/types/MapNestModify";
import type { NodeType } from "@/plugins/konva/nodes";

export const loadTypes: SelectProps["options"] = [
    {
        label: "不限制",
        value: 0
    },
    {
        label: "负载",
        value: 1
    },
    {
        label: "空载",
        value: 2
    }
];

// 三方设备的类型
export const deviceTypes: SelectProps["options"] = [
    {
        label: "电梯",
        value: "elevator"
    },
    {
        label: "自动门",
        value: "autoDoor"
    },
    {
        label: "风淋门",
        value: "airShowerDoor"
    },
    {
        label: "交通灯",
        value: "trafficLight"
    },
];

// 三方设备的类型
export const chargeStationDeviceTypes: SelectProps["options"] = [
    {
        label: "充电桩",
        value: "chargePile"
    }
];

// 自动门对应的申请操作
export const applyDeviceAutoDoorTypes: SelectProps["options"] = [
    {
        label: "开门",
        value: "OPEN_DOOR"
    }
];

// 风淋门对应的申请操作
export const applyDeviceAirShowerDoorTypes: SelectProps["options"] = [
    {
        label: "开前门",
        value: "OPEN_FONT_DOOR"
    },
    // {
    //     label: "风淋",
    //     value: "SHOWER"
    // },
    {
        label: "开后门",
        value: "OPEN_BACK_DOOR"
    }
];

// 电梯对应的申请操作
export const applyDeviceElevatorTypes: SelectProps["options"] = [
    {
        label: "呼叫电梯",
        value: "OUTER_CALL"
    }
];

// 自动门对应的释放操作
export const releaseDeviceAutoDoorTypes: SelectProps["options"] = [
    {
        label: "关门",
        value: "CLOSE_DOOR"
    }
];

// 风淋门对应的释放操作
export const releaseDeviceAirShowerDoorTypes: SelectProps["options"] = [
    {
        label: "关前门",
        value: "CLOSE_FONT_DOOR"
    },
    {
        label: "关后门",
        value: "CLOSE_BACK_DOOR"
    }
];

// 电梯对应的释放操作
export const releaseDeviceElevatorTypes: SelectProps["options"] = [
    {
        label: "电梯关门",
        value: "CLOSE_ELEVATOR_DOOR"
    }
];

// 传感器避障id对应的中文名，地图编辑中的显示顺序也是这个顺序
export const avoidList: AvoidMap[] = [
    {
        name: "前方导航激光",
        sensor_index: 4,
        id: "laser_nav"
    },
    {
        name: "前方避障激光",
        sensor_index: 0,
        id: "laser_forward_obstacle"
    },
    {
        name: "前方相机",
        sensor_index: 5,
        id: "camera_forward_obstacle"
    },
    {
        name: "后方导航激光",
        sensor_index: 11,
        id: "laser_rear_nav"
    },
    {
        name: "后方避障激光",
        sensor_index: 3,
        id: "laser_rear_obstacle"
    },
    {
        name: "后方相机",
        sensor_index: 8,
        id: "camera_rear_obstacle"
    },
    {
        name: "左方避障激光",
        sensor_index: 1,
        id: "laser_left_obstacle"
    },
    {
        name: "左方相机",
        sensor_index: 6,
        id: "camera_left_obstacle"
    },
    {
        name: "右方避障激光",
        sensor_index: 2,
        id: "laser_right_obstacle"
    },
    {
        name: "右方相机",
        sensor_index: 7,
        id: "camera_right_obstacle"
    },
    {
        name: "叉尖左方避障激光",
        sensor_index: 9,
        id: "laser_rear_left_obstacle"
    },
    {
        name: "叉尖右方避障激光",
        sensor_index: 10,
        id: "laser_rear_right_obstacle"
    },
    {
        name: "叉齿中段左方避障激光",
        sensor_index: 12,
        id: "laser_left_middle_obstacle"
    },
    {
        name: "叉齿中段右方避障激光",
        sensor_index: 13,
        id: "laser_right_middle_obstacle"
    },
    {
        name: "货叉尖端避障",
        sensor_index: 14,
        id: "fork_tip_obstacle"
    }
];

// 创建路径或高级区域时前后方避障的默认值
export const defaultAvoid: AvoidType[] = [
    {
        as_index: 0,
        as_install_used: true,
        id: "camera_forward_obstacle",
        install_used: true,
        on_off: true
    },
    {
        as_index: 0,
        as_install_used: true,
        id: "camera_left_obstacle",
        install_used: true,
        on_off: true
    },
    {
        as_index: 0,
        as_install_used: true,
        id: "camera_rear_obstacle",
        install_used: true,
        on_off: true
    },
    {
        as_index: 0,
        as_install_used: true,
        id: "camera_right_obstacle",
        install_used: true,
        on_off: true
    },
    {
        as_index: 0,
        as_install_used: false,
        id: "fork_tip_obstacle",
        install_used: true,
        on_off: true
    },
    {
        as_index: 0,
        as_install_used: true,
        id: "laser_forward_obstacle",
        install_used: true,
        on_off: true
    },
    {
        as_index: 0,
        as_install_used: true,
        id: "laser_left_middle_obstacle",
        install_used: true,
        on_off: true
    },
    {
        as_index: 0,
        as_install_used: true,
        id: "laser_left_obstacle",
        install_used: true,
        on_off: true
    },
    {
        as_index: 0,
        as_install_used: true,
        id: "laser_nav",
        install_used: true,
        on_off: true
    },
    {
        as_index: 0,
        as_install_used: true,
        id: "laser_rear_left_obstacle",
        install_used: true,
        on_off: true
    },
    {
        as_index: 0,
        as_install_used: true,
        id: "laser_rear_nav",
        install_used: true,
        on_off: true
    },
    {
        as_index: 0,
        as_install_used: true,
        id: "laser_rear_obstacle",
        install_used: true,
        on_off: true
    },
    {
        as_index: 0,
        as_install_used: true,
        id: "laser_rear_right_obstacle",
        install_used: true,
        on_off: true
    },
    {
        as_index: 0,
        as_install_used: true,
        id: "laser_right_middle_obstacle",
        install_used: true,
        on_off: true
    },
    {
        as_index: 0,
        as_install_used: true,
        id: "laser_right_obstacle",
        install_used: true,
        on_off: true
    }
];

// VDA5050里面的传感器避障选择
export const avoidMapList: SelectProps["options"] = [
    {
        label: "默认避障",
        value: 31
    },
    {
        label: "自定义1",
        value: 24
    },
    {
        label: "自定义2",
        value: 23
    },
    {
        label: "自定义3",
        value: 22
    },
    {
        label: "自定义4",
        value: 21
    }
];

interface ExtendMenuProps extends Omit<MenuProps, "items"> {
    key: string;
    label?: React.ReactNode;
    danger?: boolean;
    enable: string[];
    disabled?: boolean;
}

// 画布菜单项
export const menuItems: ExtendMenuProps[] = [
    {
        key: "batchDelete",
        label: "批量删除",
        danger: true,
        enable: ["stage"]
        // disabled: !(!!selectShapes?.length),
        // icon: <DeleteOutlined />
    },
    {
        key: "evenlyInsertNodes",
        label: "等距插入节点",
        enable: ["stage"]
    },
    {
        key: "alignTwoPoints",
        label: "两点对齐",
        enable: ["stage"]
    },
    {
        key: "createNodeByRobot",
        label: "根据车体坐标创建节点",
        enable: ["robot"]
    },
    {
        key: "delete",
        label: "删除",
        danger: true,
        enable: ["node", "edge"]
        // icon: <DeleteOutlined />
    },
    {
        key: "selectReverseEdge",
        label: "选中反向路径",
        enable: ["edge"]
    },
    {
        key: "addReverseEdge",
        label: "添加反向路径",
        enable: ["edge"]
    },
    // 框选同向路径拆分为两个并列菜单（SPEC_brush_same_direction_split）：
    // 「框选拓扑同向路径」沿 v2（brush_same_direction_contextmenu）的拓扑双向 BFS 语义；
    // 「框选方向同向路径」按弦方向角度完全一致筛选（不做连通性要求）。
    // enable 覆盖右键边/节点/空白三种命中（不含 robot——右键车体是"根据车体坐标创建节点"场景）；
    // 可点条件（恰好左键选中 1 条路径）由 ContextMenu 按 selectShapes 动态置灰控制（v2 §4.1）
    {
        key: "brushSelectSameDir",
        label: "框选拓扑同向路径",
        enable: ["node", "edge", "stage"]
    },
    {
        key: "brushSelectSameAngle",
        label: "框选方向同向路径",
        enable: ["node", "edge", "stage"]
    },
    // 「选择附近元素…」：右键空白 / 节点 / 路径时均可出现（SPEC §3.1-§3.2）
    // hover 展开二级候选列表（来自右键时计算的 nearbyCandidates），点选后自动选中连通分量。
    {
        key: "selectNearbyElements",
        label: "选择附近元素",
        enable: ["stage", "node", "edge"]
    },
    // 独占区/三方交管 拆分为 4 个单向一级项（D1 + D2 + D10 + D17 + D23）：
    // 类型成对排列（添加/移除 × 独占区/三方交管），移除两项 danger（红），添加两项不 danger。
    // enable 沿用原 exclusiveGroup/trafficGroup 的 ["node","edge","stage"]（B5 扩展 stage 批量入口）。
    {
        key: "addToExclusiveGroup",
        label: "添加独占区",
        enable: ["node", "edge", "stage"]
    },
    {
        key: "removeFromExclusiveGroup",
        label: "移除独占区",
        danger: true,
        enable: ["node", "edge", "stage"]
    },
    {
        key: "addToTrafficGroup",
        label: "添加三方交管",
        enable: ["node", "edge", "stage"]
    },
    {
        key: "removeFromTrafficGroup",
        label: "移除三方交管",
        danger: true,
        enable: ["node", "edge", "stage"]
    }
];

/**
 * 等距插入节点可用的节点类型选项（决策 3：全部 7 种）
 * label 与 ManualPane 添加节点菜单的中文文案保持一致；
 * 展示文案统一在组件调用层用 t() 翻译（原“决策 13：中文硬编码，不走 locales”已被 docs/SPEC_constants_i18n.md §D5 覆盖）
 */
export const nodeTypeOptions: { value: NodeType; label: string }[] = [
    { value: "node", label: "节点" },
    { value: "work", label: "工作站点" },
    // { value: "shelf", label: "货架站点" },
    // { value: "warehouse_font", label: "库区前点" },
    // { value: "warehouse_back", label: "库区后点" },
    { value: "park", label: "停靠站点" },
    { value: "charge", label: "充电站点" },
    { value: "warehouse", label: "库区站点" }
];