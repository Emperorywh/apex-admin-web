# OpenAPI endpoint 清单（T00.1 基线证据）

- 文件：C:/yangwenhua/ApexTableReact/default_OpenAPI.json
- SHA-256：A82E9B5F6EF5E564DEEE16E4E74713B28FCCB35CD0A651E3631CFD9D63D49C7C（2026-09-17 核验，与规格一致）
- 规模：238 operation / 408 schema（与规格第 1 章一致）

## action（18 个）

| Method | Path | operationId | tags |
| --- | --- | --- | --- |
| POST | /fms/v1/action/agvAction/addAGVAction | addAGVAction | 车辆动作控制类 |
| POST | /fms/v1/action/agvAction/deleteAGVAction | deleteAGVAction | 车辆动作控制类 |
| GET | /fms/v1/action/agvAction/exportExcel | exportExcel | 车辆动作控制类 |
| GET | /fms/v1/action/agvAction/getAGVActions | getAGVActions | 车辆动作控制类 |
| POST | /fms/v1/action/agvAction/importExcel | importExcel | 车辆动作控制类 |
| GET | /fms/v1/action/agvAction/pageAGVActions | pageAGVActions | 车辆动作控制类 |
| POST | /fms/v1/action/agvAction/updateAGVAction | updateAGVAction | 车辆动作控制类 |
| POST | /fms/v1/action/agvActionGroup/addAGVActionGroup | addAGVActionGroup | 车辆动作组控制类 |
| POST | /fms/v1/action/agvActionGroup/deleteAGVActionGroup | deleteAGVActionGroup | 车辆动作组控制类 |
| GET | /fms/v1/action/agvActionGroup/getAGVActionGroups | getAGVActionGroups | 车辆动作组控制类 |
| GET | /fms/v1/action/agvActionGroup/pageAGVActionGroups | pageAGVActionGroups | 车辆动作组控制类 |
| POST | /fms/v1/action/agvActionGroup/updateAGVActionGroup | updateAGVActionGroup | 车辆动作组控制类 |
| POST | /fms/v1/action/sysAction/addSysAction | addSysAction | 系统动作控制类 |
| POST | /fms/v1/action/sysAction/deleteSysAction | deleteSysAction | 系统动作控制类 |
| GET | /fms/v1/action/sysAction/getSysActionImplements | getSysActionImplements | 系统动作控制类 |
| GET | /fms/v1/action/sysAction/getSysActions | getSysActions | 系统动作控制类 |
| GET | /fms/v1/action/sysAction/pageSysActions | pageSysActions | 系统动作控制类 |
| POST | /fms/v1/action/sysAction/updateSysAction | updateSysAction | 系统动作控制类 |

## auth（20 个）

| Method | Path | operationId | tags |
| --- | --- | --- | --- |
| POST | /fms/v1/auth/authorize/login | login | 登录控制 |
| POST | /fms/v1/auth/authorize/logout | logout | 登录控制 |
| GET | /fms/v1/auth/license/getHardwareInfo | getHardwareInfo | 软件授权控制 |
| POST | /fms/v1/auth/license/getLicense | getLicense | 软件授权控制 |
| POST | /fms/v1/auth/license/softwareActivation | softwareActivation | 软件授权控制 |
| GET | /fms/v1/auth/permission/getPermissions | getPermissions | 权限资源管理 |
| POST | /fms/v1/auth/role/addRole | addRole | 角色管理 |
| POST | /fms/v1/auth/role/assignPermissions | assignPermissions | 角色管理 |
| POST | /fms/v1/auth/role/delete | deleteRole | 角色管理 |
| GET | /fms/v1/auth/role/getRoles | getRoles | 角色管理 |
| GET | /fms/v1/auth/role/pageRoles | pageRoles | 角色管理 |
| POST | /fms/v1/auth/role/updateRole | updateRole | 角色管理 |
| POST | /fms/v1/auth/user/addUser | addUser | 用户授权管理 |
| POST | /fms/v1/auth/user/assignRoles | assignRoles | 用户授权管理 |
| POST | /fms/v1/auth/user/deleteUser | deleteUser | 用户授权管理 |
| GET | /fms/v1/auth/user/getUsers | getUsers | 用户授权管理 |
| GET | /fms/v1/auth/user/pageUsers | pageUsers | 用户授权管理 |
| POST | /fms/v1/auth/user/resetPassword | resetPassword | 用户授权管理 |
| POST | /fms/v1/auth/user/updatePassword | updatePassword | 用户授权管理 |
| POST | /fms/v1/auth/user/updateState | updateState | 用户授权管理 |

