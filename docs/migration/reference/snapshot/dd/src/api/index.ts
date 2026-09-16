/**
 * @description 所有的接口
 * @date 2025-5-22
 */
import { get, post, put } from "./request";
import API from "./api";
import type { SoftwareActivationType, SearchType } from "@/types/typing";
import type { VehicleForm, QueryVehiclesParams, DeleteVehicleParams, AllVehicleOperate, VehicleOperate, GetVehicleType } from "@/types/VehicleDeploy/VehicleType";
import type { VehicleGroupParams, VehicleGroupForm, UpdateVehicleGroup } from "@/types/VehicleDeploy/GroupType";
import type { EditConfigParams } from "@/types/DispatchHub/typing";
import type { PageOrderRecordsParams, TaskOperate, CreateOrderRecord, PageOrderTasksParams } from "@/types/OrderRecord";
import type { MockDispatch, MockPark, GetStations, MockCharge, ConnectivityVerificationType, GetVehicleStateParams } from "@/types/OverLook";
import type { MapInfoSearchParams, DeleteMapParams, UpdateMapType, PullMapType, CreateMapType } from "@/types/MapList";
import type { UpdateMapResourceType } from "@/types/MapNestModify";
//@ts-ignore
import type { LoginType } from "@/types/Login";
import type { PageAutoDoorParams, AutoDoorParams, AutoDoorDeviceKey } from "@/types/TriDevice/AutoDoor";
import type { PageElevators, AddElevator, ElevatorCommand } from "@/types/TriDevice/Elevators";
import type { AddAirDoor, PageAirDoor, AirDoorDeviceKey, AirDoorOpen, AirDoorOperationType } from "@/types/TriDevice/AirShowerDoor";
import type { PageCrossMaps, GetCrossMapStations, CreateCrossMap, DeleteCrossMap } from "@/types/MultipleMaps";
import type { PageAgvActionTypes, AGVActionType, DeleteAgvActionType } from "@/types/ActionControl/AGVActions";
import type { PageSysActionType, SysActionType, DeleteSysAction } from "@/types/ActionControl/SysActions";
import type { PageAGVActionGroupType, AGVActionGroupType, DeleteActionGroup } from "@/types/ActionControl/AGVActionGroup";
import type { GetOrderDetailType } from "@/types/OrderRecord/OrderInfo";
import type { OrderGroupType, PageOrderGroupType, DeleteOrderTemplateType } from "@/types/MissionCluster/MissionCreate";
import type { OrderGroupForm, OrderGroupQueryType, OrderFlowOperationType } from "@/types/MissionCluster/MissionFlow";
import type { SystemVersionParam } from "@/types/SystemInvolve/VersionControl";
import type { SysLogParam, DownloadLogType, PageSysLogsParams, LicenseProofRecord, DataBaseBackupDownloadParam, DataBaseBackupFilesParam } from "@/types/SystemInvolve/SystemLog";
import type { AGVAlarmCodeAddParam, AGVAlarmCodeUpdateParam, AGVAlarmCodeParam, AGVAlarmCodePageParam } from "@/types/SystemInvolve/AlarmCode";
import type { OrderStatisticsParams, OrderQuantityStatisticsParams, TaskStatisticsParam, ResultTaskStatisticsVO } from "@/types/AnalyzeVisual/OrderStatistics";
import type { ResultServerResourceSnapshot } from "@/types/AnalyzeVisual/ServerResource";
import type { PageSystemAlarmRecordsParams, ResultPageSystemAlarmRecord, AlarmStatisticsParam, ResultAlarmStatisticsVO } from "@/types/AnalyzeVisual/SystemAlarmRecord";
import type { AgvStateStatisticsParam, ResultAgvStateStatisticsVO, ResultAgvExecutingTimeStatisticsVO } from "@/types/AnalyzeVisual/VehicleStateStatistics";
import type { DashboardParam, ResultDashboardBoardVO } from "@/types/Dashboard";
import { dropStrategyType, PageParams } from "@/pages/StrategyManage/type";
import type { GetSimpleStrategyType } from "@/types/StrategyManage";
import type { SearchParamsType, ObstacleRecord } from "@/types/ObstacleAvoidance";
import type { TriTrafficRecord, PageTrafficType, TestCommunicationType } from "@/types/TriTraffic";
import type { ModbusElevator, CommandParams } from "@/types/TriDevice/ModbusElevator";
import type { AutoDoorRecord, AutoDoorCommand } from "@/types/TriDevice/ModbusAutodoor";
import type { ChargePileRecord } from "@/types/TriDevice/ModbusChargePie";
import type { LineRecord } from "@/types/TriDevice/ConveyorLine";
import type { ExportStartParam, ProgressParams, DownloadParams, VehicleEventParams, SystemStatusParams, TrafficReasonParams, PlaybackFramesParams, DeleteImportRecordingParams, ImportRecordingPageParams, GetImportMapInfoParams } from "@/types/PlaybackTypings";
import type { PageTrafficLightParams, AddTrafficLightParams, UpdateTrafficLightParams, DeleteTrafficLightParams, TrafficLightRecord } from "@/types/TriDevice/TrafficLight";
import type { PageCarrierParams, CreateCarrierParams, UpdateCarrierParams, DeleteCarrierParams } from "@/types/VehicleDeploy/CarrierType";
import type { MapInfoVersionJsonParam, MapInfoVersionPushParam, MapInfoVersionJsonPublishParam, PageMapInfoVersionsParams, MapInfoVersion, VehicleDownloadMapParam, MapDownloadParam } from "@/types/MapVersion";
import type { MapRePushParam, PageMapPushRecordsParams } from "@/types/MapPushRecord";
import type { AGVNodeMappingUpdateParam, AGVNodeMappingAddParam, AGVNodeMappingParam, AGVNodeMappingPageParam, ResultPageAGVNodeMapping, CollectionNodeSuggestionParam, ResultCollectionNodeSuggestion } from "@/types/VehicleDeploy/NodeMappingType";


