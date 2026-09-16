/**
 * @description 三方设备的组件 修改
 * @date 2026-3-9
 */
import { Divider, Form } from "antd";
import DeviceType from "./DeviceType";
import DeviceKey from "./DeviceKey";
import ApplyDeviceOperationType from "./ApplyDeviceOperationType";
import ReleaseDeviceOperationType from "./ReleaseDeviceOperationType";
import LeavedEdge from "./LeavedEdge";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface ThirdDeviceProps {
    selectShapes: Konva.Shape[];
}

export default (props: ThirdDeviceProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    // 节点类型（TypeItem）是通过 Konva shape.setAttrs 命令式写入 data.type 的，
    // 既不改 selectShapes 引用、也不触发 React state 更新，
    // 因此下方基于 shape.attrs.data.type 的显隐判断不会刷新——
    // 用户切换类型后必须重新选中节点，三方设备区块才会出现。
    // 这里订阅 Form 的 type 字段：TypeItem 的 Select 被 Form.Item name="type" 包裹，
    // 类型变化会同步到 form 字段并触发本组件重渲染；
    // 重渲染时命令式写入的 shape.attrs.data.type 已是最新值，显隐判断即可生效。
    // 做法与 EnterChargeStationId 保持一致。
    const form = Form.useFormInstance();
    Form.useWatch("type", form);

    // 只有路径和充电站点才显示三方设备选项
    if (selectShapes.every(shape => shape.attrs?.enableSelect === "edge") || selectShapes.every(shape => shape.attrs?.data?.type === "charge")) {
        return (
            <>
                <Divider style={{ borderColor: "#1677FF", fontWeight: 550 }} plain>{t("三方设备")}</Divider>
                <DeviceType
                    selectShapes={selectShapes}
                />
                <DeviceKey
                    selectShapes={selectShapes}
                />
                <ApplyDeviceOperationType
                    selectShapes={selectShapes}
                />
                <ReleaseDeviceOperationType
                    selectShapes={selectShapes}
                />
                <LeavedEdge
                    selectShapes={selectShapes}
                />
            </>
        )
    }
    return null;
};
