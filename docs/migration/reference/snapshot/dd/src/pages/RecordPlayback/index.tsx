import { getPlaybackFrames, getSimpleMaps, getSystemStatusRanges } from '@/api';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import KonvaRender from './components/KonvaRender';
import TopBar from './components/TopBar';
import ControlPanel from './components/ControlPanel';
import VehicleInformation from './components/VehicleInformation';
import VehicleStatusLegend from '@/components/VehicleStatusLegend';
import styles from './index.less';
import { Spin, Empty, message } from 'antd';
import { OverlayVisible } from '@/types/OverLook';
import { PlaybackFrameDTO, SysStatusRangeDTO } from '@/types/PlaybackTypings';
import { splitNodeEdgeGroups, getAreaFocusPosition } from '@/utils/areaHighlight';
import { MapInfo } from '@/utils/typing';
import { useI18n } from '@/hooks/useI18n';

/**
 * 录制回放页面
 * @returns
 */
const RecordPlayback = () => {
    const { t } = useI18n();
    // 地图中图层的显示隐藏
    const [overlayVisible, setOverlayVisible] = useState<OverlayVisible>({
        nodeLabel: true,
        edgeLabel: false,
        traffic: true,
        robot: true,
        grid: false,
        angle: false,
        device: false,
        actions: false,
        // 路径属性着色默认全部关闭（SPEC edge_attribute_color_toggle D5）
        loadSecurityColor: false,
        freeSecurityColor: false,
        allowVehicleGroupsColor: false,
    });
    // 当前选中的车辆ID
    const [selectedVehicle, setSelectedVehicle] = useState<string | undefined>(
        undefined,
    );
    // 交管白名单：选中的 agvKey 数组。空数组 = 显示全部（TrafficGroup 内短路）。不持久化（SPEC §3.1）
    const [visibleTrafficAgvKeys, setVisibleTrafficAgvKeys] = useState<string[]>([]);
    // 地图缩放比例
    const [scale, setScale] = useState(1);
    // 是否正在加载查询结果
    const [isLoading, setIsLoading] = useState(false);
    // 地图中心位置坐标
    const [position, setPosition] = useState({ x: 0, y: 0 });

    // Konva Stage 实例，供 TopBar 中的旋转地图等功能直接操作画布变换
    const [stage, setStage] = useState<Konva.Stage | null>(null);

    // 地图选项列表
    const [mapOptions, setMapOptions] = useState<
        { label: string; value: string }[]
    >([]);
    // 当前选中的地图ID
    const [selectedMapId, setSelectedMapId] = useState<string | undefined>(
        undefined,
    );
    // 时间范围状态 [开始时间, 结束时间]
    const [timeRange, setTimeRange] = useState<any>([
        dayjs().subtract(10, 'minute'),
        dayjs(),
    ]);
    // 实际查询使用的时间范围
    const [queriedTimeRange, setQueriedTimeRange] = useState<any>(null);

    // 地图数据
    const [mapData, setMapData] = useState<MapInfo | null>(null);

    /**
     * 区域高亮状态（SPEC_area_highlight_monitoring_playback §4.4）。
     * 区域列表随 mapData 派生；重新查询/切换地图/历史回放都会 setMapData 新引用，
     * 届时清空高亮集合（D9，不同地图 areaId 互不相通）。
     */
    const [highlightedAreaIds, setHighlightedAreaIds] = useState<Set<string>>(new Set());

    // 面板按类型分两组展示（D13）；旧导入文件缺 nodeEdgeGroups 时 splitNodeEdgeGroups 返回空数组
    const { exclusiveGroups, trafficGroups } = useMemo(
        () => splitNodeEdgeGroups(mapData?.mapJson?.nodeEdgeGroups),
        [mapData],
    );

    // 回放帧数据列表
    const [playBackFrames, setPlayBackFrames] = useState<PlaybackFrameDTO[]>([]);
    // 当前显示的回放帧
    const [currentFrame, setCurrentFrame] = useState<PlaybackFrameDTO | null>(null);
    // 是否正在缓冲加载数据
    const [isBuffering, setIsBuffering] = useState(false);
    // 系统异常时间区间列表
    const [anomalyRanges, setAnomalyRanges] = useState<SysStatusRangeDTO[]>([]);

    // 最新已拉取的时间戳
    const latestFetchedTsRef = useRef<number>(0);
    // 查询时间范围的引用
    const queriedTimeRangeRef = useRef<any>(null);
    // 是否正在拉取数据的标记
    const isFetchingDataRef = useRef(false);
    // 回放帧数据列表的引用
    const playBackFramesRef = useRef<PlaybackFrameDTO[]>([]);
    // 上次拉取是否返回空数据
    const lastFetchEmptyRef = useRef(false);
    // 跳转版本号，用于处理并发seek请求
    const seekVersionRef = useRef(0);
    // 当前回放的历史录制ID（历史回放时有值，普通查询时为undefined）
    const recordIdRef = useRef<number | undefined>(undefined);

    // 同步查询时间范围到ref
    useEffect(() => {
        queriedTimeRangeRef.current = queriedTimeRange;
    }, [queriedTimeRange]);

    // 同步回放帧数据到ref
    useEffect(() => {
        playBackFramesRef.current = playBackFrames;
    }, [playBackFrames]);

    // 页面容器DOM引用
    const containerRef = useRef<HTMLDivElement>(null);

    // 获取弹出层挂载容器（全屏兼容）
    const getPopupContainer = () => containerRef.current || document.body;

    // 处理车辆选择切换
    // 锁定后由 KonvaRender 内部的跟随动画逐帧缓慢滑动到车辆位置，并在车辆周围绘制虚线圆
    const handleVehicleChange = (vehicleKey: string | undefined) => {
        setSelectedVehicle(vehicleKey);
    };

    /**
     * 交管白名单变更包装：
     * - 非空选中时，同步取消「隐藏所有交管信息」全局开关，避免选了车却看不到的困惑；
     * - 清空时不改动全局开关，保持当前显隐状态（SPEC §3.2）。
     * 与「锁定车辆」(selectedVehicle) 完全独立（SPEC §2 决策）。
     */
    const handleTrafficFilterChange = (keys: string[]) => {
        setVisibleTrafficAgvKeys(keys);
        if (keys.length > 0) {
            setOverlayVisible(prev => ({ ...prev, traffic: true }));
        }
    };

    /**
     * 切换全屏显示
     */
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch((err: any) => {
                console.error(`进入全屏失败: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    /**
     * 从服务器获取地图列表
     */
    const fetchMaps = async () => {
        try {
            const res = await getSimpleMaps();
            if (res.code === 200 && res.data) {
                setMapOptions(
                    res.data.map((item: MapInfo) => ({
                        label: item.mapName,
                        value: item.mapId,
                    })),
                );
                if (!selectedMapId && res.data.length > 0) {
                    setSelectedMapId(res.data[0].mapId);
                }
            }
        } catch (error) {
            console.error('获取地图列表失败:', error);
        }
    };

    /**
     * 处理查询请求，仅获取回放帧数据（地图信息由调用方在查询前独立获取）
     * @param overrideMapId 覆盖当前选中的地图ID（用于状态尚未更新的场景）
     * @param overrideTimeRange 覆盖当前的时间范围（用于状态尚未更新的场景）
     */
    const handleQuery = async (overrideMapId?: string, overrideTimeRange?: any[], overrideRecordId?: number) => {
        const queryMapId = overrideMapId ?? selectedMapId;
        const queryTimeRange = overrideTimeRange ?? timeRange;
        if (!queryMapId || !queryTimeRange || queryTimeRange.length !== 2) {
            /**
             * 参数校验失败时必须重置 loading 状态。
             * 调用方（TopBar.handleQuery / handleMapChange 等）在调用 onQuery 前已将 isLoading 置为 true，
             * 若此处直接 return 而不重置，查询按钮与加载遮罩将永远停留在"加载中"，
             * 例如用户清空时间范围后点击查询、或清空时间后切换地图，都会触发该路径。
             */
            setIsLoading(false);
            return;
        }
        recordIdRef.current = overrideRecordId;
        setIsLoading(true);
        setCurrentFrame(null);
        // 重新查询清空交管白名单（不同查询车辆集合不同，旧选择无意义；SPEC §5.3）
        setVisibleTrafficAgvKeys([]);
        setQueriedTimeRange(queryTimeRange);
        setAnomalyRanges([]);
        playBackFramesRef.current = [];
        setPlayBackFrames([]);
        isFetchingDataRef.current = true;
        lastFetchEmptyRef.current = false;
        try {
            const startTs = queryTimeRange[0].valueOf();
            const endTs = queryTimeRange[1].valueOf();
            const initialToTs = Math.min(startTs + 20000, endTs);
            latestFetchedTsRef.current = initialToTs;

            getSystemStatusRanges({ mapId: queryMapId, fromTs: startTs, toTs: endTs })
                .then((res) => {
                    if (res.code === 200 && res.data) {
                        setAnomalyRanges(res.data);
                    }
                })
                .catch((err) => console.error('获取系统状态区间失败:', err));

            const res = await getPlaybackFrames({
                mapId: queryMapId,
                fromTs: startTs,
                toTs: initialToTs,
                recordId: recordIdRef.current,
            });

            if (res.code === 200 && res.data) {
                playBackFramesRef.current = res.data;
                setPlayBackFrames(res.data);
            } else {
                message.error(res.message || t('查询回放数据失败'));
                setQueriedTimeRange(null);
            }
        } catch (error) {
            console.error('查询过程中发生异常:', error);
        } finally {
            isFetchingDataRef.current = false;
            setIsBuffering(false);
            setIsLoading(false);
        }
    };

    /**
     * 播放过程中增量预取下一段数据
     * 仅在正常播放推进时调用（拖拽/seek 期间不触发）
     */
    const fetchNextFramesChunk = async (currentTs: number) => {
        if (!selectedMapId || !queriedTimeRangeRef.current || queriedTimeRangeRef.current.length !== 2) return;

        const globalEndTs = queriedTimeRangeRef.current[1].valueOf();
        const allFetched = latestFetchedTsRef.current >= globalEndTs;
        const frames = playBackFramesRef.current;
        const lastFrameTs = frames.length > 0 ? frames[frames.length - 1].ts : 0;

        if (isFetchingDataRef.current) {
            if (currentTs >= lastFrameTs && !allFetched) {
                setIsBuffering(true);
            }
            return;
        }

        if (allFetched) return;

        if (lastFrameTs > 0 && (lastFrameTs - currentTs) > 5000 && (latestFetchedTsRef.current - currentTs) > 5000) return;

        if (lastFetchEmptyRef.current && (latestFetchedTsRef.current - currentTs) > 5000) return;

        if (currentTs >= lastFrameTs) {
            setIsBuffering(true);
        }

        isFetchingDataRef.current = true;
        // 游标理论恒为整数（seek 入口已取整），此处再取整一次作防御，确保请求参数不带小数
        const nextFromTs = Math.round(latestFetchedTsRef.current) + 1;
        const nextToTs = Math.min(nextFromTs + 20000, globalEndTs);
        try {

            const res = await getPlaybackFrames({
                mapId: selectedMapId,
                fromTs: nextFromTs,
                toTs: nextToTs,
                recordId: recordIdRef.current,
            });

            if (res.code === 200 && res.data) {
                latestFetchedTsRef.current = nextToTs;
                lastFetchEmptyRef.current = res.data.length === 0;
                if (res.data.length > 0) {
                    setPlayBackFrames((prev) => {
                        const combined = [...prev, ...res.data];
                        combined.sort((a, b) => a.ts - b.ts);
                        playBackFramesRef.current = combined;
                        return combined;
                    });
                }
            } else {
                latestFetchedTsRef.current = nextToTs;
                lastFetchEmptyRef.current = true;
                message.error(res.message || t('拉取回放数据失败'));
            }
        } catch (error) {
            console.error('增量拉取回放帧数据失败:', error);
            latestFetchedTsRef.current = nextToTs;
            lastFetchEmptyRef.current = true;
        } finally {
            isFetchingDataRef.current = false;
            setIsBuffering(false);
        }
    };

    /**
     * 用户主动 seek（点击/拖拽滑块松手）时调用
     * 若目标位置超出已缓冲范围，直接跳到目标位置加载数据，不填充中间 gap
     * 若目标位置在已拉取范围内但帧缓存存在空洞，也会重新拉取
     */
    const handleSeek = async (seekTs: number) => {
        if (!selectedMapId || !queriedTimeRangeRef.current || queriedTimeRangeRef.current.length !== 2) return;

        // 滑块按位置比例换算出的时间戳是浮点数，接口要求毫秒时间戳为整数，
        // 统一在入口取整，避免 fromTs/toTs 带小数
        seekTs = Math.round(seekTs);

        const globalEndTs = queriedTimeRangeRef.current[1].valueOf();
        const isForwardSeek = seekTs > latestFetchedTsRef.current;

        if (isForwardSeek) {
            if (latestFetchedTsRef.current >= globalEndTs) return;
        } else {
            // 向后 seek：用二分查找检测 seekTs 之前是否有实际帧数据，
            // 若处于已拉取区间的空洞中则需要重新拉取
            const frames = playBackFramesRef.current;
            const hasNearbyFrames = (() => {
                if (frames.length === 0) return false;
                let low = 0, high = frames.length - 1;
                while (low <= high) {
                    const mid = Math.floor((low + high) / 2);
                    if (frames[mid].ts <= seekTs) {
                        low = mid + 1;
                    } else {
                        high = mid - 1;
                    }
                }
                // high = 最后一个 ts <= seekTs 的帧索引（-1 表示没有）
                // low  = 第一个 ts >  seekTs 的帧索引
                const GAP_TOLERANCE = 5000;
                // 回退位置的渲染依赖"不晚于目标时刻"的帧（frames[high]），
                // 目标之后的帧（frames[low]）无法覆盖回退位置，
                // 因此只按 frames[high] 判断附近是否有数据，
                // 否则回退到空洞中（前方恰好有 seek 拉取的帧）会被误判为无需拉取
                return high >= 0 && (seekTs - frames[high].ts) <= GAP_TOLERANCE;
            })();
            if (hasNearbyFrames) return;
        }

        const version = ++seekVersionRef.current;
        // 将拉取游标重置到 seek 目标，确保后续增量拉取从此处继续
        latestFetchedTsRef.current = seekTs;
        isFetchingDataRef.current = true;
        setIsBuffering(true);
        lastFetchEmptyRef.current = false;
        const fetchToTs = Math.min(seekTs + 20000, globalEndTs);

        try {
            const res = await getPlaybackFrames({
                mapId: selectedMapId,
                fromTs: seekTs,
                toTs: fetchToTs,
                recordId: recordIdRef.current,
            });

            if (version !== seekVersionRef.current) return;

            if (res.code === 200 && res.data) {
                // 拉取游标是"已拉取到的时间高水位"：向后 seek 补拉时不能让游标倒退，
                // 否则后续增量预取会从倒退位置重复拉取已缓冲的区间
                latestFetchedTsRef.current = Math.max(latestFetchedTsRef.current, fetchToTs);
                lastFetchEmptyRef.current = res.data.length === 0;
                if (res.data.length > 0) {
                    setPlayBackFrames((prev) => {
                        const combined = [...prev, ...res.data];
                        combined.sort((a, b) => a.ts - b.ts);
                        playBackFramesRef.current = combined;
                        return combined;
                    });
                }
            } else {
                latestFetchedTsRef.current = Math.max(latestFetchedTsRef.current, fetchToTs);
                lastFetchEmptyRef.current = true;
                message.error(res.message || t('跳转拉取数据失败'));
            }
        } catch (error) {
            console.error('跳转后拉取帧数据失败:', error);
            latestFetchedTsRef.current = Math.max(latestFetchedTsRef.current, fetchToTs);
            lastFetchEmptyRef.current = true;
        } finally {
            if (version === seekVersionRef.current) {
                isFetchingDataRef.current = false;
                setIsBuffering(false);
            }
        }
    };

    // 页面初始化时获取地图列表
    useEffect(() => {
        fetchMaps();
    }, []);

    // mapData 为空时 KonvaRender 卸载，底层 Stage 实例被销毁；
    // 同步清空 stage 引用，避免 RotateMap 持有已被销毁的实例再次操作画布。
    useEffect(() => {
        if (!mapData) setStage(null);
    }, [mapData]);

    // 换图 / 重新查询 / 历史回放都会产生新的 mapData 引用：清空区域高亮（D9）
    useEffect(() => {
        // 已为空时返回原引用，避免首次挂载（mapData 尚为 null）时因新 Set 引用空跑一次重渲染
        setHighlightedAreaIds(prev => (prev.size ? new Set() : prev));
    }, [mapData]);

    /**
     * 勾选/取消区域高亮（TopBar 面板透传）。
     * 聚焦用 focusStageToArea 的受控变体（D3 / §4.4）：scale/position 是受控 state 且与
     * 锁定跟随 lerp 动画并存，stage.to 会互相拉扯，故 getAreaFocusPosition 后一步 setPosition。
     * - 锁定车辆（selectedVehicle 非空，跟随中）时跳过聚焦，仅高亮；
     * - isLoading 期间 KonvaRender 已卸载、stage state 仍持旧实例（仅 mapData 为 null 时才清空），
     *   对已销毁 stage findOne 恒为 null → getAreaFocusPosition 返回 null 自动跳过，不得调 stage.to。
     */
    const handleToggleAreaHighlight = useCallback((areaId: string, checked: boolean) => {
        setHighlightedAreaIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(areaId);
            else next.delete(areaId);
            return next;
        });
        if (checked && !selectedVehicle && stage) {
            const targetGroup = [...exclusiveGroups, ...trafficGroups].find(group => group.id === areaId);
            if (targetGroup) {
                const pos = getAreaFocusPosition(stage, targetGroup);
                pos && setPosition(pos);
            }
        }
    }, [selectedVehicle, stage, exclusiveGroups, trafficGroups]);

    return (
        <div className={styles.container} ref={containerRef}>
            <TopBar
                overlayVisible={overlayVisible}
                setOverlayVisible={setOverlayVisible}
                selectedVehicle={selectedVehicle}
                setSelectedVehicle={handleVehicleChange}
                scale={scale}
                setScale={setScale}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                position={position}
                setPosition={setPosition}
                mapOptions={mapOptions}
                selectedMapId={selectedMapId}
                setSelectedMapId={setSelectedMapId}
                onToggleFullscreen={toggleFullscreen}
                timeRange={timeRange}
                setTimeRange={setTimeRange}
                onQuery={handleQuery}
                setMapData={setMapData}
                currentFrame={currentFrame}
                getPopupContainer={getPopupContainer}
                stage={stage}
                mapId={selectedMapId}
                trafficFilterValue={visibleTrafficAgvKeys}
                onTrafficFilterChange={handleTrafficFilterChange}
                exclusiveGroups={exclusiveGroups}
                trafficGroups={trafficGroups}
                highlightedAreaIds={highlightedAreaIds}
                onToggleAreaHighlight={handleToggleAreaHighlight}
            />
            <div className={styles.spinContainer}>
                {(isLoading || isBuffering) && (
                    <div className={styles.loadingMask}>
                        <Spin spinning={true} tip={isBuffering ? t("加载下一段数据中...") : ""} />
                    </div>
                )}
                {!isLoading && !mapData && (
                    <Empty description={t("请选择地图和时间范围后点击查询")} />
                )}
                {!isLoading && mapData && <KonvaRender
                    mapData={mapData}
                    scale={scale}
                    position={position}
                    setScale={setScale}
                    setPosition={setPosition}
                    currentFrame={currentFrame}
                    overlayVisible={overlayVisible}
                    focusId={selectedVehicle}
                    setStage={setStage}
                    visibleTrafficAgvKeys={visibleTrafficAgvKeys}
                    highlightedAreaIds={highlightedAreaIds}
                />}
                {/* 车辆状态图例：与 KonvaRender 同条件挂载（未查询/无地图数据/加载中时画布不存在，图例一并隐藏），避免悬浮在 Empty 占位上（SPEC_vehicle_status_legend §6.3） */}
                {!isLoading && mapData && <VehicleStatusLegend />}
            </div>
            <ControlPanel
                frames={playBackFrames}
                startTime={queriedTimeRange && queriedTimeRange.length === 2 ? queriedTimeRange[0].valueOf() : 0}
                endTime={queriedTimeRange && queriedTimeRange.length === 2 ? queriedTimeRange[1].valueOf() : 0}
                mapId={selectedMapId}
                anomalyRanges={anomalyRanges}
                onFrameChange={setCurrentFrame}
                onTimeUpdate={fetchNextFramesChunk}
                onSeek={handleSeek}
                isBuffering={isBuffering}
                getPopupContainer={getPopupContainer}
            />
            <VehicleInformation
                vehicles={currentFrame?.vehicles}
                mapId={selectedMapId}
                ts={currentFrame?.ts}
                recordId={recordIdRef.current}
                getPopupContainer={getPopupContainer}
            />
        </div>
    );
};

export default RecordPlayback;