const { LOGIN, LOGOUT, DETAIL, GETHARDWAREINFO, SOFTWAREACTIVATION, GETMAPINFO, GETSIMPLEMAPS, GETUNRELATIONSIMPLEVEHICLES, ADDVEHICLE, PAGEVEHICLES, DELETEVEHICLE, UPDATEVEHICLE, PAGEVEHICLEGROUPS, GETTASKCONFIGS, EDITCONFIG, BATCHEDITCONFIGS, ORDERRECORDSTATESTATISTIC, PAGEORDERRECORDS, ORDERTASKOPERATE, MOCKDISPATCH, MOCKPARK, GETSTATIONS, MOCKCHARGE, GETSIMPLEVEHICLES, ADDVEHICLEGROUP, DELETEVEHICLEGROUP, GETTRAFFICREASON, CLEARVEHICLETRAFFICS, UPDATEVEHICLEGROUP, PAGEMAPINFOS, CREATEMAP, DELETEMAP, UPDATEMAP, UPLOADMAP, UPDATEMAPRESOURCE, DOWNLOADMAPINFO, PAGEAUTODOORS, ADDAUTODOOR, GETAUTODOORDRIVERS, GETAUTODOORSTATE, UPDATEAUTODOOR, DELETEAUTODOOR, AUTODOOROPEN, AUTODOORCLOSE, PAGEELEVATORS, GETELEVATORDRIVERS, ADDELEVATOR, UPDATEELEVATOR, OUTERCALL, OPENDOOR, INNERCALL, DELETEELEVATOR, CLOSEDOOR, CLEARELEVATOROCCUPY, GETELEVATORSTATE, ADDAIRSHOWERDOOR, GETAIRSHOWERDOORDRIVERS, PAGEAIRSHOWERDOORS, UPDATEAIRSHOWERDOOR, SHOWER, AIRDOOROPEN, DELETEAIRSHOWERDOOR, AIRDOORCLOSE, CLEARAIRSHOWERDOOROCCUPY, GETAIRSHOWERDOORSTATE, CLEARAUTODOOROCCUPY, PAGECROSSMAPS, GETCROSSMAPSTATIONS, GETELEVATORS, CREATECROSSMAP, UPDATECROSSMAP, DELETECROSSMAP, GETAIRSHOWERDOORS, GETAUTODOORS, ALLVEHICLEOPERATE, VEHICLEOPERATE, GETVEHICLEGROUPS, CREATEORDERRECORD, CONNECTIVITYVERIFICATION, PAGEAGVACTIONS, ADDAGVACTION, UPDATEAGVACTION, DELETEAGVACTION, GETAGVACTIONS, PAGESYSACTIONS, ADDSYSACTION, UPDATESYSACTION, DELETESYSACTION, GETSYSACTIONIMPLEMENTS, PAGEAGVACTIONGROUPS, ADDAGVACTIONGROUP, UPDATEAGVACTIONGROUP, DELETEAGVACTIONGROUP, GETAGVACTIONGROUPS, GETORDERRECORDDETAIL, GETVEHICLE, GETVEHICLESTATE, CREATEORDERTEMPLATE, PAGEORDERTEMPLATES, DELETEORDERTEMPLATE, UPDATEORDERTEMPLATE, CREATEORDERFLOW, GETORDERTEMPLATES, PAGEORDERFLOWS, ORDERFLOWOPERATION, SUBORDERFLOWOPERATION, UPDATEJARRESTART, RESTARTSYSTEM, ROLLBACK, ORDERQUANTITYSTATISTICS, ORDEREFFICIENCYSTATISTICS, SAVEACTIONSTRATEGY, UPDATEACTIONSTRATEGY, DELETEACTIONSTRATEGY, PAGEACTIONSTRATEGIES, GETSIMPLEACTIONSTRATEGIES, PAGEOBSTACLEAVOIDANCE, CREATEOBSTACLEAVOIDANCE, DELETEOBSTACLEAVOIDANCE, UPDATEOBSTACLEAVOIDANCE, GETOBSTACLEAVOIDANCELIST, ADDTRIPARTITETRAFFIC, PAGETRIPARTITETRAFFICS, DELETETRIPARTITETRAFFIC, UPDATETRIPARTITETRAFFIC, GETSIMPLETRIPARTITETRAFFICEDGEGROUPS, TESTCOMMUNICATION, PAGEMODBUSELEVATORS, ADDMODBUSELEVATOR, DELETEMODBUSELEVATOR, PAGEMODBUSAUTODOORS, ADDMODBUSAUTODOOR, AUTODOOROPENDOOR, AUTODOORCLOSEDOOR, UPDATEMODBUSELEVATOR, PAGECHARGEPILES, ADDCHARGEPILE, UPDATECHARGEPILE, DELETECHARGEPILE, STARTCHARGE, STOPCHARGE, GETCHARGEPILEDRIVERS, PAGESYSTEMVERSIONS, UPLOADSYSTEMVERSION, DELETEPENDINGJAR, GETSYSTEMVERSIONS, GETSYSTEMLOGTYPES, PAGESYSTEMLOGS, DOWNLOADSYSTEMLOG, PAGECONVEYORLINES, GETCONVEYORLINEDRIVERS, ADDCONVEYORLINE, UPDATECONVEYORLINE, DELETECONVEYORLINE, GETCONVEYORLINESTATE, GETALLCHARGEPILES, UPLOADPLAYBACKFILE, STARTEXPORTPLAYBACK, DOWNLOADEXPORTEDFILE, GETVEHICLEEVENTRANGES, GETSYSTEMSTATUSRANGES, GETLOCALTRAFFICREASON, GETPLAYBACKFRAMES, GETTASKPROGRESS, REFRESHTASKHEARTBEAT, DELETEIMPORTRECORDING, PAGEIMPORTRECORDINGS, GETIMPORTMAPINFO, PAGEORDERTASKS, UPLOADSYSTEMIMAGE, GETSYSTEMIMAGE, PAGESYSLOGS, GETLICENSE, DOWNLOADDATABASEBACKUPFILE, GETDATABASES, GETDATABASEBACKUPFILES, ADDTRAFFICLIGHT, PAGETRAFFICLIGHTS, UPDATETRAFFICLIGHT, DELETETRAFFICLIGHT, TESTTRAFFICLIGHT, GETTRAFFICLIGHTS, GETTRAFFICLIGHTDRIVERS, CREATECARRIER, PAGECARRIERS, UPDATECARRIER, DELETECARRIER, UPDATEMAPINFOVERSIONJSON, PUSHMAPINFOVERSION, PUBLISHMAPINFOVERSION, PAGEMAPINFOVERSIONS, GETMAPINFOVERSION, VEHICLEDOWNLOADMAP, UPLOADVEHICLEMAP, UPLOADSTDMAPJSON, UPLOADMAPFILE, DOWNLOADMAP } = API;

// 系统版本：下载系统版本包（另起一行解构，避免原有解构过长）
const { DOWNLOADSYSTEMVERSIONJAR } = API;

// 订单记录：导出Excel（另起一行解构，避免原有解构过长）
const { EXPORTORDERRECORDS } = API;

// 登录
export const login = (data: LoginType) => post(LOGIN, data);

// 退出登录
export const logout = () => post(LOGOUT);

// 获取登录用户详情
export const detail = () => get(DETAIL);

// 获取服务器硬件信息
export const getHardwareInfo = () => get(GETHARDWAREINFO);

// 软件激活
export const softwareActivation = (data: SoftwareActivationType) => post(SOFTWAREACTIVATION, data);

// 根据地图id查询地图数据
export const getMapInfo = (params: { mapId: string }) => get(GETMAPINFO, params);

// 查询地图列表
export const getSimpleMaps = () => get(GETSIMPLEMAPS);

// 获取所有未加入到调度系统的简单车辆
export const getUnRelationSimpleVehicles = () => get(GETUNRELATIONSIMPLEVEHICLES);

// 新增车辆
export const addVehicle = (data: VehicleForm) => post(ADDVEHICLE, data);

// 分页查询车辆
export const pageVehicles = (data: QueryVehiclesParams) => get(PAGEVEHICLES, data);

// 删除车辆
export const deleteVehicle = (data: DeleteVehicleParams) => post(DELETEVEHICLE, data);

// 更新车辆
export const updateVehicle = (data: VehicleForm) => post(UPDATEVEHICLE, data);

// 分页查询车辆分组
export const pageVehicleGroups = (data: VehicleGroupParams) => get(PAGEVEHICLEGROUPS, data);

