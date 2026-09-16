/**
 * 基础响应结果
 */
export interface BaseResult {
    code: number;
    message: string;
    timestamp: number;
}

/**
 * 响应结果：返回字符串格式的数据 (通常为任务ID)
 */
export interface ResultString extends BaseResult {
    data: string;
}

/**
 * 导出录制文件请求参数
 */
export interface ExportStartParam {
    /**
     * 地图ID
     */
    mapId: string;
    /**
     * 开始时间戳(毫秒)
     */
    startTs: number;
    /**
     * 结束时间戳(毫秒)
     */
    endTs: number;
}

/**
 * 任务进度数据传输对象
 */
export interface TaskProgressDTO {
    /**
     * 任务ID
     */
    taskId: string;
    /**
     * 状态
     */
    status: string;
    /**
     * 进度(0-100)
     */
    percent: number;
    /**
     * 错误信息(可选)
     */
    errorMessage?: string;
}

/**
 * 响应结果：返回任务进度信息
 */
export interface ResultTaskProgressDTO extends BaseResult {
    data: TaskProgressDTO;
}

/**
 * 查询进度请求参数
 */
export interface ProgressParams {
    /**
     * 任务ID
     */
    taskId: string;
}

/**
 * 车辆事件查询参数
 */
export interface VehicleEventParams {
    /**
     * 地图ID
     */
    mapId: string;
    /**
     * 时间戳
     */
    ts: number;
    /**
     * 录制ID (可选)
     */
    recordId?: number;
}

/**
 * 车辆事件范围DTO
 */
export interface VehicleEventRangeDTO {
    /**
     * 车辆Key
     */
    vehicleKey: string;
    /**
     * 事件类型,可用值:VEHICLE_ERROR,ORDER_SUSPENDED
     */
    eventType: string;
    /**
     * 事件详情JSON
     */
    payloadJson: Record<string, any>;
    /**
     * 开始时间戳(毫秒)
     */
    startTs: number;
    /**
     * 结束时间戳(毫秒)，为空表示进行中
     */
    endTs: number;
}

/**
 * 响应结果：车辆事件范围列表
 */
export interface ResultListVehicleEventRangeDTO extends BaseResult {
    data: VehicleEventRangeDTO[];
}

/**
 * 系统状态查询参数
 */
export interface SystemStatusParams {
    /**
     * 地图ID
     */
    mapId: string;
    /**
     * 开始时间戳(毫秒)
     */
    fromTs: number;
    /**
     * 结束时间戳(毫秒)
     */
    toTs: number;
    /**
     * 录制ID (可选)
     */
    recordId?: number;
}

/**
 * 系统状态范围DTO
 */
export interface SysStatusRangeDTO {
    /**
     * 状态枚举值,可用值:TASK_SUSPENDED,AGV_ERROR
     */
    status: string;
    /**
     * 开始时间戳(毫秒)
     */
    startTs: number;
    /**
     * 结束时间戳(毫秒)，为空表示进行中
     */
    endTs: number;
}

/**
 * 响应结果：系统状态范围列表
 */
export interface ResultListSysStatusRangeDTO extends BaseResult {
    data: SysStatusRangeDTO[];
}

/**
 * 交管原因查询参数
 */
export interface TrafficReasonParams {
    /**
     * 地图ID
     */
    mapId: string;
    /**
     * 车辆Key
     */
    vehicleKey: string;
    /**
     * 时间戳
     */
    ts: number;
    /**
     * 录制ID (可选)
     */
    recordId?: number;
}

/**
 * 简易车辆信息
 */
export interface SimpleVehicleInfo {
    key: string;
    name: string;
}

/**
 * 简易交管原因记录
 */
export interface SimpleTrafficReasonRecord {
    /**
     * 锁定车辆信息
     */
    lockedVehicle: SimpleVehicleInfo;
    /**
     * 时间
     */
    time: string;
    /**
     * 交管详情
     */
    trafficDetail: string;
    /**
     * 参数列表
     */
    params: string[];
    /**
     * 交管类型名称
     */
    trafficTypeName: string;
}

/**
 * 响应结果：简易交管原因记录
 */
export interface ResultSimpleTrafficReasonRecord extends BaseResult {
    data: SimpleTrafficReasonRecord;
}

/**
 * 回放帧列表查询参数
 */
