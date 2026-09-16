/**
 * @description 节点shape的属性设置
 * @date 2025-7-9
 */
import { Form, message, Typography } from "antd";
import Konva from "konva";
import NameItem from "./NameItem";
import TypeItem from "./TypeItem";
import AngleItem from "./AngleItem";
import MaxRotateAngle from "./MaxRotateAngle";
/**
 * 限制叉车旋转是节点级调度约束。
 * 独立组件接入属性面板，避免和最大旋转角度的数值输入耦合。
 */
import LimitForkLiftRotation from "./LimitForkLiftRotation";
import VirtualParkStation from "./VirtualParkStation";
import VirtualAvoidStation from "./VirtualAvoidStation";
import CoordItem from "./CoordItem";
import EnterChargeStationId from "./EnterChargeStationId";
import Actions from "../CommonAttrs/Actions";
import UserDefinedProperties from "../CommonAttrs/UserDefinedProperties";
import BatchModifyTips from "../CommonAttrs/BatchModifyTips";
import PointOffset from "./PointOffset";
import AllowVehicleGroups from "../CommonAttrs/AllowVehicleGroups";
/**
 * 高精度标记为通用布尔属性，节点/路径均复用，故放在 CommonAttrs 下。
 */
import HighPrecision from "../CommonAttrs/HighPrecision";
import { useI18n } from "@/hooks/useI18n";

interface NodeShapeProps {
    selectShapes: Konva.Shape[];
}

export default (props: NodeShapeProps) => {
    /* 国际化翻译方法 */ const { t } = useI18n();
    const { selectShapes } = props;
    console.log("selectShapes", selectShapes)

    const [form] = Form.useForm();

    return (
        <Form
            name="nodeAttribute"
            style={{ height: "calc(100vh - 300px)", overflow: "auto" }}
            labelCol={{
                span: 10,
                style: {
                    fontSize: 18,
                    fontWeight: 550
                }
            }}
            wrapperCol={{ span: 14 }}
            autoComplete="off"
            labelAlign="left"
            variant="underlined"
            colon={false}
            requiredMark={false}
            form={form}
            validateTrigger={["onChange", "onBlur"]}
        >
            <Form.Item label={t("唯一标识")}>
                <Typography.Text
                    copyable={{
                        text: selectShapes[0]?.attrs?.id,
                        tooltips: [t("点击复制"), t("复制成功")],
                        onCopy: () => message.success(t("复制成功"))
                    }}
                >
                    {selectShapes[0]?.attrs?.id}
                </Typography.Text>
            </Form.Item>
            <BatchModifyTips
                selectShapes={selectShapes}
            />

            <NameItem
                selectShapes={selectShapes}
            />

            <CoordItem
                selectShapes={selectShapes}
            />

            <TypeItem
                selectShapes={selectShapes}
            />

            <AngleItem
                selectShapes={selectShapes}
            />

            {/*
              限制叉车旋转只负责写入节点 data。
              保存阶段会统一从 attrs.data 汇总节点属性。
            */}
            <LimitForkLiftRotation
                selectShapes={selectShapes}
            />

            {/*
              高精度标记只负责写入元素 data。
              保存阶段会统一从 attrs.data 汇总元素属性。
            */}
            <HighPrecision
                selectShapes={selectShapes}
            />

            <VirtualParkStation
                selectShapes={selectShapes}
            />

            <VirtualAvoidStation
                selectShapes={selectShapes}
            />

            <PointOffset
                selectShapes={selectShapes}
            />

            <AllowVehicleGroups
                selectShapes={selectShapes}
            />

            {/* 充电关联点，只有是充电点的时候才显示 */}
            <EnterChargeStationId
                selectShapes={selectShapes}
            />

            {/* 自定义动作 */}
            <Actions
                selectShapes={selectShapes}
            />

            {/* 自定义属性 */}
            <UserDefinedProperties
                selectShapes={selectShapes}
            />

        </Form>
    )
};
