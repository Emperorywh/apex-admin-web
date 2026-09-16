import type { AgvPosition, MapEdge } from "../typing";

export interface UnRelationSimpleVehicle {
  key: string;
  name: string;
}

export interface VehicleForm {
  agvKey: string;
  agvName: string;
  agvType?: number;
  length: number;
  width: number;
  loadLength: number;
  loadWidth: number;
  centerOffset: number;
  dispatchState: "ENABLE" | "DISABLE";
}


interface QueryVehiclesOrders {
  column: string;
  asc: boolean;
}

export interface QueryVehiclesParams {
  pageSize: number;
  pageNo: number;
  query: string;
}

interface ControlPoints {
  x: number;
  y: number;
  weight: number;
}

export interface EdgeStates {
  edgeId: string;
  sequenceId: number;
  edgeDescription: string;
  released: boolean;
  trajectory: {
    degree: number;
    knotVector: [],
    controlPoints: ControlPoints[];
  }
}

interface Loades {
  loadId: string;
  loadType: string;
  loadPosition: string;
  weight: number;
  boundingBoxReference: {
    x: number;
    y: number;
    z: number;
    theta: number;
  },
  loadDimensions: {
    length: number;
    width: number;
    height: number;
  }
}

interface ActionStates {
  actionId: string;
  actionType: string;
  actionDescription: string;
  actionStatus: "WAITING" | "INITOALIZING" | "RUNNING" | "FINISHED" | "FAILED";
  resultDescription: string;
}

interface ErrorReferences {
  referenceKey: string;
  referenceValue: string;
}

interface Errors {
  errorType: string;
  errorReferences: ErrorReferences[];
  errorDescription: string;
  errorLevel: "WARNING" | "FAIL";

}

interface InfoReferences {
  referenceKey: string;
  referenceValue: string;
}

interface Information {
  infoType: string;
  infoDescription: string;
  infoLevel: "INFO" | "DEBUG";
  infoReferences: InfoReferences[];

}

interface Steps {
  name: string;
  length: number;
  key: string;
  id: string;
  sequenceId: number;
  deadLockStep: boolean;
  cost: number;
  nodeStep: boolean;
  edgeStep: boolean;
  simpleStep: {
    id: string;
    name: string;
    sequenceId: number;
  };
  shapes: object[];
}

interface ActionParameters {
  key: string;
  value: object;
}

interface Actions {
  actionType: string;
  actionId: string;
  actionDescription: string;
  blockingType: string;
  actionParameters: ActionParameters[];
}

interface ExtendedParameters {
  key: string;
  value: object;
}

interface UnFinishedSubTasks {
  key: string;
  orderTaskKey: string;
  station: {
    name: string; // 站点名称
    type: number; // 站点类型
    priority: number; // 站点优先级
    desc: string; // 站点备注信息
    nodeName: string; // 站点所在节点名称
    posYaw: number; // 站点角度
    userDefinedProperties: object; // 用户自定义属性
  },
  route: {
    cost: number;
    steps: Steps[];
  };
  actions: Actions[];
  state: string;
  extendedParameters: ExtendedParameters[];
  startExecuteTime: string;
  finalTime: string;

}

interface ExtendParameters {
  key: string;
  value: object;
}

interface FutureTrafficSegments {
  steps: object[];
  length: number;
  cost: number;
  sequenceId: number;
}

interface Nodes {
  name: string;
  x: number;
  y: number;
  desc: string;
  userDefinedProperties: object;
}

interface SendOrders {
  headerId: number;
  timestamp: string;
  version: string;
  manufacturer: string;
  serialNumber: string;
  orderId: string;
  orderUpdateId: number;
  zoneSetId: string;
  nodes: Nodes[];
  edges: MapEdge[];
  maxSequence: number;

}

interface SendActionDeque {
  headerId: number;
  timestamp: string;
  version: string;
  manufacturer: string;
  serialNumber: string;
  actions: object[];
}

interface Maps {
  mapId: string;
  mapVersion: string;
  mapDescription: string;
  mapStatus: "ENABLED" | "DISABLED"
}

interface NodeStates {
  nodeId: string;
  sequenceId: number;
  nodeDescription: string;
  nodePosition: {
    x: number;
    y: number;
    theta: number;
    allowedDeviationXY: number;
    allowedDeviationTheta: number;
    mapId: string;
    mapDescription: string;
  },
  released: true
}