export interface PlaybackFramesParams {
    /**
     * 地图ID
     */
    mapId: string;
    /**
     * 开始时间戳(毫秒)
     */
    fromTs: number;
    /**
     * 结束时间戳(毫秒)
     */
    toTs: number;
    /**
     * 录制ID (可选)
     */
    recordId?: number;
}

/**
 * 简易电池状态
 */
export interface SimpleBatteryState {
    batteryCharge: number;
    batteryVoltage: number;
    batteryHealth: number;
    charging: boolean;
}

/**
 * 简易AGV尺寸
 */
export interface SimpleAGVDimension {
    length: number;
    width: number;
    centerOffset: number;
    loadLength: number;
    loadWidth: number;
}

/**
 * 简易AGV位置
 */
export interface SimpleAgvPosition {
    x: number;
    y: number;
    theta: number;
}

/**
 * 简易速度
 */
export interface SimpleVelocity {
    vx: number;
    vy: number;
    omega: number;
}

/**
 * 简易交管形状资源
 */
export interface SimpleTrafficShapeResources {
    lockedRectangles: any[];
    applyingRectangles: any[];
}

/**
 * 错误引用信息
 */
export interface ErrorReference {
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

/**
 * 错误条目
 */
export interface ErrorEntry {
    errorType: string;
    errorReferences: ErrorReference[];
    errorDescription: string;
    errorLevel: string;
    /** 描述译文列表，按当前语言匹配展示 */
    errorDescriptionTranslations: TranslationItem[];
    /** 处理建议译文列表，按当前语言匹配展示 */
    errorHintTranslations: TranslationItem[];
}

/**
 * 简易车辆推送记录
 */
export interface SimpleVehiclePushRecord {
    agvKey: string;
    agvName: string;
    type: number;
    orderTaskKey: string;
    /**
     * 可用值:IN_QUEUE,OUT_QUEUE,PROCESSING,HANG,CANCELLED,SUCCEEDED,FAILED
     */
    orderState: string;
    /**
     * 可用值:ONLINE,OFFLINE,CONNECTIONBROKEN
     */
    connectionState: string;
    batteryState: SimpleBatteryState;
    agvDimension: SimpleAGVDimension;
    agvPosition: SimpleAgvPosition;
    velocity: SimpleVelocity;
    trafficShapeResources: SimpleTrafficShapeResources;
    /**
     * 可用值:IDLE,CHARGE,PROCESSING,TRAFFIC,AVOID,BRAKE,ERROR
     */
    vehicleProcStatus: string;
    /**
     * 可用值:ENABLE,DISABLE
     */
    dispatchState: string;
    errorEntryList: ErrorEntry[];
    paused: boolean;
    loaded: boolean;
}

/**
 * 回放帧DTO
 */
export interface PlaybackFrameDTO {
    /**
     * 帧时间戳(毫秒)
     */
    ts: number;
    /**
     * 车辆数据列表
     */
    vehicles: SimpleVehiclePushRecord[];
}

/**
 * 响应结果：回放帧列表
 */
export interface ResultListPlaybackFrameDTO extends BaseResult {
    data: PlaybackFrameDTO[];
}

/**
 * 下载文件请求参数
 */
export interface DownloadParams {
    /**
     * 任务ID
     */
    taskId: string;
}

/**
 * 车辆状态查询参数
 */
export interface VehicleStateParams {
    /**
     * 车辆Key
     */
    vehicleKey: string;
}

/**
 * 车辆状态信息
 */
export interface VehicleStateDTO {
    agvKey: string;
    agvName: string;
    type: number;
    orderKey: string;
    orderName: string;
    orderState: string;
    connectionState: string;
    safetyState: {
        fieldViolation: boolean;
        estop: string;
    };
    batteryState: {
        batteryCharge: number;
        batteryVoltage: number;
        batteryHealth: number;
        charging: boolean;
        reach: number;
    };
    agvDimension: {
        length: number;
        width: number;
        centerOffset: number;
        loadLength: number;
        loadWidth: number;
    };
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
    };
    vehicleProcStatus: string;
    dispatchState: string;
    paused: boolean;
    loaded: boolean;
    createTime: number;
}

/**
 * 响应结果：车辆状态信息
 */
export interface ResultVehicleStateDTO extends BaseResult {
    data: VehicleStateDTO;
}

