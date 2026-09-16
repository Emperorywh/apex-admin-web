import { useModel } from '@umijs/max';
import { mountGraphEdges, mountGraphNodes } from '@/utils/graph';
import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useLocalStorageState } from 'ahooks';
import { Stage } from 'react-konva';
import Konva from 'konva';
import { theme } from 'antd';
import RobotLayer from './RobotLayer';
import MapNodeLayer from './MapNodeLayer';
import MapEdgeLayer from './MapEdgeLayer';
import DeviceLayer from './DeviceLayer';
import ActionBadgeLayer from './ActionBadgeLayer';
import { ActionTooltip } from '@/plugins/konva/actions';
import type { ActionTooltipData } from '@/plugins/konva/actions';
import { OverlayVisible } from '@/types/OverLook';
import { PlaybackFrameDTO } from '@/types/PlaybackTypings';
import { buildAreaColorIndex } from '@/utils/areaHighlight';
import { MapInfo } from '@/utils/typing';
import { computeAdaptiveScale } from '@/plugins/konva/runtime/adaptiveScale';

interface Props {
	mapData: MapInfo | null;
	scale: number;
	position: { x: number; y: number };
	currentFrame: PlaybackFrameDTO | null;
	setScale: (scale: number) => void;
	setPosition: (pos: { x: number; y: number }) => void;
	overlayVisible: OverlayVisible;
	/** 当前锁定/聚焦的车辆 agvKey，用于绘制虚线圆并让地图跟随滑动 */
	focusId?: string;
	/**
	 * Stage 挂载/更新时回调，把底层 Konva.Stage 实例抛给父组件，
	 * 供 RotateMap 等需要直接操作画布变换的工具栏组件使用。
	 */
	setStage?: (stage: Konva.Stage | null) => void;
	/**
	 * 交管白名单（选中 agvKey 数组）：透传给 RobotLayer→TrafficGroup 做交管过滤。
	 * 空数组 = 全显。RecordPlayback 的 KonvaRender 为普通函数组件（无自定义 memo 比较），无此坑（SPEC §5.5）。
	 */
	visibleTrafficAgvKeys?: string[];
	/** 当前高亮中的区域ID集合（SPEC_area_highlight_monitoring_playback §4.4） */
	highlightedAreaIds: Set<string>;
}