// 查询调度订单配置
export const getTaskConfigs = () => get(GETTASKCONFIGS);

// 修改调度配置
export const editConfig = (data: EditConfigParams) => post(EDITCONFIG, data);

// 批量修改调度配置
export const batchEditConfigs = (data: EditConfigParams[]) => post(BATCHEDITCONFIGS, data);

// 订单记录状态统计
export const orderRecordStateStatistic = () => get(ORDERRECORDSTATESTATISTIC);

// 分页查询订单记录
export const pageOrderRecords = (data: PageOrderRecordsParams) => get(PAGEORDERRECORDS, data);

// 导出订单记录Excel（blob + getResponse，便于从响应头取文件名）
export const exportOrderRecords = (data: PageOrderRecordsParams) =>
    get(EXPORTORDERRECORDS, data, { responseType: "blob", getResponse: true });

// 调度订单控制
export const orderTaskOperate = (data: TaskOperate) => post(ORDERTASKOPERATE, data);

// 模拟订单分配
export const mockDispatch = (data: MockDispatch) => post(MOCKDISPATCH, data);

// 模拟停靠
export const mockPark = (data: MockPark) => post(MOCKPARK, data);

// 查询节点类型
export const getStations = (data: GetStations) => get(GETSTATIONS, data);

// 模拟充电
export const mockCharge = (data: MockCharge) => post(MOCKCHARGE, data);

// 获取所有的简单车辆
export const getSimpleVehicles = (data?: { mapId: string }) => get(GETSIMPLEVEHICLES, data);

// 新增车辆组
export const addVehicleGroup = (data: VehicleGroupForm) => post(ADDVEHICLEGROUP, data);

// 删除车辆组
export const deleteVehicleGroup = (data: { key: string }) => post(DELETEVEHICLEGROUP, data);

// 更新车辆组
export const updateVehicleGroup = (data: UpdateVehicleGroup) => post(UPDATEVEHICLEGROUP, data);

// 获取交管原因
export const getTrafficReason = (data: { vehicleKey: string }) => get(GETTRAFFICREASON, data);

// 清除车辆交管资源
export const clearVehicleTraffics = (data: { vehicleKey: string }) => post(CLEARVEHICLETRAFFICS, data);

// 分页查询地图数据
export const pageMapInfos = (data: MapInfoSearchParams) => get(PAGEMAPINFOS, data);

// 创建地图
export const createMap = (data: CreateMapType) => post(CREATEMAP, data);

// 删除地图
export const deleteMap = (data: DeleteMapParams) => post(DELETEMAP, data);

// 编辑地图
export const updateMap = (data: UpdateMapType) => post(UPDATEMAP, data);

// 导入地图
export const upLoadMap = (data: FormData) => post(UPLOADMAP, data);

// 更新地图资源
export const updateMapResource = (data: UpdateMapResourceType) => post(UPDATEMAPRESOURCE, data);

// 下载地图
export const downloadMapInfo = (data: PullMapType) => post(DOWNLOADMAPINFO, data);

// 查询自动门
export const pageAutoDoors = (data: PageAutoDoorParams) => get(PAGEAUTODOORS, data);

//添加自动门
export const addAutoDoor = (data: AutoDoorParams) => post(ADDAUTODOOR, data);

// 获取自动门驱动集合
export const getAutoDoorDrivers = () => get(GETAUTODOORDRIVERS);

// 获取自动门状态
export const getAutoDoorState = (data: AutoDoorDeviceKey) => get(GETAUTODOORSTATE, data);

// 自动门开门
export const autoDoorOpen = (data: AutoDoorDeviceKey) => post(AUTODOOROPEN, data);

// 自动门关门
export const autoDoorClose = (data: AutoDoorDeviceKey) => post(AUTODOORCLOSE, data);

// 清除自动门被占用的车辆
export const clearAutoDoorOccupy = (data: AutoDoorDeviceKey) => post(CLEARAUTODOOROCCUPY, data);

// 获取自动门
export const getAutoDoors = () => get(GETAUTODOORS);

// 分页查询电梯信息
export const pageElevators = (data: PageElevators) => get(PAGEELEVATORS, data);

// 获取电梯驱动集合
export const getElevatorDrivers = () => get(GETELEVATORDRIVERS);

// 添加电梯信息
export const addElevator = (data: AddElevator) => post(ADDELEVATOR, data);

// 更新电梯信息
export const updateElevator = (data: AddElevator) => post(UPDATEELEVATOR, data);

// 呼叫电梯
export const outerCall = (data: CommandParams) => post(OUTERCALL, data);

// 电梯开门
export const openDoor = (data: ElevatorCommand) => post(OPENDOOR, data);

// 电梯上楼
export const innerCall = (data: CommandParams) => post(INNERCALL, data);

// 删除电梯
export const deleteElevator = (data: ElevatorCommand) => post(DELETEELEVATOR, data);

// 电梯关门
export const closeDoor = (data: ElevatorCommand) => post(CLOSEDOOR, data);

// 清除占用电梯的车辆
export const clearElevatorOccupy = (data: ElevatorCommand) => post(CLEARELEVATOROCCUPY, data);

// 获取电梯状态
export const getElevatorState = (data: ElevatorCommand) => get(GETELEVATORSTATE, data);

// 添加风淋门信息
export const addAirShowerDoor = (data: AddAirDoor) => post(ADDAIRSHOWERDOOR, data);

// 获取风淋门驱动集合
export const getAirShowerDoorDrivers = () => get(GETAIRSHOWERDOORDRIVERS);

// 分页查询风淋门信息
export const pageAirShowerDoors = (data: PageAirDoor) => get(PAGEAIRSHOWERDOORS, data);

// 更新风淋门信息
export const updateAirShowerDoor = (data: AddAirDoor) => post(UPDATEAIRSHOWERDOOR, data);

// 风淋门风淋操作（无需指定门类型，直接触发）
export const shower = (data: AirDoorDeviceKey) => post(SHOWER, data);

// 风淋门开门
export const airDoorOpen = (data: AirDoorOpen) => post(AIRDOOROPEN, data);

// 删除风淋门信息
export const deleteAirShowerDoor = (data: AirDoorDeviceKey) => post(DELETEAIRSHOWERDOOR, data);

// 风淋门关门
export const airDoorClose = (data: AirDoorOpen) => post(AIRDOORCLOSE, data);

// 清除占用风淋门的车辆
export const clearAirShowerDoorOccupy = (data: AirDoorDeviceKey) => post(CLEARAIRSHOWERDOOROCCUPY, data);

// 获取风淋门状态
export const getAirShowerDoorState = (data: AirDoorDeviceKey) => get(GETAIRSHOWERDOORSTATE, data);

// 获取所有的风淋门集合
export const getAirShowerDoors = () => get(GETAIRSHOWERDOORS);

// 分页查询跨地图关联集合
export const pageCrossMaps = (data: PageCrossMaps) => get(PAGECROSSMAPS, data);

// 获取所有的跨地图站点
export const getCrossMapStations = (data: GetCrossMapStations) => get(GETCROSSMAPSTATIONS, data);

// 获取所有的电梯信息
export const getElevators = () => get(GETELEVATORS);

// 创建跨地图关联
export const createCrossMap = (data: CreateCrossMap) => post(CREATECROSSMAP, data);