## common（2 个）

| Method | Path | operationId | tags |
| --- | --- | --- | --- |
| GET | /fms/v1/common/metrics/getMetrics | getMetrics | 性能指标统计类 |
| POST | /fms/v1/common/sysLog/pageSysLogs | pageSysLogs | 系统日志控制类 |

## dataBase（3 个）

| Method | Path | operationId | tags |
| --- | --- | --- | --- |
| GET | /fms/v1/dataBase/downloadDataBaseBackupFile | downloadDataBaseBackupFile | 数据库控制类 |
| GET | /fms/v1/dataBase/getDataBaseBackupFiles | getDataBaseBackupFiles | 数据库控制类 |
| GET | /fms/v1/dataBase/getDataBases | getDataBases | 数据库控制类 |

## device（48 个）

| Method | Path | operationId | tags |
| --- | --- | --- | --- |
| POST | /fms/v1/device/airShowerDoor/addAirShowerDoor | addAirShowerDoor | 风淋门模块 |
| POST | /fms/v1/device/airShowerDoor/clearAirShowerDoorOccupy | clearAirShowerDoorOccupy | 风淋门模块 |
| POST | /fms/v1/device/airShowerDoor/closeDoor | closeDoor_2 | 风淋门模块 |
| POST | /fms/v1/device/airShowerDoor/deleteAirShowerDoor | deleteAirShowerDoor | 风淋门模块 |
| GET | /fms/v1/device/airShowerDoor/getAirShowerDoorDrivers | getAirShowerDoorDrivers | 风淋门模块 |
| GET | /fms/v1/device/airShowerDoor/getAirShowerDoorState | getAirShowerDoorState | 风淋门模块 |
| GET | /fms/v1/device/airShowerDoor/getAirShowerDoors | getAirShowerDoors | 风淋门模块 |
| POST | /fms/v1/device/airShowerDoor/openDoor | openDoor_2 | 风淋门模块 |
| GET | /fms/v1/device/airShowerDoor/pageAirShowerDoors | pageAirShowerDoors | 风淋门模块 |
| POST | /fms/v1/device/airShowerDoor/shower | shower | 风淋门模块 |
| POST | /fms/v1/device/airShowerDoor/updateAirShowerDoor | updateAirShowerDoor | 风淋门模块 |
| POST | /fms/v1/device/autoDoor/addAutoDoor | addAutoDoor | 自动门模块 |
| POST | /fms/v1/device/autoDoor/clearAutoDoorOccupy | clearAutoDoorOccupy | 自动门模块 |
| POST | /fms/v1/device/autoDoor/closeDoor | closeDoor_1 | 自动门模块 |
| POST | /fms/v1/device/autoDoor/deleteAutoDoor | deleteAutoDoor | 自动门模块 |
| GET | /fms/v1/device/autoDoor/getAutoDoorDrivers | getAutoDoorDrivers | 自动门模块 |
| GET | /fms/v1/device/autoDoor/getAutoDoorState | getAutoDoorState | 自动门模块 |
| GET | /fms/v1/device/autoDoor/getAutoDoors | getAutoDoors | 自动门模块 |
| POST | /fms/v1/device/autoDoor/openDoor | openDoor_1 | 自动门模块 |
| GET | /fms/v1/device/autoDoor/pageAutoDoors | pageAutoDoors | 自动门模块 |
| POST | /fms/v1/device/autoDoor/updateAutoDoor | updateAutoDoor | 自动门模块 |
| POST | /fms/v1/device/chargePile/addChargePile | addChargePile | 充电桩模块 |
| POST | /fms/v1/device/chargePile/deleteChargePile | deleteChargePile | 充电桩模块 |
| GET | /fms/v1/device/chargePile/getAllChargePiles | getAllChargePiles | 充电桩模块 |
| GET | /fms/v1/device/chargePile/getChargePileDetail | getChargePileDetail | 充电桩模块 |
| GET | /fms/v1/device/chargePile/getChargePileDrivers | getChargePileDrivers | 充电桩模块 |
| GET | /fms/v1/device/chargePile/pageChargePiles | pageChargePiles | 充电桩模块 |
| POST | /fms/v1/device/chargePile/startCharge | startCharge | 充电桩模块 |
| POST | /fms/v1/device/chargePile/stopCharge | stopCharge | 充电桩模块 |
| POST | /fms/v1/device/chargePile/updateChargePile | updateChargePile | 充电桩模块 |
| POST | /fms/v1/device/elevator/addElevator | addElevator | 电梯模块 |
| POST | /fms/v1/device/elevator/clearElevatorOccupy | clearElevatorOccupy | 电梯模块 |
| POST | /fms/v1/device/elevator/closeDoor | closeDoor | 电梯模块 |
| POST | /fms/v1/device/elevator/deleteElevator | deleteElevator | 电梯模块 |
| GET | /fms/v1/device/elevator/getElevatorDrivers | getElevatorDrivers | 电梯模块 |
| GET | /fms/v1/device/elevator/getElevatorState | getElevatorState | 电梯模块 |
| GET | /fms/v1/device/elevator/getElevators | getElevators | 电梯模块 |
| POST | /fms/v1/device/elevator/openDoor | openDoor | 电梯模块 |
| POST | /fms/v1/device/elevator/outerCall | outerCall | 电梯模块 |
| GET | /fms/v1/device/elevator/pageElevators | pageElevators | 电梯模块 |
| POST | /fms/v1/device/elevator/updateElevator | updateElevator | 电梯模块 |
| POST | /fms/v1/device/trafficLight/addTrafficLight | addTrafficLight | 交通信号灯模块 |
| POST | /fms/v1/device/trafficLight/deleteTrafficLight | deleteTrafficLight | 交通信号灯模块 |
| GET | /fms/v1/device/trafficLight/getDrivers | getDrivers | 交通信号灯模块 |
| GET | /fms/v1/device/trafficLight/getTrafficLights | getTrafficLights | 交通信号灯模块 |
| GET | /fms/v1/device/trafficLight/pageTrafficLights | pageTrafficLights | 交通信号灯模块 |
| POST | /fms/v1/device/trafficLight/testTrafficLight | testTrafficLight | 交通信号灯模块 |
| POST | /fms/v1/device/trafficLight/updateTrafficLight | updateTrafficLight | 交通信号灯模块 |

