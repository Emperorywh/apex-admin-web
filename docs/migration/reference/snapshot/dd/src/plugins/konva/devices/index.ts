/**
 * @description 路径三方设备图标插件模块统一出口
 * @date 2026-6-27
 *
 * 与 src/plugins/konva/nodes/ 结构对齐，集中提供：
 *   - 设备类型识别 resolveDeviceType（D2：仅读 userDefinedProperties.deviceType）
 *   - 图标配色 deviceStyles（明/暗两套，D15/D16）
 *   - 图标绘制 deviceIconSceneFunc（5 种矢量图标，D6）
 *   - 尺寸/偏移常量与标签让位 helper（供三画布 DeviceLayer 与边 sceneFunc 复用）
 */
export { deviceStyles } from "./deviceStyles";
export type { DeviceColorSet, TrafficLightColors } from "./deviceStyles";
export { deviceIconSceneFunc, deviceIconHitFunc, DEVICE_BASE_RADIUS, DEVICE_NORMAL_OFFSET_RATIO } from "./deviceIconSceneFunc";
export { refreshDeviceIcons } from "./refreshDeviceLayer";

/**
 * 设备图标类型（D2）：四种已知设备 + 未知占位
 */
export type DeviceIconType = "elevator" | "autoDoor" | "airShowerDoor" | "trafficLight" | "unknown";

/**
 * 设备类型中文名（hover 设备图标时用于 tooltip 展示）
 */
export const deviceTypeLabels: Record<DeviceIconType, string> = {
    elevator: "电梯",
    autoDoor: "自动门",
    airShowerDoor: "风淋门",
    trafficLight: "交通灯",
    unknown: "未知设备",
};

/**
 * 设备实时状态（D3 预留接口）：本期恒为 undefined，绘制静态图标
 */
export type DeviceState = {
    /** 设备状态：如门开/关、电梯到达 */
    status?: "idle" | "active" | "error";
    /** 交通灯当前灯色 */
    phase?: "red" | "green" | "yellow";
};

/** 已知的设备类型集合（用于 resolveDeviceType 命中判断） */
const KNOWN_DEVICE_TYPES: readonly DeviceIconType[] = ["elevator", "autoDoor", "airShowerDoor", "trafficLight"];

/**
 * 设备类型识别（D2）：只读 userDefinedProperties.deviceType，不读 applyDeviceOperationType
 *
 * 1. deviceType 命中已知值 → 对应图标
 * 2. deviceType 有值但不在四种已知内 → unknown（占位图标，D12）
 * 3. userDefinedProperties 为空 / 无 deviceType → null（不绘制）
 *
 * 注意（D17）：识别逻辑支持 trafficLight，但不修改编辑器的 deviceTypes 下拉常量，
 * 交通灯数据视为来自后端/导入，仅做展示识别。
 *
 * @param userDefinedProperties 边的 userDefinedProperties（类型声明为 null，运行时为对象）
 */
export const resolveDeviceType = (
    userDefinedProperties: Record<string, unknown> | null | undefined
): DeviceIconType | null => {
    if (!userDefinedProperties) return null;
    const deviceType = (userDefinedProperties as { deviceType?: unknown }).deviceType;
    if (typeof deviceType !== "string" || !deviceType) return null;
    if (KNOWN_DEVICE_TYPES.includes(deviceType as DeviceIconType)) {
        return deviceType as DeviceIconType;
    }
    return "unknown";
};

/**
 * 计算有设备的边，name 标签让位后的位置（位于图标的法线对侧，保证不重叠，SPEC §3.7）
 *
 * @param anchorX anchorY 锚点（路径标签点，canvas 坐标即 y 已取反）
 * @param angle 切线角度（弧度，来自 computeEdgeTangentAngle）
 * @param isBackEdge 是否反向边（与图标偏移侧相反，使标签落在图标对侧）
 * @param offset 偏移量（= DEVICE_BASE_RADIUS × DEVICE_NORMAL_OFFSET_RATIO × scale）
 */
export const computeDeviceLabelPos = (
    anchorX: number, anchorY: number,
    angle: number, isBackEdge: boolean, offset: number
) => {
    // 法线单位向量（canvas 坐标系，切线左侧）
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const iconSign = isBackEdge ? -1 : 1;
    // 标签位于图标的法线对侧（图标在 +iconSign·n，标签在 -iconSign·n）
    return {
        x: anchorX - iconSign * nx * offset,
        y: anchorY - iconSign * ny * offset,
    };
};
