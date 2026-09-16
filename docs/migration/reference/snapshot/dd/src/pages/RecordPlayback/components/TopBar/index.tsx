import {
    BlockOutlined,
    ExportOutlined,
    EyeOutlined,
    FullscreenOutlined,
    HistoryOutlined,
    ImportOutlined,
    SearchOutlined,
    ZoomInOutlined,
    ZoomOutOutlined,
} from '@ant-design/icons';
import {
    Button,
    Checkbox,
    DatePicker,
    Dropdown,
    MenuProps,
    message,
    Popover,
    Select,
} from 'antd';
import dayjs from 'dayjs';
import Konva from 'konva';
import React, { useMemo, useState } from 'react';
import { ExportModal } from '../ExportModal';
import { HistoryModal } from '../HistoryModal';
import { ImportModal } from '../ImportModal';
import RotateMap from '@/components/RotateMap';
import TrafficFilterSelect from '@/components/TrafficFilterSelect';
import AreaHighlightPanel from '@/components/AreaHighlightPanel';
import styles from './index.less';
import { useModel } from '@umijs/max';
import { useLocalStorageState } from 'ahooks';
import { getMapInfo, getImportMapInfo } from '@/api';
import { OverlayVisible } from '@/types/OverLook';
import type { NodeEdgeGroup } from '@/types/MapNestModify';
import { ImportRecording, PlaybackFrameDTO } from '@/types/PlaybackTypings';
import { MapInfo } from '@/utils/typing';
import { useI18n } from '@/hooks/useI18n';

const { RangePicker } = DatePicker;

interface TopBarProps {
    /** 覆盖物可见性 */
    overlayVisible: OverlayVisible;
    /** 设置覆盖物可见性 */
    setOverlayVisible: (visible: OverlayVisible) => void;
    /** 当前选中的车辆ID */
    selectedVehicle: string | undefined;
    /** 设置当前选中的车辆ID */
    setSelectedVehicle: (vehicle: string | undefined) => void;
    /** 地图缩放比例 */
    scale: number;
    /** 设置地图缩放比例 */
    setScale: (scale: number) => void;
    /** 是否正在加载查询结果 */
    isLoading: boolean;
    /** 设置是否正在加载查询结果 */
    setIsLoading: (loading: boolean) => void;
    /** 地图中心位置坐标 */
    position: { x: number; y: number };
    /** 设置地图中心位置坐标 */
    setPosition: (position: { x: number; y: number }) => void;
    /** 地图选项列表 */
    mapOptions: { label: string; value: string }[];
    /** 当前选中的地图ID */
    selectedMapId: string | undefined;
    /** 设置当前选中的地图ID */
    setSelectedMapId: (mapId: string) => void;
    /** 切换全屏 */
    onToggleFullscreen?: () => void;
    /** 时间范围 */
    timeRange: any;
    /** 设置时间范围 */
    setTimeRange: (timeRange: any) => void;
    /** 查询回放帧数据，支持传入覆盖参数以解决异步状态更新时序问题 */
    onQuery?: (overrideMapId?: string, overrideTimeRange?: any[], overrideRecordId?: number) => void;
    /** 设置地图数据 */
    setMapData: (data: MapInfo | null) => void;
    /** 当前回放帧 */
    currentFrame: PlaybackFrameDTO | null;
    /** 弹出层挂载容器（全屏兼容） */
    getPopupContainer?: () => HTMLElement;
    /** 底层 Konva.Stage 实例，供旋转地图等工具直接操作画布变换 */
    stage: Konva.Stage | null;
    /** 当前选中的地图ID，作为旋转角度缓存的键 */
    mapId: string | undefined;
    /** 交管筛选白名单（选中的 agvKey 数组，空 = 显示全部交管） */
    trafficFilterValue: string[];
    /** 交管筛选变更回调（含全局开关联动，由父组件包装，SPEC §3.2） */
    onTrafficFilterChange: (keys: string[]) => void;
    /** 独占区分组（SPEC_area_highlight_monitoring_playback §4.4） */
    exclusiveGroups: NodeEdgeGroup[];
    /** 三方交管分组 */
    trafficGroups: NodeEdgeGroup[];
    /** 当前高亮中的区域ID集合 */
    highlightedAreaIds: Set<string>;
    /** 勾选/取消区域高亮（实现在页面 index.tsx，此处透传） */
    onToggleAreaHighlight: (areaId: string, checked: boolean) => void;
}

