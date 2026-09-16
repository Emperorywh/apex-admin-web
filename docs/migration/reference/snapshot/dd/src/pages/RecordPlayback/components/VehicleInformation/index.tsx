import { useRef, useEffect, useLayoutEffect, useState, useCallback } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Card, Descriptions, Space, Popover, Typography, theme } from "antd";
import { useModel, useLocation } from "@umijs/max";
import { CloseCircleOutlined, HolderOutlined } from "@ant-design/icons";
import styles from "./index.less";
import { getVehicleStatusText } from "@/utils/enum";
import TrafficContent from "./TrafficContent";
import OrderInfoModal from "@/components/OrderInfoModal";
import VehicleInfoModal from "../VehicleInfoModal";
import { SimpleVehiclePushRecord } from "@/types/PlaybackTypings";
import ErrorEntryTable from "@/components/ErrorEntryTable";
import { useI18n } from "@/hooks/useI18n";

interface VehicleInformationProps {
    vehicles?: SimpleVehiclePushRecord[];
    mapId?: string;
    ts?: number;
    recordId?: number;
    getPopupContainer?: () => HTMLElement;
}

/** 车辆信息提示框 */
const VehicleInformation = ({ vehicles, mapId, ts, recordId, getPopupContainer }: VehicleInformationProps) => {
    const { t } = useI18n();
    const { token } = theme.useToken();
    // 提示框的属性
    const { tooltip, setTooltip } = useModel("tooltipJson");
    // 监听路由变化
    const location = useLocation();

    // 当前显示的车辆状态
    const [vehicleState, setVehicleState] = useState<SimpleVehiclePushRecord | null>(null);

    const [orderModalOpen, setOrderModalOpen] = useState(false);
    const [orderModalKey, setOrderModalKey] = useState("");
    const openOrderModal = useCallback((key: string) => {
        setOrderModalKey(key);
        setOrderModalOpen(true);
    }, []);

    const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
    const [vehicleModalKey, setVehicleModalKey] = useState("");
    const openVehicleModal = useCallback((key: string) => {
        setVehicleModalKey(key);
        setVehicleModalOpen(true);
    }, []);

    // Card 组件的引用，用于获取实际尺寸
    const cardRef = useRef<HTMLDivElement>(null);

    // 调整后的位置
    const [adjustedPosition, setAdjustedPosition] = useState({ left: 0, top: 0 });

    /**
     * 当选中的车辆或帧数据更新时，从当前帧中查找车辆
     */
    const findVehicleFromFrame = () => {
        if (tooltip.visible && tooltip.vehicleKey && vehicles) {
            const found = vehicles.find(v => v.agvKey === tooltip.vehicleKey);
            setVehicleState(found ?? null);
        }
    };

    // 拖拽的参数
    const draggableParams = useRef({
        isDragging: false,
        offsetX: 0,
        offsetY: 0
    });

    // 拖拽的元素
    const draggableNode = useRef<HTMLSpanElement>(null);

    /*
     * 拖拽入口只收敛在标题手柄上，正文链接、弹窗入口和关闭按钮都不参与拖动。
     * 偏移量按整张卡片计算，避免从标题内部按下时卡片因为标题边距产生位置跳动。
     */
    const handleMouseDown = (event: ReactMouseEvent<HTMLSpanElement>) => {
        event.preventDefault();
        const cardRect = cardRef.current?.getBoundingClientRect();
        if (!cardRect) return;
        draggableParams.current.isDragging = true;
        draggableParams.current.offsetX = event.clientX - cardRect.left;
        draggableParams.current.offsetY = event.clientY - cardRect.top;
    };

    // 鼠标移动时更新提示框位置
    const handleMouseMove = (event: MouseEvent) => {
        if (!draggableParams.current.isDragging) return;
        const nl = event.clientX - draggableParams.current.offsetX;
        const nt = event.clientY - draggableParams.current.offsetY;
        const cardWidth = cardRef.current?.offsetWidth || 320;
        const cardHeight = cardRef.current?.offsetHeight || 320;
        const limitLeft = Math.max(0, Math.min(nl, window.innerWidth - cardWidth));
        const limitTop = Math.max(0, Math.min(nt, window.innerHeight - cardHeight));
        setTooltip(tips => ({
            ...tips,
            clientX: limitLeft,
            clientY: limitTop
        }));
    };

    // 鼠标松开结束拖拽
    const handleMouseUp = () => {
        if (draggableParams.current.isDragging) {
            draggableParams.current.isDragging = false;
        }
    };

    // 根据最新的车辆状态生成描述列表项
    const generateDescriptionItems = () => {
        if (!vehicleState) return [];

        const {
            agvName,
            agvKey,
            batteryState,
            vehicleProcStatus,
            connectionState,
            loaded,
            orderTaskKey,
            paused,
            agvPosition,
            velocity = { vx: 0, vy: 0, omega: 0 },
            errorEntryList = [],
            loads
        } = vehicleState as any;

        return [
            {
                key: "agvName",
                label: t("名称"),
                children: <a onClick={() => openVehicleModal(agvKey)} style={{ cursor: "pointer" }}>{agvName}</a>
            },
            {
                key: "agvKey",
                label: t("标识"),
                children: agvKey
            },
            {
                key: "batteryCharge",
                label: t("电量"),
                children: batteryState?.batteryCharge ?? '-'
            },
            {
                key: "vehicleProcStatus",
                label: t("状态"),
                // 车辆离线/连接中断时优先展示连接状态，否则展示业务进度状态
                children: t(getVehicleStatusText(connectionState, vehicleProcStatus) || "")
            },
            {
                key: "loaded",
                label: t("载货"),
                children: loaded ? t("是") : t("否")
            },
            {
                key: "loadTheta",
                label: t("托盘角度"),
                // 托盘角度取 loads 首个货物的 boundingBoxReference.theta
                // 容错：回放帧可能不携带 loads，链路任一环节缺失时显示占位符
                children: loads?.[0]?.boundingBoxReference?.theta ?? '-'
            },
            {
                key: "velocity",
                label: t("速度"),
                children: `vx: ${velocity.vx} vy: ${velocity.vy} omega: ${velocity.omega}`
            },
            {
                key: "orderTaskKey",
                label: t("订单"),
                children: orderTaskKey ? <a onClick={() => openOrderModal(orderTaskKey)} style={{ cursor: "pointer" }}>{orderTaskKey}</a> : '-'
            },
            {
                key: "paused",
                label: t("暂停"),
                children: paused ? t("是") : t("否")
            },
            {
                key: "localizationScore",
                label: t("定位置信度"),
                children: agvPosition?.localizationScore ?? '-'
            },
            {
                key: "agvPosition",
                label: t("位置"),
                // 回放帧数据中的 agvPosition.x/y 为世界坐标，与总览页/车辆详情弹窗口径一致，不取反
                children: agvPosition ? `x: ${agvPosition.x ?? '-'} y: ${agvPosition.y ?? '-'}` : '-'
            },
            {
                key: "errorEntryList",
                label: t("告警"),
                // 非空数组：详情 Popover + 表格（保留 getPopupContainer 透传，避免被卡片 overflow 裁切）
                // 空数组/null：显示"暂无告警"
                children: Array.isArray(errorEntryList) && errorEntryList.length > 0 ? (
                    <Popover
                        title={t("车辆告警")}
                        content={
                            // 宽度由外层 div 控制，表格 width:100% 自适应填充
                            <div style={{ width: 880 }}>
                                <ErrorEntryTable errorEntryList={errorEntryList} />
                            </div>
                        }
                        getPopupContainer={getPopupContainer}
                    >
                        <Typography.Text code style={{ cursor: 'pointer' }}>{t("详情")}</Typography.Text>
                    </Popover>
                ) : (
                    <Typography.Text type="secondary">{t("暂无告警")}</Typography.Text>
                )
            }
        ];
    };

    /*
     * 标题节点是条件渲染出来的，所以按下事件直接挂在 JSX 上，避免初始隐藏时 ref 为空。
     * 移动和释放事件挂到 window，保证鼠标离开卡片后依然能继续移动并正确结束拖拽。
     */
    useEffect(() => {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        }
    }, []);

    // 路由变化时关闭卡片
    useEffect(() => {
        setTooltip({ visible: false });
    }, [location.pathname]);

    // 组件卸载时彻底清理 tooltip 状态
    useEffect(() => {
        return () => {
            setTooltip({ visible: false, vehicleKey: undefined, clientX: 0, clientY: 0 });
        };
    }, []);

    // 当选中的车辆或帧数据更新时，从当前帧中查找车辆
    useEffect(() => {
        findVehicleFromFrame();
    }, [tooltip.vehicleKey, tooltip.visible, vehicles]);

    // 根据组件实际尺寸调整位置，确保不超出视口
    useLayoutEffect(() => {
        if (tooltip.visible && cardRef.current) {
            const cardWidth = cardRef.current.offsetWidth || 320;
            const cardHeight = cardRef.current.offsetHeight || 320;
            const clientX = tooltip.clientX || 0;
            const clientY = tooltip.clientY || 0;

            const left = Math.max(0, Math.min(clientX, window.innerWidth - cardWidth));
            const top = Math.max(0, Math.min(clientY, window.innerHeight - cardHeight));

            setAdjustedPosition({ left, top });
        }
    }, [tooltip.visible, tooltip.clientX, tooltip.clientY, vehicleState]);

    /*
     * 标题区域复用总览页车辆 tooltip 的拖拽视觉语言。
     * 手柄图标负责提示可拖动，短提示文案降低用户发现成本，不承载业务状态。
     */
    const tooltipTitle = (
        <span
            className={styles.dragTitle}
            ref={draggableNode}
            onMouseDown={handleMouseDown}
            title={t("按住这里拖动车辆信息卡片")}
            aria-label={t("按住这里拖动车辆信息卡片")}
        >
            <span className={styles.dragIcon}>
                <HolderOutlined />
            </span>
            <span className={styles.dragTitleText}>{t("车辆信息")}</span>
            <span className={styles.dragHint}>{t("按住拖动")}</span>
        </span>
    );

    return (
        <>
            {tooltip.visible && (
                <Card
                    ref={cardRef}
                    className={styles.tooltip}
                    style={{
                        width: 320,
                        left: adjustedPosition.left,
                        top: adjustedPosition.top,
                        backgroundColor: token.colorBgContainer,
                        boxShadow: token.boxShadowSecondary,
                    }}
                    title={tooltipTitle}
                    extra={
                        <Space>
                            <TrafficContent
                                vehicleKey={vehicleState?.agvKey}
                                vehicleProcStatus={vehicleState?.vehicleProcStatus}
                                mapId={mapId}
                                ts={ts}
                                recordId={recordId}
                            />
                            <CloseCircleOutlined onClick={() => setTooltip({ visible: false })} style={{ cursor: 'pointer' }} />
                        </Space>
                    }
                    size="small"
                    type="inner"
                    actions={[]}
                >
                    <Descriptions
                        size="small"
                        column={1}
                        colon
                        items={generateDescriptionItems()}
                    />
                </Card>
            )}
            <OrderInfoModal open={orderModalOpen} orderKey={orderModalKey} onClose={() => setOrderModalOpen(false)} getContainer={getPopupContainer} />
            <VehicleInfoModal open={vehicleModalOpen} vehicleKey={vehicleModalKey} vehicles={vehicles} onClose={() => setVehicleModalOpen(false)} getContainer={getPopupContainer} />
        </>
    )
}

export default VehicleInformation;
