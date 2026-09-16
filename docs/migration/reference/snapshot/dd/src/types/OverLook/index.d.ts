import type { DescriptionsProps } from "antd";

export interface SimpleMapList {
    mapId: string;
    mapName: string;
}

export interface StageSize {
    width: number;
    height: number;
}

export interface TooltipTypes {
    visible: boolean;
    description?: DescriptionsProps["items"];
    vehicleKey?: string;
    clientX?: number;
    clientY?: number;
}

export interface OverlayVisible {
    nodeLabel: boolean;
    edgeLabel: boolean;
    traffic: boolean;
    robot: boolean;
    grid: boolean;
    /** 是否显示路径夹角（节点上相邻 edge 之间的角度标记） */
    angle: boolean;
    /** 是否显示路径上的三方设备图标（电梯/自动门/风淋门/交通灯） */
    device: boolean;
    /** 是否显示节点/路径上的动作角标（SPEC D14，默认 false，用户按需开启） */
    actions: boolean;
    /** 载货避障着色是否可见（默认 false，SPEC edge_attribute_color_toggle） */
    loadSecurityColor: boolean;
    /** 空载避障着色是否可见（默认 false，SPEC edge_attribute_color_toggle） */
    freeSecurityColor: boolean;
    /** 车辆分组着色是否可见（默认 false，SPEC edge_attribute_color_toggle） */
    allowVehicleGroupsColor: boolean;
}

export interface DisplayElementsItem {
    label: React.ReactNode;
    value: string;
}

export interface MockDispatch {
    orderTaskKey: string;
    vehicleKey: string;
}

export interface MockPark {
    vehicleKey: string;
    stationId: string;
    mapId: string;
}

export interface GetStationsItem {
    id: string;
    name: string;
    mapId: string;
}

export interface GetStations {
    mapId: string;
    type: "node" | "warehouse" | "park" | "charge" | "work" | "";
}

export interface MockCharge {
    vehicleKey: string;
    stationId: string;
    mapId: string;
}

export interface Pixel {
    id: string;
    name: string;
    type?: string;
    visible?: boolean;
    x?: number;
    y?: number;
}

export interface ConnectivityVerificationType {
    mapId?: string;
    snodeId: string;
    enodeId: string;
}

export interface GetVehicleStateParams {
    vehicleKey: string;
}

export interface GetVehicleStateData {
    agvKey: string;
    agvName: string;
    type: 1 | 2;
    orderKey: string;
    orderName: string;
    orderState: string;
    connectionState: string;
    safetyState: {
        fieldViolation: boolean;
        estop: string;
    },
    batteryState: {
        batteryCharge: number;
        batteryVoltage: number;
        batteryHealth: number;
        charging: boolean;
        reach: number;
    },
    agvDimension: {
        length: number;
        width: number;
        centerOffset: number;
        loadLength: number;
        loadWidth: number;
    },
    agvPosition: {
        x: number;
        y: number;
        theta: number;
        mapId: string;
        mapDescription: string;
        positionInitialized: boolean;
        localizationScore: number;
        deviationRange: number;
        normal: boolean;
    },
    vehicleProcStatus: string;
    dispatchState: "ENABLE" | "DISABLE";
    paused: boolean;
    loaded: boolean;
    createTime: number;
}