// 更新跨地图关联
export const updateCrossMap = (data: CreateCrossMap) => post(UPDATECROSSMAP, data);

// 删除跨地图关联
export const deleteCrossMap = (data: DeleteCrossMap) => post(DELETECROSSMAP, data);

// 车辆整体指令操作
export const allVehicleOperate = (data: AllVehicleOperate) => post(ALLVEHICLEOPERATE, data);

// 车辆指令操作
export const vehicleOperate = (data: VehicleOperate) => post(VEHICLEOPERATE, data);

// 查询车辆组集合
export const getVehicleGroups = () => get(GETVEHICLEGROUPS);

// 查询车辆动作集合
export const getAgvActions = () => get(GETAGVACTIONS);

// 创建订单记录
export const createOrderRecord = (data: CreateOrderRecord) => post(CREATEORDERRECORD, data);

// 地图连通性校验
export const connectivityVerification = (data: ConnectivityVerificationType) => post(CONNECTIVITYVERIFICATION, data);

// 分页查询agv动作集合
export const pageAGVActions = (data: PageAgvActionTypes) => get(PAGEAGVACTIONS, data);

// 新增agv动作
export const addAGVAction = (data: AGVActionType) => post(ADDAGVACTION, data);

// 编辑agv动作
export const updateAGVAction = (data: AGVActionType) => post(UPDATEAGVACTION, data);

// 删除agv动作
export const deleteAGVAction = (data: DeleteAgvActionType) => post(DELETEAGVACTION, data);

// 分页查询系统动作集合
export const pageSysActions = (data: PageSysActionType) => get(PAGESYSACTIONS, data);

// 新增系统动作
export const addSysAction = (data: SysActionType) => post(ADDSYSACTION, data);

// 编辑系统动作
export const updateSysAction = (data: SysActionType) => post(UPDATESYSACTION, data);

// 删除系统动作
export const deleteSysAction = (data: DeleteSysAction) => post(DELETESYSACTION, data);

// 获取所有的系统动作实现集合
export const getSysActionImplements = () => get(GETSYSACTIONIMPLEMENTS);

// 分页查询车辆动作组
export const pageAGVActionGroups = (data: PageAGVActionGroupType) => get(PAGEAGVACTIONGROUPS, data);

// 新增车辆动作组
export const addAGVActionGroup = (data: AGVActionGroupType) => post(ADDAGVACTIONGROUP, data);

// 编辑车辆动作组
export const updateAGVActionGroup = (data: AGVActionGroupType) => post(UPDATEAGVACTIONGROUP, data);

// 删除车辆动作组
export const deleteAGVActionGroup = (data: DeleteActionGroup) => post(DELETEAGVACTIONGROUP, data);

// 查询车辆动作组集合
export const getAGVActionGroups = () => get(GETAGVACTIONGROUPS);

// 查询订单详情（mission 分页，POST）
export const getOrderRecordDetail = (data: GetOrderDetailType) => post(GETORDERRECORDDETAIL, data);

// 获取车辆信息
export const getVehicle = (data: GetVehicleType) => get(GETVEHICLE, data);

// 获取车辆状态
export const getVehicleState = (data: GetVehicleStateParams) => get(GETVEHICLESTATE, data);

// 创建订单组合
export const createOrderTemplate = (data: OrderGroupType) => post(CREATEORDERTEMPLATE, data);

// 分页查询订单组合
export const pageOrderTemplates = (data: PageOrderGroupType) => get(PAGEORDERTEMPLATES, data);

// 删除订单组合
export const deleteOrderTemplate = (data: DeleteOrderTemplateType) => post(DELETEORDERTEMPLATE, data);

// 修改订单组合
export const updateOrderTemplate = (data: OrderGroupType) => post(UPDATEORDERTEMPLATE, data);

// 创建订单组合任务
export const createOrderFlow = (data: OrderGroupForm) => post(CREATEORDERFLOW, data);

// 查询所有的订单工艺
export const getOrderTemplates = () => get(GETORDERTEMPLATES);

// 分页查询订单工艺
export const pageOrderFlows = (data: OrderGroupQueryType) => get(PAGEORDERFLOWS, data);

// 订单工艺操作
export const orderFlowOperation = (data: OrderFlowOperationType) => post(ORDERFLOWOPERATION, data);

// 订单子工艺操作
export const subOrderFlowOperation = (data: OrderFlowOperationType) => post(SUBORDERFLOWOPERATION, data);

// 订单数量统计
export const orderQuantityStatistics = (data: OrderQuantityStatisticsParams) => post(ORDERQUANTITYSTATISTICS, data);

// 订单效率统计
export const orderEfficiencyStatistics = (data: OrderStatisticsParams) => post(ORDEREFFICIENCYSTATISTICS, data);

// 简单查询所有策略
export const getSimpleActionStrategies = (data: GetSimpleStrategyType) => get(GETSIMPLEACTIONSTRATEGIES, data);

// 保存策略管理
export const saveActionStrategy = (data: dropStrategyType) => post(SAVEACTIONSTRATEGY, data)

// 删除策略管理
export const deleteActionStrategy = (data: FormData) => post(DELETEACTIONSTRATEGY, data)

// 更新策略管理
export const updateActionStrategy = (data: dropStrategyType) => post(UPDATEACTIONSTRATEGY, data)

// 查询策略管理
export const getActionStrategies = (data: PageParams) => get(PAGEACTIONSTRATEGIES, data)

// 分页查询避障模型数据
export const pageObstacleAvoidance = (data: SearchParamsType) => get(PAGEOBSTACLEAVOIDANCE, data);

// 创建避障模型数据
export const createObstacleAvoidance = (data: ObstacleRecord) => post(CREATEOBSTACLEAVOIDANCE, data);

// 删除避障模型数据
export const deleteObstacleAvoidance = (data: URLSearchParams) => post(DELETEOBSTACLEAVOIDANCE, data);

// 更新避障模型数据
export const updateObstacleAvoidance = (data: ObstacleRecord) => post(UPDATEOBSTACLEAVOIDANCE, data);

// 查询所有的避障模型数据
export const getObstacleAvoidanceList = () => get(GETOBSTACLEAVOIDANCELIST);

// 新增三方交管
export const addTripartiteTraffic = (data: TriTrafficRecord) => post(ADDTRIPARTITETRAFFIC, data);

// 分页查询三方交管
export const pageTripartiteTraffics = (data: PageTrafficType) => get(PAGETRIPARTITETRAFFICS, data);

// 删除当前三方交管
export const deleteTripartiteTraffic = (data: TriTrafficRecord) => post(DELETETRIPARTITETRAFFIC, data);

// 编辑当前三方交管
export const updateTripartiteTraffic = (data: TriTrafficRecord) => post(UPDATETRIPARTITETRAFFIC, data);

// 查询三方交管点边组合
export const getSimpleTripartiteTrafficEdgeGroups = () => get(GETSIMPLETRIPARTITETRAFFICEDGEGROUPS);

// 三方交管模拟测试
export const testCommunication = (data: TestCommunicationType) => post(TESTCOMMUNICATION, data);

// 查询三方电梯
export const pageModbusElevators = (data: SearchType) => get(PAGEMODBUSELEVATORS, data);

