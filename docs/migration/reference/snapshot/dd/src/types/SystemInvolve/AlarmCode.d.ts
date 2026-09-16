/**
 * 多语言告警码描述记录
 */
export interface AlarmCodeRecord {
    /** 语言类型 */
    locale?: string;
    /** 描述 */
    desc?: string;
    /** 线索 */
    hint?: string;
}

/**
 * 车辆告警码记录
 */
export interface AGVAlarmCodeRecord {
    id: number;
    createTime?: string;
    updateTime?: string;
    createUser?: string;
    updateUser?: string;
    /** 告警码 */
    alarmCode?: string;
    /** 多语言告警描述集合 */
    alarmCodeRecords?: AlarmCodeRecord[];
}

/**
 * 分页查询车辆告警码返回数据
 */
export interface AGVAlarmCodeData {
    records: AGVAlarmCodeRecord[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

/**
 * 创建车辆告警码请求参数
 */
export interface AGVAlarmCodeAddParam {
    /** 告警码 */
    alarmCode?: string;
    /** 多语言告警描述 */
    alarmCodeRecords?: AlarmCodeRecord[];
}

/**
 * 更新车辆告警码请求参数
 */
export interface AGVAlarmCodeUpdateParam {
    id: number;
    /** 告警码 */
    alarmCode?: string;
    /** 多语言告警描述 */
    alarmCodeRecords?: AlarmCodeRecord[];
}

/**
 * 删除车辆告警码请求参数
 */
export interface AGVAlarmCodeParam {
    /** 告警码 */
    alarmCode?: string;
}

/**
 * 分页查询车辆告警码请求参数
 */
export interface AGVAlarmCodePageParam {
    /** 每页数量 */
    pageSize?: number;
    /** 当前页码 */
    pageNo?: number;
    /** 告警码（模糊查询） */
    alarmCode?: string;
}
