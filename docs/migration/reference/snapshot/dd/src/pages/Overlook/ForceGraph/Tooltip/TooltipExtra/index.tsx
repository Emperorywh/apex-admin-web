/**
 * @description tooltip的头部组件
 * @date 2025-6-27
 */
import { memo, useEffect } from "react";
import { useModel } from "@umijs/max";
import { message, Space, Popconfirm, Tooltip, Switch } from "antd";
import { DeleteOutlined, CloseCircleOutlined } from "@ant-design/icons";
import type { SwitchProps } from "antd";
import { clearVehicleTraffics, updateVehicle } from "@/api";
import { PERM_BUTTON } from "@/constants/permission";
import { useAccess } from "@/hooks/useAccess";
import type { VehicleForm } from "@/types/VehicleDeploy/VehicleType";
import TrafficContent from "./TrafficContent";
import type { GetVehicleStateData } from "@/types/OverLook";
import { useI18n } from "@/hooks/useI18n";

interface TooltipHeaderProps {
    vehicleState?: GetVehicleStateData;
    getVehicleKeyState: (vehicleKey: string) => void;
}

export default memo((props: TooltipHeaderProps) => {

    const { vehicleState, getVehicleKeyState } = props;

    /* 国际化翻译方法，用于将车辆操作相关的提示文案进行多语言转换 */
    const { t } = useI18n();

    const { setTooltip } = useModel("tooltipJson");

    /*
     * 车辆操作权限（overview:vehicle-operate）
     * 调度状态 Switch 属状态展示型内联控件：无权限时 disabled（仍展示状态，不可切换）；
     * 清除交管资源属动作触发型：无权限时隐藏入口
     */
    const { hasPerm } = useAccess();
    const canOperate = hasPerm(PERM_BUTTON.OVERVIEW_VEHICLE_OPERATE);

    const handleDispatchChange: SwitchProps["onChange"] = () => {
        if (!vehicleState) return;
        const { agvKey, agvName, type, agvDimension: { width, length, centerOffset, loadWidth, loadLength }, dispatchState } = vehicleState;
        const data: VehicleForm = {
            agvKey,
            agvName,
            agvType: type,
            length,
            width,
            centerOffset,
            loadLength,
            loadWidth,
            dispatchState: dispatchState === "ENABLE" ? "DISABLE" : "ENABLE"
        };
        updateVehicle(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                getVehicleKeyState(agvKey);
                message.success(t("操作车辆成功") + res?.message);
            } else {
                message.warning(t("操作车辆出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("操作车辆出错") + err?.message);
            }
        });
    };

    // 清除交管资源占用
    const onClearTrafficConfirm = () => {
        if (!vehicleState) return;
        clearVehicleTraffics({ vehicleKey: vehicleState.agvKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("清除车辆交管资源成功"));
            } else {
                message.warning(t("清除车辆交管资源出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("清除车辆交管资源出错") + err?.message);
            }
        })
    };

    useEffect(() => {
        return () => {
            setTooltip({ visible: false });
        }
    }, [])

    return (
        <Space>
            <Tooltip title={t("调度状态")}>
                <Switch
                    size="small"
                    value={vehicleState?.dispatchState === "ENABLE"}
                    disabled={!canOperate}
                    onChange={handleDispatchChange}
                />
            </Tooltip>
            {/* 清除交管资源：动作触发型，无车辆操作权限时隐藏入口 */}
            {canOperate && (
                <Popconfirm
                    title={t("清除当前车辆交管资源")}
                    description={t("确定清除当前车辆交管资源?")}
                    onConfirm={onClearTrafficConfirm}
                    okText={t("确定")}
                    cancelText={t("取消")}
                >
                    <DeleteOutlined />
                </Popconfirm>
            )}
            {/* 交管原因组件 */}
            <TrafficContent
                vehicleKey={vehicleState?.agvKey}
                vehicleProcStatus={vehicleState?.vehicleProcStatus}
            />
            <CloseCircleOutlined
                onClick={() => setTooltip({ visible: false })}
            />
        </Space>
    )
});