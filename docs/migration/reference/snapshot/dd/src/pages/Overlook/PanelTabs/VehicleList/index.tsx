/**
 * @description 侧边栏显示车辆列表的panel
 * @date 2025-6-19
 */
import { updateVehicle } from "@/api";
import { PERM_BUTTON } from "@/constants/permission";
import { useAccess } from "@/hooks/useAccess";
import { useI18n } from "@/hooks/useI18n";
import { useWebSocketContext } from "@/socket";
import type { VehicleForm } from "@/types/VehicleDeploy/VehicleType";
import { getVehicleStatusText } from "@/utils/enum";
import type { SocketDispatcherState, VehicleType } from "@/utils/typing";
import type { TableProps } from "antd";
import { message, Space, Switch, Table, Tooltip, Typography } from "antd";
import { memo, useEffect, useMemo, useRef, useState } from "react";

interface VehicleListProps {
	panelHeight: React.MutableRefObject<number>;
}

/**
 * 受控排序状态：仅关心 columnKey 与 order
 * （order 缺省表示无排序，dataSource 直接等于推送原序）
 */
interface SortedInfo {
	columnKey?: string;
	order?: "ascend" | "descend";
}

/**
 * 参与排序的三列 columnKey 常量
 * 说明：统一用字符串 key 做受控判断，避免电量列 dataIndex 为数组
 * 时 antd 给出的 field 不直观导致 sortOrder 错位
 */
const COL = {
	name: "agvName",
	status: "vehicleProcStatus",
	battery: "batteryCharge",
} as const;

/**
 * 读取某行指定列的排序原始值（与显示文本无关）
 * - agvName / vehicleProcStatus：直接取字符串
 * - batteryCharge：安全穿透 batteryState，缺失返回 undefined（视为空值）
 */
const readSortValue = (
	record: VehicleType,
	columnKey: string,
): string | number | undefined => {
	switch (columnKey) {
		case COL.name:
			return record.agvName;
		case COL.status:
			return record.vehicleProcStatus;
		case COL.battery:
			return record.batteryState?.batteryCharge;
		default:
			return undefined;
	}
};

/**
 * 升序语义下的基础比较（不含空值处理）
 * - agvName：localeCompare 忽略大小写（中文段顺序依赖运行环境 ICU，见规格 D3）
 * - vehicleProcStatus：字符串码点字典序
 * - batteryCharge：数值差
 */
const baseCompare = (
	va: string | number,
	vb: string | number,
	columnKey: string,
): number => {
	switch (columnKey) {
		case COL.name:
			return String(va).localeCompare(String(vb), undefined, {
				sensitivity: "base",
			});
		case COL.status:
			return String(va) < String(vb) ? -1 : String(va) > String(vb) ? 1 : 0;
		case COL.battery:
			return Number(va) - Number(vb);
		default:
			return 0;
	}
};

/**
 * 带空值沉底的比较器
 * 约定：缺失视为最大值——升序缺失排末尾、降序缺失排首位（跟随排序方向沉底）
 */
const compareRows = (
	a: VehicleType,
	b: VehicleType,
	columnKey: string,
	order: "ascend" | "descend",
): number => {
	const va = readSortValue(a, columnKey);
	const vb = readSortValue(b, columnKey);
	let r = 0;
	if (va === undefined && vb === undefined) r = 0;
	else if (va === undefined) r = 1; // 缺失视为最大
	else if (vb === undefined) r = -1;
	else r = baseCompare(va, vb, columnKey);
	return order === "descend" ? -r : r;
};