## dispatcher（123 个）

| Method | Path | operationId | tags |
| --- | --- | --- | --- |
| POST | /fms/v1/dispatcher/agvNodeMapping/deleteAGVNodeMapping | deleteAGVNodeMapping | AGV节点映射模块 |
| GET | /fms/v1/dispatcher/agvNodeMapping/getSuggestionsForCollectionNodes | getSuggestionsForCollectionNodes | AGV节点映射模块 |
| GET | /fms/v1/dispatcher/agvNodeMapping/pageAGVNodeMapping | pageAGVNodeMapping | AGV节点映射模块 |
| POST | /fms/v1/dispatcher/agvNodeMapping/saveAGVNodeMapping | saveAGVNodeMapping | AGV节点映射模块 |
| POST | /fms/v1/dispatcher/agvNodeMapping/updateAGVNodeMapping | updateAGVNodeMapping | AGV节点映射模块 |
| POST | /fms/v1/dispatcher/carrier/createCarrier | createCarrier | 载具类型模块 |
| POST | /fms/v1/dispatcher/carrier/deleteCarrier | deleteCarrier | 载具类型模块 |
| POST | /fms/v1/dispatcher/carrier/pageCarriers | pageCarriers | 载具类型模块 |
| POST | /fms/v1/dispatcher/carrier/updateCarrier | updateCarrier | 载具类型模块 |
| POST | /fms/v1/dispatcher/crossMap/createCrossMap | createCrossMap | 多地图模块 |
| POST | /fms/v1/dispatcher/crossMap/deleteCrossMap | deleteCrossMap | 多地图模块 |
| GET | /fms/v1/dispatcher/crossMap/getCrossMapStations | getCrossMapStations | 多地图模块 |
| GET | /fms/v1/dispatcher/crossMap/pageCrossMaps | pageCrossMaps | 多地图模块 |
| POST | /fms/v1/dispatcher/crossMap/updateCrossMap | updateCrossMap | 多地图模块 |
| POST | /fms/v1/dispatcher/dashboard/board | board | 实时运行看板控制类 |
| POST | /fms/v1/dispatcher/map/connectivityVerification | connectivityVerification | 地图模块 |
| POST | /fms/v1/dispatcher/map/createMap | createMap | 地图模块 |
| POST | /fms/v1/dispatcher/map/deleteMap | deleteMap | 地图模块 |
| POST | /fms/v1/dispatcher/map/downloadMap | downloadMap | 地图模块 |
| GET | /fms/v1/dispatcher/map/getMapInfo | getMapInfo | 地图模块 |
| GET | /fms/v1/dispatcher/map/getMapInfos | getMapInfos | 地图模块 |
| GET | /fms/v1/dispatcher/map/getSimpleMaps | getSimpleMaps | 地图模块 |
| GET | /fms/v1/dispatcher/map/getSimpleTripartiteTrafficEdgeGroups | getSimpleTripartiteTrafficEdgeGroups | 地图模块 |
| GET | /fms/v1/dispatcher/map/getSites | getSites | 地图模块 |
| GET | /fms/v1/dispatcher/map/getStations | getStations | 地图模块 |
| GET | /fms/v1/dispatcher/map/pageMapInfos | pageMapInfos | 地图模块 |
| POST | /fms/v1/dispatcher/map/shortPath | shortPath | 地图模块 |
| POST | /fms/v1/dispatcher/map/updateMap | updateMap | 地图模块 |
| POST | /fms/v1/dispatcher/map/uploadMap | uploadMap | 地图模块 |
| POST | /fms/v1/dispatcher/map/uploadStdMapJson | uploadStdMapJson | 地图模块 |
| POST | /fms/v1/dispatcher/map/uploadVehicleMap | uploadVehicleMap | 地图模块 |
| GET | /fms/v1/dispatcher/map/vehicleDownloadMap | vehicleDownloadMap | 地图模块 |
| POST | /fms/v1/dispatcher/mapPushRecord/cancelPushMap | cancelPushMap | 地图版本推送记录模块 |
| GET | /fms/v1/dispatcher/mapPushRecord/pageMapPushRecords | pageMapPushRecords | 地图版本推送记录模块 |
| POST | /fms/v1/dispatcher/mapPushRecord/rePushMap | rePushMap | 地图版本推送记录模块 |
| GET | /fms/v1/dispatcher/mapVersion/getMapInfoVersion | getMapInfoVersion | 地图版本模块 |
| GET | /fms/v1/dispatcher/mapVersion/pageMapInfoVersions | pageMapInfoVersions | 地图版本模块 |
| POST | /fms/v1/dispatcher/mapVersion/publishMapInfoVersion | publishMapInfoVersion | 地图版本模块 |
| POST | /fms/v1/dispatcher/mapVersion/pushMapInfoVersion | pushMapInfoVersion | 地图版本模块 |
| POST | /fms/v1/dispatcher/mapVersion/updateMapInfoVersionJson | updateMapInfoVersionJson | 地图版本模块 |
| POST | /fms/v1/dispatcher/obstacleAvoidance/createObstacleAvoidance | createObstacleAvoidance | 避障模型数据控制类 |
| POST | /fms/v1/dispatcher/obstacleAvoidance/deleteObstacleAvoidance | deleteObstacleAvoidance | 避障模型数据控制类 |
| GET | /fms/v1/dispatcher/obstacleAvoidance/getObstacleAvoidanceList | getObstacleAvoidanceList | 避障模型数据控制类 |
| GET | /fms/v1/dispatcher/obstacleAvoidance/pageObstacleAvoidance | pageObstacleAvoidance | 避障模型数据控制类 |
| POST | /fms/v1/dispatcher/obstacleAvoidance/updateObstacleAvoidance | updateObstacleAvoidance | 避障模型数据控制类 |
| POST | /fms/v1/dispatcher/orderFlow/createOrderFlow | createOrderFlow | 订单工艺控制类 |
| POST | /fms/v1/dispatcher/orderFlow/orderFlowOperation | orderFlowOperation | 订单工艺控制类 |
| GET | /fms/v1/dispatcher/orderFlow/pageOrderFlows | pageOrderFlows | 订单工艺控制类 |
| POST | /fms/v1/dispatcher/orderFlow/subOrderFlowOperation | subOrderFlowOperation | 订单工艺控制类 |
| POST | /fms/v1/dispatcher/orderRecord/createOrderRecord | createOrderRecord | 订单记录控制类 |
| GET | /fms/v1/dispatcher/orderRecord/exportOrderRecords | exportOrderRecords | 订单记录控制类 |
| GET | /fms/v1/dispatcher/orderRecord/getOrderRecord | getOrderRecord | 订单记录控制类 |
| GET | /fms/v1/dispatcher/orderRecord/getOrderRecordByTaskId | getOrderRecordByTaskId | 订单记录控制类 |
| POST | /fms/v1/dispatcher/orderRecord/getOrderRecordDetail | getOrderRecordDetail | 订单记录控制类 |
| POST | /fms/v1/dispatcher/orderRecord/listMissionsByUpperKeys | listMissionsByUpperKeys | 订单记录控制类 |
| GET | /fms/v1/dispatcher/orderRecord/orderRecordStateStatistic | orderRecordStateStatistic | 订单记录控制类 |
| GET | /fms/v1/dispatcher/orderRecord/pageOrderRecords | pageOrderRecords | 订单记录控制类 |
| POST | /fms/v1/dispatcher/orderRecord/updateOrderRecord | updateOrderRecord | 订单记录控制类 |
| GET | /fms/v1/dispatcher/orderTask/getOrderTasks | getOrderTasks | 调度任务控制类 |
| GET | /fms/v1/dispatcher/orderTask/getTrafficReason | getTrafficReason | 调度任务控制类 |
| GET | /fms/v1/dispatcher/orderTask/getUnFinishedOrderSize/{mapId} | getUnFinishedOrderSize | 调度任务控制类 |
| POST | /fms/v1/dispatcher/orderTask/mockCharge | mockCharge | 调度任务控制类 |
| POST | /fms/v1/dispatcher/orderTask/mockDispatch | mockDispatch | 调度任务控制类 |
| POST | /fms/v1/dispatcher/orderTask/mockPark | mockPark | 调度任务控制类 |
| POST | /fms/v1/dispatcher/orderTask/orderTaskOperate | orderTaskOperate | 调度任务控制类 |
| POST | /fms/v1/dispatcher/orderTemplate/createOrderRecords | createOrderRecords | 订单模版控制类 |
| POST | /fms/v1/dispatcher/orderTemplate/createOrderTemplate | createOrderTemplate | 订单模版控制类 |
| POST | /fms/v1/dispatcher/orderTemplate/deleteOrderTemplate | deleteOrderTemplate | 订单模版控制类 |
| GET | /fms/v1/dispatcher/orderTemplate/getOrderTemplates | getOrderTemplates | 订单模版控制类 |
| GET | /fms/v1/dispatcher/orderTemplate/pageOrderTemplates | pageOrderTemplates | 订单模版控制类 |
| POST | /fms/v1/dispatcher/orderTemplate/updateOrderTemplate | updateOrderTemplate | 订单模版控制类 |
| GET | /fms/v1/dispatcher/playback/frames | getFrames | 回放接口 |
| GET | /fms/v1/dispatcher/playback/importExport/export/download | downloadExport | 回放导入导出接口 |
| POST | /fms/v1/dispatcher/playback/importExport/export/start | startExport | 回放导入导出接口 |
| GET | /fms/v1/dispatcher/playback/importExport/getImportMapInfo | getImportMapInfo | 回放导入导出接口 |
| POST | /fms/v1/dispatcher/playback/importExport/heartbeat | heartbeat | 回放导入导出接口 |
| POST | /fms/v1/dispatcher/playback/importExport/task/cancel | cancel | 回放导入导出接口 |
| GET | /fms/v1/dispatcher/playback/importExport/task/progress | getExportProgress | 回放导入导出接口 |
| POST | /fms/v1/dispatcher/playback/importExport/upload | upload | 回放导入导出接口 |
| POST | /fms/v1/dispatcher/playback/importExport/upload/delete | deleteImportRecording | 回放导入导出接口 |
| GET | /fms/v1/dispatcher/playback/importExport/upload/page | pageImportRecordings | 回放导入导出接口 |
| GET | /fms/v1/dispatcher/playback/local/trafficReason | getLocalTrafficReason | 回放接口 |
| GET | /fms/v1/dispatcher/playback/policies | listPolicies | 回放接口 |
| POST | /fms/v1/dispatcher/playback/policies | updatePolicies | 回放接口 |
| GET | /fms/v1/dispatcher/playback/systemStatusRanges | getSystemStatusRanges | 回放接口 |
| GET | /fms/v1/dispatcher/playback/vehicleEventRanges | getVehicleEventRanges | 回放接口 |
| POST | /fms/v1/dispatcher/systemNodeEdgeGroup/createSystemNodeEdgeGroup | createSystemNodeEdgeGroup | 多地图点边组合模块 |
| POST | /fms/v1/dispatcher/systemNodeEdgeGroup/deleteSystemNodeEdgeGroup | deleteSystemNodeEdgeGroup | 多地图点边组合模块 |
| GET | /fms/v1/dispatcher/systemNodeEdgeGroup/getAllSimpleNodeEdgeGroups | getAllSimpleNodeEdgeGroups | 多地图点边组合模块 |
| GET | /fms/v1/dispatcher/systemNodeEdgeGroup/pageSystemNodeEdgeGroups | pageSystemNodeEdgeGroups | 多地图点边组合模块 |
| POST | /fms/v1/dispatcher/systemNodeEdgeGroup/updateSystemNodeEdgeGroup | updateSystemNodeEdgeGroup | 多地图点边组合模块 |
| POST | /fms/v1/dispatcher/taskConfig/batchEditConfigs | batchEditConfigs | 调度配置控制类 |
| POST | /fms/v1/dispatcher/taskConfig/editConfig | editConfig | 调度配置控制类 |
| GET | /fms/v1/dispatcher/taskConfig/getTaskConfigs | getTaskConfigs | 调度配置控制类 |
| POST | /fms/v1/dispatcher/tripartiteTraffic/addTripartiteTraffic | addTripartiteTraffic | 三方交管配置类 |
| POST | /fms/v1/dispatcher/tripartiteTraffic/deleteTripartiteTraffic | deleteTripartiteTraffic | 三方交管配置类 |
| GET | /fms/v1/dispatcher/tripartiteTraffic/pageTripartiteTraffics | pageTripartiteTraffics | 三方交管配置类 |
| POST | /fms/v1/dispatcher/tripartiteTraffic/testCommunication | testCommunication | 三方交管配置类 |
| POST | /fms/v1/dispatcher/tripartiteTraffic/updateTripartiteTraffic | updateTripartiteTraffic | 三方交管配置类 |
| POST | /fms/v1/dispatcher/vehicle/addVehicle | addVehicle | 车辆控制类 |
| POST | /fms/v1/dispatcher/vehicle/allVehicleOperate | allVehicleOperate | 车辆控制类 |
| POST | /fms/v1/dispatcher/vehicle/clearVehicleTraffics | clearVehicleTraffics | 车辆控制类 |
| POST | /fms/v1/dispatcher/vehicle/deleteVehicle | deleteVehicle | 车辆控制类 |
| GET | /fms/v1/dispatcher/vehicle/getSimpleVehicles | getSimpleVehicles | 车辆控制类 |
| GET | /fms/v1/dispatcher/vehicle/getUnRelationSimpleVehicles | getUnRelationSimpleVehicles | 车辆控制类 |
| GET | /fms/v1/dispatcher/vehicle/getVehicle | getVehicle | 车辆控制类 |
| GET | /fms/v1/dispatcher/vehicle/getVehicleMaps | getVehicleMaps | 车辆控制类 |
| GET | /fms/v1/dispatcher/vehicle/getVehicleState | getVehicleState | 车辆控制类 |
| GET | /fms/v1/dispatcher/vehicle/pageVehicles | pageVehicles | 车辆控制类 |
| POST | /fms/v1/dispatcher/vehicle/resetVehicle | resetVehicle | 车辆控制类 |
| POST | /fms/v1/dispatcher/vehicle/updateVehicle | updateVehicle | 车辆控制类 |
| POST | /fms/v1/dispatcher/vehicle/vehicleOperate | vehicleOperate | 车辆控制类 |
| POST | /fms/v1/dispatcher/vehicleAlarmCode/addVehicleAlarmCode | addVehicleAlarmCode | 车辆告警码控制类 |
| POST | /fms/v1/dispatcher/vehicleAlarmCode/deleteVehicleAlarmCode | deleteVehicleAlarmCode | 车辆告警码控制类 |
| POST | /fms/v1/dispatcher/vehicleAlarmCode/downVehicleAlarmCodeFile | downVehicleAlarmCodeFile | 车辆告警码控制类 |
| GET | /fms/v1/dispatcher/vehicleAlarmCode/pageVehicleAlarmCodes | pageVehicleAlarmCodes | 车辆告警码控制类 |
| POST | /fms/v1/dispatcher/vehicleAlarmCode/updateVehicleAlarmCode | updateVehicleAlarmCode | 车辆告警码控制类 |
| POST | /fms/v1/dispatcher/vehicleAlarmCode/uploadVehicleAlarmCodeFile | uploadVehicleAlarmCodeFile | 车辆告警码控制类 |
| POST | /fms/v1/dispatcher/vehicleGroup/addVehicleGroup | addVehicleGroup | 车型组控制类 |
| POST | /fms/v1/dispatcher/vehicleGroup/deleteVehicleGroup | deleteVehicleGroup | 车型组控制类 |
| GET | /fms/v1/dispatcher/vehicleGroup/getVehicleGroups | getVehicleGroups | 车型组控制类 |
| GET | /fms/v1/dispatcher/vehicleGroup/pageVehicleGroups | pageVehicleGroups | 车型组控制类 |
| POST | /fms/v1/dispatcher/vehicleGroup/updateVehicleGroup | updateVehicleGroup | 车型组控制类 |

