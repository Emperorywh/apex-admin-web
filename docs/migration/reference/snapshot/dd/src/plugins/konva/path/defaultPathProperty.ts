/**
 * @description 路径的默认属性，添加路径用
 * @date 2025-7-14
 */
import { MapEdge } from "@/utils/typing";
import { defaultAvoid } from "@/constants/mapThrough";

export const defaultPathProperty: MapEdge = {
        id: "",
        name: "",
        mapId: "",
        reverseEdgeId: null,
        edgeType: "LINE",
        sx: 0,
        sy: 0,
        ex: 0,
        ey: 0,
        cx: null,
        cy: null,
        dx: null,
        dy: null,
        isBackEdge: false,
        enableLimitForkLiftReturn: false,
        limitV: 0, // 速度限制
        cost: 0, // 路径的长度
        loadType: 0, // 载货类型 0：所有 1：负载 2：空载
        allowVehicleGroup: [], // 允许通过的车辆分组
        userDefinedProperties: null, // 三方设备的额外属性
        enodeId: "",
        snodeId: "",
        sfacing: 0, // 开始切线的夹角
        efacing: 0, // 结束切线的夹角
        actions: [],
        avoidMap: 0, // 默认的避障范围
        // forward_avoid: defaultAvoid,
        // reverse_avoid: defaultAvoid
        maxFreeSpeed: 1,
        maxLoadSpeed: 1
};
