/**
 * @description 地图推送记录相关类型定义
 * 对应后端接口 /fms/v1/dispatcher/mapPushRecord/*
 * @date 2026-7-16
 */

/**
 * 地图推送状态
 * - WAITING 等待推送
 * - RUNNING 推送中
 * - FAILED 推送失败
 * - SUCCEEDED 推送成功
 * - CANCELLED 已取消
 */
export type MapPushState = "WAITING" | "RUNNING" | "FAILED" | "SUCCEEDED" | "CANCELLED";

/**
 * 重新推送地图 - 请求参数（对应 MapRePushParam）
 * 取消推送地图（cancelPushMap）的请求体与之结构一致，直接复用本类型
 */
export interface MapRePushParam {
    /** 推送记录的id */
    mapPushRecordId: number;
    /** 推送子记录的id列表（不传或空数组表示对该记录下的全部子记录重新推送/取消推送） */
    mapPushSubRecordIds?: number[];
}

/**
 * 分页查询地图推送记录 - 请求参数
 */
export interface PageMapPushRecordsParams {
    /** 每页的数量 */
    pageSize: number;
    /** 当前的页码 */
    pageNo: number;
}

/**
 * 地图推送子记录（单台车辆的推送明细）
 */
export interface MapPushSubRecord {
    id: number;
    createTime?: string;
    updateTime?: string;
    createUser?: string;
    updateUser?: string;
    /** 推送的记录id */
    mapPushRecordId: number;
    /** 推送唯一key */
    subRecordKey: string;
    /** 推送的车辆key */
    vehicleKey: string;
    /** 推送的车辆名称 */
    vehicleName: string;
    /** 地图推送状态 */
    mapPushState: MapPushState;
    /** 地图推送完成时间 */
    finishTime?: string;
    /** 地图推送失败原因 */
    failReason?: string;
    /** 地图推送取消原因 */
    cancelReason?: string;
    /** 地图推送等待原因 */
    waitReason?: string;
}

/**
 * 地图推送记录（一次推送批次，含多台车辆子记录）
 */
export interface MapPushRecord {
    id: number;
    createTime?: string;
    updateTime?: string;
    createUser?: string;
    updateUser?: string;
    /** 推送的地图唯一key */
    mapId: string;
    /** 推送的地图名称 */
    mapName: string;
    /** 推送的地图版本 */
    mapVersion: string;
    /** 推送的地图下载地址 */
    mapDownloadLink: string;
    /** 是否推送slam底图 */
    enabledPushSlamMap: boolean;
    /** 推送的地图子记录列表 */
    mapPushSubRecords: MapPushSubRecord[];
}
