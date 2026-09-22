import { useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { LocateFixed, Maximize, Minus, Plus } from 'lucide-react'
import { STATIONS } from '../monitor.model'
import styles from './MonitorMap.module.css'

/** 地图使用 1000×700 逻辑坐标；外部负责运行状态、图层与站点选择，视野由地图独立管理。 */
export interface MonitorMapProps {
	position: { x: number; y: number; heading: number }
	running: boolean
	emergency: boolean
	statusLabel: string
	routeVisible: boolean
	gridVisible: boolean
	scanVisible: boolean
	follow: boolean
	onFollowChange: (value: boolean) => void
	onStationSelect: (id: string) => void
	selectedStation: string | null
}

/** 标签偏移属于地图排版；站点名称和坐标统一读取运行模型，避免任务面板与地图不一致。 */
const STATION_LABEL_OFFSETS: Record<string, { x: number; y: number }> = {
	P01: { x: 0, y: 41 },
	P02: { x: 0, y: 41 },
	P03: { x: -53, y: -24 },
	P04: { x: 29, y: 2 },
	P05: { x: 0, y: -30 },
}

/** 货架只保留实际通道所需的几何细节，为导航路线留出足够对比度。 */
const RACKS = [
	{
		x: 220,
		y: 200,
		width: 142,
		height: 77,
		label: 'A-01',
		sublabel: '原料存储区',
	},
	{
		x: 408,
		y: 200,
		width: 142,
		height: 77,
		label: 'A-02',
		sublabel: '原料存储区',
	},
	{
		x: 596,
		y: 200,
		width: 100,
		height: 77,
		label: 'A-03',
		sublabel: '备料区',
	},
	{
		x: 220,
		y: 390,
		width: 142,
		height: 77,
		label: 'B-01',
		sublabel: '成品存储区',
	},
	{
		x: 562,
		y: 390,
		width: 134,
		height: 77,
		label: 'B-02',
		sublabel: '成品存储区',
	},
]

/** 将车辆投影到最近路线段，使已行驶轨迹在转角处保持连续。 */
function traveledRoute(position: MonitorMapProps['position']) {
	let nearestDistance = Number.POSITIVE_INFINITY
	let nearestIndex = 0
	let nearestPoint = STATIONS[0]

	for (let index = 0; index < STATIONS.length - 1; index += 1) {
		const start = STATIONS[index]
		const end = STATIONS[index + 1]
		const deltaX = end.x - start.x
		const deltaY = end.y - start.y
		const ratio = Math.max(
			0,
			Math.min(
				1,
				((position.x - start.x) * deltaX +
					(position.y - start.y) * deltaY) /
					(deltaX ** 2 + deltaY ** 2),
			),
		)
		const projected = {
			...start,
			x: start.x + deltaX * ratio,
			y: start.y + deltaY * ratio,
		}
		const distance = Math.hypot(
			position.x - projected.x,
			position.y - projected.y,
		)

		if (distance < nearestDistance) {
			nearestDistance = distance
			nearestIndex = index
			nearestPoint = projected
		}
	}

	return [...STATIONS.slice(0, nearestIndex + 1), nearestPoint]
		.map((point) => `${point.x},${point.y}`)
		.join(' ')
}

/** 单机仓库地图：SVG 保持地图、光束与车辆在同一坐标系，支持有界缩放、拖动及键盘站点选择。 */
export function MonitorMap({
	position,
	running,
	emergency,
	statusLabel,
	routeVisible,
	gridVisible,
	scanVisible,
	follow,
	onFollowChange,
	onStationSelect,
	selectedStation,
}: MonitorMapProps) {
	const id = useId().replaceAll(':', '')
	const [zoom, setZoom] = useState(1)
	const [pan, setPan] = useState({ x: 0, y: 0 })
	const [dragging, setDragging] = useState(false)
	const [viewport, setViewport] = useState({ width: 920, height: 530 })
	const canvasRef = useRef<SVGSVGElement>(null)
	const drag = useRef<{
		pointerId: number
		x: number
		y: number
		panX: number
		panY: number
		unit: number
	} | null>(null)

	// 总览保留完整厂区；放大后跟随车辆，以免车辆在正常巡航时离开视野。
	const center =
		follow && zoom > 1 ? position : { x: 500 + pan.x, y: 350 + pan.y }
	// 根据容器比例适配视野，保持地图坐标不变，在宽屏时减少四周留白。
	const viewWidth = Math.max(920, (530 * viewport.width) / viewport.height)
	const viewHeight = Math.max(530, (920 * viewport.height) / viewport.width)
	const viewLeft = center.x - viewWidth / (2 * zoom)
	const viewTop = center.y - viewHeight / (2 * zoom)
	const viewBox = `${viewLeft} ${viewTop} ${viewWidth / zoom} ${viewHeight / zoom}`
	const scaleMeters = ((57 / viewport.width) * viewWidth) / zoom / 20
	const routePoints = STATIONS.map(
		(station) => `${station.x},${station.y}`,
	).join(' ')

	/** 原生非被动滚轮监听阻止地图操作同时滚动页面；尺寸监听与事件在卸载时统一释放。 */
	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const observer = new ResizeObserver(([entry]) => {
			const { width, height } = entry.contentRect
			if (width > 0 && height > 0) setViewport({ width, height })
		})
		const handleWheel = (event: WheelEvent) => {
			event.preventDefault()
			setZoom((value) =>
				Math.max(
					0.75,
					Math.min(
						2.5,
						Math.round(
							(value - Math.sign(event.deltaY) * 0.1) * 100,
						) / 100,
					),
				),
			)
		}
		observer.observe(canvas)
		canvas.addEventListener('wheel', handleWheel, { passive: false })
		return () => {
			observer.disconnect()
			canvas.removeEventListener('wheel', handleWheel)
		}
	}, [])

	/** 指针捕获让拖拽离开地图后仍可结束；手动移动视野会关闭跟随。 */
	const startDrag = (event: PointerEvent<SVGSVGElement>) => {
		if (
			event.button !== 0 ||
			(event.target as Element).closest('[data-station]')
		)
			return
		const bounds = event.currentTarget.getBoundingClientRect()
		const actualPan = { x: center.x - 500, y: center.y - 350 }
		drag.current = {
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			panX: actualPan.x,
			panY: actualPan.y,
			unit:
				Math.max(viewWidth / bounds.width, viewHeight / bounds.height) /
				zoom,
		}
		setPan(actualPan)
		onFollowChange(false)
		setDragging(true)
		event.currentTarget.setPointerCapture(event.pointerId)
	}

	/** 限制平移范围，避免连续拖动把厂区永久移出视野。 */
	const moveDrag = (event: PointerEvent<SVGSVGElement>) => {
		const activeDrag = drag.current
		if (!activeDrag || activeDrag.pointerId !== event.pointerId) return
		setPan({
			x: Math.max(
				-420,
				Math.min(
					420,
					activeDrag.panX -
						(event.clientX - activeDrag.x) * activeDrag.unit,
				),
			),
			y: Math.max(
				-300,
				Math.min(
					300,
					activeDrag.panY -
						(event.clientY - activeDrag.y) * activeDrag.unit,
				),
			),
		})
	}

	/** 松开、取消与捕获丢失共用清理逻辑，不注册全局监听，卸载时由浏览器释放指针捕获。 */
	const stopDrag = () => {
		drag.current = null
		setDragging(false)
	}

	/** 视野复位恢复可读的厂区总览，并保留外部图层开关。 */
	const resetView = () => {
		setZoom(1)
		setPan({ x: 0, y: 0 })
		onFollowChange(false)
	}

	return (
		<div
			className={`${styles.map} ${viewport.height < 280 ? styles.compact : ''} ${emergency ? styles.emergency : ''}`}
		>
			{/* 固定刻度与地图分离，平移时保持视野边界清晰。 */}
			<div className={styles.topRuler} aria-hidden="true">
				<span className={styles.rulerUnit}>m</span>
				{Array.from({ length: 11 }, (_, index) => (
					<span key={index} style={{ left: `${index * 10}%` }}>
						{(
							(viewLeft + ((viewWidth / zoom) * index) / 10) /
							20
						).toFixed(1)}
					</span>
				))}
			</div>
			<div className={styles.leftRuler} aria-hidden="true">
				{Array.from({ length: 7 }, (_, index) => (
					<span key={index} style={{ top: `${(index * 100) / 6}%` }}>
						{(
							(viewTop + ((viewHeight / zoom) * index) / 6) /
							20
						).toFixed(1)}
					</span>
				))}
			</div>
			<div className={styles.mapInfo}>
				<span className={styles.mapStatus}>
					<i />
					实时定位
				</span>
				<span>WAREHOUSE · FLOOR 01</span>
				<small>生产车间 / 一层导航地图</small>
			</div>
			<div className={styles.compass} aria-label="地图上方为北">
				<span>N</span>
				<svg viewBox="0 0 40 40" aria-hidden="true">
					<path d="M20 5 29 30 20 25 11 30Z" />
					<path d="M20 5V25L11 30Z" />
				</svg>
			</div>

			<svg
				ref={canvasRef}
				className={`${styles.canvas} ${dragging ? styles.dragging : ''}`}
				viewBox={viewBox}
				aria-label="AGV 仓库实时地图，可点击导航站点并拖动地图"
				onPointerDown={startDrag}
				onPointerMove={moveDrag}
				onPointerUp={stopDrag}
				onPointerCancel={stopDrag}
				onLostPointerCapture={stopDrag}
			>
				{/* 所有 SVG 资源带实例标识，确保切换页面或多实例预览不会互相覆盖。 */}
				<defs>
					<pattern
						id={`${id}-grid`}
						width="25"
						height="25"
						patternUnits="userSpaceOnUse"
					>
						<path
							d="M25 0H0V25"
							fill="none"
							stroke="#7c98a5"
							strokeOpacity=".07"
							strokeWidth=".8"
						/>
					</pattern>
					<pattern
						id={`${id}-major-grid`}
						width="125"
						height="125"
						patternUnits="userSpaceOnUse"
					>
						<rect
							width="125"
							height="125"
							fill={`url(#${id}-grid)`}
						/>
						<path
							d="M125 0H0V125"
							fill="none"
							stroke="#7c98a5"
							strokeOpacity=".09"
						/>
					</pattern>
					<pattern
						id={`${id}-hatch`}
						width="8"
						height="8"
						patternUnits="userSpaceOnUse"
						patternTransform="rotate(45)"
					>
						<line
							x1="0"
							y1="0"
							x2="0"
							y2="8"
							stroke="#93a8b5"
							strokeOpacity=".14"
							strokeWidth="2"
						/>
					</pattern>
					<radialGradient id={`${id}-scanner`}>
						<stop
							offset="0%"
							stopColor="#2bd9c5"
							stopOpacity=".02"
						/>
						<stop
							offset="80%"
							stopColor="#2bd9c5"
							stopOpacity=".04"
						/>
						<stop
							offset="100%"
							stopColor="#2bd9c5"
							stopOpacity=".13"
						/>
					</radialGradient>
					<linearGradient
						id={`${id}-vehicle`}
						x1="0"
						x2="0"
						y1="0"
						y2="1"
					>
						<stop stopColor="#ecf4f5" />
						<stop offset="1" stopColor="#9db5c0" />
					</linearGradient>
				</defs>
				{gridVisible && (
					<rect
						x="-1500"
						y="-1000"
						width="4000"
						height="3000"
						fill={`url(#${id}-major-grid)`}
					/>
				)}

				{/* 外墙采用双线、立柱和入口断口，简化地图仍保留真实仓库的工程比例。 */}
				<g className={styles.building}>
					<rect
						x="135"
						y="137"
						width="745"
						height="429"
						className={styles.floorSurface}
					/>
					{gridVisible && (
						<rect
							x="135"
							y="137"
							width="745"
							height="429"
							fill={`url(#${id}-major-grid)`}
						/>
					)}
					<path
						d="M135 137H880V566H553M465 566H135Z"
						className={styles.wallShadow}
					/>
					<path
						d="M135 137H880V566H553M465 566H135Z"
						className={styles.wall}
					/>
					<path
						d="M147 149H868V554H553M465 554H147Z"
						className={styles.wallInner}
					/>
					<path
						d="M465 566V552M553 566V552"
						className={styles.wall}
					/>
					<path d="M473 560H545" className={styles.entrance} />
					<text
						x="509"
						y="594"
						textAnchor="middle"
						className={styles.zoneLabel}
					>
						主通道入口
					</text>
					{[135, 320, 508, 695, 880].map((x) => (
						<g key={x}>
							<rect
								x={x - 4}
								y="133"
								width="8"
								height="10"
								className={styles.column}
							/>
							<rect
								x={x - 4}
								y="561"
								width="8"
								height="10"
								className={styles.column}
							/>
						</g>
					))}
					<text x="162" y="176" className={styles.zoneLabel}>
						A 区 · 原料仓
					</text>
					<text x="162" y="372" className={styles.zoneLabel}>
						B 区 · 成品仓
					</text>
					<path
						d="M155 310H851M155 350H851M744 155V544"
						className={styles.floorGuide}
					/>
					<text
						x="590"
						y="322"
						textAnchor="middle"
						className={styles.corridorLabel}
					>
						AGV 运行通道
					</text>
					<path
						d="m331 328 5 4-5 4m283-8 5 4-5 4m161 132 4-5 4 5"
						className={styles.directionArrow}
					/>
				</g>

				{/* 货架分格与黄色防撞护角用于辨识静态障碍，避免与青色导航高亮混淆。 */}
				{RACKS.map((rack) => (
					<g key={rack.label} className={styles.rack}>
						<rect
							x={rack.x}
							y={rack.y}
							width={rack.width}
							height={rack.height}
							rx="2"
							className={styles.rackBase}
						/>
						<rect
							x={rack.x + 7}
							y={rack.y + 8}
							width={rack.width - 14}
							height={rack.height - 16}
							fill={`url(#${id}-hatch)`}
						/>
						{Array.from({ length: 5 }, (_, index) => (
							<line
								key={index}
								x1={rack.x + (rack.width / 5) * index}
								y1={rack.y + 1}
								x2={rack.x + (rack.width / 5) * index}
								y2={rack.y + rack.height - 1}
								className={styles.rackDivider}
							/>
						))}
						<line
							x1={rack.x}
							y1={rack.y + rack.height / 2}
							x2={rack.x + rack.width}
							y2={rack.y + rack.height / 2}
							className={styles.rackDivider}
						/>
						<rect
							x={rack.x + rack.width / 2 - 29}
							y={rack.y + 25}
							width="58"
							height="27"
							rx="3"
							className={styles.rackLabelPlate}
						/>
						<text
							x={rack.x + rack.width / 2}
							y={rack.y + 43}
							textAnchor="middle"
							className={styles.rackLabel}
						>
							{rack.label}
						</text>
						<text
							x={rack.x + rack.width / 2}
							y={rack.y + rack.height + 19}
							textAnchor="middle"
							className={styles.rackCaption}
						>
							{rack.sublabel}
						</text>
						<path
							d={`M${rack.x - 5} ${rack.y + 9}v-14h14M${rack.x + rack.width - 9} ${rack.y - 5}h14v14M${rack.x - 5} ${rack.y + rack.height - 9}v14h14M${rack.x + rack.width - 9} ${rack.y + rack.height + 5}h14v-14`}
							className={styles.rackGuard}
						/>
					</g>
				))}

				{/* 充电泊位和装卸区采用低饱和独立色，表示固定设施而非运行状态。 */}
				<g>
					<rect
						x="158"
						y="483"
						width="63"
						height="52"
						rx="6"
						className={styles.chargingBay}
					/>
					<path
						d="M162 490V485H169M210 485H217V490M162 528V533H169M210 533H217V528"
						className={styles.chargingCorner}
					/>
					<rect
						x="761"
						y="381"
						width="67"
						height="68"
						rx="3"
						className={styles.loadingBay}
					/>
					<path
						d="M770 390H819V440H770Z M770 402H819M770 428H819M782 390V440M807 390V440"
						className={styles.loadingDetail}
					/>
					<text
						x="794"
						y="470"
						textAnchor="middle"
						className={styles.rackCaption}
					>
						装卸作业区
					</text>
					<rect
						x="763"
						y="156"
						width="54"
						height="49"
						rx="5"
						className={styles.standbyBay}
					/>
					<text
						x="190"
						y="608"
						textAnchor="middle"
						className={styles.floorLabel}
					>
						01
					</text>
					<text x="220" y="608" className={styles.floorCaption}>
						PRODUCTION FLOOR
					</text>
				</g>

				{/* 底层宽光晕衬托规划路线；行驶段由车辆位置计算，暂停时停止流动提示。 */}
				{routeVisible && (
					<g className={styles.route}>
						<polyline
							points={routePoints}
							className={styles.routeHalo}
						/>
						<polyline
							points={routePoints}
							className={styles.routeBase}
						/>
						<polyline
							points={routePoints}
							className={`${styles.routeFlow} ${running && !emergency ? styles.flowing : ''}`}
						/>
						<polyline
							points={traveledRoute(position)}
							className={styles.traveledRoute}
						/>
					</g>
				)}

				{/* 站点为独立可聚焦控件，键盘 Enter/空格与鼠标点击执行同一选择。 */}
				{STATIONS.map((station) => {
					const label = STATION_LABEL_OFFSETS[station.id]
					return (
						<g
							key={station.id}
							data-station={station.id}
							transform={`translate(${station.x} ${station.y})`}
							className={`${styles.station} ${selectedStation === station.id ? styles.selectedStation : ''}`}
							role="button"
							tabIndex={0}
							aria-label={`选择 ${station.id} ${station.label}`}
							aria-pressed={selectedStation === station.id}
							onClick={() => onStationSelect(station.id)}
							onKeyDown={(event) => {
								if (
									event.key === 'Enter' ||
									event.key === ' '
								) {
									event.preventDefault()
									onStationSelect(station.id)
								}
							}}
						>
							<circle r="20" className={styles.stationHit} />
							<circle r="10" className={styles.stationOuter} />
							<circle r="4" className={styles.stationDot} />
							<text
								x={label.x}
								y={label.y}
								className={styles.stationLabel}
								textAnchor={label.x > 0 ? 'start' : 'middle'}
							>
								{station.id}
								<tspan className={styles.stationName}>
									{' '}
									{station.label}
								</tspan>
							</text>
							{selectedStation === station.id && (
								<circle
									r="17"
									className={styles.selectedRing}
								/>
							)}
						</g>
					)
				})}

				{/* 扫描图层展示感知范围；急停使用警示色并停止扫描，运动敏感设置也会停止动画。 */}
				<g
					transform={`translate(${position.x} ${position.y})`}
					className={styles.robotGroup}
				>
					{scanVisible && (
						<g className={styles.scanner}>
							<circle r="108" fill={`url(#${id}-scanner)`} />
							<circle r="108" className={styles.scanOuter} />
							<circle r="75" className={styles.scanInner} />
							<circle r="43" className={styles.scanInner} />
							<g
								className={`${styles.scanSweep} ${running && !emergency ? styles.scanning : ''}`}
							>
								<path
									d="M0 0 83 -69A108 108 0 0 1 108 0Z"
									className={styles.scanSector}
								/>
								<path d="M0 0H108" className={styles.scanRay} />
							</g>
							{Array.from({ length: 36 }, (_, index) => {
								const angle = (index * Math.PI) / 18
								const radius = 99 + Math.sin(index * 7) * 9
								return (
									<circle
										key={index}
										cx={Math.cos(angle) * radius}
										cy={Math.sin(angle) * radius}
										r={index % 3 === 0 ? 1.8 : 1}
										className={styles.scanPoint}
									/>
								)
							})}
						</g>
					)}
					<circle r="32" className={styles.robotHalo} />
					<g transform={`rotate(${position.heading})`}>
						<path
							d="M34 -7 43 0 34 7Z"
							className={styles.headingArrow}
						/>
						<rect
							x="-19"
							y="-24"
							width="11"
							height="7"
							rx="2"
							className={styles.wheel}
						/>
						<rect
							x="-19"
							y="17"
							width="11"
							height="7"
							rx="2"
							className={styles.wheel}
						/>
						<rect
							x="9"
							y="-24"
							width="11"
							height="7"
							rx="2"
							className={styles.wheel}
						/>
						<rect
							x="9"
							y="17"
							width="11"
							height="7"
							rx="2"
							className={styles.wheel}
						/>
						<rect
							x="-24"
							y="-19"
							width="49"
							height="38"
							rx="8"
							fill={`url(#${id}-vehicle)`}
							className={styles.robotBody}
						/>
						<rect
							x="-17"
							y="-13"
							width="30"
							height="26"
							rx="4"
							className={styles.robotDeck}
						/>
						<path
							d="M-12 -7H8M-12 -2H8M-12 3H2"
							className={styles.robotDetail}
						/>
						<circle cx="17" r="5" className={styles.lidar} />
						<circle cx="17" r="2" className={styles.lidarLight} />
						<path d="M-23 -11V11" className={styles.robotLight} />
					</g>
					<g
						transform="translate(37 -49)"
						className={styles.robotTag}
					>
						<path d="M0 28 -16 41" className={styles.tagLeader} />
						<rect width="112" height="40" rx="6" />
						<circle cx="13" cy="14" r="3" />
						<text x="23" y="18">
							XCD-061
						</text>
						<text x="12" y="31" className={styles.robotTagStatus}>
							{statusLabel}
						</text>
					</g>
				</g>
			</svg>

			{/* 控件脱离地图变换，保证任意缩放级别都有固定点击尺寸。 */}
			<div className={styles.viewControls} aria-label="地图视野控制">
				<button
					type="button"
					aria-label="放大地图"
					title="放大地图"
					disabled={zoom >= 2.5}
					onClick={() =>
						setZoom((value) =>
							Math.min(
								2.5,
								Math.round((value + 0.25) * 100) / 100,
							),
						)
					}
				>
					<Plus size={16} />
				</button>
				<span>
					{Math.round(zoom * 100)}
					<small>%</small>
				</span>
				<button
					type="button"
					aria-label="缩小地图"
					title="缩小地图"
					disabled={zoom <= 0.75}
					onClick={() =>
						setZoom((value) =>
							Math.max(
								0.75,
								Math.round((value - 0.25) * 100) / 100,
							),
						)
					}
				>
					<Minus size={16} />
				</button>
				<i />
				<button
					type="button"
					aria-label="恢复全图视野"
					title="恢复全图视野"
					onClick={resetView}
				>
					<Maximize size={15} />
				</button>
				<button
					type="button"
					aria-label="跟随机器人"
					aria-pressed={follow}
					title="跟随机器人"
					className={follow ? styles.activeControl : ''}
					onClick={() => onFollowChange(!follow)}
				>
					<LocateFixed size={16} />
				</button>
			</div>
			<div className={styles.scale}>
				<span>0</span>
				<i />
				<span>{scaleMeters.toFixed(1)} m</span>
			</div>
			<div className={styles.coordinateReadout}>
				<span>
					X <b>{(position.x / 20).toFixed(2)}</b>
				</span>
				<span>
					Y <b>{(position.y / 20).toFixed(2)}</b>
				</span>
				<span>
					θ <b>{position.heading.toFixed(1)}°</b>
				</span>
			</div>
		</div>
	)
}
