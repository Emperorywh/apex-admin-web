/**
 * @description 画布的提示框
 * @date 2025-6-12
 */
import { memo, useState, useEffect, useRef } from "react";
import { Card, Descriptions, message, Tooltip, Popover, Typography } from "antd";
import { useModel, Icon } from "@umijs/max";
import ErrorEntryTable from "@/components/ErrorEntryTable";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";
import { HolderOutlined } from "@ant-design/icons";
import styles from "./index.less";
import MockParkModal from "./MockParkModal";
import MockChargeModal from "./MockChargeModal";
import TooltipExtra from "./TooltipExtra";
import { getVehicleState, vehicleOperate } from "@/api";
import type { GetVehicleStateData } from "@/types/OverLook";
import { getVehicleStatusText } from "@/utils/enum";
import { useWebSocketContext } from "@/socket";
import type { SocketDispatcherState, VehicleType } from "@/utils/typing";

const { Text } = Typography;

export default memo(() => {

    /* 国际化翻译方法，用于将车辆信息卡片的文案进行多语言转换 */
    const { t } = useI18n();

    /* 按钮级权限判定（SPEC §8.3）：车辆操作 overlay Icon（暂停/继续/停车检测/充电检测，粗粒度码 §7.4/§7.6） */
    const { hasPerm } = useAccess();
    const canVehicleOperate = hasPerm(PERM_BUTTON.OVERVIEW_VEHICLE_OPERATE);

    // 模拟停靠的弹窗
    const [openParkModal, setOpenParkModal] = useState<boolean>(false);
    // 当前选中车辆的Key
    const [agvKey, setAgvKey] = useState<string>("");
    // 模拟充电的弹窗
    const [openChargeModal, setOpenChargeModal] = useState<boolean>(false);
    // 车辆状态详情
    const [vehicleState, setVehicleState] = useState<GetVehicleStateData>();

    // 提示框的属性
    const { tooltip, setTooltip } = useModel("tooltipJson");
    // 订阅 websocket 消息，用来实时刷新 tooltip 卡片内的车辆信息
    const { lastMessage } = useWebSocketContext();
    // 拖拽的参数
    const draggableParams = useRef({
        isDragging: false,
        offsetX: 0,
        offsetY: 0
    })
    // 拖拽的元素
    const draggableNode = useRef<HTMLSpanElement>(null);

    const getVehicleKeyState = (vehicleKey: string) => {
        getVehicleState({ vehicleKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: GetVehicleStateData = res?.data;
                setVehicleState(data);
                // 使用接口最新数据更新 tooltip 里的展示内容
                setTooltip(tips => {
                    if (!tips.description) return tips;
                    const newDescription = tips.description.map(item => {
                        if (item.key === "localizationScore") {
                            return { ...item, children: data.agvPosition?.localizationScore ?? item.children };
                        }
                        if (item.key === "agvPosition") {
                            // 离线车辆可能不携带坐标，此时直接显示为空
                            const { x, y } = data.agvPosition || {};
                            if (x === undefined || y === undefined) return { ...item, children: "" };
                            return { ...item, children: `x: ${x} y: ${y}` };
                        }
                        if (item.key === "batteryCharge") {
                            return { ...item, children: data.batteryState?.batteryCharge ?? item.children };
                        }
                        if (item.key === "vehicleProcStatus") {
                            // 车辆离线/连接中断时优先展示连接状态，否则展示业务进度状态
                            return { ...item, children: t(getVehicleStatusText(data?.connectionState, data?.vehicleProcStatus) || "") || item.children };
                        }
                        // 如果有其他需要同步的字段也可以在这里加
                        return item;
                    });
                    return { ...tips, description: newDescription };
                });
            } else {
                message.warning(t("查询车辆详情出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询车辆详情出错") + err?.message);
            }
        })
    };

    // 模拟停靠
    const handleMockParkClick = () => {
        setAgvKey(tooltip?.vehicleKey || "");
        setOpenParkModal(true);
    };

    // 模拟充电
    const handleMockChargeClick = () => {
        setAgvKey(tooltip?.vehicleKey || "");
        setOpenChargeModal(true);
    };

    // 车辆的快捷操作 暂停/继续
    const handleShuttleClick = (operate: "CONTINUE" | "PAUSE") => {
        const vehicleKey = vehicleState?.agvKey;
        if (!vehicleKey) return;
        vehicleOperate({ operate, vehicleKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("车辆操作成功"));
            } else {
                message.warning(t("车辆操作出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("车辆操作出错") + err?.message);
            }
        })
    };

    const handleMouseDown = (event: MouseEvent) => {
        event.preventDefault();
        draggableParams.current.isDragging = true;
        draggableParams.current.offsetX = event.clientX - (draggableNode.current?.getBoundingClientRect().left || 0);
        draggableParams.current.offsetY = event.clientY - (draggableNode.current?.getBoundingClientRect().top || 0);
    };

    const handleMouseMove = (event: MouseEvent) => {
        if (!draggableParams.current.isDragging) return;
        const nl = event.clientX - draggableParams.current.offsetX;
        const nt = event.clientY - draggableParams.current.offsetY;
        const limitLeft = Math.max(0, Math.min(nl, window.innerWidth - (draggableNode.current?.offsetWidth || 0)));
        const limitTop = Math.max(0, Math.min(nt, window.innerHeight - (draggableNode.current?.offsetHeight || 0)));
        setTooltip(tips => ({
            ...tips,
            clientX: limitLeft,
            clientY: limitTop
        }));
    };

    const handleMouseUp = () => {
        if (draggableParams.current.isDragging) {
            draggableParams.current.isDragging = false;
        }
    };

    useEffect(() => {
        // 拖拽三件套
        draggableNode.current?.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            draggableNode.current?.removeEventListener("mousedown", handleMouseDown);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        }
    }, [])

    useEffect(() => {
        getVehicleKeyState(tooltip?.vehicleKey || "");
    }, [tooltip?.vehicleKey])

    // 监听 websocket 推送，实时刷新当前 tooltip 展示的车辆信息
    useEffect(() => {
        if (!lastMessage || !tooltip?.visible || !tooltip?.vehicleKey) return;
        let data: SocketDispatcherState;
        try {
            data = JSON.parse(lastMessage.data);
        } catch (error) {
            return;
        }
        const vehicle: VehicleType | undefined = data?.vehicles?.find(v => v.agvKey === tooltip.vehicleKey);
        if (!vehicle) return;

        // 合并 websocket 数据到 vehicleState（TooltipExtra 需要的 dispatchState / agvDimension 等均在 ws 中）
        setVehicleState(prev => ({
            ...(prev || {} as GetVehicleStateData),
            agvKey: vehicle.agvKey,
            agvName: vehicle.agvName,
            type: vehicle.type,
            connectionState: vehicle.connectionState,
            dispatchState: vehicle.dispatchState,
            paused: vehicle.paused,
            loaded: vehicle.loaded,
            vehicleProcStatus: vehicle.vehicleProcStatus,
            batteryState: { ...(prev?.batteryState || {} as GetVehicleStateData["batteryState"]), ...vehicle.batteryState },
            agvDimension: { ...(prev?.agvDimension || {} as GetVehicleStateData["agvDimension"]), ...vehicle.agvDimension },
            agvPosition: { ...(prev?.agvPosition || {} as GetVehicleStateData["agvPosition"]), ...vehicle.agvPosition }
        } as GetVehicleStateData));

        // 按 key 更新 Descriptions 条目，保留点击时生成的交互 JSX（名称/订单的 <a onClick>）
        setTooltip(tips => {
            if (!tips?.description) return tips;
            let { batteryState, agvPosition, velocity, errorEntryList, vehicleProcStatus, loaded, paused, connectionState, loads } = vehicle;
            const newDescription = tips.description.map(item => {
                switch (item.key) {
                    case "batteryCharge":
                        return { ...item, children: batteryState?.batteryCharge ?? item.children };
                    case "vehicleProcStatus":
                        // 车辆离线/连接中断时优先展示连接状态，否则展示业务进度状态
                        return { ...item, children: t(getVehicleStatusText(connectionState, vehicleProcStatus) || "") || item.children };
                    case "loaded":
                        return { ...item, children: loaded ? t("是") : t("否") };
                    case "loadTheta":
                        // 托盘角度取 loads 首个货物的 boundingBoxReference.theta
                        // 容错：链路任一环节缺失时保留原值，避免覆盖掉上一帧的有效角度
                        return { ...item, children: loads?.[0]?.boundingBoxReference?.theta ?? item.children };
                    case "velocity":
                        return { ...item, children: `vx: ${velocity?.vx} vy: ${velocity?.vy} omega: ${velocity?.omega}` };
                    case "paused":
                        return { ...item, children: paused ? t("是") : t("否") };
                    case "localizationScore":
                        return { ...item, children: agvPosition?.localizationScore ?? item.children };
                    case "agvPosition": {
                        // 实时展示车辆世界坐标（ws 中 agvPosition.x/y 为世界坐标）
                        // 离线车辆可能不携带坐标，此时直接显示为空
                        const { x, y } = agvPosition || {};
                        if (x === undefined || y === undefined) return { ...item, children: "" };
                        return { ...item, children: `x: ${x} y: ${y}` };
                    }
                    case "errorEntryList":
                        return {
                            ...item,
                            // 非空数组：详情 Popover + 表格（与 GraphStage 点击初始项保持同形，避免闪现旧 JSON）
                            // 空数组/null：直接显示"暂无告警"，不再包 Popover
                            children: Array.isArray(errorEntryList) && errorEntryList.length > 0 ? (
                                <Popover
                                    title={t("车辆告警")}
                                    content={
                                        // 宽度由外层 div 控制，表格 width:100% 自适应填充；纵向滚动交给组件 maxHeight
                                        <div style={{ width: 880 }}>
                                            <ErrorEntryTable errorEntryList={errorEntryList} />
                                        </div>
                                    }
                                >
                                    <Text code>{t("详情")}</Text>
                                </Popover>
                            ) : (
                                <Text type="secondary">{t("暂无告警")}</Text>
                            )
                        };
                    default:
                        return item;
                }
            });
            return { ...tips, description: newDescription };
        });
    }, [lastMessage, tooltip?.visible, tooltip?.vehicleKey])

    /*
     * 拖拽标题只负责暴露移动入口，不参与车辆业务数据计算。
     * 图标、短文案和悬停提示共同传达“可拖拽”，降低用户发现成本。
     */
    const tooltipTitle = (
        <span
            className={styles.dragTitle}
            ref={draggableNode}
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
            <Card
                className={styles.tooltip}
                style={{
                    width: 320,
                    left: (tooltip.clientX || 0),
                    top: (tooltip.clientY || 0) > window.innerHeight - 320 ? window.innerHeight - 320 : (tooltip.clientY || 0),
                    display: tooltip.visible ? "block" : "none"
                }}
                title={tooltipTitle}
                extra={
                    <TooltipExtra vehicleState={vehicleState} getVehicleKeyState={getVehicleKeyState} />
                }
                size="small"
                type="inner"
                actions={
                    /* 车辆操作 Icon（粗粒度码 §7.4/§7.6）：无权限隐藏全部操作入口 */
                    canVehicleOperate ? [
                        <Tooltip placement="bottom" title={t("停车检测")} arrow>
                            <Icon icon="local:park-fill" width="20" height="20" onClick={handleMockParkClick} />
                        </Tooltip>,
                        <Tooltip placement="bottom" title={t("充电检测")} arrow>
                            <Icon icon="local:charge-fill" width="20" height="20" onClick={handleMockChargeClick} />
                        </Tooltip>,
                        <Tooltip placement="bottom" title={t("暂停")} arrow>
                            <Icon icon="local:pause-fill" width="20" height="20" onClick={() => handleShuttleClick("PAUSE")} />
                        </Tooltip>,
                        <Tooltip placement="bottom" title={t("继续")} arrow>
                            <Icon icon="local:continue-fill" width="20" height="20" onClick={() => handleShuttleClick("CONTINUE")} />
                        </Tooltip>
                    ] : []
                }
            >
                <Descriptions
                    size="small"
                    column={1}
                    colon
                    items={tooltip?.description || []}
                />
            </Card>
            <MockParkModal
                open={openParkModal}
                agvKey={agvKey}
                setOpenParkModal={setOpenParkModal}
            />
            <MockChargeModal
                open={openChargeModal}
                agvKey={agvKey}
                setOpenChargeModal={setOpenChargeModal}
            />
        </>
    )
});
