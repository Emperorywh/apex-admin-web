/**
 * @description 节点的默认属性有哪些 创建节点会用到
 * @date 2025-7-14
 */
import type { MapNode } from "@/utils/typing";

export const defaultNodeProperty: MapNode = {
    id: "",
    name: "",
    type: "node",
    areaId: null,
    mapId: "",
    allowVehicleGroup: null,
    enterChargeStationId: null,
    x: 0,
    y: 0,
    angle: null,
    maxRotateAngle: null,
    /**
     * 新建节点默认不限制叉车旋转。
     * 属性面板可以显式切换为 true 并随节点 data 保存。
     */
    enableLimitForkLiftRotation: true,
    userDefinedProperties: null,
    actions: [],
    addDis: null,
    allowVehicleGroups: null
};