/**
 * 简易车辆信息
 */
export interface SimpleVehicle {
    /**
     * 车辆唯一key
     */
    key: string;
    /**
     * 车辆名称
     */
    name: string;
}

/**
 * 状态码
 */
export interface StatusCode {
    message: string;
    code: number;
}

/**
 * 交管原因
 */
export interface TrafficReason {
    applyingVehicle: SimpleVehicle;
    lockedVehicle: SimpleVehicle;
    /**
     * 交管类型,可用值:collision,nodeEdgeGroup,position,deadlockPrediction,deviceApply,tripartiteTraffic
     */
    trafficType: string;
    /**
     * 交管时间
     */
    time: string;
    statusCode: StatusCode;
    /**
     * 获取交管详情(国际化)
     */
    trafficDetail: string;
    /**
     * 申请的资源id
     */
    applyingStepIds: string[];
    /**
     * 参数
     */
    params: string[];
    /**
     * 获取交管类型名称(国际化)
     */
    trafficTypeName: string;
}

/**
 * 响应结果：交管原因
 */
export interface ResultTrafficReason extends BaseResult {
    data: TrafficReason;
}

/**
 * 车辆参数
 */
export interface VehicleParam {
    /**
     * 车辆唯一key
     */
    vehicleKey?: string;
}

/**
 * 空响应结果
 */
export interface ResultVoid extends BaseResult {
    data: Record<string, any>;
}

/**
 * 删除已导入录制文件参数
 */
export interface DeleteImportRecordingParams {
    /**
     * 录制文件ID
     */
    id: number;
}

/**
 * 分页查询已导入录制文件参数
 */
export interface ImportRecordingPageParams {
    /**
     * 每页的数量
     */
    pageSize?: number;
    /**
     * 当前的页码
     */
    pageNo?: number;
    /**
     * 关键字(fileName/name)
     */
    keyword?: string;
}

/**
 * 已导入录制文件记录
 */
export interface ImportRecording {
    /**
     * 记录ID
     */
    id: number;
    /**
     * 文件名
     */
    fileName: string;
    /**
     * 地图ID
     */
    mapId: string;
    /**
     * 名称
     */
    name: string;
    /**
     * 开始时间
     */
    startTs: string;
    /**
     * 结束时间
     */
    endTs: string;
    /**
     * 文件哈希
     */
    fileHash: string;
    /**
     * 创建时间
     */
    createdAt: string;
}

/**
 * 分页数据：已导入录制文件
 */
export interface PageImportRecording {
    /**
     * 记录列表
     */
    records: ImportRecording[];
    /**
     * 总数
     */
    total: number;
    /**
     * 每页大小
     */
    size: number;
    /**
     * 当前页码
     */
    current: number;
    /**
     * 总页数
     */
    pages: number;
}

/**
 * 响应结果：分页已导入录制文件
 */
export interface ResultPageImportRecording extends BaseResult {
    data: PageImportRecording;
}

/**
 * 查询导入文件的地图信息参数
 */
export interface GetImportMapInfoParams {
    /**
     * 录制文件ID
     */
    id: number;
}

/**
 * 动作参数
 */
export interface ActionParameter {
    key: string;
    value: any;
}

/**
 * 动作
 */
export interface Action {
    /**
     * 动作类型
     */
    actionType: string;
    /**
     * 动作唯一id
     */
    actionId: string;
    /**
     * 动作描述
     */
    actionDescription: string;
    /**
     * 阻塞类型,可用值:NONE,SOFT,HARD
     */
    blockingType: string;
    /**
     * 动作参数
     */
    actionParameters: ActionParameter[];
}

/**
 * 节点
 */
export interface MapNode {
    /**
     * 节点id
     */
    id: string;
    /**
     * 节点名称
     */
    name: string;
    /**
     * 节点类型,可用值:node,warehouse,park,charge,work
     */
    type: string;
    mapId: string;
    allowVehicleGroups: string[];
    /**
     * 关联的充电退出点
     */
    enterChargeStationId: string;
    /**
     * x坐标(m/米)
     */
    x: number;
    /**
     * y坐标(m/米)
     */
    y: number;
    /**
     * 角度[π,-π]
     */
    angle: number;
    /**
     * 动作
     */
    actions: Action[];
    /**
     * 用户自定义属性
     */
    userDefinedProperties: Record<string, any>;
}

