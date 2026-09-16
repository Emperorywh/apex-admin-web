import type dayjs from "dayjs";
export interface RecordStatistics {
  cancelNumber: number;
  executingNumber: number;
  failNumber: number;
  hangNumber: number;
  queuingNumber: number;
  successNumber: number;
  totalNumber: number;
}

export interface PageOrderRecordsParams {
  pageSize?: number;
  pageNo?: number;
  query?: string; // 订单编号或key
  orderType?: "WORK" | "CHARGE" | "PARK" | "BATTERY_MAINTAIN" | "";
  orderState?: "IN_QUEUE" | "OUT_QUEUE" | "PROCESSING" | "HANG" | "CANCELLED" | "SUCCEEDED" | "FAILED" | "";
  startCreateTime?: string;
  endCreateTime?: string;
  startFinalTime?: string;
  endFinalTime?: string;
  vehicleKey?: string;
  startExecutionTime?: string;
  endExecutionTime?: string;
  createTime?: [dayjs.ConfigType, dayjs.ConfigType];
  finalTime?: [dayjs.ConfigType, dayjs.ConfigType];
  executionTime?: [dayjs.ConfigType, dayjs.ConfigType];
  mapId?: string;
}

export interface PageOrderTasksParams {
  mapId?: string;
  pageSize?: number;
  pageNo?: number;
  query?: string; // 订单编号或key
  orderState?: "IN_QUEUE" | "OUT_QUEUE" | "PROCESSING" | "HANG" | "CANCELLED" | "SUCCEEDED" | "FAILED" | "";
  endFinalTime?: string;
  vehicleKey?: string;
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

interface OrderMissions {
  id: number;
  createTime: string;
  updateTime: string;
  createUser: number;
  updateUser: number;
  orderMissionKey: string;
  orderRecordKey: string;
  mapId: string;
  mapName: string;
  stationId: string;
  stationName: string;
  actions: Actions[];
  missionState: string;
  extendParameters: ActionParameters[];
  loadDimension: {
    length: number;
    width: number;
  },
  startExecuteTime: string;
  finalTime: string;
  station: {
    id: string;
    name: string;
    type: number;
    areaId: string;
    mapId: string;
    allowVehicleGroup: [],
    enterChargeStationId: string;
    x: number;
    y: number;
    angle: number;
    userDefinedProperties: object;
  }
}

interface ExtendParameters {
  key: string;
  value: object;
}

interface Records {
  id: number;
  createTime: string;
  updateTime: string;
  createUser: number;
  updateUser: number;
  upperKey: string;
  orderKey: string;
  orderName: string;
  orderType: string;
  taskId?: string;
  priority: number;
  appointVehicleKey: string;
  appointVehicleName: string;
  appointVehicleGroupKey: string;
  appointVehicleGroupName: string;
  orderMissions: OrderMissions[];
  extendParameters: ExtendParameters[];
  executeVehicleKey: string;
  executeVehicleName: string;
  orderState: "IN_QUEUE" | "OUT_QUEUE" | "PROCESSING" | "HANG" | "CANCELLED" | "SUCCEEDED" | "FAILED";
  vehicleLockKey: string;
  vehicleLockStatus: string;
  startExecuteTime: string;
  finalTime: string;
  hangReason: string;
  cancelReason: string;
  failReason: string;
}

export interface OrderRecordResult {
  records: Records[];
  total: number;
  size: number;
  current: number;
  orders: [
    {
      "column": "",
      "asc": true
    }
  ],
  optimizeCountSql: object;
  searchCount: object;
  optimizeJoinOfCountSql: boolean;
  maxLimit: number;
  countId: string;
  pages: number;
}

export interface OrderStateEnum {
  chName: string;
  enum: string;
  color: string;
}

export interface TaskOperate {
  orderTaskKey: string;
  cancelReason: string;
  operate: "CMD_ORDER_CANCEL" | "CMD_ORDER_IN_QUEUE_TO_OUT_QUEUE" | "CMD_ORDER_OUT_QUEUE_TO_IN_QUEUE" | "CMD_ORDER_HANG_TO_SKIP" | "CMD_ORDER_HANG_TO_CONTINUE";
}

export interface OperateOptions {
  key: "CMD_ORDER_CANCEL" | "CMD_ORDER_IN_QUEUE_TO_OUT_QUEUE" | "CMD_ORDER_OUT_QUEUE_TO_IN_QUEUE" | "CMD_ORDER_HANG_TO_SKIP" | "CMD_ORDER_HANG_TO_CONTINUE";
  label: string;
  disabled: boolean;
  enabled: string[];
}

export interface MenuInfo {
  key: string;
  keyPath: string[];
  /** @deprecated This will not support in future. You should avoid to use this */
  item: React.ReactInstance;
  domEvent: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>;
}

interface ActionParameters {
  key: string;
  value: object;
}

interface Actions {
  actionType: string;
  actionDescription: string;
  blockingType: string;
  actionParameters: ActionParameters[];
}

interface OrderMission {
  id?: number;
  mapId: string;
  stationId: string;
  // actions: Actions[];
  agvAction?: Actions[];
  agvActionGroup?: Actions[];
  extendParameters: ActionParameters[];
}

export interface CreateOrderRecord {
  upperKey?: string;
  orderName: string;
  priority: number;
  appointVehicleKey?: string;
  appointVehicleGroupKey?: string;
  orderMissions: OrderMission[];
  extendParameters?: ActionParameters[];
  vehicleLockKey?: string;
  vehicleLockStatus?: string;
}

export interface StatisticItem {
  key: string;
  title: string;
  value: string | number;
}
