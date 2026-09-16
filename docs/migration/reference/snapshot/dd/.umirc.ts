import { defineConfig } from "@umijs/max";
import { PERM } from "./src/constants/permission";
import packageJson from "./package.json";
const fs = require("fs");
let branch = "unknown";
try {
	branch = fs.readFileSync("../.git/HEAD", "utf-8");
} catch (e) {
	try {
		branch = fs.readFileSync(".git/HEAD", "utf-8");
	} catch (e2) {
		console.log("git branch not found");
	}
}

export default defineConfig({
	hash: true,
	history: {
		type: "hash"
	},
	base: "/",
	publicPath: "/",
	esbuildMinifyIIFE: true,
	helmet: false,
	/*
	 * 关闭 MFSU 以解决无限重编译问题
	 * 根本原因：MFSU eager 模式与 Icons 插件及 esbuild prepare build
	 * 之间存在文件监听反馈循环，导致 icons.tsx 和 appData.json
	 * 被反复重写，触发 webpack 持续重编译
	 */
	mfsu: false,
	deadCode: {
		patterns: ["src/pages/**", "src/api/**", "src/assets/**", "src/components/**", "src/constants/**", "src/icons/**", "src/models/**", "src/plugins/**", "src/types/**", "src/utils/**"]
	},
	antd: {
		configProvider: {
			locale: "zh-cn"
		},
		theme: {
			cssVar: true,
			hashed: false
		}
	},
	icons: {
		include: [
			"local:eye",
			"local:eye-close",
			"local:pause-fill",
			"local:continue-fill",
			"local:park-fill",
			"local:charge-fill",
			"local:position",
			"local:zoom-in",
			"local:zoom-out",
			"local:fit-view",
			"local:rotate-map",
		]
	},
	access: {},
	model: {},
	initialState: {},
	request: {},
	locale: {
		default: "zh-CN"
	},
	layout: {
		locale: true
	},
	metas: [
		{
			name: "date",
			content: new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString()
		},
		{
			name: "version",
			content: packageJson.version
		},
		{
			name: "branch",
			content: branch
		}
	],
	routes: [
		{
			path: "/",
			redirect: "/login"
		},
		{
			name: "登录",
			path: "/login",
			component: "./Login",
			layout: false
		},
		{
			name: "软件授权",
			path: "/authorize-ingress",
			component: "./AuthorizeIngress",
			layout: false
		},
		{
			name: "调度监控",
			icon: "BorderlessTableOutlined",
			path: "/over-look",
			component: "./Overlook",
			access: PERM.OVERVIEW_VIEW
		},
		{
			name: "任务管理",
			icon: "BarsOutlined",
			path: "/order-record",
			component: "./OrderRecord",
			access: PERM.ORDER_RECORD_VIEW
		},
		{
			name: "车辆管理",
			icon: "CarOutlined",
			path: "/vehicle-deploy",
			component: "./VehicleDeploy",
			access: PERM.VEHICLE_MANAGE,
			routes: [
				{
					name: "车辆分组",
					path: "/vehicle-deploy/vehicle-group",
					component: "./VehicleDeploy/VehicleGroup",
					access: PERM.VEHICLE_GROUP_VIEW
				},
				{
					name: "车辆列表",
					path: "/vehicle-deploy/vehicle-diplay",
					component: "./VehicleDeploy/VehicleDisplay",
					access: PERM.VEHICLE_LIST_VIEW
				},
				{
					name: "载具类型",
					path: "/vehicle-deploy/vehicle-type",
					component: "./VehicleDeploy/VehicleType",
				},
				{
					name: "节点映射",
					path: "/vehicle-deploy/node-mapping",
					component: "./VehicleDeploy/NodeMapping",
					access: PERM.NODE_MAPPING_VIEW
				},
				{
					name: "告警码管理",
					path: "/vehicle-deploy/alarm-code-management",
					component: "./SystemInvolve/AlarmCodeManagement",
					access: PERM.VEHICLE_ALARM_CODE_VIEW
				}
			]
		},
		{
			name: "地图管理",
			icon: "PictureOutlined",
			path: "/map-through",
			component: "./MapThrough",
			access: PERM.MAP_MANAGE,
			routes: [
				{
					name: "地图列表",
					path: "/map-through/map-list",
					component: "./MapThrough/MapList",
					access: PERM.MAP_LIST_VIEW
				},
				{
					name: "地图编辑",
					path: "/map-through/map-nest-modify",
					component: "./MapThrough/MapNestModify",
					access: PERM.MAP_EDIT_VIEW
				},
				{
					name: "地图关联",
					path: "/map-through/cross-maps",
					component: "./MapThrough/CrossMaps",
					access: PERM.CROSS_MAP_VIEW
				},
				{
					name: "多地图点边组合",
					path: "/map-through/point-edge-combination",
					component: "./MapThrough/PointEdgeCombination",
					access: PERM.POINT_EDGE_COMBINATION_VIEW
				},
				{
					name: "地图推送记录",
					path: "/map-through/map-push-records",
					component: "./MapThrough/MapPushNotificationRecords",
					access: PERM.MAP_PUSH_RECORD_VIEW
				}
			]
		},
		{
			name: "调度中心",
			icon: "BlockOutlined",
			path: "/dispatch-hub",
			component: "./DispatchHub",
			access: PERM.DISPATCH_HUB_VIEW
		},
		{
			name: "三方资源",
			icon: "ApiOutlined",
			path: "/tri-resource",
			component: "./TriResource",
			access: PERM.THIRD_PARTY_MANAGE,
			routes: [
				{
					name: "三方设备",
					icon: "ApiOutlined",
					path: "/tri-resource/tri-device",
					component: "./TriDevice",
					access: PERM.THIRD_PARTY_DEVICE_MANAGE,
					routes: [
						{
							name: "电梯",
							path: "/tri-resource/tri-device/elevator",
							component: "./TriDevice/Elevator_back",
							access: PERM.DEVICE_ELEVATOR_VIEW
						},
						{
							name: "自动门",
							path: "/tri-resource/tri-device/auto-door",
							component: "./TriDevice/AutoDoor_back",
							access: PERM.DEVICE_AUTO_DOOR_VIEW
						},
						{
							name: "充电桩",
							path: "/tri-resource/tri-device/charge-pie",
							component: "./TriDevice/ChargePile/ModbusChargePile",
							access: PERM.DEVICE_CHARGE_PILE_VIEW
						},
						{
							name: "交通灯",
							path: "/tri-resource/tri-device/traffic-lights",
							component: "./TriResource/TrafficLights",
							access: PERM.DEVICE_TRAFFIC_LIGHT_VIEW
						},
						{
							name: "风淋门",
							path: "/tri-resource/tri-device/air-shower-door",
							component: "./TriDevice/AirShowerDoor_back",
							access: PERM.DEVICE_AIR_SHOWER_DOOR_VIEW
						},
					]
				},
				{
					name: "三方交管",
					icon: "MinusCircleOutlined",
					path: "/tri-resource/tri-traffic",
					component: "./TriTraffic",
					access: PERM.TRAFFIC_TRIPARTITE_VIEW
				},
			]
		},
		{
			name: "工艺配置",
			icon: "InteractionOutlined",
			path: "/mission-cluster",
			component: "./MissionCluster",
			access: PERM.PROCESS_MANAGE,
			routes: [
				{
					name: "任务工艺",
					path: "/mission-cluster/mission-create",
					component: "./MissionCluster/MissionCreate",
					access: PERM.MISSION_FLOW_VIEW
				},
				{
					name: "工艺管理",
					path: "/mission-cluster/mission-flow",
					component: "./MissionCluster/MissionFlow",
					access: PERM.MISSION_TEMPLATE_VIEW
				},
				{
					name: "避障模板",
					icon: "MinusCircleOutlined",
					path: "/mission-cluster/obstacle-avoidance",
					component: "./ObstacleAvoidance",
					access: PERM.OBSTACLE_AVOIDANCE_VIEW
				},
				{
					name: "动作管理",
					icon: "FunctionOutlined",
					path: "/mission-cluster/action-control",
					component: "./ActionControl",
					access: PERM.ACTION_MANAGE,
					routes: [
						{
							name: "车辆动作",
							path: "/mission-cluster/action-control/agv-action",
							component: "./ActionControl/AGVAction",
							access: PERM.ACTION_VEHICLE_VIEW
						},
						{
							name: "动作分组",
							path: "/mission-cluster/action-control/agv-action-group",
							component: "./ActionControl/AGVActionGroup",
							access: PERM.ACTION_GROUP_VIEW
						},
					]
				},
			]
		},
		{
			name: "系统管理",
			icon: "SettingFilled",
			path: "/system-involve",
			component: "./SystemInvolve",
			access: PERM.SYSTEM_MANAGE,
			routes: [
				{
					name: "版本管理",
					path: "/system-involve/version-control",
					component: "./SystemInvolve/VersionControl",
					access: PERM.SYSTEM_VERSION_VIEW
				},
				{
					name: "系统日志",
					path: "/system-involve/system-log",
					component: "./SystemInvolve/SystemLog",
					access: PERM.SYSTEM_LOG_VIEW
				},
				{
					name: "系统设置",
					path: "/system-involve/system-setting",
					component: "./SystemInvolve/SystemSetting",
					access: PERM.SYSTEM_SETTING_VIEW
				},
				{
					name: "操作日志",
					path: "/system-involve/operation-log",
					component: "./SystemInvolve/OperationLog",
					access: PERM.SYSTEM_OPERATION_LOG_VIEW
				},
				{
					name: "软件信息",
					path: "/system-involve/software-information",
					component: "./SystemInvolve/SoftwareInformation",
					access: PERM.SYSTEM_SOFTWARE_VIEW
				},
				{
					name: "数据库备份管理",
					path: "/system-involve/database-backup",
					component: "./SystemInvolve/DatabaseBackupManagement",
				}
			]
		},
		{
			name: "权限管理",
			icon: "AuditOutlined",
			path: "/access-management",
			component: "./AccessManagement",
			access: PERM.AUTH_MANAGE,
			routes: [
				{
					name: "用户管理",
					path: "/access-management/user-management",
					component: "./AccessManagement/UserManagement",
					access: PERM.AUTH_USER_VIEW
				},
				{
					name: "角色管理",
					path: "/access-management/role-management",
					component: "./AccessManagement/RoleManagement",
					access: PERM.AUTH_ROLE_VIEW
				}
			]
		},
		{
			name: "数据统计",
			icon: "SignalFilled",
			path: "/analyze-visual",
			component: "./AnalyzeVisual",
			access: PERM.STATISTICS_MANAGE,
			routes: [
				{
					name: "任务统计",
					path: "/analyze-visual/order-statistics",
					component: "./AnalyzeVisual/OrderStatistics",
					access: PERM.STATISTICS_ORDER_VIEW
				},
				{
					name: "录制回放",
					icon: "PlayCircleOutlined",
					path: "/analyze-visual/record-playback",
					component: "./RecordPlayback",
					access: PERM.RECORD_PLAYBACK_VIEW
				},
				{
					name: "实时看板",
					icon: "DashboardOutlined",
					path: "/analyze-visual/dashboard-realtime",
					component: "./AnalyzeVisual/RealtimeDashboard",
					access: PERM.DASHBOARD_REALTIME_VIEW
				},
				{
					name: "任务统计报表",
					icon: "UnorderedListOutlined",
					path: "/analyze-visual/dashboard-task",
					component: "./AnalyzeVisual/TaskStatisticsReport",
					access: PERM.DASHBOARD_TASK_VIEW
				},
				{
					name: "故障告警",
					icon: "WarningOutlined",
					path: "/analyze-visual/dashboard-fault",
					component: "./AnalyzeVisual/FaultAlert",
					access: PERM.DASHBOARD_FAULT_VIEW
				},
				{
					name: "车辆状态统计",
					icon: "BarChartOutlined",
					path: "/analyze-visual/vehicle-status",
					component: "./AnalyzeVisual/VehicleStatus",
					access: PERM.VEHICLE_STATUS_VIEW
				},
				{
					name: "服务器资源",
					icon: "CloudServerOutlined",
					path: "/analyze-visual/server-resource",
					/*
					 * 菜单入口（别名）：权限控制菜单展示与该路径直访，点击后 replace 重定向到全屏页。
					 * 实际页面是顶层 layout:false 路由，不带布局壳；
					 * 两个路由绑定同一权限码，直访全屏地址同样受控（与库位看板的公开路由不同）。
					 */
					redirect: "/analyze-visual/server-resource-monitor",
					access: PERM.SERVER_RESOURCE_MONITOR_VIEW
				}
			]
		},
		{
			name: "任务详情",
			path: "/order-info",
			component: "./OrderInfo",
			layout: false,
			access: PERM.ORDER_RECORD_VIEW
		},
		{
			name: "车辆详情",
			path: "/vehicle-info",
			component: "./VehicleInfo",
			layout: false,
			access: PERM.VEHICLE_LIST_VIEW
		},
		{
			/*
			 * 服务器资源监控大屏（全屏）：菜单入口是 /analyze-visual/server-resource 重定向别名。
			 * 顶层 layout:false 不进菜单、不包布局壳；权限码与菜单别名一致，直访同样受控。
			 */
			path: "/analyze-visual/server-resource-monitor",
			component: "./AnalyzeVisual/ServerRealtimeResources",
			layout: false,
			access: PERM.SERVER_RESOURCE_MONITOR_VIEW
		},
		{
			name: "无权限",
			path: "/no-permission",
			component: "./UnAccess",
			layout: false
		},
		{
			path: "/*",
			component: "@/pages/NotFound"
		}
	],
	npmClient: "pnpm",
	proxy: {
		"/fms": {
			// target: "http://127.0.0.1:8888",
			target: "http://10.11.2.67:8888",
			changeOrigin: true,
		},
		"/rcsFlow": {
			// target: "http://127.0.0.1:8888",
			// target: "http://192.168.0.153:8888",
			// target: "http://172.16.2.83:8888",
			target: "http://10.11.2.67:8888",
			changeOrigin: true,
		}
	}
});