// 添加modbus电梯信息
export const addModbusElevator = (data: ModbusElevator) => post(ADDMODBUSELEVATOR, data);

// 删除modbus电梯信息
export const deleteModbusElevator = (data: { deviceKey: string }) => post(DELETEMODBUSELEVATOR, data);

// 更新电梯信息
export const updateModbusElevator = (data: ModbusElevator) => post(UPDATEMODBUSELEVATOR, data);

// 分页查询自动门
export const pageModbusAutoDoors = (data: SearchType) => get(PAGEMODBUSAUTODOORS, data);

// 新增modbus自动门
export const addModbusAutoDoor = (data: AutoDoorRecord) => post(ADDMODBUSAUTODOOR, data);

// 删除自动门信息
export const deleteAutoDoor = (data: { deviceKey: string }) => post(DELETEAUTODOOR, data);

// 更新自动门信息
export const updateAutoDoor = (data: AutoDoorParams) => post(UPDATEAUTODOOR, data);

// 自动门开门
export const autoDoorOpenDoor = (data: AutoDoorCommand) => post(AUTODOOROPENDOOR, data);

// 自动门关门
export const autoDoorCloseDoor = (data: AutoDoorCommand) => post(AUTODOORCLOSEDOOR, data);

// 分页查询充电桩信息
export const pageChargePiles = (data: SearchType) => get(PAGECHARGEPILES, data);

// 新增充电桩
export const addChargePile = (data: ChargePileRecord) => post(ADDCHARGEPILE, data);

// 更新充电桩信息
export const updateChargePile = (data: ChargePileRecord) => post(UPDATECHARGEPILE, data);

// 删除充电桩
export const deleteChargePile = (data: { deviceKey: string }) => post(DELETECHARGEPILE, data);

// 开始充电
export const startCharge = (data: { deviceKey: string }) => post(STARTCHARGE, data);

// 结束充电
export const stopCharge = (data: { deviceKey: string }) => post(STOPCHARGE, data);

// 查询充电桩驱动集合
export const getChargePileDrivers = () => get(GETCHARGEPILEDRIVERS);

// 分页查询版本
export const pageSystemVersions = (data: SearchType) => get(PAGESYSTEMVERSIONS, data);

// 上传更新包并且重启系统
export const updateJarRestart = (data: FormData) => post(UPDATEJARRESTART, data);

// 重启程序
export const restartSystem = () => post(RESTARTSYSTEM);

// 回滚版本包
export const rollback = (data: SystemVersionParam) => post(ROLLBACK, data);

// 上传系统版本更新包（仅上传，不重启）
export const uploadSystemVersion = (data: FormData) => post(UPLOADSYSTEMVERSION, data);

// 删除待升级 jar
export const deletePendingJar = (data: SystemVersionParam) => post(DELETEPENDINGJAR, data);

// 查询所有的系统版本信息集合（不分页）
export const getSystemVersions = () => get(GETSYSTEMVERSIONS);

// 下载系统版本包
export const downloadSystemVersionJar = (data: SystemVersionParam) =>
  post(DOWNLOADSYSTEMVERSIONJAR, data, { responseType: "arraybuffer", getResponse: true });

// 获取系统日志文件类型
export const getSystemLogTypes = () => get(GETSYSTEMLOGTYPES);

// 分页查询系统日志
export const pageSystemLogs = (data: SysLogParam) => get(PAGESYSTEMLOGS, data);

// 下载系统日志文件
export const downloadSystemLog = (data: DownloadLogType) => post(DOWNLOADSYSTEMLOG, data, { responseType: "arraybuffer", getResponse: true });

// 分页查询输送线
export const pageConveyorLines = (data: SearchType) => get(PAGECONVEYORLINES, data);

// 查询输送线驱动集合
export const getConveyorLineDrivers = () => get(GETCONVEYORLINEDRIVERS);

// 新增输送线
export const addConveyorLine = (data: LineRecord) => post(ADDCONVEYORLINE, data);

// 更新输送线信息
export const updateConveyorLine = (data: LineRecord) => post(UPDATECONVEYORLINE, data);

// 删除输送线
export const deleteConveyorLine = (data: { deviceKey: string }) => post(DELETECONVEYORLINE, data);

// 查询输送线状态
export const getConveyLineState = (data: { deviceKey: string }) => post(GETCONVEYORLINESTATE, data);

// 查询所有充电桩
export const getAllChargePiles = () => get(GETALLCHARGEPILES);

/**
 * 上传录制文件，返回任务ID
 */
export const uploadPlaybackFile = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return post(UPLOADPLAYBACKFILE, formData);
};

/**
 * 按地图与时间范围导出本系统录制文件，返回任务ID
 */
export const startExportPlayback = (data: ExportStartParam) => post(STARTEXPORTPLAYBACK, data);

/**
 * 下载导出的录制文件
 */
export const downloadExportedFile = (data: DownloadParams) => get(DOWNLOADEXPORTEDFILE, data, { responseType: 'blob' });

/**
 * 按时刻获取车辆事件
 */
export const getVehicleEventRanges = (data: VehicleEventParams) => get(GETVEHICLEEVENTRANGES, data);

/**
 * 按时间范围获取系统状态区间
 */
export const getSystemStatusRanges = (data: SystemStatusParams) => get(GETSYSTEMSTATUSRANGES, data);

/**
 * 本系统回放：按时刻查询某车最接近的交管原因
 */
export const getLocalTrafficReason = (data: TrafficReasonParams) => get(GETLOCALTRAFFICREASON, data);

/**
 * 按时间范围获取回放帧列表
 */
export const getPlaybackFrames = (data: PlaybackFramesParams) => get(GETPLAYBACKFRAMES, data);

/**
 * 查询任务进度（上传/导出通用）
 */
export const getTaskProgress = (data: ProgressParams) => get(GETTASKPROGRESS, data);

/**
 * 刷新任务心跳
 */
export const refreshTaskHeartbeat = (taskId: string) => post(`${REFRESHTASKHEARTBEAT}?taskId=${encodeURIComponent(taskId)}`, {});

/**
 * 删除已导入录制文件
 */
export const deleteImportRecording = (data: DeleteImportRecordingParams) => post(`${DELETEIMPORTRECORDING}?id=${data.id}`, {});

/**
 * 分页查询已导入录制文件
 */
export const pageImportRecordings = (data: ImportRecordingPageParams) => get(PAGEIMPORTRECORDINGS, data);

/**
 * 查询导入文件的地图信息
 */
export const getImportMapInfo = (data: GetImportMapInfoParams) => get(GETIMPORTMAPINFO, data);

/**
 * 分页查询订单任务
 */
export const pageOrderTasks = (data: PageOrderTasksParams) => get(PAGEORDERTASKS, data);

/**
 * 上传系统配置图片 (PUT + multipart/form-data)
 * @param placementKey 
 * @param file 
 * @returns 
 */
export const uploadSystemImage = (placementKey: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return put(`${UPLOADSYSTEMIMAGE}/${placementKey}`, formData);
};

/**
 * 获取系统配置图片（二进制流），返回 Blob
 * @param placementKey 
 * @returns 
 */
export const fetchSystemImage = (placementKey: string): Promise<Blob> =>
  get(`${GETSYSTEMIMAGE}/${encodeURIComponent(placementKey)}/file`, {}, { responseType: "blob" });

