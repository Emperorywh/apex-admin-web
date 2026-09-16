/**
 * @description 边的高亮颜色配置，当边数据中包含特定属性时使用对应颜色
 * @date 2026-3-27
 */
export const edgeHighlightColors = {
    allowVehicleGroups: "#9C27B0",
    loadSecurity: "#00BCD4",
    freeSecurity: "#09eb25"
} as const;

/**
 * 路径属性着色开关状态（SPEC edge_attribute_color_toggle）
 * 每个字段对应一个独立开关：true = 该属性着色可见，false = 隐藏。
 * 三个画布各自维护一份，由用户通过展示菜单按属性独立控制。
 */
export interface EdgeColorVisible {
    /** 载货避障着色是否可见 */
    loadSecurity: boolean;
    /** 空载避障着色是否可见 */
    freeSecurity: boolean;
    /** 车辆分组着色是否可见 */
    allowVehicleGroups: boolean;
}

/**
 * 根据边的 data 属性 + 开关状态计算描边颜色（SPEC edge_attribute_color_toggle）。
 * 优先级（仅在被开启的属性中比较）：allowVehicleGroups > loadSecurity > freeSecurity。
 * 某属性开关关闭时，即使 data 中有该属性也跳过（D3），向下检查下一个已开启的属性。
 *
 * 第三个参数 enabled 为必传（无默认值）：确保所有调用方显式传入开关状态，
 * 不会因遗漏而意外显示颜色。默认关闭语义由各画布的初始 attr / prop 值保证。
 */
export const getEdgeStrokeColor = (
    data: Record<string, unknown>,
    defaultStroke: string,
    enabled: EdgeColorVisible,
): string => {
    if (
        enabled.allowVehicleGroups &&
        Array.isArray(data?.allowVehicleGroups) &&
        data.allowVehicleGroups.length > 0
    ) {
        return edgeHighlightColors.allowVehicleGroups;
    }
    if (enabled.loadSecurity && data?.loadSecurity) {
        return edgeHighlightColors.loadSecurity;
    }
    if (enabled.freeSecurity && data?.freeSecurity) {
        return edgeHighlightColors.freeSecurity;
    }
    return defaultStroke;
};