interface Records {
  headerId: number;
  timestamp: string;
  version: string;
  manufacturer: string;
  serialNumber: string;
  key: string;
  name: string;
  vehicleType: number;
  agvDimension: {
    length: number;
    width: number;
    loadLength: number;
    loadWidth: number;
    centerOffset: number;
    diagonal: number;
  },
  state: {
    headerId: number;
    timestamp: string;
    version: string;
    manufacturer: string;
    serialNumber: string;
    maps: Maps[];
    orderId: string;
    orderUpdateId: number;
    zoneSetId: string;
    lastNodeId: string;
    lastNodeSequenceId: number;
    driving: boolean;
    paused: boolean;
    newBaseRequest: boolean;
    distanceSinceLastNode: number;
    operatingMode: "AUTOMATIC" | "SEMIAUTOMATIC" | "MANUAL" | "SERVICE" | "TEACHIN";
    nodeStates: NodeStates[];
    edgeStates: EdgeStates[];
    agvPosition: AgvPosition;
    velocity: {
      vx: number;
      vy: number;
      omega: number;
      running: boolean;
    },
    loads: Loades[];
    actionStates: ActionStates[];
    batteryState: {
      batteryCharge: number;
      batteryVoltage: number;
      batteryHealth: number;
      charging: boolean;
      reach: number;
    },
    errors: Errors[];
    information: Information[];
    safetyState: {
      fieldViolation: boolean;
      estop: "AUTOACK" | "MANUAL" | "REMOTE" | "NONE";
    },
    onNode: boolean;
  };
  connectionState: "ONLINE" | "OFFLINE" | "CONNECTIONBROKEN";
  orderTask: {
    key: string;
    name: string;
    upperKey: string;
    orderSequenceKey: string;
    unFinishedSubTasks: UnFinishedSubTasks[];
    finishedSubTasks: [];
    orderTaskType: string;
    state: string;
    startExecuteTime: string;
    createTime: string;
    finalTime: string;
    priority: number;
    appointVehicleKey: string;
    appointVehicleName: string;
    appointVehicleGroupKey: string;
    appointVehicleGroupName: string;
    processingVehicle: {
      key: string;
      name: string;
    },
    extendParameters: ExtendParameters[];
    hangReason: string;
    cancelReason: string;
    failReason: string;
    interruptAble: boolean;
    resumeAble: boolean;
    firstMoveSubTask: object;
    curSubTask: object;
    work: boolean;
  },
  orderSequenceKey: string;
  lastOrderTaskFinalTime: string;
  lastBatteryMaintenanceTime: string;
  dispatchState: "ENABLE" | "DISABLE";
  createTime: string;
  task: {
    futureTrafficSegments: FutureTrafficSegments[];
    applyingTrafficSegment: {
      steps: object[];
      length: number;
      cost: number;
      sequenceId: number;
    };
    sendOrders: SendOrders[];
    appliedSteps: object[];
    sendSequenceId: number;
    maxSequenceId: number;
    sendOrderId: string;
    sendActionDeque: SendActionDeque[];
    interactingWithDevice: boolean;
    waitForOrder: boolean;
  }
}

interface Orders {
  column: string;
  asc: boolean;
}

export interface VehicleResultData {
  records: Records[];
  total: number;
  size: number;
  current: number;
  orders: Orders[];
  optimizeCountSql: object;
  searchCount: object;
  optimizeJoinOfCountSql: boolean;
  maxLimit: number;
  countId: string;
  pages: number;
}

export interface DeleteVehicleParams {
  key: string;
}

/**
 * 车辆指令操作类型
 * - PAUSE 暂停 / CONTINUE 继续 / ENABLED 启用 / DISABLED 禁用
 */
export type VehicleOperateType = "PAUSE" | "CONTINUE" | "ENABLED" | "DISABLED";

export interface AllVehicleOperate {
  /** 车辆key集合（不传或空数组表示对全部车辆操作） */
  vehicleKeys?: string[];
  /** 操作类型 */
  operate: VehicleOperateType;
}

export interface VehicleOperate {
  /** 车辆key */
  vehicleKey: string;
  /** 操作类型 */
  operate: VehicleOperateType;
}

export interface GetVehicleType {
  vehicleKey: string;
}
