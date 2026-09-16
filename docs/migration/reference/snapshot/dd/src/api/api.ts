/**
 * @description 请求需要用到的url
 * @date 2025-5-17
 */

export default {
    // 登录
    LOGIN: "/fms/v1/auth/authorize/login",
    // 退出登录
    LOGOUT: "/fms/v1/auth/authorize/logout",
    // 获取登录用户详情
    DETAIL: "/fms/v1/auth/authorize/detail",
    // 获取服务器硬件信息
    GETHARDWAREINFO: "/fms/v1/auth/license/getHardwareInfo",
    // 软件激活
    SOFTWAREACTIVATION: "/fms/v1/auth/license/softwareActivation",
    // 获取地图数据
    GETMAPINFO: "/fms/v1/dispatcher/map/getMapInfo",
    // 获取地图列表
    GETSIMPLEMAPS: "/fms/v1/dispatcher/map/getSimpleMaps",
    // 获取所有未加入到调度系统的简单车辆
    GETUNRELATIONSIMPLEVEHICLES: "/fms/v1/dispatcher/vehicle/getUnRelationSimpleVehicles",
    // 新增车辆
    ADDVEHICLE: "/fms/v1/dispatcher/vehicle/addVehicle",
    // 分页查询车辆
    PAGEVEHICLES: "/fms/v1/dispatcher/vehicle/pageVehicles",
    // 删除车辆
    DELETEVEHICLE: "/fms/v1/dispatcher/vehicle/deleteVehicle",
    // 更新车辆
    UPDATEVEHICLE: "/fms/v1/dispatcher/vehicle/updateVehicle",
    // 分页查询车辆分组
    PAGEVEHICLEGROUPS: "/fms/v1/dispatcher/vehicleGroup/pageVehicleGroups",
    // 查询调度订单配置
    GETTASKCONFIGS: "/fms/v1/dispatcher/taskConfig/getTaskConfigs",
    // 修改调度配置
    EDITCONFIG: "/fms/v1/dispatcher/taskConfig/editConfig",
    // 批量修改调度配置
    BATCHEDITCONFIGS: "/fms/v1/dispatcher/taskConfig/batchEditConfigs",
    // 订单记录状态统计
    ORDERRECORDSTATESTATISTIC: "/fms/v1/dispatcher/orderRecord/orderRecordStateStatistic",
    // 分页查询订单记录
    PAGEORDERRECORDS: "/fms/v1/dispatcher/orderRecord/pageOrderRecords",
    // 导出订单记录Excel
    EXPORTORDERRECORDS: "/fms/v1/dispatcher/orderRecord/exportOrderRecords",
    // 调度订单控制
    ORDERTASKOPERATE: "/fms/v1/dispatcher/orderTask/orderTaskOperate",
    // 模拟订单分配
    MOCKDISPATCH: "/fms/v1/dispatcher/orderTask/mockDispatch",
    // 模拟停靠
    MOCKPARK: "/fms/v1/dispatcher/orderTask/mockPark",
    // 根据类型查询节点
    GETSTATIONS: "/fms/v1/dispatcher/map/getStations",
    // 模拟充电
    MOCKCHARGE: "/fms/v1/dispatcher/orderTask/mockCharge",
    // 获取所有的简单车辆 不分页
    GETSIMPLEVEHICLES: "/fms/v1/dispatcher/vehicle/getSimpleVehicles",
    // 新增车辆组
    ADDVEHICLEGROUP: "/fms/v1/dispatcher/vehicleGroup/addVehicleGroup",
    // 删除车辆组
    DELETEVEHICLEGROUP: "/fms/v1/dispatcher/vehicleGroup/deleteVehicleGroup",
    // 更新车辆组
    UPDATEVEHICLEGROUP: "/fms/v1/dispatcher/vehicleGroup/updateVehicleGroup",
    // 获取交管原因
    GETTRAFFICREASON: "/fms/v1/dispatcher/orderTask/getTrafficReason",
    // 清除车辆交管资源
    CLEARVEHICLETRAFFICS: "/fms/v1/dispatcher/vehicle/clearVehicleTraffics",
    // 分页查询地图数据
    PAGEMAPINFOS: "/fms/v1/dispatcher/map/pageMapInfos",
    // 创建地图
    CREATEMAP: "/fms/v1/dispatcher/map/createMap",
    // 删除地图
    DELETEMAP: "/fms/v1/dispatcher/map/deleteMap",
    // 编辑地图
    UPDATEMAP: "/fms/v1/dispatcher/map/updateMap",
    // 导入地图
    UPLOADMAP: "/fms/v1/dispatcher/map/upLoadMap",
    // 更新地图资源
    UPDATEMAPRESOURCE: "/fms/v1/dispatcher/map/updateMapResource",
    // 拉取地图
    DOWNLOADMAPINFO: "/fms/v1/dispatcher/map/downloadMapInfo",
    // 查询自动门
    PAGEAUTODOORS: "/fms/v1/device/autoDoor/pageAutoDoors",
    // 添加自动门
    ADDAUTODOOR: "/fms/v1/device/autoDoor/addAutoDoor",
    // 获取自动门驱动集合
    GETAUTODOORDRIVERS: "/fms/v1/device/autoDoor/getAutoDoorDrivers",
    // 获取自动门状态
    GETAUTODOORSTATE: "/fms/v1/device/autoDoor/getAutoDoorState",
    // 自动门开门
    AUTODOOROPEN: "/fms/v1/device/autoDoor/openDoor",
    // 自动门关门
    AUTODOORCLOSE: "/fms/v1/device/autoDoor/closeDoor",
    // 清除自动门被占用的车辆
    CLEARAUTODOOROCCUPY: "/fms/v1/device/autoDoor/clearAutoDoorOccupy",
    // 查询所有的自动门集合
    GETAUTODOORS: "/fms/v1/device/autoDoor/getAutoDoors",
    // 分页查询电梯信息
    PAGEELEVATORS: "/fms/v1/device/elevator/pageElevators",
    // 获取电梯驱动集合
    GETELEVATORDRIVERS: "/fms/v1/device/elevator/getElevatorDrivers",
    // 添加电梯信息
    ADDELEVATOR: "/fms/v1/device/elevator/addElevator",
    // 更新电梯信息
    UPDATEELEVATOR: "/fms/v1/device/elevator/updateElevator",
    // 呼叫电梯
    OUTERCALL: "/fms/v1/device/elevator/outerCall",
    // 电梯开门
    OPENDOOR: "/fms/v1/device/elevator/openDoor",
    // 电梯上楼
    INNERCALL: "/fms/v1/device/elevator/innerCall",
    // 删除电梯
    DELETEELEVATOR: "/fms/v1/device/elevator/deleteElevator",
    // 电梯关门
    CLOSEDOOR: "/fms/v1/device/elevator/closeDoor",
    // 清除占用电梯的车辆
    CLEARELEVATOROCCUPY: "/fms/v1/device/elevator/clearElevatorOccupy",
    // 获取电梯状态
    GETELEVATORSTATE: "/fms/v1/device/elevator/getElevatorState",
    // 添加风淋门信息
    ADDAIRSHOWERDOOR: "/fms/v1/device/airShowerDoor/addAirShowerDoor",
    // 获取风淋门驱动集合
    GETAIRSHOWERDOORDRIVERS: "/fms/v1/device/airShowerDoor/getAirShowerDoorDrivers",
    // 分页查询风淋门信息
    PAGEAIRSHOWERDOORS: "/fms/v1/device/airShowerDoor/pageAirShowerDoors",
    // 更新风淋门信息
    UPDATEAIRSHOWERDOOR: "/fms/v1/device/airShowerDoor/updateAirShowerDoor",
    // 风淋门风淋操作
    SHOWER: "/fms/v1/device/airShowerDoor/shower",
    // 风淋门开门
    AIRDOOROPEN: "/fms/v1/device/airShowerDoor/openDoor",
    // 删除风淋门信息
    DELETEAIRSHOWERDOOR: "/fms/v1/device/airShowerDoor/deleteAirShowerDoor",
    // 风淋门关门
    AIRDOORCLOSE: "/fms/v1/device/airShowerDoor/closeDoor",
    // 清除占用风淋门的车辆
    CLEARAIRSHOWERDOOROCCUPY: "/fms/v1/device/airShowerDoor/clearAirShowerDoorOccupy",
    // 获取风淋门状态
    GETAIRSHOWERDOORSTATE: "/fms/v1/device/airShowerDoor/getAirShowerDoorState",
    // 获取所有的风淋门集合
    GETAIRSHOWERDOORS: "/fms/v1/device/airShowerDoor/getAirShowerDoors",
    // 获取风淋门可用操作（apply 申请操作 / release 释放操作）
    GETAIRSHOWERDOOROPERATION: "/fms/v1/device/airShowerDoor/getAirShowerDoorOperation",
    // 分页查询跨地图关联集合
    PAGECROSSMAPS: "/fms/v1/dispatcher/crossMap/pageCrossMaps",
    // 获取所有的跨地图站点
    GETCROSSMAPSTATIONS: "/fms/v1/dispatcher/map/getSites",
    // 获取所有的电梯信息
    GETELEVATORS: "/fms/v1/device/elevator/getElevators",
    // 创建跨地图关联
    CREATECROSSMAP: "/fms/v1/dispatcher/crossMap/createCrossMap",
    // 更新跨地图关联
    UPDATECROSSMAP: "/fms/v1/dispatcher/crossMap/updateCrossMap",
    // 删除跨地图关联
    DELETECROSSMAP: "/fms/v1/dispatcher/crossMap/deleteCrossMap",
    // 车辆整体指令操作
    ALLVEHICLEOPERATE: "/fms/v1/dispatcher/vehicle/allVehicleOperate",
    // 车辆指令操作
    VEHICLEOPERATE: "/fms/v1/dispatcher/vehicle/vehicleOperate",
    // 查询车辆组集合
    GETVEHICLEGROUPS: "/fms/v1/dispatcher/vehicleGroup/getVehicleGroups",
    // 创建订单记录
    CREATEORDERRECORD: "/fms/v1/dispatcher/orderRecord/createOrderRecord",
    // 地图连通性校验
    CONNECTIVITYVERIFICATION: "/fms/v1/dispatcher/map/connectivityVerification",
    // 分页查询agv动作集合
    PAGEAGVACTIONS: "/fms/v1/action/agvAction/pageAGVActions",
    // 新增agv动作
    ADDAGVACTION: "/fms/v1/action/agvAction/addAGVAction",
    // 编辑agv动作
    UPDATEAGVACTION: "/fms/v1/action/agvAction/updateAGVAction",
    // 删除agv动作
    DELETEAGVACTION: "/fms/v1/action/agvAction/deleteAGVAction",
    // 查询所有的agv动作
    GETAGVACTIONS: "/fms/v1/action/agvAction/getAGVActions",
    // 分页查询系统动作集合
    PAGESYSACTIONS: "/fms/v1/action/sysAction/pageSysActions",
    // 新增系统动作
    ADDSYSACTION: "/fms/v1/action/sysAction/addSysAction",
    // 编辑系统动作
    UPDATESYSACTION: "/fms/v1/action/sysAction/updateSysAction",
    // 删除系统动作
    DELETESYSACTION: "/fms/v1/action/sysAction/deleteSysAction",
    // 获取所有的系统动作实现集合
    GETSYSACTIONIMPLEMENTS: "/fms/v1/action/sysAction/getSysActionImplements",
    // 分页查询车辆动作组
    PAGEAGVACTIONGROUPS: "/fms/v1/action/agvActionGroup/pageAGVActionGroups",
    // 新增车辆动作组
    ADDAGVACTIONGROUP: "/fms/v1/action/agvActionGroup/addAGVActionGroup",
    // 编辑车辆动作组
    UPDATEAGVACTIONGROUP: "/fms/v1/action/agvActionGroup/updateAGVActionGroup",
    // 删除车辆动作组
    DELETEAGVACTIONGROUP: "/fms/v1/action/agvActionGroup/deleteAGVActionGroup",
    // 查询车辆动作组集合
    GETAGVACTIONGROUPS: "/fms/v1/action/agvActionGroup/getAGVActionGroups",
    // 查询订单详情
    GETORDERRECORDDETAIL: "/fms/v1/dispatcher/orderRecord/getOrderRecordDetail",
    // 获取车辆信息
    GETVEHICLE: "/fms/v1/dispatcher/vehicle/getVehicle",
    // 获取车辆状态
    GETVEHICLESTATE: "/fms/v1/dispatcher/vehicle/getVehicleState",
    // *****************************************************************任务管理******************************************//
    // 创建订单模板
    CREATEORDERTEMPLATE: "/fms/v1/dispatcher/orderTemplate/createOrderTemplate",
    // 分页查询订单组合
    PAGEORDERTEMPLATES: "/fms/v1/dispatcher/orderTemplate/pageOrderTemplates",
    // 删除订单模板
    DELETEORDERTEMPLATE: "/fms/v1/dispatcher/orderTemplate/deleteOrderTemplate",
    // 修改订单模板
    UPDATEORDERTEMPLATE: "/fms/v1/dispatcher/orderTemplate/updateOrderTemplate",
    // 创建订单工艺
    CREATEORDERFLOW: "/fms/v1/dispatcher/orderFlow/createOrderFlow",
    // 查询所有的订单模板
    GETORDERTEMPLATES: "/fms/v1/dispatcher/orderTemplate/getOrderTemplates",
    // 分页查询订单组合任务
    PAGEORDERFLOWS: "/fms/v1/dispatcher/orderFlow/pageOrderFlows",
    // 订单组合任务操作
    ORDERFLOWOPERATION: "/fms/v1/dispatcher/orderFlow/orderFlowOperation",
    // 订单子工艺操作
    SUBORDERFLOWOPERATION: "/fms/v1/dispatcher/orderFlow/subOrderFlowOperation",
    //*********************************************************************订单统计******************************************************//
    // 订单数量统计
    ORDERQUANTITYSTATISTICS: "/fms/v1/report/orderStatisticsReport/orderQuantityStatistics",
    // 订单效率统计
    ORDEREFFICIENCYSTATISTICS: "/fms/v1/report/orderStatisticsReport/orderEfficiencyStatistics",
    // 简单查询所有策略
    GETSIMPLEACTIONSTRATEGIES: "/fms/v1/actionStrategy/getSimpleActionStrategies",

    //*********************************************************************策略管理******************************************************//
    // 保存策略
    SAVEACTIONSTRATEGY: "/fms/v1/actionStrategy/saveActionStrategy",
    // 更新策略
    UPDATEACTIONSTRATEGY: "/fms/v1/actionStrategy/updateActionStrategy",
    // 删除策略
    DELETEACTIONSTRATEGY: "/fms/v1/actionStrategy/deleteActionStrategy",
    // 查询策略
    PAGEACTIONSTRATEGIES: "/fms/v1/actionStrategy/pageActionStrategies",
    // **********************************************************************避障模型数据**********************************************************
    // 分页查询避障模型数据
    PAGEOBSTACLEAVOIDANCE: "/fms/v1/dispatcher/obstacleAvoidance/pageObstacleAvoidance",
    // 创建避障模型数据
    CREATEOBSTACLEAVOIDANCE: "/fms/v1/dispatcher/obstacleAvoidance/createObstacleAvoidance",
    // 删除避障模型数据
    DELETEOBSTACLEAVOIDANCE: "/fms/v1/dispatcher/obstacleAvoidance/deleteObstacleAvoidance",
    // 更新避障模型数据
    UPDATEOBSTACLEAVOIDANCE: "/fms/v1/dispatcher/obstacleAvoidance/updateObstacleAvoidance",
    // 查询所有的避障模型数据
    GETOBSTACLEAVOIDANCELIST: "/fms/v1/dispatcher/obstacleAvoidance/getObstacleAvoidanceList",
    // ********************************************************************三方交管******************************************************************
    // 新增三方交管
    ADDTRIPARTITETRAFFIC: "/fms/v1/dispatcher/tripartiteTraffic/addTripartiteTraffic",
    // 分页查询三方交管
    PAGETRIPARTITETRAFFICS: "/fms/v1/dispatcher/tripartiteTraffic/pageTripartiteTraffics",
    // 删除当前三方交管
    DELETETRIPARTITETRAFFIC: "/fms/v1/dispatcher/tripartiteTraffic/deleteTripartiteTraffic",
    // 编辑三方交管
    UPDATETRIPARTITETRAFFIC: "/fms/v1/dispatcher/tripartiteTraffic/updateTripartiteTraffic",
    // 查询三方交管点边组合
    GETSIMPLETRIPARTITETRAFFICEDGEGROUPS: "/fms/v1/dispatcher/map/getSimpleTripartiteTrafficEdgeGroups",
    // 三方交管模拟测试
    TESTCOMMUNICATION: "/fms/v1/dispatcher/tripartiteTraffic/testCommunication",
    // ***************************************************************三方设备*******************************************************
    // 查询modbus电梯
    PAGEMODBUSELEVATORS: "/fms/v1/device/modbusElevator/pageModbusElevators",
    // 添加modbus电梯信息
    ADDMODBUSELEVATOR: "/fms/v1/device/modbusElevator/addModbusElevator",
    // 删除电梯信息
    DELETEMODBUSELEVATOR: "/fms/v1/device/modbusElevator/deleteModbusElevator",
    // 更新电梯信息
    UPDATEMODBUSELEVATOR: "/fms/v1/device/modbusElevator/updateModbusElevator",
    // 分页查询自动门
    PAGEMODBUSAUTODOORS: "/fms/v1/device/modbusAutoDoor/pageModbusAutoDoors",
    // 新增自动门
    ADDMODBUSAUTODOOR: "/fms/v1/device/modbusAutoDoor/addModbusAutoDoor",
    // 删除自动门信息
    DELETEAUTODOOR: "/fms/v1/device/autoDoor/deleteAutoDoor",
    // 更新自动门信息
    UPDATEAUTODOOR: "/fms/v1/device/autoDoor/updateAutoDoor",
    // 自动门开门
    AUTODOOROPENDOOR: "/fms/v1/device/autoDoor/openDoor",
    // 自动门关门
    AUTODOORCLOSEDOOR: "/fms/v1/device/autoDoor/closeDoor",
    // 分页查询充电桩信息
    PAGECHARGEPILES: "/fms/v1/device/chargePile/pageChargePiles",
    // 创建充电桩
    ADDCHARGEPILE: "/fms/v1/device/chargePile/addChargePile",
    // 更新充电桩信息
    UPDATECHARGEPILE: "/fms/v1/device/chargePile/updateChargePile",
    // 删除充电桩
    DELETECHARGEPILE: "/fms/v1/device/chargePile/deleteChargePile",
    // 开始充电
    STARTCHARGE: "/fms/v1/device/chargePile/startCharge",
    // 停止充电
    STOPCHARGE: "/fms/v1/device/chargePile/stopCharge",
    // 查询充电桩驱动集合
    GETCHARGEPILEDRIVERS: "/fms/v1/device/chargePile/getChargePileDrivers",
    // 查询所有充电桩
    GETALLCHARGEPILES: "/fms/v1/device/chargePile/getAllChargePiles",
    // 分页查询输送线
    PAGECONVEYORLINES: "/rcsFlow/v1/conveyorLine/pageConveyorLines",
    // 查询输送线的驱动集合
    GETCONVEYORLINEDRIVERS: "/rcsFlow/v1/conveyorLine/getConveyorLineDrivers",
    // 新增输送线
    ADDCONVEYORLINE: "/rcsFlow/v1/conveyorLine/addConveyorLine",
    // 更新输送线信息
    UPDATECONVEYORLINE: "/rcsFlow/v1/conveyorLine/updateConveyorLine",
    // 删除输送线
    DELETECONVEYORLINE: "/rcsFlow/v1/conveyorLine/deleteConveyorLine",
    // 查询输送线状态
    GETCONVEYORLINESTATE: "/rcsFlow/v1/conveyorLine/getConveyLineState",
    //*******************************************************************系统管理************************************************//
    // 获取所有的版本更新包
    PAGESYSTEMVERSIONS: "/fms/v1/systemVersion/pageSystemVersions",
    // 上传更新包并且重启系统
    UPDATEJARRESTART: "/fms/v1/systemVersion/updateJarRestart",
    // 重启系统
    RESTARTSYSTEM: "/fms/v1/systemVersion/restartSystem",
    // 回滚版本包
    ROLLBACK: "/fms/v1/systemVersion/rollback",
    // 上传系统版本更新包（仅上传，不重启）
    UPLOADSYSTEMVERSION: "/fms/v1/systemVersion/uploadSystemVersion",
    // 删除待升级 jar
    DELETEPENDINGJAR: "/fms/v1/systemVersion/deletePendingJar",
    // 查询所有的系统版本信息集合（不分页）
    GETSYSTEMVERSIONS: "/fms/v1/systemVersion/getSystemVersions",
    // 下载系统版本包
    DOWNLOADSYSTEMVERSIONJAR: "/fms/v1/systemVersion/downloadSystemVersionJar",
    //********************************************************************系统日志********************************************************//
    // 获取系统日志文件类型
    GETSYSTEMLOGTYPES: "/fms/v1/systemLog/getSystemLogTypes",
    // 分页查询系统日志
    PAGESYSTEMLOGS: "/fms/v1/systemLog/pageSystemLogs",
    // 下载系统日志文件
    DOWNLOADSYSTEMLOG: "/fms/v1/systemLog/downloadSystemLog",
    /**
     * 上传录制文件，返回任务ID
     */
    UPLOADPLAYBACKFILE: "/fms/v1/dispatcher/playback/importExport/upload",
    /**
     * 按地图与时间范围导出本系统录制文件，返回任务ID
     */
    STARTEXPORTPLAYBACK: "/fms/v1/dispatcher/playback/importExport/export/start",
    /**
     * 下载导出的录制文件
     */
    DOWNLOADEXPORTEDFILE: "/fms/v1/dispatcher/playback/importExport/export/download",
    /**
     * 按时刻获取车辆事件
     */
    GETVEHICLEEVENTRANGES: "/fms/v1/dispatcher/playback/vehicleEventRanges",
    /**
     * 按时间范围获取系统状态区间
     */
    GETSYSTEMSTATUSRANGES: "/fms/v1/dispatcher/playback/systemStatusRanges",
    /**
     * 本系统回放：按时刻查询某车最接近的交管原因
     */
    GETLOCALTRAFFICREASON: "/fms/v1/dispatcher/playback/local/trafficReason",
    /**
     * 按时间范围获取回放帧列表
     */
    GETPLAYBACKFRAMES: "/fms/v1/dispatcher/playback/frames",
    /**
     * 查询任务进度（上传/导出通用）
     */
    GETTASKPROGRESS: "/fms/v1/dispatcher/playback/importExport/task/progress",
    /**
     * 刷新任务心跳
     */
    REFRESHTASKHEARTBEAT: "/fms/v1/dispatcher/playback/importExport/heartbeat",
    /**
     * 删除已导入录制文件
     */
    DELETEIMPORTRECORDING: "/fms/v1/dispatcher/playback/importExport/upload/delete",
    /**
     * 分页查询已导入录制文件
     */
    PAGEIMPORTRECORDINGS: "/fms/v1/dispatcher/playback/importExport/upload/page",
    /**
     * 查询导入文件的地图信息
     */
    GETIMPORTMAPINFO: "/fms/v1/dispatcher/playback/importExport/getImportMapInfo",

    /**
     * 分页查询订单任务
     * @param params 分页参数
     */
    PAGEORDERTASKS: "/fms/v1/dispatcher/orderTask/getOrderTasks",
    //*********************************************************************系统设置******************************************************//
    // 上传系统配置图片
    UPLOADSYSTEMIMAGE: "/fms/v1/systemLogos",
    // 获取系统配置图片
    GETSYSTEMIMAGE: "/fms/v1/systemLogos",
    // 分页查询系统日志
    PAGESYSLOGS: "/fms/v1/common/sysLog/pageSysLogs",
    // 获取激活信息
    GETLICENSE: "/fms/v1/auth/license/getLicense",
    //*********************************************************************交通信号灯******************************************************//
    // 添加交通信号灯
    ADDTRAFFICLIGHT: "/fms/v1/device/trafficLight/addTrafficLight",
    // 分页查询交通灯信息
    PAGETRAFFICLIGHTS: "/fms/v1/device/trafficLight/pageTrafficLights",
    // 更新交通信号灯信息
    UPDATETRAFFICLIGHT: "/fms/v1/device/trafficLight/updateTrafficLight",
    // 删除交通信号灯信息
    DELETETRAFFICLIGHT: "/fms/v1/device/trafficLight/deleteTrafficLight",
    // 测试交通信号灯
    TESTTRAFFICLIGHT: "/fms/v1/device/trafficLight/testTrafficLight",
    // 查询所有的交通灯集合
    GETTRAFFICLIGHTS: "/fms/v1/device/trafficLight/getTrafficLights",
    // 获取交通灯驱动集合
    GETTRAFFICLIGHTDRIVERS: "/fms/v1/device/trafficLight/getDrivers",
    //*********************************************************************载具类型******************************************************//
    // 创建载具类型
    CREATECARRIER: "/fms/v1/dispatcher/carrier/createCarrier",
    // 分页查询载具类型
    PAGECARRIERS: "/fms/v1/dispatcher/carrier/pageCarriers",
    // 修改载具类型
    UPDATECARRIER: "/fms/v1/dispatcher/carrier/updateCarrier",
    // 删除载具类型
    DELETECARRIER: "/fms/v1/dispatcher/carrier/deleteCarrier",
    //*********************************************************************地图版本******************************************************//
    // 更新地图版本json数据
    UPDATEMAPINFOVERSIONJSON: "/fms/v1/dispatcher/mapVersion/updateMapInfoVersionJson",
    // 推送地图版本
    PUSHMAPINFOVERSION: "/fms/v1/dispatcher/mapVersion/pushMapInfoVersion",
    // 发布地图版本
    PUBLISHMAPINFOVERSION: "/fms/v1/dispatcher/mapVersion/publishMapInfoVersion",
    // 分页查询地图版本数据
    PAGEMAPINFOVERSIONS: "/fms/v1/dispatcher/mapVersion/pageMapInfoVersions",
    // 获取地图版本数据
    GETMAPINFOVERSION: "/fms/v1/dispatcher/mapVersion/getMapInfoVersion",
    //*********************************************************************地图文件操作******************************************************//
    // 车辆下载地图数据
    VEHICLEDOWNLOADMAP: "/fms/v1/dispatcher/map/vehicleDownloadMap",
    // 上传车载地图文件
    UPLOADVEHICLEMAP: "/fms/v1/dispatcher/map/uploadVehicleMap",
    // 上传std地图json文件
    UPLOADSTDMAPJSON: "/fms/v1/dispatcher/map/uploadStdMapJson",
    // 上传调度地图文件
    UPLOADMAPFILE: "/fms/v1/dispatcher/map/uploadMap",
    // 下载地图文件
    DOWNLOADMAP: "/fms/v1/dispatcher/map/downloadMap",
    //*********************************************************************数据库备份******************************************************//
    // 下载数据库备份文件
    DOWNLOADDATABASEBACKUPFILE: "/fms/v1/dataBase/downloadDataBaseBackupFile",
    // 查询所有备份的数据库
    GETDATABASES: "/fms/v1/dataBase/getDataBases",
    // 查询数据库备份文件
    GETDATABASEBACKUPFILES: "/fms/v1/dataBase/getDataBaseBackupFiles",
    /* *********************************************************************多地图点边组合****************************************************** */
    /* 创建多地图点边组合 */
    CREATESYSTEMNODEEDGEGROUP: "/fms/v1/dispatcher/systemNodeEdgeGroup/createSystemNodeEdgeGroup",
    /* 更新多地图点边组合 */
    UPDATESYSTEMNODEEDGEGROUP: "/fms/v1/dispatcher/systemNodeEdgeGroup/updateSystemNodeEdgeGroup",
    /* 删除多地图点边组合 */
    DELETESYSTEMNODEEDGEGROUP: "/fms/v1/dispatcher/systemNodeEdgeGroup/deleteSystemNodeEdgeGroup",
    /* 分页查询多地图点边组合 */
    PAGESYSTEMNODEEDGEGROUPS: "/fms/v1/dispatcher/systemNodeEdgeGroup/pageSystemNodeEdgeGroups",
    /* 查询所有地图的点边组合 */
    GETALLSIMPLENODEEDGEGROUPS: "/fms/v1/dispatcher/systemNodeEdgeGroup/getAllSimpleNodeEdgeGroups",
    //*********************************************************************用户管理******************************************************//
    // 修改用户状态
    AUTHUSERUPDATESTATE: "/fms/v1/auth/user/updateState",
    // 更新用户密码
    AUTHUSERUPDATEPASSWORD: "/fms/v1/auth/user/updatePassword",
    // 重置密码
    AUTHUSERRESETPASSWORD: "/fms/v1/auth/user/resetPassword",
    // 删除用户
    AUTHUSERDELETEUSER: "/fms/v1/auth/user/deleteUser",
    // 分配用户角色
    AUTHUSERASSIGNROLES: "/fms/v1/auth/user/assignRoles",
    // 新增用户
    AUTHUSERADDUSER: "/fms/v1/auth/user/addUser",
    // 分页查询用户列表
    AUTHUSERPAGEUSERS: "/fms/v1/auth/user/pageUsers",
    // 查询用户列表（不分页）
    AUTHUSERGETUSERS: "/fms/v1/auth/user/getUsers",
    //*********************************************************************角色管理******************************************************//
    // 更新角色
    AUTHROLEUPDATEROLE: "/fms/v1/auth/role/updateRole",
    // 删除角色
    AUTHROLEDELETE: "/fms/v1/auth/role/delete",
    // 分配角色权限
    AUTHROLEASSIGNPERMISSIONS: "/fms/v1/auth/role/assignPermissions",
    // 新增角色
    AUTHROLEADDROLE: "/fms/v1/auth/role/addRole",
    // 分页查询角色列表
    AUTHROLEPAGEROLES: "/fms/v1/auth/role/pageRoles",
    // 查询角色列表
    AUTHROLEGETROLES: "/fms/v1/auth/role/getRoles",
    //*********************************************************************权限资源******************************************************//
    // 查询权限资源列表
    AUTHPERMISSIONGETPERMISSIONS: "/fms/v1/auth/permission/getPermissions",
    /* *********************************************************************车辆告警码****************************************************** */
    /* 上传车辆告警码文件（全量覆盖） */
    UPLOADVEHICLEALARMCODEFILE: "/fms/v1/dispatcher/vehicleAlarmCode/uploadVehicleAlarmCodeFile",
    /* 更新车辆告警码 */
    UPDATEVEHICLEALARMCODE: "/fms/v1/dispatcher/vehicleAlarmCode/updateVehicleAlarmCode",
    /* 下载车辆告警码文件 */
    DOWNVEHICLEALARMCODEFILE: "/fms/v1/dispatcher/vehicleAlarmCode/downVehicleAlarmCodeFile",
    /* 删除车辆告警码 */
    DELETEVEHICLEALARMCODE: "/fms/v1/dispatcher/vehicleAlarmCode/deleteVehicleAlarmCode",
    /* 创建车辆告警码 */
    ADDVEHICLEALARMCODE: "/fms/v1/dispatcher/vehicleAlarmCode/addVehicleAlarmCode",
    /* 分页查询车辆告警码 */
    PAGEVEHICLEALARMCODES: "/fms/v1/dispatcher/vehicleAlarmCode/pageVehicleAlarmCodes",
    //*********************************************************************地图推送记录******************************************************//
    // 重新推送地图
    REPUSHMAP: "/fms/v1/dispatcher/mapPushRecord/rePushMap",
    // 分页查询地图推送记录
    PAGEMAPPUSHRECORDS: "/fms/v1/dispatcher/mapPushRecord/pageMapPushRecords",
    // 取消推送地图
    CANCELPUSHMAP: "/fms/v1/dispatcher/mapPushRecord/cancelPushMap",
    //*********************************************************************实时运行看板******************************************************//
    // 实时运行看板聚合数据
    DASHBOARDBOARD: "/fms/v1/dispatcher/dashboard/board",
    //*********************************************************************任务统计报表******************************************************//
    // 任务统计报表聚合数据
    TASKSTATISTICS: "/fms/v1/report/orderStatisticsReport/taskStatistics",
    //*********************************************************************系统告警记录******************************************************//
    // 分页查询系统告警记录
    PAGESYSTEMALARMRECORDS: "/fms/v1/report/systemAlarmRecord/pageSystemAlarmRecords",
    // 告警统计报表聚合数据
    ALARMSTATISTICS: "/fms/v1/report/systemAlarmRecord/alarmStatistics",
    //*********************************************************************服务器实时资源******************************************************//
    // 获取服务器实时资源（磁盘、内存、CPU）
    GETSERVERRESOURCECURRENT: "/fms/v1/serverResource/current",
    //*********************************************************************AGV 状态时长统计报表******************************************************//
    // AGV 状态每日时长统计（状态由参数指定，利用率由前端计算）
    AGVSTATESTATISTICS: "/fms/v1/report/vehicleStatisticsReport/agvStateStatistics",
    // AGV 各状态总时长统计（每车，按状态分组，状态由参数指定）
    AGVEXECUTINGTIMESTATISTICS: "/fms/v1/report/vehicleStatisticsReport/agvExecutingTimeStatistics",
    //*********************************************************************AGV节点映射******************************************************//
    // 更新AGV节点映射
    UPDATEAGVNODEMAPPING: "/fms/v1/dispatcher/agvNodeMapping/updateAGVNodeMapping",
    // 保存AGV节点映射
    SAVEAGVNODEMAPPING: "/fms/v1/dispatcher/agvNodeMapping/saveAGVNodeMapping",
    // 删除AGV节点映射
    DELETEAGVNODEMAPPING: "/fms/v1/dispatcher/agvNodeMapping/deleteAGVNodeMapping",
    // 分页查询节点映射
    PAGEAGVNODEMAPPINGS: "/fms/v1/dispatcher/agvNodeMapping/pageAGVNodeMapping",
    // 获取采集点位的建议
    GETCOLLECTIONNODESUGGESTIONS: "/fms/v1/dispatcher/agvNodeMapping/getSuggestionsForCollectionNodes",
};