export const TopBar: React.FC<TopBarProps> = (props) => {
    const { t } = useI18n();
    const {
        overlayVisible,
        setOverlayVisible,
        selectedVehicle,
        setSelectedVehicle,
        scale,
        setScale,
        isLoading,
        setIsLoading,
        position,
        setPosition,
        mapOptions,
        selectedMapId,
        setSelectedMapId,
        onToggleFullscreen,
        timeRange,
        setTimeRange,
        onQuery,
        setMapData,
        currentFrame,
        getPopupContainer,
        stage,
        mapId,
        trafficFilterValue,
        onTrafficFilterChange,
        exclusiveGroups,
        trafficGroups,
        highlightedAreaIds,
        onToggleAreaHighlight,
    } = props;

    // 导入弹窗是否打开
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    // 导出弹窗是否打开
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    // 历史回放弹窗是否打开
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    // 车辆下拉选项列表，根据当前帧的车辆数据生成
    const vehicleOptions = useMemo(() => {
        if (!currentFrame || !currentFrame.vehicles) return [];
        return currentFrame.vehicles.map((v) => ({
            label: v.agvName || v.agvKey,
            value: v.agvKey,
        }));
    }, [currentFrame]);

    // 交管筛选可选项：当前帧车辆 ∪ 已选（含不在帧的），按 agvKey 去重（SPEC §3.5）
    // 复用 vehicleOptions，再补齐已选但不在当前帧的 agvKey（label 回退为 agvKey）
    const trafficFilterOptions = useMemo(() => {
        const map = new Map<string, { value: string; label: string }>();
        vehicleOptions.forEach(o => map.set(o.value, { value: o.value, label: o.label }));
        trafficFilterValue.forEach(k => {
            if (!map.has(k)) {
                map.set(k, { value: k, label: k });
            }
        });
        return Array.from(map.values());
    }, [vehicleOptions, trafficFilterValue]);

    // 当前使用的地图
    const { currentMapInfo, setCurrentMapInfo } = useModel("currentMapInfo");
    // 车辆信息卡片的全局提示框状态（用于切换地图时销毁旧卡片）
    const { setTooltip } = useModel("tooltipJson");

    // 存储在localStorage中的当前的地图
    const [localMap, setLocalMap] = useLocalStorageState<string>("currentUseMapId", {
        defaultValue: "",
        listenStorageChange: true
    });

    // 处理地图切换，同步更新本地存储和全局状态，并自动执行查询
    const handleMapChange = async (value: string) => {
        // 切换地图时销毁所有车辆信息卡片：不同地图的车辆必然不同，
        // 旧地图残留的 vehicleKey 已无意义，需隐藏卡片并重置提示框状态
        setTooltip({ visible: false, vehicleKey: undefined, clientX: 0, clientY: 0 });

        setLocalMap(value);
        setCurrentMapInfo(prev => ({
            ...prev,
            mapId: value
        }));
        setSelectedMapId(value);

        // 自动执行查询逻辑
        setIsLoading(true);
        try {
            const mapRes = await getMapInfo({ mapId: value });
            if (mapRes.code === 200 && mapRes.data) {
                setMapData({ ...mapRes.data, ...mapRes.data.currentMapInfoVersion });
            } else {
                message.error(mapRes.message || t('获取地图信息失败'));
                setIsLoading(false);
                return;
            }
        } catch (error) {
            console.error('获取地图信息失败:', error);
            message.error(t('获取地图信息异常'));
            setIsLoading(false);
            return;
        }
        if (onQuery) {
            onQuery(value);
        } else {
            setIsLoading(false);
        }
    };

    // 放大地图
    const handleZoomIn = () => setScale(scale * 1.2);
    // 缩小地图
    const handleZoomOut = () => setScale(scale / 1.2);

    /**
     * 普通查询：先获取地图信息，再触发回放帧查询
     */
    const handleQuery = async () => {
        if (!selectedMapId) return;
        /**
         * 时间范围未选择时直接拦截并提示，避免触发无意义的地图请求，
         * 也防止进入 onQuery 后因参数校验失败导致的空查询体验。
         */
        if (!timeRange || !timeRange[0] || !timeRange[1]) {
            message.warning(t('请先选择时间范围'));
            return;
        }
        setIsLoading(true);
        try {
            const mapRes = await getMapInfo({ mapId: selectedMapId });
            if (mapRes.code === 200 && mapRes.data) {
                setMapData({ ...mapRes.data, ...mapRes.data.currentMapInfoVersion });
            } else {
                message.error(mapRes.message || t('获取地图信息失败'));
                setIsLoading(false);
                return;
            }
        } catch (error) {
            console.error('获取地图信息失败:', error);
            message.error(t('获取地图信息异常'));
            setIsLoading(false);
            return;
        }
        if (onQuery) {
            onQuery();
        } else {
            setIsLoading(false);
        }
    };

    // 切换全屏显示
    const toggleFullscreen = () => {
        if (onToggleFullscreen) {
            onToggleFullscreen();
            return;
        }

        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => {
                console.error(`进入全屏失败: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    /**
     * 用户选中历史录制记录后的处理函数：
     * 1. 填入地图ID和时间范围到查询条件
     * 2. 调用 getImportMapInfo 获取导入文件的地图信息并设置
     * 3. 自动触发回放帧查询（使用 override 参数避免 state 时序问题）
     */
    const handleHistorySelect = async (record: ImportRecording) => {
        setSelectedMapId(record.mapId);
        const start = dayjs(Number(record.startTs) || record.startTs);
        const end = dayjs(Number(record.endTs) || record.endTs);
        if (start.isValid() && end.isValid()) {
            setTimeRange([start, end]);
        }
        setIsLoading(true);
        try {
            const mapRes = await getImportMapInfo({ id: record.id });
            if (mapRes.code === 200 && mapRes.data) {
                setMapData(mapRes.data);
            } else {
                message.error(mapRes.message || t('获取导入地图信息失败'));
                setIsLoading(false);
                return;
            }
        } catch (error) {
            console.error('获取导入地图信息失败:', error);
            message.error(t('获取导入地图信息异常'));
            setIsLoading(false);
            return;
        }
        if (onQuery && start.isValid() && end.isValid()) {
            onQuery(record.mapId, [start, end], record.id);
        } else {
            setIsLoading(false);
        }
    };

    // "更多"下拉菜单项：低频数据操作（导入/导出/历史回放）收纳于此，
    // 为主查询路径（地图/时间/查询/锁定车辆/交管）腾出首屏空间
    const moreMenuItems: MenuProps['items'] = [
        { key: 'import', icon: <ImportOutlined />, label: t('导入') },
        { key: 'export', icon: <ExportOutlined />, label: t('导出') },
        { key: 'history', icon: <HistoryOutlined />, label: t('历史回放') },
    ];

    /**
     * 打开导出弹窗前的校验：
     * 1. 时间范围必选，未选择时拦截提示
     * 2. 导出跨度不能超过1小时，超限时拦截提示
     */
    const openExportModal = () => {
        if (!timeRange || !timeRange[0] || !timeRange[1]) {
            message.warning(t('请先选择时间范围'));
            return;
        }
        const duration = timeRange[1].valueOf() - timeRange[0].valueOf();
        const oneHourInMs = 60 * 60 * 1000;
        if (duration > oneHourInMs) {
            message.warning(t('导出时间范围不能超过1小时，请缩小时间范围后重试'));
            return;
        }
        setIsExportModalOpen(true);
    };

    // "更多"菜单点击分发，行为与原独立按钮完全一致
    const handleMoreMenuClick: MenuProps['onClick'] = ({ key }) => {
        if (key === 'import') {
            setIsImportModalOpen(true);
        } else if (key === 'export') {
            openExportModal();
        } else if (key === 'history') {
            setIsHistoryModalOpen(true);
        }
    };

    // 图层显示控制菜单项
    const displayMenuItems: MenuProps['items'] = [
        {
            key: '1',
            label: (
                <Checkbox
                    checked={!overlayVisible.nodeLabel}
                    onChange={() => setOverlayVisible({ ...overlayVisible, nodeLabel: !overlayVisible.nodeLabel })}
                >
                    {t("隐藏所有节点标签")}
                </Checkbox>
            ),
        },
        {
            key: '2',
            label: (
                <Checkbox
                    checked={!overlayVisible.edgeLabel}
                    onChange={() => setOverlayVisible({ ...overlayVisible, edgeLabel: !overlayVisible.edgeLabel })}
                >
                    {t("隐藏所有线路标签")}
                </Checkbox>
            ),
        },
        {
            key: '3',
            label: (
                <Checkbox
                    checked={!overlayVisible.traffic}
                    onChange={() => setOverlayVisible({ ...overlayVisible, traffic: !overlayVisible.traffic })}
                >
                    {t("隐藏所有交管信息")}
                </Checkbox>
            ),
        },
        {
            key: '4',
            label: (
                <Checkbox
                    checked={!overlayVisible.robot}
                    onChange={() => setOverlayVisible({ ...overlayVisible, robot: !overlayVisible.robot })}
                >
                    {t("隐藏所有车辆")}
                </Checkbox>
            ),
        },
        {
            key: '5',
            label: (
                <Checkbox
                    checked={!overlayVisible.device}
                    onChange={() => setOverlayVisible({ ...overlayVisible, device: !overlayVisible.device })}
                >
                    {t("隐藏三方设备")}
                </Checkbox>
            ),
        },
        {
            key: '6',
            label: (
                <Checkbox
                    checked={!overlayVisible.actions}
                    onChange={() => setOverlayVisible({ ...overlayVisible, actions: !overlayVisible.actions })}
                >
                    {t("隐藏动作角标")}
                </Checkbox>
            ),
        },
        // 路径属性着色开关（SPEC edge_attribute_color_toggle D7/D8：直接追加，无分组）
        {
            key: '7',
            label: (
                <Checkbox
                    checked={!overlayVisible.loadSecurityColor}
                    onChange={() => setOverlayVisible({ ...overlayVisible, loadSecurityColor: !overlayVisible.loadSecurityColor })}
                >
                    {t("隐藏载货避障着色")}
                </Checkbox>
            ),
        },
        {
            key: '8',
            label: (
                <Checkbox
                    checked={!overlayVisible.freeSecurityColor}
                    onChange={() => setOverlayVisible({ ...overlayVisible, freeSecurityColor: !overlayVisible.freeSecurityColor })}
                >
                    {t("隐藏空载避障着色")}
                </Checkbox>
            ),
        },
        {
            key: '9',
            label: (
                <Checkbox
                    checked={!overlayVisible.allowVehicleGroupsColor}
                    onChange={() => setOverlayVisible({ ...overlayVisible, allowVehicleGroupsColor: !overlayVisible.allowVehicleGroupsColor })}
                >
                    {t("隐藏车辆分组着色")}
                </Checkbox>
            ),
        },
    ];

    return (
        <>
            <div className={styles.top_bar_container}>
                <div className={styles.left_section}>
                    <Select
                        showSearch
                        filterOption={(input, option) =>
                            (option?.label ?? '')
                                .toLowerCase()
                                .includes(input.toLowerCase())
                        }
                        value={selectedMapId}
                        onChange={handleMapChange}
                        style={{ width: 150 }}
                        options={mapOptions}
                        placeholder={t("请选择地图")}
                        getPopupContainer={getPopupContainer}
                        popupMatchSelectWidth={225}
                    />

                    <RangePicker
                        showTime
                        value={timeRange}
                        onChange={(val) => setTimeRange(val)}
                        getPopupContainer={getPopupContainer}
                    />

                    <Button
                        type="primary"
                        icon={<SearchOutlined />}
                        onClick={handleQuery}
                        loading={isLoading}
                    >
                        {t("查询")}
                    </Button>

                    <div className={styles.divider}></div>

                    <Select
                        showSearch
                        filterOption={(input, option) =>
                            (option?.label ?? '')
                                .toLowerCase()
                                .includes(input.toLowerCase())
                        }
                        allowClear
                        className={styles.vehicle_select}
                        placeholder={t("锁定车辆")}
                        value={selectedVehicle}
                        onChange={setSelectedVehicle}
                        options={vehicleOptions}
                        getPopupContainer={getPopupContainer}
                        popupMatchSelectWidth={375}
                    />

                    {/* 交管白名单筛选：仅显示选中车辆的交管信息，与「锁定车辆」独立（SPEC §4.2） */}
                    <TrafficFilterSelect
                        value={trafficFilterValue}
                        onChange={onTrafficFilterChange}
                        options={trafficFilterOptions}
                        getPopupContainer={getPopupContainer}
                    />
                </div>

                <div className={styles.right_section}>
                    {/* 低频数据操作收纳：导入/导出/历史回放移入"更多"下拉，
                        收纳后右侧从约480px压缩到约230px，保证左侧查询区首屏完整可见 */}
                    <Dropdown
                        menu={{ items: moreMenuItems, onClick: handleMoreMenuClick }}
                        trigger={['click']}
                        getPopupContainer={getPopupContainer}
                    >
                        <Button>{t("导入/导出")}</Button>
                    </Dropdown>

                    <div className={styles.divider}></div>

                    {/* 视图工具组：图标化紧凑排列，悬浮提示说明功能 */}
                    <Dropdown
                        menu={{ items: displayMenuItems }}
                        trigger={['click']}
                        getPopupContainer={getPopupContainer}
                    >
                        <Button type="text" icon={<EyeOutlined />} title={t("图层显示")} />
                    </Dropdown>

                    {/* 区域面板（D12）：独立图标按钮；必须挂 getPopupContainer——
                        原生全屏时挂在 body 的弹层不可见，这是既有惯例非新约定。
                        面板收起后高亮保留（D2），取消高亮随时可再打开操作 */}
                    <Popover
                        trigger="click"
                        placement="bottomRight"
                        getPopupContainer={getPopupContainer}
                        content={
                            <AreaHighlightPanel
                                exclusiveGroups={exclusiveGroups}
                                trafficGroups={trafficGroups}
                                highlightedIds={highlightedAreaIds}
                                onToggle={onToggleAreaHighlight}
                                footerHint={t("区域为当前地图配置，可能与录制时刻不一致")}
                            />
                        }
                    >
                        <Button type="text" icon={<BlockOutlined />} title={t("区域")} />
                    </Popover>

                    <Button
                        type="text"
                        icon={<ZoomInOutlined />}
                        onClick={handleZoomIn}
                        title={t("放大")}
                    />
                    <Button
                        type="text"
                        icon={<ZoomOutOutlined />}
                        onClick={handleZoomOut}
                        title={t("缩小")}
                    />
                    <RotateMap stage={stage} mapId={mapId || ''} />
                    <Button
                        type="text"
                        icon={<FullscreenOutlined />}
                        onClick={toggleFullscreen}
                        title={t("全屏")}
                    />
                </div>
            </div>

            <ImportModal
                open={isImportModalOpen}
                onCancel={() => setIsImportModalOpen(false)}
                onSuccess={() => setIsImportModalOpen(false)}
            />
            <ExportModal
                open={isExportModalOpen}
                onCancel={() => setIsExportModalOpen(false)}
                mapId={selectedMapId}
                startTs={timeRange?.[0]?.valueOf()}
                endTs={timeRange?.[1]?.valueOf()}
            />
            <HistoryModal
                open={isHistoryModalOpen}
                onCancel={() => setIsHistoryModalOpen(false)}
                onSelect={handleHistorySelect}
            />
        </>
    );
};

export default TopBar;
