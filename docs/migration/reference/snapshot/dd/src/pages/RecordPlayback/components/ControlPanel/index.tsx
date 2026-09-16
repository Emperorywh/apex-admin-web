import React, { useEffect, useState, useRef } from 'react';
import { Slider, Button, Dropdown, Modal, Spin, theme } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, FastBackwardOutlined, FastForwardOutlined } from '@ant-design/icons';
import { useDebounceFn } from 'ahooks';
import dayjs from 'dayjs';
import styles from './index.less';
import { getVehicleEventRanges } from '@/api';
import { PlaybackFrameDTO, SysStatusRangeDTO, VehicleEventRangeDTO } from '@/types/PlaybackTypings';
import ErrorEntryTable from '@/components/ErrorEntryTable';
import { useI18n } from '@/hooks/useI18n';

// 事件类型对应的中文标签映射
const EVENT_TYPE_LABEL: Record<string, string> = {
	VEHICLE_ERROR: '车辆异常',
	ORDER_SUSPENDED: '任务挂起',
	TASK_SUSPENDED: '任务挂起',
	AGV_ERROR: '车辆异常',
};

export interface ControlPanelProps {
	frames: PlaybackFrameDTO[];
	startTime: number;
	endTime: number;
	mapId?: string;
	onFrameChange: (frame: PlaybackFrameDTO | null) => void;
	onTimeUpdate?: (currentTs: number) => void;
	anomalyRanges: SysStatusRangeDTO[];
	onSeek?: (seekTs: number) => void;
	isBuffering?: boolean;
	getPopupContainer?: () => HTMLElement;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ frames, startTime, endTime, mapId, anomalyRanges, onFrameChange, onTimeUpdate, onSeek, isBuffering = false, getPopupContainer }) => {
	const { token } = theme.useToken();
	/* 国际化翻译方法 */ const { t } = useI18n();
	// 是否正在播放
	const [isPlaying, setIsPlaying] = useState(false);
	// 播放速度倍率
	const [speed, setSpeed] = useState(1);
	// 滑块当前值（毫秒偏移量）
	const [sliderValue, setSliderValue] = useState(0);
	// 是否正在拖拽滑块
	const [isDragging, setIsDragging] = useState(false);

	// 鼠标悬停时的时间提示信息
	const [hoverTooltip, setHoverTooltip] = useState<{ left: number; text: string } | null>(null);

	// 事件详情弹窗是否打开
	const [isEventModalOpen, setIsEventModalOpen] = useState(false);
	// 当前查看的异常区间
	const [eventModalAnomaly, setEventModalAnomaly] = useState<SysStatusRangeDTO | null>(null);
	// 事件弹窗是否加载中
	const [eventModalLoading, setEventModalLoading] = useState(false);
	// 事件弹窗中的车辆事件列表
	const [eventModalEvents, setEventModalEvents] = useState<VehicleEventRangeDTO[]>([]);
	const [eventModalTs, setEventModalTs] = useState<number>(0);

	// 动画帧请求ID
	const requestRef = useRef<number>();
	// 上一帧的时间戳
	const lastTimeRef = useRef<number>();
	// 是否正在拖拽的引用（用于动画帧内判断）
	const isDraggingRef = useRef(false);
	// 滑块容器DOM引用
	const sliderContainerRef = useRef<HTMLDivElement>(null);
	const hoverTsRef = useRef<number | null>(null);

	// 快进/快退待跳转的目标偏移（防抖等待期间暂存，连续点击只在停止点击后请求最终位置）
	const pendingSkipRef = useRef<number | null>(null);

	// 回放总时长（毫秒）
	const duration = Math.max(0, endTime - startTime);

	// 快进/快退的数据拉取防抖：进度立即跳转，接口请求合并为一次
	const { run: debouncedSkipSeek, cancel: cancelSkipSeek } = useDebounceFn(
		() => {
			const pending = pendingSkipRef.current;
			pendingSkipRef.current = null;
			// 防抖等待期间开始拖拽滑块时放弃本次跳转，拖拽松手会自行触发 seek
			if (pending == null || isDraggingRef.current) return;
			if (onSeek) {
				onSeek(startTime + pending);
			}
		},
		{ wait: 300 },
	);

	// 监听帧数据变化，切换到全新查询时重置状态
	useEffect(() => {
		// 仅当帧数据清空时（切换到全新查询）才重置
		if (frames.length === 0) {
			setSliderValue(0);
			setIsPlaying(false);
			// 取消尚未发出的防抖 seek，避免用旧查询的时间基准发起跳转请求
			cancelSkipSeek();
			pendingSkipRef.current = null;
		}
	}, [frames]);

	// 根据当前播放进度更新显示的帧
	const updateFrame = (elapsed: number) => {
		const currentTs = startTime + elapsed;
		if (onTimeUpdate && !isDraggingRef.current) {
			onTimeUpdate(currentTs);
		}

		if (frames.length === 0 || frames[0].ts > currentTs) {
			onFrameChange(null);
			return;
		}

		// 二分查找最接近且不超过当前时间的帧
		let low = 0;
		let high = frames.length - 1;
		let best = frames[0];

		while (low <= high) {
			const mid = Math.floor((low + high) / 2);
			if (frames[mid].ts <= currentTs) {
				best = frames[mid];
				low = mid + 1;
			} else {
				high = mid - 1;
			}
		}
		onFrameChange(best);
	};

	// 滑块值变化时更新当前帧，播放结束时自动暂停
	useEffect(() => {
		updateFrame(sliderValue);
		if (sliderValue >= duration && duration > 0 && isPlaying && !isDragging) {
			setIsPlaying(false);
		}
	}, [sliderValue, duration, isPlaying, isDragging, frames]);

	// 播放状态的引用（用于动画帧内访问最新值）
	const isPlayingRef = useRef(isPlaying);
	// 播放速度的引用
	const speedRef = useRef(speed);
	// 缓冲状态的引用
	const isBufferingRef = useRef(isBuffering);

	// 动画帧回调，驱动播放进度推进
	const play = (time: number) => {
		if (lastTimeRef.current != null && !isBufferingRef.current) {
			const deltaTime = time - lastTimeRef.current;
			setSliderValue((prev) => {
				let nextValue = prev + deltaTime * speedRef.current;
				if (nextValue >= duration) {
					nextValue = duration;
				}
				return nextValue;
			});
		}
		lastTimeRef.current = time;
		if (isPlayingRef.current) {
			requestRef.current = requestAnimationFrame(play);
		}
	};

	// 页面隐藏时暂停播放
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.hidden) {
				setIsPlaying(false);
			}
		};
		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
	}, []);

	// 同步播放相关状态到ref，并管理动画帧的启停
	useEffect(() => {
		isPlayingRef.current = isPlaying;
		speedRef.current = speed;
		isBufferingRef.current = isBuffering;

		if (isPlaying && !isDragging) {
			lastTimeRef.current = performance.now();
			requestRef.current = requestAnimationFrame(play);
		} else {
			if (requestRef.current) {
				cancelAnimationFrame(requestRef.current);
			}
			lastTimeRef.current = undefined;
		}
		return () => {
			if (requestRef.current) {
				cancelAnimationFrame(requestRef.current);
			}
		};
	}, [isPlaying, speed, duration, isDragging, isBuffering]);

	// 切换播放/暂停状态
	const togglePlay = () => {
		if (sliderValue >= duration && duration > 0) {
			setSliderValue(0);
		}
		setIsPlaying(!isPlaying);
	};

	// 将毫秒偏移量格式化为日期时间字符串
	const formatTime = (ms: number) => {
		if (isNaN(ms) || startTime === 0) return '--';
		return dayjs(startTime + ms).format('YYYY-MM-DD HH:mm:ss');
	};

	// 滑块拖拽中回调
	const handleSliderChange = (value: number) => {
		setIsDragging(true);
		isDraggingRef.current = true;
		setSliderValue(value);
	};

	// 滑块拖拽结束回调
	const handleSliderAfterChange = (value: number) => {
		setIsDragging(false);
		isDraggingRef.current = false;
		if (onSeek) {
			onSeek(startTime + value);
		}
	};

	// 快进或快退指定毫秒数
	const skipTime = (amount: number) => {
		// 计算跳转后的目标进度，并夹取在有效范围内
		const next = Math.max(0, Math.min(duration, sliderValue + amount));
		// UI 立即跳转，数据拉取走防抖：与拖拽滑块松手一致，主动跳转需通知父组件
		// 按需拉取目标位置附近的数据，否则回退落入未拉取的空洞区间时画面会停留在旧帧；
		// 连续点击时合并为停止点击后对最终位置的一次请求
		setSliderValue(next);
		pendingSkipRef.current = next;
		debouncedSkipSeek();
	};

	// 点击异常区间标记，跳转到该时刻并打开事件详情弹窗
	const handleAnomalyClick = (anomaly: SysStatusRangeDTO) => {
		const seekTs = Number.parseInt(`${hoverTsRef.current ?? anomaly.startTs}`);
		// if (isPlaying) setIsPlaying(false);
		// const elapsed = seekTs - startTime;
		// setSliderValue(Math.max(0, Math.min(duration, elapsed)));
		// if (onSeek) onSeek(seekTs);

		setEventModalAnomaly(anomaly);
		setEventModalTs(seekTs);
		setIsEventModalOpen(true);
		setEventModalLoading(true);
		if (mapId) {
			getVehicleEventRanges({ mapId, ts: seekTs })
				.then((res) => {
					if (res.code === 200 && res.data) {
						setEventModalEvents(res.data);
					}
				})
				.catch((err) => console.error('获取车辆事件失败:', err))
				.finally(() => setEventModalLoading(false));
		} else {
			setEventModalLoading(false);
		}
	};

	// 时间轴鼠标移动时显示悬停时间提示
	const handleTrackMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
		const container = sliderContainerRef.current;
		if (!container || duration === 0 || isDragging) return;
		const rect = container.getBoundingClientRect();
		const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		const ms = ratio * duration;
		hoverTsRef.current = startTime + ms;
		setHoverTooltip({ left: e.clientX - rect.left, text: formatTime(ms) });
	};

	// 鼠标离开时间轴时隐藏悬停提示
	const handleTrackMouseLeave = () => {
		setHoverTooltip(null);
		hoverTsRef.current = null;
	};

	// 播放速度下拉菜单配置
	const speedMenu = {
		items: [
			{ key: '0.5', label: '0.5x', onClick: () => setSpeed(0.5) },
			{ key: '1', label: '1x', onClick: () => setSpeed(1) },
			{ key: '2', label: '2x', onClick: () => setSpeed(2) },
			{ key: '4', label: '4x', onClick: () => setSpeed(4) },
			{ key: '8', label: '8x', onClick: () => setSpeed(8) },
		],
		selectable: true,
		selectedKeys: [speed.toString()],
	};

	return (
		<div className={styles.controlPanel} style={{ backgroundColor: token.colorBgContainer, borderTopColor: token.colorBorderSecondary }}>
			{/* 时间轴滑块 */}
			<div className={styles.timelineRow}>
				<span className={`${styles.timeText} ${styles.timeTextRight}`} style={{ color: token.colorTextSecondary }}>{formatTime(sliderValue)}</span>

				<div
					className={styles.sliderContainer}
					ref={sliderContainerRef}
					onMouseMove={handleTrackMouseMove}
					onMouseLeave={handleTrackMouseLeave}
				>
					<Slider
						className={styles.slider}
						min={0}
						max={duration}
						value={sliderValue}
						onChange={handleSliderChange}
						onAfterChange={handleSliderAfterChange}
						tooltip={{ formatter: (val) => formatTime(val || 0) }}
						disabled={duration === 0}
					/>
					{anomalyRanges.length > 0 && duration > 0 && (
						<div className={styles.anomalyBar} style={{ backgroundColor: token.colorBorderSecondary }}>
							{anomalyRanges.map((a, i) => {
								const left = Math.max(0, ((a.startTs - startTime) / duration) * 100);
								const rangeEnd = a.endTs || endTime;
								const width = Math.max(0.5, ((rangeEnd - a.startTs) / duration) * 100);
								return (
									<div
										key={i}
									className={styles.anomalyMarker}
									style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
									title={t(EVENT_TYPE_LABEL[a.status] || a.status)}
									onClick={() => handleAnomalyClick(a)}
									/>
								);
							})}
						</div>
					)}
					{hoverTooltip && (
						<div className={styles.hoverTooltip} style={{ left: hoverTooltip.left }}>
							{hoverTooltip.text}
						</div>
					)}
				</div>

				<span className={styles.timeText} style={{ color: token.colorTextSecondary }}>{formatTime(duration)}</span>
			</div>

			{/* 播放控制按钮 */}
			<div className={styles.controlsRow}>
				<div className={styles.controlsGroup}>
					<Button
						type="text"
						icon={<FastBackwardOutlined className={styles.iconNormal} style={{ color: token.colorTextSecondary }} />}
						onClick={() => skipTime(-5000)}
						disabled={duration === 0}
					/>
					<Button
						type="text"
						icon={isPlaying ? <PauseCircleOutlined className={styles.iconPlay} style={{ color: token.colorPrimary }} /> : <PlayCircleOutlined className={styles.iconPlay} style={{ color: token.colorPrimary }} />}
						onClick={togglePlay}
						disabled={duration === 0}
					/>
					<Button
						type="text"
						icon={<FastForwardOutlined className={styles.iconNormal} style={{ color: token.colorTextSecondary }} />}
						onClick={() => skipTime(5000)}
						disabled={duration === 0}
					/>
					<Dropdown menu={speedMenu} placement="top" trigger={['click']} disabled={duration === 0} getPopupContainer={getPopupContainer}>
						<Button type="text" className={styles.speedBtn} style={{ color: token.colorTextSecondary }}>
							{speed}x
						</Button>
					</Dropdown>
				</div>
			</div>
			<Modal
				title={`${t("时刻事件")}${eventModalTs ? ` (${dayjs(eventModalTs).format('HH:mm:ss')})` : ''}`}
				open={isEventModalOpen}
				onCancel={() => setIsEventModalOpen(false)}
				footer={
					<Button type="primary" onClick={() => setIsEventModalOpen(false)}>
						{t("关闭")}
					</Button>
				}
				destroyOnClose
				width={880}
				centered
				getContainer={getPopupContainer}
			>
			{eventModalLoading ? (
				<div className={styles.eventModalLoading}>
					<Spin size="large" />
					<div className={styles.loadingText} style={{ color: token.colorTextSecondary }}>{t("正在查询时刻车辆事件...")}</div>
				</div>
			) : (
			<div className={styles.eventModalContent}>
				{eventModalEvents.length > 0 ? (
					eventModalEvents.map((event, idx) => {
						const payload = event.payloadJson || {};
						const vehicleName = payload.vehicleName || event.vehicleKey;
						const errorEntryList = payload.errorEntryList;
						return (
							<div key={idx} className={styles.eventCard} style={{ borderColor: token.colorBorderSecondary }}>
								<div className={styles.eventCardHeader} style={{ color: token.colorError, background: token.colorErrorBg, borderBottomColor: token.colorErrorBorder }}>
									{vehicleName} - {t(EVENT_TYPE_LABEL[event.eventType] || event.eventType)}
								</div>
								{Array.isArray(errorEntryList) && errorEntryList.length > 0 ? (
									<div className={styles.eventCardBody} style={{ background: token.colorFillQuaternary }}>
										<ErrorEntryTable errorEntryList={errorEntryList} />
									</div>
								) : (
									<div className={styles.eventCardBody} style={{ color: token.colorTextSecondary }}>{t('暂无告警')}</div>
								)}
							</div>
						);
					})
				) : (
					<div className={styles.emptyText} style={{ color: token.colorTextDisabled }}>{t("该时刻暂无车辆事件")}</div>
				)}
			</div>
			)}
			</Modal>
		</div>
	);
};

export default ControlPanel;