// 分页查询系统日志
export const pageSysLogs = (data: PageSysLogsParams) => post(PAGESYSLOGS, data);

// 获取激活信息
export const getLicense = () => post(GETLICENSE);

/**
 * 添加交通信号灯信息
 * @param data 包含交通信号灯名称、请求地址、请求参数、响应成功表达式、是否同步等待响应
 */
export const addTrafficLight = (data: AddTrafficLightParams) => post(ADDTRAFFICLIGHT, data);

/**
 * 分页查询交通灯信息
 * @param data 包含分页参数（pageSize、pageNo）以及可选的查询关键字（交通信号灯名称或唯一key）
 */
export const pageTrafficLights = (data: PageTrafficLightParams) => get(PAGETRAFFICLIGHTS, data);

/**
 * 更新交通信号灯信息
 * @param data 包含交通信号灯唯一key以及需要更新的字段信息
 */
export const updateTrafficLight = (data: UpdateTrafficLightParams) => post(UPDATETRAFFICLIGHT, data);

/**
 * 删除交通信号灯信息
 * @param data 包含需要删除的交通信号灯唯一key
 */
export const deleteTrafficLight = (data: DeleteTrafficLightParams) => post(DELETETRAFFICLIGHT, data);

/**
 * 测试交通信号灯
 * 用于在添加或修改前验证交通信号灯的连通性和响应是否正常
 * @param data 包含交通信号灯设备标识
 */
export const testTrafficLight = (data: { deviceKey: string }) => post(TESTTRAFFICLIGHT, data);

/**
 * 查询所有的交通灯集合
 * 返回系统中所有交通信号灯的完整信息列表，不分页
 */
export const getTrafficLights = () => get(GETTRAFFICLIGHTS);

/**
 * 获取交通灯驱动集合
 * 返回系统中所有可用的交通灯驱动列表
 */
export const getTrafficLightDrivers = () => get(GETTRAFFICLIGHTDRIVERS);

/**
 * 创建载具类型
 */
export const createCarrier = (data: CreateCarrierParams) => post(CREATECARRIER, data);

/**
 * 分页查询载具类型
 */
export const pageCarriers = (data: PageCarrierParams) => post(PAGECARRIERS, data);

/**
 * 修改载具类型
 */
export const updateCarrier = (data: UpdateCarrierParams) => post(UPDATECARRIER, data);

/**
 * 删除载具类型
 */
export const deleteCarrier = (data: DeleteCarrierParams) => post(DELETECARRIER, data);

//*********************************************************************地图版本******************************************************//

/**
 * 更新地图版本json数据
 * @param data 包含地图版本id、编辑地图备注、节点列表、边列表、区域列表、点边组合列表
 */
export const updateMapInfoVersionJson = (data: MapInfoVersionJsonParam) => post(UPDATEMAPINFOVERSIONJSON, data);

/**
 * 推送地图版本
 * @param data 包含地图版本id、推送的车辆key、是否启用推送SLAM底图
 */
export const pushMapInfoVersion = (data: MapInfoVersionPushParam) => post(PUSHMAPINFOVERSION, data);

/**
 * 发布地图版本
 * @param data 包含地图版本id
 */
export const publishMapInfoVersion = (data: MapInfoVersionJsonPublishParam) => post(PUBLISHMAPINFOVERSION, data);

/**
 * 分页查询地图版本数据
 * @param data 包含分页参数（pageSize、pageNo）以及可选的查询关键字和地图id
 */
export const pageMapInfoVersions = (data: PageMapInfoVersionsParams) => get(PAGEMAPINFOVERSIONS, data);

/**
 * 获取地图版本数据
 * @param data 包含地图版本id
 */
export const getMapInfoVersion = (data: { mapVersionId: number }) => get<MapInfoVersion>(GETMAPINFOVERSION, data);

//*********************************************************************地图文件操作******************************************************//

/**
 * 车辆下载地图数据
 * @param data 包含地图名称、地图版本、是否下载slam底图
 */
export const vehicleDownloadMap = (data: VehicleDownloadMapParam) => post(VEHICLEDOWNLOADMAP, data);

/**
 * 上传车载地图文件
 * @param file 车载地图文件
 */
export const uploadVehicleMap = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return post(UPLOADVEHICLEMAP, formData);
};

/**
 * 上传std地图json文件
 * @param file std地图json文件
 */
export const uploadStdMapJson = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return post(UPLOADSTDMAPJSON, formData);
};

/**
 * 上传调度地图文件
 * @param file 调度地图文件
 */
export const uploadMapFile = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return post(UPLOADMAPFILE, formData);
};

/**
 * 下载地图文件
 * @param data 包含地图版本id
 */
export const downloadMap = (data: MapDownloadParam) => post(DOWNLOADMAP, data, { responseType: "arraybuffer", getResponse: true });

//*********************************************************************数据库备份******************************************************//
// 下载数据库备份文件
export const downloadDataBaseBackupFile = (data: DataBaseBackupDownloadParam) =>
    post(DOWNLOADDATABASEBACKUPFILE, data, { responseType: "arraybuffer", getResponse: true });

// 查询所有备份的数据库
export const getDataBases = () => get(GETDATABASES);

// 查询数据库备份文件
export const getDataBaseBackupFiles = (params: DataBaseBackupFilesParam) =>
    get(GETDATABASEBACKUPFILES, params);

/* *********************************************************************多地图点边组合****************************************************** */
/* 单独解构本分区新增的 URL 常量，避免改动顶部集中解构的超长行，降低合并冲突概率 */
const {
    CREATESYSTEMNODEEDGEGROUP,
    UPDATESYSTEMNODEEDGEGROUP,
    DELETESYSTEMNODEEDGEGROUP,
    PAGESYSTEMNODEEDGEGROUPS,
    GETALLSIMPLENODEEDGEGROUPS,
} = API;

/* 创建多地图点边组合 */
export const createSystemNodeEdgeGroup = (data: {
    systemNodeEdgeGroupName: string;
    mapNodeEdgeGroupIds: string[];
}) => post(CREATESYSTEMNODEEDGEGROUP, data);

/* 更新多地图点边组合 */
export const updateSystemNodeEdgeGroup = (data: {
    systemNodeEdgeGroupId: number;
    systemNodeEdgeGroupName: string;
    mapNodeEdgeGroupIds: string[];
}) => post(UPDATESYSTEMNODEEDGEGROUP, data);

/* 删除多地图点边组合 */
export const deleteSystemNodeEdgeGroup = (data: {
    systemNodeEdgeGroupId: number;
}) => post(DELETESYSTEMNODEEDGEGROUP, data);

/* 分页查询多地图点边组合 */
export const pageSystemNodeEdgeGroups = (data: {
    pageNo: number;
    pageSize: number;
    query?: string;
}) => get(PAGESYSTEMNODEEDGEGROUPS, data);

/* 查询所有地图的点边组合 */
export const getAllSimpleNodeEdgeGroups = () => get(GETALLSIMPLENODEEDGEGROUPS);