/**
 * 边
 */
export interface MapEdge {
    /**
     * 边id
     */
    id: string;
    /**
     * 边名称
     */
    name: string;
    mapId: string;
    /**
     * 边类型,可用值:LINE,BEZIER
     */
    edgeType: string;
    /**
     * 起点x坐标(m/米)
     */
    sx: number;
    /**
     * 起点y坐标(m/米)
     */
    sy: number;
    /**
     * 终点x坐标(m/米)
     */
    ex: number;
    /**
     * 终点y坐标(m/米)
     */
    ey: number;
    /**
     * 贝塞尔靠近起点的控制点x坐标(m/米)
     */
    cx: number;
    /**
     * 贝塞尔靠近起点的控制点y坐标(m/米)
     */
    cy: number;
    /**
     * 贝塞尔靠近终点的控制点x坐标(m/米)
     */
    dx: number;
    /**
     * 贝塞尔靠近终点的控制点y坐标(m/米)
     */
    dy: number;
    /**
     * 是否为倒退路径
     */
    isBackEdge: boolean;
    /**
     * 路径最大线速度,单位m/s,0表示无限制
     */
    limitV: number;
    /**
     * 路径代价,默认路径长度(m/米)
     */
    cost: number;
    /**
     * 路径类型:0:na,1:load,2:free
     */
    loadType: number;
    /**
     * 路径绑定的车型组
     */
    allowVehicleGroups: string[];
    /**
     * agv避障方案
     */
    avoidMap: number;
    /**
     * 动作
     */
    actions: Action[];
    /**
     * 自定义属性
     */
    userDefinedProperties: Record<string, any>;
    snodeId: string;
    enodeId: string;
    sfacing: number;
    efacing: number;
}

/**
 * 区域
 */
export interface MapArea {
    /**
     * 区域id
     */
    id: string;
    /**
     * 区域名称
     */
    name: string;
    /**
     * 区域类型(避障区域,减速区域)
     */
    type: number;
    /**
     * 区域左上角x坐标
     */
    paX: number;
    /**
     * 区域左上角y坐标
     */
    paY: number;
    /**
     * 区域右上角x坐标
     */
    pbX: number;
    /**
     * 区域右上角y坐标
     */
    pbY: number;
    /**
     * 区域右下角x坐标
     */
    pcX: number;
    /**
     * 区域右下角y坐标
     */
    pcY: number;
    /**
     * 区域左下角x坐标
     */
    pdX: number;
    /**
     * 区域左下角y坐标
     */
    pdY: number;
    /**
     * 用户自定义属性
     */
    userDefinedProperties: Record<string, any>;
    cx: number;
    cy: number;
}

/**
 * 点边组合
 */
export interface NodeEdgeGroup {
    /**
     * 点边组合唯一id
     */
    id: string;
    /**
     * 点边组合名称
     */
    name: string;
    /**
     * 点边组合包含的边id
     */
    edgeIds: string[];
    /**
     * 点边组合包含的节点id
     */
    nodeIds: string[];
    /**
     * 用户自定义属性
     */
    userDefinedProperties: Record<string, any>;
}

/**
 * 地图JSON结构
 */
export interface MapJson {
    /**
     * 节点列表
     */
    nodes: MapNode[];
    /**
     * 边列表
     */
    edges: MapEdge[];
    /**
     * 区域列表
     */
    areas: MapArea[];
    /**
     * 点边组合列表；旧导入文件可能缺该字段，故为可选（运行时无影响）
     */
    nodeEdgeGroups?: NodeEdgeGroup[];
}

/**
 * 导入文件的地图历史信息
 */
export interface ImportMapHistory {
    /**
     * 录制ID
     */
    recordingId: number;
    /**
     * 地图ID
     */
    mapId: string;
    /**
     * 地图名称
     */
    mapName: string;
    /**
     * 地图图片文件名
     */
    imageFileName: string;
    /**
     * 地图JSON数据
     */
    mapJson: MapJson;
    /**
     * 地图图片(Base64)
     */
    mapImage: string;
    /**
     * 地图资源(Base64)
     */
    mapResource: string;
}

/**
 * 响应结果：导入文件的地图信息
 */
export interface ResultImportMapHistory extends BaseResult {
    data: ImportMapHistory;
}