## report（7 个）

| Method | Path | operationId | tags |
| --- | --- | --- | --- |
| POST | /fms/v1/report/orderStatisticsReport/orderEfficiencyStatistics | orderEfficiencyStatistics | 订单报表控制类 |
| POST | /fms/v1/report/orderStatisticsReport/orderQuantityStatistics | orderQuantityStatistics | 订单报表控制类 |
| POST | /fms/v1/report/orderStatisticsReport/taskStatistics | taskStatistics | 订单报表控制类 |
| POST | /fms/v1/report/systemAlarmRecord/alarmStatistics | alarmStatistics | 系统告警记录控制类 |
| POST | /fms/v1/report/systemAlarmRecord/pageSystemAlarmRecords | pageSystemAlarmRecords | 系统告警记录控制类 |
| POST | /fms/v1/report/vehicleStatisticsReport/agvExecutingTimeStatistics | agvExecutingTimeStatistics | 车辆报表控制类 |
| POST | /fms/v1/report/vehicleStatisticsReport/agvStateStatistics | agvStateStatistics | 车辆报表控制类 |

## serverResource（1 个）

| Method | Path | operationId | tags |
| --- | --- | --- | --- |
| GET | /fms/v1/serverResource/current | getCurrent | 服务器资源监控 |

## systemLog（3 个）