//*********************************************************************用户管理******************************************************//
// 单独解构本分区新增的 URL 常量，避免改动顶部集中解构的超长行，降低合并冲突概率
const {
    AUTHUSERUPDATESTATE,
    AUTHUSERUPDATEPASSWORD,
    AUTHUSERRESETPASSWORD,
    AUTHUSERDELETEUSER,
    AUTHUSERASSIGNROLES,
    AUTHUSERADDUSER,
    AUTHUSERPAGEUSERS,
    AUTHUSERGETUSERS,
} = API;

// 用户状态：启用 / 禁用
export type AuthUserState = "ENABLED" | "DISABLED";

/**
 * 用户
 */
export type AuthUser = {
    id: number;
    createTime?: string;
    updateTime?: string;
    createUser?: string;
    updateUser?: string;
    username: string;            // 用户名（登录账号）
    state: AuthUserState;        // 状态（启用 / 禁用）
};

// 修改用户状态
export const updateUserState = (data: {
    username: string;
    state: AuthUserState;
}) => post(AUTHUSERUPDATESTATE, data);

// 更新用户密码
export const updateUserPassword = (data: {
    username: string;
    password: string;
}) => post(AUTHUSERUPDATEPASSWORD, data);

// 重置密码（按用户 id）
export const resetPassword = (data: { id: number }) =>
    post(AUTHUSERRESETPASSWORD, data);

// 删除用户（按用户 id）
export const deleteUser = (data: { id: number }) =>
    post(AUTHUSERDELETEUSER, data);

// 分配用户角色
export const assignRoles = (data: { userId: number; roleIds: number[] }) =>
    post(AUTHUSERASSIGNROLES, data);

// 新增用户
export const addUser = (
    data: { username: string; password: string; confirm: string },
) => post(AUTHUSERADDUSER, data);

// 分页查询用户列表
export const pageUsers = (data: {
    pageNo: number;
    pageSize: number;
    query?: string;
}) => get(AUTHUSERPAGEUSERS, data);

// 查询用户列表（不分页）
export const getUsers = () => get(AUTHUSERGETUSERS);

//*********************************************************************角色管理******************************************************//
// 单独解构本分区新增的 URL 常量，避免改动顶部集中解构的超长行，降低合并冲突概率
const {
    AUTHROLEUPDATEROLE,
    AUTHROLEDELETE,
    AUTHROLEASSIGNPERMISSIONS,
    AUTHROLEADDROLE,
    AUTHROLEPAGEROLES,
    AUTHROLEGETROLES,
    AUTHPERMISSIONGETPERMISSIONS,
} = API;

// 角色状态：启用 / 禁用
export type AuthRoleState = "ENABLED" | "DISABLED";

// 权限类型：菜单 / 按钮
export type AuthPermissionType = "MENU" | "BUTTON";

/**
 * 权限资源（树形结构）
 * 用于菜单 / 按钮权限的展示与分配
 */
export type AuthPermission = {
    id: number;
    createTime?: string;
    updateTime?: string;
    createUser?: string;
    updateUser?: string;
    code: string;                        // 权限编码
    name: string;                        // 权限名称
    type: AuthPermissionType;            // 权限类型（菜单 / 按钮）
    parentCode?: string;                 // 父权限编码
    path?: string;                       // 前端路由路径
    icon?: string;                       // 前端菜单图标
    sort?: number;                       // 排序
    state?: AuthRoleState;               // 状态（启用 / 禁用）
    childPermissions?: AuthPermission[]; // 子权限（递归）
};

/**
 * 角色
 */
export type AuthRole = {
    id: number;
    createTime?: string;
    updateTime?: string;
    createUser?: string;
    updateUser?: string;
    code: string;         // 角色编码
    name: string;         // 角色名称
    state: AuthRoleState; // 状态（启用 / 禁用）
};

// 更新角色
export const updateRole = (data: {
    id: number;
    code: string;
    name: string;
    state: AuthRoleState;
}) => post(AUTHROLEUPDATEROLE, data);

// 删除角色（按角色 id，POST + query 参数）
export const deleteRole = (data: { id: number }) =>
    post(`${AUTHROLEDELETE}?id=${data.id}`, {});

// 分配角色权限
export const assignPermissions = (data: {
    roleId: number;
    permissionIds: number[];
}) => post(AUTHROLEASSIGNPERMISSIONS, data);

// 新增角色
export const addRole = (data: {
    code: string;
    name: string;
    state: AuthRoleState;
}) => post(AUTHROLEADDROLE, data);

// 分页查询角色列表
export const pageRoles = (data: {
    pageNo: number;
    pageSize: number;
    query?: string;
}) => get(AUTHROLEPAGEROLES, data);

// 查询角色列表（可按 userId 过滤，不分页）
// 后端统一返回 { code, message, data } 包装体，data 为角色数组
export const getRoles = (data?: { userId: number }) =>
    get<{ code: number; message: string; data: AuthRole[] }>(
        AUTHROLEGETROLES,
        data,
    );

//*********************************************************************权限资源******************************************************//
// 查询权限资源列表（可按 roleId 过滤，返回树形结构）
// 后端统一返回 { code, message, data } 包装体，data 为权限树数组
export const getPermissions = (data?: { roleId: number }) =>
    get<{ code: number; message: string; data: AuthPermission[] }>(
        AUTHPERMISSIONGETPERMISSIONS,
        data,
    );
//*********************************************************************风淋门操作******************************************************//
// 单独解构本分区新增的 URL 常量，避免改动顶部集中解构的超长行，降低合并冲突概率
const { GETAIRSHOWERDOOROPERATION } = API;

/* 获取风淋门操作（apply 申请操作 / release 释放操作） */
export const getAirShowerDoorOperation = (params: { deviceOperationType: AirDoorOperationType }) =>
    get(GETAIRSHOWERDOOROPERATION, params);

//*********************************************************************版本包上传 URL 导出******************************************************//
/*
 * 导出版本上传 URL 常量，供 uploadWithProgress 直接使用（不走 umi post，无超时配置）
 * v2_dev 版本控制改为「仅上传版本包到待升级列表，不自动重启」，
 * 故用 UPLOADSYSTEMVERSION 而非 UPDATEJARRESTART（重启由版本列表页独立按钮触发）
 */
export const UPLOADSYSTEMVERSION_URL = UPLOADSYSTEMVERSION;

/* *********************************************************************车辆告警码****************************************************** */
/* 单独解构本分区新增的 URL 常量，避免改动顶部集中解构的超长行，降低合并冲突概率 */
const {
    UPLOADVEHICLEALARMCODEFILE,
    UPDATEVEHICLEALARMCODE,
    DOWNVEHICLEALARMCODEFILE,
    DELETEVEHICLEALARMCODE,
    ADDVEHICLEALARMCODE,
    PAGEVEHICLEALARMCODES,
} = API;

/* 上传车辆告警码文件（全量覆盖） */
export const uploadVehicleAlarmCodeFile = (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return post(UPLOADVEHICLEALARMCODEFILE, formData);
};

/* 更新车辆告警码 */
export const updateVehicleAlarmCode = (data: AGVAlarmCodeUpdateParam) => post(UPDATEVEHICLEALARMCODE, data);

/* 下载车辆告警码文件 */
export const downVehicleAlarmCodeFile = () =>
    post(DOWNVEHICLEALARMCODEFILE, {}, { responseType: "blob", getResponse: true });

