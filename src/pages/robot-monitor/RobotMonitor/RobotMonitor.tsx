import {
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from 'react'
import { App } from 'antd'
import {
	Activity,
	ArrowRight,
	BatteryCharging,
	BatteryFull,
	Bot,
	Check,
	ChevronRight,
	CircleHelp,
	Cpu,
	Crosshair,
	Expand,
	Gauge,
	Grid2X2,
	Layers,
	MapPin,
	Minimize2,
	Pause,
	Play,
	Radar,
	Radio,
	RotateCcw,
	Route,
	ShieldCheck,
	Square,
	Terminal,
	Timer,
	Wifi,
	Zap,
} from 'lucide-react'
import { MonitorMap } from '@/features/robot-monitor/components/MonitorMap'
import {
	STATIONS,
	TOTAL_DISTANCE,
} from '@/features/robot-monitor/monitor.model'
import { useRobotMonitor } from '@/features/robot-monitor/hooks/useRobotMonitor'
import styles from '@/pages/robot-monitor/RobotMonitor/RobotMonitor.module.css'

/** 局部开关只控制地图呈现，不改变仿真位置或任务执行状态。 */
function LayerToggle({
	icon,
	label,
	checked,
	onChange,
}: {
	icon: ReactNode
	label: string
	checked: boolean
	onChange: () => void
}) {
	return (
		<button
			type="button"
			className={`${styles.layerToggle} ${checked ? styles.layerActive : ''}`}
			aria-pressed={checked}
			onClick={onChange}
		>
			{icon}
			<span>{label}</span>
			<span className={styles.toggleTrack}>
				<i />
			</span>
		</button>
	)
}

/** 立体机器人示意图与真实位姿分离，专门辅助识别当前监控的单台设备。 */
function RobotIllustration({ emergency }: { emergency: boolean }) {
	return (
		<svg
			className={styles.robotIllustration}
			viewBox="0 0 300 150"
			role="img"
			aria-label="XCD-061 潜伏式 AGV 机器人示意图"
		>
			<defs>
				<linearGradient id="robot-shell" x1="0" y1="0" x2="1" y2="1">
					<stop stopColor="#d0dae5" />
					<stop offset="1" stopColor="#5f7489" />
				</linearGradient>
				<linearGradient id="robot-side" x1="0" y1="0" x2="0" y2="1">
					<stop stopColor="#536a82" />
					<stop offset="1" stopColor="#24384c" />
				</linearGradient>
			</defs>
			<ellipse
				cx="151"
				cy="121"
				rx="102"
				ry="19"
				fill="#49caff"
				opacity=".035"
			/>
			<ellipse
				cx="151"
				cy="121"
				rx="83"
				ry="13"
				fill="none"
				stroke="#3e849d"
				strokeDasharray="3 5"
				opacity=".4"
			/>
			<path
				d="M47 100 148 134 255 84"
				fill="none"
				stroke="#376276"
				opacity=".55"
			/>
			<g stroke="#111e2c" strokeWidth="1.4" strokeLinejoin="round">
				<path d="m77 80 99 32 60-31-101-30Z" fill="#152332" />
				<path d="m78 75 1 22 95 32 2-25Z" fill="#172634" />
				<path d="m176 104 59-30v23l-61 32Z" fill="#0e1925" />
				<path
					d="m68 64 107 33 69-33-106-32Z"
					fill="url(#robot-shell)"
				/>
				<path d="m68 64 1 28 106 33V97Z" fill="url(#robot-side)" />
				<path d="m175 97 69-33v27l-69 34Z" fill="#3c5267" />
				<path d="m89 56 85 26 46-21-83-25Z" fill="#273c4f" />
				<path d="m97 53 77 24 37-17-76-23Z" fill="#52667a" />
				<path d="m108 52 62 19 29-13-62-19Z" fill="#697f93" />
				<path
					d="m81 80 29 9v7l-29-9Z"
					fill={emergency ? '#ff6878' : '#4cdcc5'}
					stroke="none"
				/>
				<path d="m184 104 47-23v5l-47 23Z" fill="#111e2b" />
				<path
					d="m188 106 20-10"
					stroke={emergency ? '#ff6878' : '#5edcf4'}
					strokeWidth="2"
				/>
				<path d="m116 94 43 14" stroke="#263d50" strokeWidth="3" />
				<ellipse
					cx="96"
					cy="104"
					rx="8"
					ry="10"
					fill="#0d1721"
					transform="rotate(-18 96 104)"
				/>
				<ellipse
					cx="155"
					cy="122"
					rx="8"
					ry="10"
					fill="#0d1721"
					transform="rotate(-18 155 122)"
				/>
				<path d="m222 63 6-3v-9l-6 3Z" fill="#293c4d" />
				<ellipse
					cx="225"
					cy="51"
					rx="5"
					ry="3"
					fill={emergency ? '#ff6878' : '#57eed0'}
					stroke="none"
				/>
			</g>
			<path
				d="m68 64-18-6H27M244 76l20-10h18"
				fill="none"
				stroke="#456079"
				strokeWidth=".7"
			/>
			<circle cx="27" cy="58" r="2" fill="#71a5c4" />
			<circle cx="282" cy="66" r="2" fill="#71a5c4" />
		</svg>
	)
}

/** 状态行使用等宽数字，持续刷新时不会引起属性名称或数值跳动。 */
function Parameter({
	label,
	children,
	good = false,
}: {
	label: string
	children: ReactNode
	good?: boolean
}) {
	return (
		<div className={styles.parameter}>
			<dt>{label}</dt>
			<dd className={good ? styles.good : undefined}>{children}</dd>
		</div>
	)
}

/** AGV 单机工作区：统一仿真状态驱动地图、遥测、任务进度与操作日志。 */
export default function RobotMonitor() {
	const monitor = useRobotMonitor()
	const { state, position, progress, speed, statusLabel, remainingSeconds } =
		monitor
	const { message } = App.useApp()
	const rootRef = useRef<HTMLDivElement>(null)
	const [gridVisible, setGridVisible] = useState(true)
	const [routeVisible, setRouteVisible] = useState(true)
	const [scanVisible, setScanVisible] = useState(true)
	const [follow, setFollow] = useState(false)
	const [selectedStation, setSelectedStation] = useState<string | null>(null)
	const [inspectorTab, setInspectorTab] = useState<'status' | 'logs'>(
		'status',
	)
	const [fullscreen, setFullscreen] = useState(false)
	const moving = state.mode === 'running' || state.mode === 'returning'
	const emergency = state.mode === 'emergency'
	const finished = state.mode === 'completed' || state.mode === 'charging'
	const canRelocate = state.mode === 'paused' || finished
	// 暂停与急停也保留返航方向，目标和任务进度始终与恢复后的线路一致。
	const returning = state.travelMode === 'returning'
	const destination = returning ? STATIONS[0] : STATIONS[STATIONS.length - 1]
	const travelPercent = returning ? 100 - progress : progress
	const nextStation = returning
		? ([...STATIONS]
				.reverse()
				.find((station) => station.distance < state.distance) ??
			STATIONS[0])
		: (STATIONS.find((station) => station.distance > state.distance) ??
			STATIONS[STATIONS.length - 1])

	// 监听浏览器全屏退出（包括 Esc），保持图标、提示与实际全屏状态一致。
	useEffect(() => {
		const sync = () =>
			setFullscreen(document.fullscreenElement === rootRef.current)
		document.addEventListener('fullscreenchange', sync)
		return () => document.removeEventListener('fullscreenchange', sync)
	}, [])

	/** 全屏只扩展监控区域；宿主不支持时给出反馈，不丢失当前仿真任务。 */
	const toggleFullscreen = async () => {
		try {
			if (document.fullscreenElement) await document.exitFullscreen()
			else await rootRef.current?.requestFullscreen()
		} catch {
			void message.info('当前窗口不支持全屏，请使用浏览器最大化查看')
		}
	}

	return (
		<div ref={rootRef} className={styles.monitor}>
			{/* 标题区明确标识演示环境，避免把本地交互当作已连接的真实车辆。 */}
			<header className={styles.heading}>
				<div className={styles.titleBlock}>
					<span className={styles.titleIcon}>
						<Radar size={24} />
					</span>
					<div>
						<div className={styles.eyebrow}>
							ROBOT OPERATIONS CENTER
						</div>
						<h1>
							机器人监控
							<span className={styles.version}>单机控制台</span>
						</h1>
					</div>
				</div>
				<div className={styles.headingActions}>
					<span className={styles.demoBadge}>
						<span />
						演示模式
					</span>
					<span className={styles.connection}>
						<Radio size={13} />
						仿真数据在线
					</span>
					<button
						type="button"
						className={styles.iconButton}
						title={fullscreen ? '退出全屏' : '全屏监控'}
						aria-label={fullscreen ? '退出全屏' : '全屏监控'}
						onClick={() => void toggleFullscreen()}
					>
						{fullscreen ? (
							<Minimize2 size={17} />
						) : (
							<Expand size={17} />
						)}
					</button>
				</div>
			</header>

			{/* 四项关键读数以连续仪表带呈现，避免分散地图工作区的视觉重心。 */}
			<section className={styles.telemetry} aria-label="机器人关键指标">
				<div className={styles.metric}>
					<span className={styles.metricIcon}>
						<Bot size={22} />
					</span>
					<div>
						<span className={styles.metricLabel}>
							机器人状态{' '}
							<span className={styles.metricEnglish}>STATUS</span>
						</span>
						<div
							className={`${styles.metricValue} ${emergency ? styles.danger : styles.good}`}
						>
							<i className={styles.statusDot} />
							{statusLabel}
							<span className={styles.metricHint}>自动模式</span>
						</div>
					</div>
				</div>
				<div className={styles.metric}>
					<span className={styles.metricIcon}>
						<Gauge size={22} />
					</span>
					<div>
						<span className={styles.metricLabel}>
							实时速度{' '}
							<span className={styles.metricEnglish}>
								VELOCITY
							</span>
						</span>
						<div className={styles.metricValue}>
							{speed.toFixed(2)}
							<small>m/s</small>
							<span
								className={styles.sparkline}
								aria-hidden="true"
							>
								<svg viewBox="0 0 88 26">
									<path
										d={
											moving
												? 'M0 21 9 21 14 15 20 17 28 7 37 9 43 5 51 9 61 6 70 8 77 5 88 6'
												: 'M0 21H88'
										}
									/>
								</svg>
							</span>
						</div>
					</div>
				</div>
				<div className={styles.metric}>
					<span className={styles.metricIcon}>
						<BatteryFull size={22} />
					</span>
					<div>
						<span className={styles.metricLabel}>
							剩余电量{' '}
							<span className={styles.metricEnglish}>
								BATTERY
							</span>
						</span>
						<div className={styles.metricValue}>
							{Math.round(state.battery)}
							<small>%</small>
							<div
								className={styles.batteryBars}
								aria-hidden="true"
							>
								{Array.from({ length: 10 }, (_, index) => (
									<i
										key={index}
										className={
											index <
											Math.round(state.battery / 10)
												? styles.batteryFilled
												: ''
										}
									/>
								))}
							</div>
						</div>
					</div>
				</div>
				<div className={styles.metric}>
					<span className={styles.metricIcon}>
						<Crosshair size={22} />
					</span>
					<div>
						<span className={styles.metricLabel}>
							定位置信度{' '}
							<span className={styles.metricEnglish}>
								LOCALIZATION
							</span>
						</span>
						<div className={styles.metricValue}>
							99.8<small>%</small>
							<span className={styles.stableBadge}>
								<Check size={11} />
								定位稳定
							</span>
						</div>
					</div>
				</div>
			</section>

			<div className={styles.workspace}>
				<div className={styles.mapColumn}>
					<section
						className={styles.mapPanel}
						aria-label="实时地图监控"
					>
						<div className={styles.panelHeader}>
							<h2>
								<MapPin size={15} />
								实时地图<span>LIVE MAP</span>
							</h2>
							<div className={styles.mapName}>
								<span />
								一号仓库 · 1F
								<ChevronRight size={13} />
								<span className={styles.mapVersion}>V 2.4</span>
							</div>
						</div>
						<div className={styles.mapToolbar}>
							<div className={styles.layerGroup}>
								<Layers size={14} />
								<LayerToggle
									icon={<Grid2X2 size={13} />}
									label="网格"
									checked={gridVisible}
									onChange={() =>
										setGridVisible(!gridVisible)
									}
								/>
								<LayerToggle
									icon={<Route size={13} />}
									label="路径"
									checked={routeVisible}
									onChange={() =>
										setRouteVisible(!routeVisible)
									}
								/>
								<LayerToggle
									icon={<Radar size={13} />}
									label="激光"
									checked={scanVisible}
									onChange={() =>
										setScanVisible(!scanVisible)
									}
								/>
							</div>
							<span className={styles.mapMode}>
								<span />
								二维导航视图
							</span>
						</div>
						<div className={styles.mapCanvas}>
							<MonitorMap
								position={position}
								running={moving}
								emergency={emergency}
								statusLabel={statusLabel}
								routeVisible={routeVisible}
								gridVisible={gridVisible}
								scanVisible={scanVisible}
								follow={follow}
								onFollowChange={setFollow}
								onStationSelect={setSelectedStation}
								selectedStation={selectedStation}
							/>
						</div>
						<div className={styles.mapFooter}>
							<span>
								<i className={styles.legendRobot} />
								机器人
							</span>
							<span>
								<i className={styles.legendRoute} />
								规划路径
							</span>
							<span>
								<i className={styles.legendStation} />
								导航站点
							</span>
							<span className={styles.mapHelp}>
								<CircleHelp size={12} />
								拖动平移 · 滚轮缩放
							</span>
						</div>
					</section>

					{/* 任务时间线与地图共享站点里程，暂停或回充后仍能准确显示当前目标。 */}
					<section className={styles.taskPanel} aria-label="当前任务">
						<div className={styles.taskHeading}>
							<h2>
								<Route size={15} />
								当前任务
								<span className={styles.taskId}>
									{returning
										? 'CHG-20260921-001'
										: 'TSK-20260921-008'}
								</span>
							</h2>
							<span
								className={`${styles.taskStatus} ${emergency ? styles.danger : ''}`}
							>
								<span />
								{statusLabel}
							</span>
						</div>
						<div className={styles.taskContent}>
							<div className={styles.taskDescription}>
								<strong>
									{returning ? '自动回充' : '物料转运'}
									<ArrowRight size={14} />
									<span>{destination.label}</span>
								</strong>
								<span>
									下一站 {nextStation.id} ·{' '}
									{nextStation.label}
								</span>
								<div className={styles.taskMeta}>
									<Timer size={12} />
									{moving
										? `预计剩余 ${Math.ceil(remainingSeconds)} 秒`
										: finished
											? '本次行程已完成'
											: '等待恢复运行'}
									<span>
										路径{' '}
										{(
											(returning
												? state.distance
												: TOTAL_DISTANCE -
													state.distance) / 20
										).toFixed(1)}{' '}
										m
									</span>
								</div>
							</div>
							<div className={styles.taskProgress}>
								<div className={styles.progressHeading}>
									<span>任务进度</span>
									<strong>
										{Math.round(travelPercent)}
										<small>%</small>
									</strong>
								</div>
								<div className={styles.progressTrack}>
									<i style={{ width: `${travelPercent}%` }} />
								</div>
								<div className={styles.stationTrack}>
									{(returning
										? [...STATIONS].reverse()
										: STATIONS
									).map((station) => (
										<button
											type="button"
											key={station.id}
											title={`查看${station.label}`}
											className={
												(
													returning
														? station.distance >=
															state.distance
														: station.distance <=
															state.distance
												)
													? styles.stationReached
													: ''
											}
											onClick={() =>
												setSelectedStation(station.id)
											}
										>
											<i />
											{station.id}
										</button>
									))}
								</div>
							</div>
						</div>
					</section>
				</div>

				<aside className={styles.inspector} aria-label="机器人属性">
					<div className={styles.panelHeader}>
						<h2>
							<Bot size={16} />
							机器人属性
						</h2>
						<span className={styles.singleDevice}>01 / 01</span>
					</div>
					<div className={styles.robotIdentity}>
						<div>
							<strong>
								XCD-061<span>C200</span>
							</strong>
							<span>潜伏式搬运机器人</span>
						</div>
						<span
							className={`${styles.onlineBadge} ${emergency ? styles.danger : ''}`}
						>
							<i />
							{emergency ? '急停' : '在线'}
						</span>
					</div>
					<div className={styles.robotVisual}>
						<div className={styles.visualGrid} />
						<RobotIllustration emergency={emergency} />
						<span className={styles.robotSerial}>
							AGV / XCD061-C200
						</span>
						<span className={styles.robotWeight}>
							200<span>kg</span>
						</span>
					</div>
					<div
						className={styles.inspectorTabs}
						role="tablist"
						aria-label="机器人详情"
					>
						<button
							type="button"
							role="tab"
							id="monitor-status-tab"
							aria-selected={inspectorTab === 'status'}
							aria-controls="monitor-status-panel"
							onClick={() => setInspectorTab('status')}
						>
							<Activity size={14} />
							实时状态
						</button>
						<button
							type="button"
							role="tab"
							id="monitor-logs-tab"
							aria-selected={inspectorTab === 'logs'}
							aria-controls="monitor-logs-panel"
							onClick={() => setInspectorTab('logs')}
						>
							<Terminal size={14} />
							运行日志<span>{state.events.length}</span>
						</button>
					</div>

					{/* 页签切换重建各自的滚动区，避免将日志滚动位置带入状态参数。 */}
					{inspectorTab === 'status' ? (
						<div
							key="status"
							className={styles.inspectorBody}
							role="tabpanel"
							id="monitor-status-panel"
							aria-labelledby="monitor-status-tab"
						>
							<div className={styles.sectionCaption}>
								运行参数<span>TELEMETRY</span>
							</div>
							<dl className={styles.parameters}>
								<Parameter label="运行状态" good={!emergency}>
									<span
										className={
											emergency
												? styles.danger
												: undefined
										}
									>
										{statusLabel}
									</span>
								</Parameter>
								<Parameter label="控制模式">
									自动控制{' '}
									<span className={styles.inlineBadge}>
										AUTO
									</span>
								</Parameter>
								<Parameter label="当前位置 X / Y">
									<span className={styles.coordinates}>
										{(position.x / 20).toFixed(3)}
										<em>/</em>
										{(position.y / 20).toFixed(3)}
									</span>
									<small>m</small>
								</Parameter>
								<Parameter label="车体角度">
									{position.heading.toFixed(1)}
									<small>°</small>
								</Parameter>
								<Parameter label="线速度 / 角速度">
									{speed.toFixed(2)}
									<small>m/s</small>
									<em>/</em>0.00<small>rad/s</small>
								</Parameter>
								<Parameter label="定位方式">
									<Crosshair size={12} />
									SLAM 激光定位
								</Parameter>
								<Parameter label="顶升 / 载货状态">
									低位<em>/</em>未载货
								</Parameter>
							</dl>
							<div className={styles.sectionCaption}>
								设备健康<span>HEALTH</span>
							</div>
							<div className={styles.healthSensors}>
								<span>
									<ShieldCheck size={14} />
									安全雷达
									<i />
								</span>
								<span>
									<Wifi size={14} />
									通信链路
									<i />
								</span>
								<span>
									<Cpu size={14} />
									驱动电机
									<i />
								</span>
							</div>
							<div className={styles.relocation}>
								<label htmlFor="relocation-station">
									<Crosshair size={13} />
									位置重定位
									<span>
										{canRelocate
											? '选择目标站点'
											: '暂停后可操作'}
									</span>
								</label>
								<div>
									<select
										id="relocation-station"
										value={selectedStation ?? ''}
										onChange={(event) =>
											setSelectedStation(
												event.target.value || null,
											)
										}
									>
										<option value="">选择重定位站点</option>
										{STATIONS.map((station) => (
											<option
												value={station.id}
												key={station.id}
											>
												{station.id} · {station.label}
											</option>
										))}
									</select>
									<button
										type="button"
										disabled={
											!canRelocate || !selectedStation
										}
										onClick={() => {
											if (selectedStation)
												monitor.relocate(
													selectedStation,
												)
										}}
									>
										<Crosshair size={13} />
										定位
									</button>
								</div>
							</div>
						</div>
					) : (
						<div
							key="logs"
							className={`${styles.inspectorBody} ${styles.eventPanel}`}
							role="tabpanel"
							id="monitor-logs-panel"
							aria-labelledby="monitor-logs-tab"
						>
							<div className={styles.sectionCaption}>
								本次会话
								<span>最新 {state.events.length} 条</span>
							</div>
							<ol className={styles.eventList}>
								{state.events.map((event) => (
									<li key={event.id} data-tone={event.tone}>
										<i />
										<div>
											<time>{event.time}</time>
											<p>{event.message}</p>
										</div>
									</li>
								))}
							</ol>
						</div>
					)}

					{/* 急停解除只进入暂停态；显式继续后才允许小车重新运动。 */}
					<div className={styles.controls}>
						<div className={styles.controlRow}>
							<button
								type="button"
								className={styles.primaryButton}
								disabled={emergency}
								onClick={
									moving
										? monitor.pause
										: finished
											? monitor.restart
											: monitor.resume
								}
							>
								{moving ? (
									<Pause size={15} />
								) : finished ? (
									<RotateCcw size={15} />
								) : (
									<Play size={15} />
								)}
								{moving
									? '暂停任务'
									: finished
										? '开始新任务'
										: '继续任务'}
							</button>
							<button
								type="button"
								className={styles.secondaryButton}
								disabled={emergency || returning}
								onClick={monitor.returnToCharge}
							>
								<BatteryCharging size={16} />
								自动回充
							</button>
						</div>
						<button
							type="button"
							className={`${styles.emergencyButton} ${emergency ? styles.emergencyActive : ''}`}
							onClick={
								emergency
									? monitor.resetEmergency
									: monitor.emergencyStop
							}
						>
							{emergency ? (
								<RotateCcw size={15} />
							) : (
								<Square size={13} fill="currentColor" />
							)}
							{emergency ? '解除急停' : '紧急停止'}
							<span>
								{emergency ? 'RESET' : 'EMERGENCY STOP'}
							</span>
						</button>
					</div>
				</aside>
			</div>

			{/* 底栏呈现固定演示环境读数；只有位置、速度、电量与任务来自仿真状态。 */}
			<footer className={styles.systemFooter}>
				<span className={styles.footerStatus}>
					<i />
					监控服务就绪
				</span>
				<span>
					<Cpu size={12} />
					CPU <b>23.6%</b>
					<i
						className={styles.resourceTrack}
						style={{ '--usage': '23.6%' } as CSSProperties}
					/>
				</span>
				<span>
					内存 <b>38.2%</b>
					<i
						className={styles.resourceTrack}
						style={{ '--usage': '38.2%' } as CSSProperties}
					/>
				</span>
				<span>
					<Activity size={12} />
					模拟延迟 <b>12 ms</b>
				</span>
				<span className={styles.footerNote}>
					<Zap size={11} />
					本地仿真 · 未连接真实设备
				</span>
				<span className={styles.footerVersion}>APEX ROBOTICS / 01</span>
			</footer>
		</div>
	)
}