const KonvaRender = ({ mapData, scale, position, setScale, setPosition, currentFrame, overlayVisible, focusId, setStage, visibleTrafficAgvKeys, highlightedAreaIds }: Props) => {
	const { token } = theme.useToken();
	/**
	 * 暗黑主题：设备图标配色据此切换（SPEC D15）。
	 * 回放画布原本无主题逻辑，此处为新引入。
	 */
	const [localTheme] = useLocalStorageState<'defaultAlgorithm' | 'darkAlgorithm'>('theme');
	const isDark = localTheme === 'darkAlgorithm';

	/**
	 * 动作角标 hover 状态（D9-D11）。onActionHover 用 useCallback 稳定引用。
	 */
	const [actionHover, setActionHover] = useState<ActionTooltipData | null>(null);
	const onActionHover = useCallback((hover: ActionTooltipData | null) => setActionHover(hover), []);

	// 地图JSON数据
	const { mapJson } = mapData || {};

	// 节点和边数据；区域分组直接自 mapJson 解构（不新增冗余 prop），
	// 旧导入文件可能缺 nodeEdgeGroups，缺省按无区域处理
	const { nodes = [], edges = [], nodeEdgeGroups } = mapJson || {};

	// 容器DOM引用
	const containerRef = useRef<HTMLDivElement>(null);

	// Konva Stage 实例引用，供 wheel 事件与父级工具栏（如 RotateMap）共用
	const stageRef = useRef<Konva.Stage>(null);

	// 容器尺寸（宽高）
	const [dimensions, setDimensions] = useState({
		width: 0,
		height: 0,
	});

	// 监听容器尺寸变化，更新dimensions
	useEffect(() => {
		// 更新容器尺寸
		const updateDimensions = () => {
			if (containerRef.current) {
				setDimensions({
					width: containerRef.current.clientWidth,
					height: containerRef.current.clientHeight,
				});
			}
		};

		// 初始化尺寸
		updateDimensions();

		// 添加尺寸变化监听器
		const resizeObserver = new ResizeObserver(() => {
			updateDimensions();
		});

		if (containerRef.current) {
			resizeObserver.observe(containerRef.current);
		}

		return () => {
			if (containerRef.current) {
				resizeObserver.unobserve(containerRef.current);
			}
			resizeObserver.disconnect();
		};
	}, []);

	const { mountNodes } = useMemo(() => {
		// 初始化所有的节点
		const mountNodes = mountGraphNodes(nodes as any[]);
		return { mountNodes }
	}, [nodes])

	// 初始化加载路径时缓存计算结果
	const { mountEdges } = useMemo(() => {
		// 初始化处理路径
		const mountEdges = mountGraphEdges(edges as any[]);
		return {
			mountEdges
		}
	}, [edges])

	/**
	 * 自适应视觉倍率（D1 方案 B）：scale 的纯函数派生值。
	 * scale 是受控 React state，其变化已驱动 KonvaRender re-render，
	 * 故 visualScale 经 useMemo 重算后随 props 下传，sceneFunc 闭包直读。
	 * 不引入 stage attr / scaleXChange 监听 / rAF 合流（与 Overlook 的关键差异）。
	 */
	const visualScale = useMemo(() => computeAdaptiveScale(scale), [scale]);

	/**
	 * 声明式区域高亮索引（D4）：shapeId → 混色，经 props 下发两层，sceneFunc 查表覆盖颜色。
	 * isLoading 期间 KonvaRender 卸载重建后，高亮随 props 自动恢复——声明式方案的核心收益。
	 */
	const areaColorIndex = useMemo(
		() => buildAreaColorIndex(nodeEdgeGroups ?? [], highlightedAreaIds),
		[nodeEdgeGroups, highlightedAreaIds],
	);

	// 提示框控制
	const { setTooltip } = useModel('tooltipJson');

	// 舞台点击事件处理，点击空白区域关闭提示框，点击车辆显示提示框
	const onStageClick = (event: any) => {
		const { target, evt } = event;
		if (evt.button === 2) return;
		if (target === target.getStage()) {
			setTooltip({ visible: false });
		}
		if (target.attrs?.isRobot) {
			const { attrs: { id } } = target;
			setTooltip({
				visible: true,
				vehicleKey: id,
				clientX: evt.clientX + 20,
				clientY: evt.clientY + 20
			});
		}
	};

	// 保留最新的地图位置，供动画循环读取（避免 rAF 依赖 React 闭包内的旧值）
	const positionRef = useRef(position);
	useEffect(() => {
		positionRef.current = position;
	}, [position]);

	// 跟随动画的目标位置 & 当前帧的动画句柄
	const followTargetRef = useRef<{ x: number; y: number } | null>(null);
	const followRafRef = useRef<number | null>(null);

	// 使用"线性插值（lerp）"每帧朝目标位置靠拢，实现平滑滑动跟随
	const startFollowAnimation = useCallback(() => {
		if (followRafRef.current !== null) return;
		const step = () => {
			const target = followTargetRef.current;
			if (!target) {
				followRafRef.current = null;
				return;
			}
			const current = positionRef.current;
			const dx = target.x - current.x;
			const dy = target.y - current.y;
			// 距离足够近时直接贴到目标并结束动画，等待下一次目标变化再重新启动
			if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
				setPosition(target);
				followRafRef.current = null;
				return;
			}
			// 缓动系数越小跟随越"缓慢"，这里取 0.15 在视觉上既平滑又不拖泥带水
			const k = 0.15;
			setPosition({
				x: current.x + dx * k,
				y: current.y + dy * k,
			});
			followRafRef.current = requestAnimationFrame(step);
		};
		followRafRef.current = requestAnimationFrame(step);
	}, [setPosition]);

	// 监听锁定车辆与当前帧的变化，计算目标位置并驱动跟随动画
	useEffect(() => {
		if (!focusId || !currentFrame || dimensions.width === 0 || dimensions.height === 0) {
			followTargetRef.current = null;
			return;
		}
		const vehicle = currentFrame.vehicles?.find((v) => v.agvKey === focusId);
		if (!vehicle?.agvPosition) return;
		followTargetRef.current = {
			x: dimensions.width / 2 - vehicle.agvPosition.x * scale,
			y: dimensions.height / 2 + vehicle.agvPosition.y * scale,
		};
		startFollowAnimation();
	}, [focusId, currentFrame, scale, dimensions.width, dimensions.height, startFollowAnimation]);

	// 组件卸载时清理动画循环
	useEffect(() => {
		return () => {
			if (followRafRef.current !== null) {
				cancelAnimationFrame(followRafRef.current);
				followRafRef.current = null;
			}
		};
	}, []);

	// 节点数据变化时自动计算缩放和居中
	useEffect(() => {
		if (mountNodes.length > 0) {
			// 计算节点包围盒
			let minX = Infinity;
			let minY = Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;

			mountNodes.forEach(node => {
				if (node.x < minX) minX = node.x;
				if (node.x > maxX) maxX = node.x;
				if (node.y < minY) minY = node.y;
				if (node.y > maxY) maxY = node.y;
			});

			const padding = 50;
			const mapWidth = maxX - minX;
			const mapHeight = maxY - minY;

			let newScale = 100; // 默认缩放比例
			if (mapWidth > 0 && mapHeight > 0) {
				const scaleX = (dimensions.width - padding * 2) / mapWidth;
				const scaleY = (dimensions.height - padding * 2) / mapHeight;
				newScale = Math.min(scaleX, scaleY, 200); // 最大缩放比例不超过200
			}

			setScale(newScale);

			// 居中地图
			setPosition({
				x: dimensions.width / 2 - ((minX + maxX) / 2) * newScale,
				y: dimensions.height / 2 - ((minY + maxY) / 2) * newScale,
			});
		}
	}, [mountNodes, dimensions.width, dimensions.height]);

	// Stage 挂载后把底层 Konva 实例抛给父组件，供 RotateMap 等工具栏直接操作画布变换。
	// Stage 仅在容器尺寸就绪后才渲染；换图时 KonvaRender 会重新挂载并产生新的 Stage 实例，
	// 故依赖 dimensions 与 mountNodes：两者任一变化触发 effect 时 ref 已挂载，
	// 可保证父组件始终拿到当前有效的 stage 实例。
	useEffect(() => {
		if (dimensions.width > 0 && dimensions.height > 0 && stageRef.current && setStage) {
			setStage(stageRef.current);
		}
	}, [dimensions.width, dimensions.height, mountNodes, setStage]);

	return (
		<div
			ref={containerRef}
			style={{ width: '100%', height: '100%', overflow: 'hidden', flex: 1, position: 'relative', backgroundColor: token.colorBgLayout }}
		>
				{dimensions.width > 0 && dimensions.height > 0 && (
				<Stage
					width={dimensions.width}
					height={dimensions.height}
					ref={stageRef}
					scaleX={scale}
					scaleY={scale}
					x={position.x}
					y={position.y}
					draggable
					onClick={onStageClick}
					onDragEnd={(e) => {
						setPosition({
							x: e.target.x(),
							y: e.target.y()
						});
					}}
					onWheel={(e) => {
						e.evt.preventDefault();
						const stage = stageRef.current;
						if (!stage) return;
						const oldScale = stage.scaleX();
						const pointer = stage.getPointerPosition();
						if (!pointer) return;

						const mousePointTo = {
							x: (pointer.x - stage.x()) / oldScale,
							y: (pointer.y - stage.y()) / oldScale,
						};

						// 缩放系数
						const scaleBy = 1.1;
						const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

						setScale(newScale);
						setPosition({
							x: pointer.x - mousePointTo.x * newScale,
							y: pointer.y - mousePointTo.y * newScale,
						});
					}}
				>
					<MapNodeLayer
						mountNodes={mountNodes}
						overlayVisible={overlayVisible}
						visualScale={visualScale}
						areaColorIndex={areaColorIndex}
					/>
					<MapEdgeLayer
						mountEdges={mountEdges}
						overlayVisible={overlayVisible}
						visualScale={visualScale}
						areaColorIndex={areaColorIndex}
					/>
					{/* 三方设备图标层：挂载于 MapEdgeLayer 之后 */}
					<DeviceLayer
						mountEdges={mountEdges}
						visible={overlayVisible.device}
						isDark={isDark}
						visualScale={visualScale}
					/>
					{/* 动作角标层：挂载于 DeviceLayer 之后 */}
					<ActionBadgeLayer
						mountNodes={mountNodes}
						mountEdges={mountEdges}
						visible={overlayVisible.actions}
						isDark={isDark}
						onActionHover={onActionHover}
						visualScale={visualScale}
					/>
					<RobotLayer
						overlayVisible={overlayVisible}
						currentFrame={currentFrame}
						focusId={focusId}
						visibleAgvKeys={visibleTrafficAgvKeys}
					/>
				</Stage>
			)}
			{/* 动作角标 hover 详情浮层（每动作一卡，贴锚点定位，D9-D11） */}
			<ActionTooltip data={actionHover} isDark={isDark} />
		</div>
	);
};

export default KonvaRender;