/* 删除车辆告警码 */
export const deleteVehicleAlarmCode = (data: AGVAlarmCodeParam) => post(DELETEVEHICLEALARMCODE, data);

/* 创建车辆告警码 */
export const addVehicleAlarmCode = (data: AGVAlarmCodeAddParam) => post(ADDVEHICLEALARMCODE, data);

/* 分页查询车辆告警码 */
export const pageVehicleAlarmCodes = (data: AGVAlarmCodePageParam) => get(PAGEVEHICLEALARMCODES, data);

/* 导出版本更新 URL 常量，供 uploadWithProgress 直接使用（不走 umi post，无超时配置） */
export const UPDATEJARRESTART_URL = UPDATEJARRESTART;

//*********************************************************************地图推送记录******************************************************//
/* 单独解构本分区新增的 URL 常量，避免改动顶部集中解构的超长行，降低合并冲突概率 */
const { REPUSHMAP, PAGEMAPPUSHRECORDS, CANCELPUSHMAP } = API;

/**
 * 重新推送地图
 * @param data 包含推送记录id，以及需要重新推送的子记录id列表（不传子记录id则重推该记录下全部子记录）
 */
export const rePushMap = (data: MapRePushParam) => post(REPUSHMAP, data);

/**
 * 分页查询地图推送记录数据
 * @param data 包含分页参数（pageSize、pageNo）
 */
export const pageMapPushRecords = (data: PageMapPushRecordsParams) => get(PAGEMAPPUSHRECORDS, data);

/**
 * 取消推送地图
 * 请求体与重新推送地图结构一致（MapRePushParam），直接复用该类型
 * @param data 包含推送记录id，以及需要取消推送的子记录id列表（不传子记录id则取消该记录下全部子记录）
 */
export const cancelPushMap = (data: MapRePushParam) => post(CANCELPUSHMAP, data);

//*********************************************************************实时运行看板******************************************************//
/* 单独解构本分区新增的 URL 常量，避免改动顶部集中解构的超长行，降低合并冲突概率 */
const { DASHBOARDBOARD } = API;

/**
 * 实时运行看板聚合数据
 * @param data 订单统计天数与订单类型（后端均有默认值，可不传）
 */
export const dashboardBoard = (data: DashboardParam) =>
    post<ResultDashboardBoardVO>(DASHBOARDBOARD, data);

//*********************************************************************任务统计报表******************************************************//
/* 单独解构本分区新增的 URL 常量，避免改动顶部集中解构的超长行，降低合并冲突概率 */
const { TASKSTATISTICS } = API;

/**
 * 任务统计报表聚合数据
 * @param data 起止时间 / 订单类型 / 车辆集合（后端均有默认值，可不传）
 */
export const taskStatistics = (data: TaskStatisticsParam) =>
    post<ResultTaskStatisticsVO>(TASKSTATISTICS, data);

//*********************************************************************系统告警记录******************************************************//
/* 单独解构本分区新增的 URL 常量，避免改动顶部集中解构的超长行，降低合并冲突概率 */
const { PAGESYSTEMALARMRECORDS, ALARMSTATISTICS } = API;

/**
 * 分页查询系统告警记录
 * @param data 分页参数及各筛选条件（来源/告警码/级别/订单/状态/时间范围，均可选）
 */
export const pageSystemAlarmRecords = (data: PageSystemAlarmRecordsParams) =>
    post<ResultPageSystemAlarmRecord>(PAGESYSTEMALARMRECORDS, data);

/**
 * 告警统计报表聚合数据
 * @param data 起止时间（统计窗口）、指定日期 Top10 AGV、指定 AGV 每天 Top10 告警
 *   （均可选；topAgvDate / topAlarmVehicleKey 不传则不查对应维度）
 */
export const alarmStatistics = (data: AlarmStatisticsParam) =>
    post<ResultAlarmStatisticsVO>(ALARMSTATISTICS, data);

//*********************************************************************服务器实时资源******************************************************//
/* 单独解构本分区新增的 URL 常量，避免改动顶部集中解构的超长行，降低合并冲突概率 */
const { GETSERVERRESOURCECURRENT } = API;

/**
 * 获取服务器实时资源（磁盘、内存、CPU）
 * 无请求参数，返回当前时刻的资源快照
 */
export const getServerResourceCurrent = () =>
    get<ResultServerResourceSnapshot>(GETSERVERRESOURCECURRENT);

//*********************************************************************AGV 状态时长统计报表******************************************************//
/* 单独解构本分区新增的 URL 常量，避免改动顶部集中解构的超长行，降低合并冲突概率 */
const { AGVSTATESTATISTICS, AGVEXECUTINGTIMESTATISTICS } = API;

/**
 * AGV 状态每日时长统计（状态由参数指定，利用率由前端计算）
 * @param data 时间范围、车辆集合、状态集合、是否按小时维度
 */
export const agvStateStatistics = (data: AgvStateStatisticsParam) =>
    post<ResultAgvStateStatisticsVO>(AGVSTATESTATISTICS, data);

/**
 * AGV 各状态总时长统计（每车，按状态分组，状态由参数指定）
 * @param data 时间范围、车辆集合、状态集合、是否按小时维度
 */
export const agvExecutingTimeStatistics = (data: AgvStateStatisticsParam) =>
    post<ResultAgvExecutingTimeStatisticsVO>(AGVEXECUTINGTIMESTATISTICS, data);

//*********************************************************************AGV节点映射******************************************************//
/* 单独解构本分区新增的 URL 常量，避免改动顶部集中解构的超长行，降低合并冲突概率 */
const {
    UPDATEAGVNODEMAPPING,
    SAVEAGVNODEMAPPING,
    DELETEAGVNODEMAPPING,
    PAGEAGVNODEMAPPINGS,
    GETCOLLECTIONNODESUGGESTIONS,
} = API;

/**
 * 更新AGV节点映射
 * @param data 映射唯一key、映射名称、按地图分组的节点映射列表、AGV唯一key集合（整体替换语义）
 */
export const updateAGVNodeMapping = (data: AGVNodeMappingUpdateParam) => post(UPDATEAGVNODEMAPPING, data);

/**
 * 保存AGV节点映射
 * @param data 映射名称、按地图分组的节点映射列表、AGV唯一key集合
 */
export const saveAGVNodeMapping = (data: AGVNodeMappingAddParam) => post(SAVEAGVNODEMAPPING, data);

/**
 * 删除AGV节点映射
 * @param data 映射唯一key
 */
export const deleteAGVNodeMapping = (data: AGVNodeMappingParam) => post(DELETEAGVNODEMAPPING, data);

/**
 * 分页查询节点映射
 * @param data 分页参数（pageSize、pageNo）以及可选的映射名称
 */
export const pageAGVNodeMappings = (data: AGVNodeMappingPageParam) =>
    get<ResultPageAGVNodeMapping>(PAGEAGVNODEMAPPINGS, data);

/**
 * 获取采集点位的建议
 * @param data 地图ID（必传）、期望点位数量（可选，不传由后端自动计算预算）
 */
export const getSuggestionsForCollectionNodes = (data: CollectionNodeSuggestionParam) =>
    get<ResultCollectionNodeSuggestion>(GETCOLLECTIONNODESUGGESTIONS, data);