| Method | Path | operationId | tags |
| --- | --- | --- | --- |
| POST | /fms/v1/systemLog/downloadSystemLog | downloadSystemLog | 系统控制类 |
| GET | /fms/v1/systemLog/getSystemLogTypes | getSystemLogTypes | 系统控制类 |
| GET | /fms/v1/systemLog/pageSystemLogs | pageSystemLogs | 系统控制类 |

## systemLogos（6 个）

| Method | Path | operationId | tags |
| --- | --- | --- | --- |
| GET | /fms/v1/systemLogos | listMeta | 系统 Logo |
| GET | /fms/v1/systemLogos/{placementKey} | getMeta | 系统 Logo |
| PUT | /fms/v1/systemLogos/{placementKey} | upsert | 系统 Logo |
| DELETE | /fms/v1/systemLogos/{placementKey} | delete | 系统 Logo |
| GET | /fms/v1/systemLogos/{placementKey}/file | getFile | 系统 Logo |
| GET | /fms/v1/systemLogos/{placementKey}/fileBase64 | getFileBase64 | 系统 Logo |

## systemVersion（6 个）

| Method | Path | operationId | tags |
| --- | --- | --- | --- |
| POST | /fms/v1/systemVersion/deletePendingJar | deletePendingJar | 系统版本控制类 |
| POST | /fms/v1/systemVersion/downloadSystemVersionJar | downloadSystemVersionJar | 系统版本控制类 |
| GET | /fms/v1/systemVersion/getSystemVersions | getSystemVersions | 系统版本控制类 |
| POST | /fms/v1/systemVersion/restartSystem | restartSystem | 系统版本控制类 |
| POST | /fms/v1/systemVersion/rollback | rollback | 系统版本控制类 |
| POST | /fms/v1/systemVersion/uploadSystemVersion | uploadSystemVersion | 系统版本控制类 |

## tripartiteTraffic（1 个）

| Method | Path | operationId | tags |
| --- | --- | --- | --- |
| POST | /rbrainrobot/v1/tripartiteTraffic | applyTripartiteTraffic | 三方交管对外接口 |