export default memo((props: VehicleListProps) => {
	const { panelHeight } = props;

	const [vehicleList, setVehicleList] = useState<VehicleType[]>([]);
	const { lastMessage } = useWebSocketContext();
	/* 国际化翻译方法，用于将车辆列表的表头和提示文案进行多语言转换 */
	const { t } = useI18n();

	/*
	 * 车辆操作权限（overview:vehicle-operate）
	 * 调度状态 Switch 属状态展示型内联控件：无权限时 disabled（仍展示状态，不可切换）
	 */
	const { hasPerm } = useAccess();
	const canOperate = hasPerm(PERM_BUTTON.OVERVIEW_VEHICLE_OPERATE);

	// 受控排序状态：columnKey + order
	// （order 为 undefined 表示无排序，dataSource 直接等于推送原序）
	const [sortedInfo, setSortedInfo] = useState<SortedInfo>({});
	// 上一次「已提交渲染」顺序的 agvKey 列表，作为稳定次序基准
	// （语义=跟随用户上次所见次序，保证并列项不跳动）
	const lastOrderRef = useRef<string[]>([]);

	useEffect(() => {
		if (lastMessage) {
			try {
				const data: SocketDispatcherState = JSON.parse(lastMessage.data);
				const { vehicles } = data;
				setVehicleList(vehicles); // 仅写入推送原序，排序交给下方的 useMemo
			} catch (error) {
				message.warning(t("解析车辆数据失败") + error);
			}
		}
	}, [lastMessage]);

	// 预排序数据源：排序始终作用于最新推送数据（高频全量替换下也能保持有序）
	// 本函数为纯计算，只读 lastOrderRef.current 作为稳定基准；
	// 对 lastOrderRef 的写入统一放到下方 useEffect（提交后执行），
	// 避免在 React 18 并发渲染的 render 阶段写 ref 导致基准漂移、偶发跳动。
	const sortedDataSource = useMemo(() => {
		const columnKey = sortedInfo.columnKey;
		// 无排序：直接返回推送原序（基准更新交给下面的 useEffect）
		if (!sortedInfo.order || !columnKey) {
			return vehicleList;
		}
		// 以「上次已提交渲染顺序」为基准重排输入，保证并列项保持上次相对次序
		const orderMap = new Map(lastOrderRef.current.map((k, i) => [k, i]));
		const base = [...vehicleList].sort((a, b) => {
			const ia = orderMap.get(a.agvKey);
			const ib = orderMap.get(b.agvKey);
			// 两车基准位都已知：按上次次序
			if (ia !== undefined && ib !== undefined) return ia - ib;
			// 仅一方为新增车：新增车排到基准末尾
			if (ia !== undefined) return -1;
			if (ib !== undefined) return 1;
			// 两者都为新增车：兜底返回 0，避免 Infinity - Infinity = NaN，
			// 由 Array.sort 稳定性维持本次输入的原序（此时上次次序本就不存在）
			return 0;
		});
		// 稳定排序（ES2019+ Array.sort 稳定）：
		// 相同排序键项保持上面建立的上次相对次序
		base.sort((a, b) => compareRows(a, b, columnKey, sortedInfo.order!));
		return base;
	}, [vehicleList, sortedInfo]);

	// 提交后再更新稳定基准：保证缓存的顺序与最终渲染结果一致
	useEffect(() => {
		lastOrderRef.current = sortedDataSource.map((v) => v.agvKey);
	}, [sortedDataSource]);

	const handleDispatchChange = (record: VehicleType) => {
		if (!record?.agvKey) return;
		const {
			agvKey,
			agvName,
			type,
			agvDimension: { width, length, loadLength, loadWidth, centerOffset },
			dispatchState,
		} = record;
		const data: VehicleForm = {
			agvKey,
			agvName,
			agvType: type,
			length,
			width,
			loadLength,
			loadWidth,
			centerOffset,
			dispatchState: dispatchState === "ENABLE" ? "DISABLE" : "ENABLE",
		};
		updateVehicle(data)
			.then((res) => {
				if (res.code === 200 && res.message === "success") {
					message.success(t("操作车辆成功") + res?.message);
				} else {
					message.warning(t("操作车辆出错") + res?.message);
				}
			})
			.catch((err) => {
				if (err) {
					message.error(t("操作车辆出错") + err?.message);
				}
			});
	};

	const columns: TableProps<VehicleType>["columns"] = [
		{
			title: t("车辆"),
			dataIndex: "agvName",
			key: COL.name,
			// 受控：仅当前列显示排序方向，保证单列高亮正确
			sortOrder: sortedInfo.columnKey === COL.name ? sortedInfo.order : null,
			sorter: true,
			sortDirections: ["ascend", "descend"], // 升→降→取消 三态循环
			showSorterTooltip: false,
			ellipsis: { showTitle: false },
			/**
			 * 车辆名称列的渲染函数
			 * 说明：不再使用 Typography.Text 的 ellipsis（基于 JS 测量宽度），
			 * 因为在 Splitter 拖拽 + 虚拟滚动场景下，ResizeObserver 会缓存
			 * 拖到最窄时的宽度，导致拖回最宽时仍显示省略号。
			 * 这里改为：
			 *   1. 外层 flex 容器 + minWidth:0 让子元素可收缩；
			 *   2. 文案用 span 通过纯 CSS 实现省略，并配合 Tooltip 提示完整内容；
			 *   3. 复制图标通过 Typography.Text 的 copyable 独立渲染，不参与宽度测量。
			 * 参数 value：当前行的车辆名称字符串
			 */
			render: (value: string) => (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 4,
						minWidth: 0,
						width: "100%",
					}}
				>
					<Tooltip title={value} placement="topLeft">
						<span
							style={{
								flex: 1,
								minWidth: 0,
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
						>
							{value}
						</span>
					</Tooltip>
					<Typography.Text copyable={{ text: value }} />
				</div>
			),
		},
		{
			title: t("状态"),
			dataIndex: "vehicleProcStatus",
			key: COL.status,
			sortOrder: sortedInfo.columnKey === COL.status ? sortedInfo.order : null,
			sorter: true,
			sortDirections: ["ascend", "descend"],
			showSorterTooltip: false,
			width: 80,
			// 车辆离线/连接中断时优先展示连接状态，否则展示业务进度状态
			// 注意：排序严格按 vehicleProcStatus 原始枚举字典序，与此处显示文本无关
			// （离线车会按其 vehicleProcStatus 归组，显示却为「离线」）
			render: (value, record) =>
				t(getVehicleStatusText(record.connectionState, value)),
		},
		{
			title: t("电量"),
			dataIndex: ["batteryState", "batteryCharge"],
			key: COL.battery,
			sortOrder: sortedInfo.columnKey === COL.battery ? sortedInfo.order : null,
			sorter: true,
			sortDirections: ["ascend", "descend"],
			showSorterTooltip: false,
			width: 80,
		},
		{
			title: t("操作"),
			width: 70,
			fixed: "right",
			dataIndex: "dispatchState",
			render: (value, record) => (
				<Space>
					<Switch
						value={value === "ENABLE"}
						disabled={!canOperate}
						onChange={() => handleDispatchChange(record)}
					/>
				</Space>
			),
		},
	];

	// 表头点击排序：仅采集 columnKey/order 更新受控状态（单列排序）
	// sorter: true 只作交互开关，真正排序由 sortedDataSource 完成
	const onTableChange: TableProps<VehicleType>["onChange"] = (
		_pg,
		_fil,
		sorter,
	) => {
		const s = Array.isArray(sorter) ? sorter[0] : sorter;
		const order = s?.order;
		setSortedInfo({
			columnKey: s?.columnKey as string | undefined,
			order: order === "ascend" || order === "descend" ? order : undefined,
		});
	};

	return (
		<Table<VehicleType>
			columns={columns}
			dataSource={sortedDataSource}
			size="small"
			sticky={true}
			pagination={false}
			rowKey={(r) => r.agvKey}
			virtual
			scroll={{ x: 100, y: panelHeight.current }}
			onChange={onTableChange}
		/>
	);
});
