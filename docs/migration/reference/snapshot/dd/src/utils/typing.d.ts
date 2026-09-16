import type { AvoidType } from "@/types/MapNestModify";
import type { MapInfoVersion } from "@/types/MapVersion";

export type BezierPoints = [number, number, number, number, number, number, number, number];

// 箭头的类型
export type ArrowPoints = [number, number, number, number, number, number];

export type LinePoint = [number, number, number, number];

export interface ActionParameter {
  key: string;
  value: string;
}

export interface ActionType {
  actionType: string;
  actionDescription: string;
  blockingType: string;
  actionParameters: ActionParameter[];
}

export interface MapNode {
  id: string;
  name: string;
  type: "node" | "warehouse" | "park" | "charge" | "work";
  areaId: string | null;
  mapId: string;
  allowVehicleGroup: null;
  enterChargeStationId: null;
  /** 是否高精度点位（最新地图结构新增） */
  highPrecision?: boolean;
  /** 是否启用虚拟停靠站点（最新地图结构新增） */
  enableVirtualParkStation?: boolean;
  /** 是否启用虚拟避让点（最新地图结构新增） */
  enableVirtualAvoidStation?: boolean;
  x: number;
  y: number;
  angle: number | null;
  maxRotateAngle: number | null;
  /**
   * 是否限制叉车在当前节点旋转。
   * true 表示限制，false 表示不限制。
   */
  enableLimitForkLiftRotation: boolean;
  userDefinedProperties: Record<string, unknown> | null,
  actions?: ActionType[];
  addDis: number | null;
  allowVehicleGroups: string[] | null;
}

export interface MapEdge {
  id: string;
  reverseEdgeId: string | null;
  name: string;
  mapId: string;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  cx: number | null;
  cy: number | null;
  dx: number | null;
  dy: number | null;
  // 是否是反向路径
  isBackEdge: boolean;
  // 是否限制车辆回归
  enableLimitForkLiftReturn: boolean;
  limitV: number;
  cost: number;
  loadType: number;
  /** agv载货避障方案（最新地图结构新增） */
  loadSecurity?: number | null;
  /** agv空载避障方案（最新地图结构新增） */
  freeSecurity?: number | null;
  userDefinedProperties: Record<string, unknown> | null;
  snodeId: string;
  enodeId: string;
  efacing: number;
  sfacing: number;
  edgeType: "LINE" | "BEZIER";
  allowVehicleGroup: string[] | null;
  /** 路径绑定的车型组（最新地图结构新增，与 allowVehicleGroup 同义的新字段名） */
  allowVehicleGroups?: string[] | null;
  actions?: ActionType[];
  forward_avoid?: AvoidType[];
  reverse_avoid?: AvoidType[];
  avoidMap?: number;
  maxFreeSpeed?: number;
  maxLoadSpeed?: number;
  /** 以下转速/加减速限制为最新地图结构新增 */
  maxLoadRotationSpeed?: number | null;
  maxFreeRotationSpeed?: number | null;
  maxLoadAcceleration?: number | null;
  maxFreeAcceleration?: number | null;
  maxLoadDeceleration?: number | null;
  maxFreeDeceleration?: number | null;
}

export interface MapJson {
  mapId: string;
  mapDescription: string;
  mapVersion: string | null;
  mapStatus: string;
  floor: number;
  nodes: MapNode[];
  areas: [];
  edges: MapEdge[];
  /** 区域列表（最新地图结构新增，编辑器版本 json 同名字段） */
  zones?: unknown[];
  /** 点边组合（独占区/三方交管区域）列表；后端实际返回该字段，编辑器已在消费（类型债务补声明，运行时无影响） */
  nodeEdgeGroups?: import("@/types/MapNestModify").NodeEdgeGroup[];
}

export interface MapInfo {
  id: number;
  createTime: string;
  updateTime: string;
  createUser: number;
  updateUser: number;
  mapId: string;
  mapName: string;
  floor: number;
  mapState: "ENABLED" | "DISABLED";
  mapVersionId: number;
  mapVersion: string | null;
  mapJson: MapJson;
  currentMapInfoVersion: MapInfoVersion;
}

export interface LineArrows {
  id: string;
  points: number[];
  stroke: string;
}

export interface MountLine {
  id,
  shapeStyle: {
    stroke: string;
    labelFill: string;
    lineWidth: number;
  },
  data: Record<string, unknown>
}

export interface ErrorReferences {
  referenceKey: string;
      referenceValue: string;
}

/**
 * 译文条目：后端 translationKey 仅返回 en_US / zh_CN（POSIX/Java 风格、下划线分隔），
 * 前端按 locale 归一化匹配并做多级回退（详见 ErrorEntryTable 组件）。
 */
export interface TranslationItem {
  translationKey: string;
  translationValue: string;
}

export interface ErrorEntry {
  errorDescription: string;
  errorLevel: string;
  errorReferences: ErrorReferences[];
  errorType: string;
  /** 描述译文列表，按当前语言匹配展示 */
  errorDescriptionTranslations: TranslationItem[];
  /** 处理建议译文列表，按当前语言匹配展示 */
  errorHintTranslations: TranslationItem[];
}

export interface VehicleType {
  agvDimension: {
    length: number;
    width: number;
    loadLength: number,
    loadWidth: number,
    centerOffset: number;
  },
  agvKey: string;
  agvName: string;
  agvPosition: {
    deviationRange: number;
    localizationScore: number;
    mapDescription: string;
    mapId: string;
    normal: boolean;
    positionInitialized: boolean;
    theta: number;
    x: number
    y: number;
  };
  batteryState: {
    batteryCharge: number;
    batteryHealth: number;
    batteryVoltage: number;
    charging: boolean;
    reach: number;
  };
  connectionState: "ONLINE" | "OFFLINE" | "CONNECTIONBROKEN";
  dispatchState: "ENABLE" | "DISABLE";
  errorEntryList: ErrorEntry[];
  trafficShapeResources: {
  applyingRectangles: number[][];
  applyingTrafficEdgeKeys: number[][];
  applyingTrafficNodeKeys: number[][];
  lockedRectangles: number[][];
  lockedTrafficEdgeKeys: number[][];
  lockedTrafficNodeKeys: number[][];
};
type: 1 | 2;
vehicleProcStatus: "IDLE" | "TRAFFIC" | "PROCESSING" | "CHARGE" | "AVOID" | "ERROR" | "BRAKE";
loaded: boolean;
/**
 * 车载货物列表（ws 推送，可能缺省）。
 * 托盘角度取首个货物的 boundingBoxReference.theta，链路各环节均需可选容错。
 */
loads?: {
  boundingBoxReference?: {
    theta?: number;
  };
}[];
orderTaskKey: string;
paused: boolean;
velocity: {
  omega: number, // 旋转速度
    running: boolean,
      vx: number,
        vy: number
}
}

interface Order {
  orderState: "IN_QUEUE" | "OUT_QUEUE" | "PROCESSING" | "HANG" | "CANCELLED" | "SUCCEEDED" | "FAILED" | "";
  orderTaskKey: string;
  orderTaskName: string;
  orderType: "WORK" | "CHARGE" | "PARK" | "BATTERY_MAINTAIN" | "";
  processingVehicle: {
    key: string;
    name: string;
  }
}

export interface SocketDispatcherState {
  vehicles: VehicleType[];
  orderRecords: Order[];
}

export interface RobotRect {
  agvKey: string;
  agvName: string;
  x: number;
  y: number;
  theta: number;
  width: number;
  length: number;
  loadLength: number,
  loadWidth: number,
  centerOffset: number;
  type: 1 | 2;
  batteryCharge: number;
  charging: boolean;
  robotFill: string;
  strokeStyle: string;
  pathFill: string;
  vehicleProcStatus: "IDLE" | "TRAFFIC" | "PROCESSING" | "CHARGE" | "AVOID" | "ERROR" | "BRAKE" | "OFFLINE" | "CONNECTIONBROKEN";
  loaded: boolean;
  orderTaskKey: string;
  connectionState: "ONLINE" | "OFFLINE" | "CONNECTIONBROKEN";
  // dispatchState: "ENABLE" | "DISABLE";
  omega: number;
  vx: number;
  vy: number;
  paused: boolean;
  localizationScore: number;
  errorEntryList: ErrorEntry[];
}

export interface TrafficPath {
  agvKey: string;
  data: string;
}

export interface CurrentMapInfo {
  mapId?: string;
  /**
   * 地图数据加载完成的时间戳
   * GraphStage 异步加载地图数据完成后更新此字段
   * 用于通知 GraphPixel 等组件在正确的时机刷新数据
   */
  mapLoadedAt?: number;
}

export interface MountNode {
  id: string;
  x: number;
  y: number;
  shapeStyle: {
    fill: string;
    stroke: string;
    radius: number;
    lineWidth: number;
    labelFill: string;
  };
  data: Record<string, unknown>;
}

export interface ClientRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KeyValueType {
  key: string;
  value: string | number;
}
