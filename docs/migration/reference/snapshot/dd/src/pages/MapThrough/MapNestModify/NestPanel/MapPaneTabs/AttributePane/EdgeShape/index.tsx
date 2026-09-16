/**
 * @description 路径shape的属性设置
 * @date 2025-7-9
 */
import { Form } from "antd";
import Konva from "konva";
import NameItem from "./NameItem";
import LoadType from "./LoadType";
import IsBackEdge from "./IsBackEdge";
import EnableLimitForkLiftReturn from "./EnableLimitForkLiftReturn";
import AllowVehicleGroups from "../CommonAttrs/AllowVehicleGroups";
import HighPrecision from "../CommonAttrs/HighPrecision";
import BatchModifyTips from "../CommonAttrs/BatchModifyTips";
// import Avoid from "./Avoid";
// import AvoidMap from "./AvoidMap";
import ControlPoints from "./ControlPoints";
import MaxLoadSpeed from "./MaxLoadSpeed";
import MaxFreeSpeed from "./MaxFreeSpeed";
import MaxLoadRotationSpeed from "./MaxLoadRotationSpeed";
import MaxFreeRotationSpeed from "./MaxFreeRotationSpeed";
import MaxLoadAcceleration from "./MaxLoadAcceleration";
import MaxFreeAcceleration from "./MaxFreeAcceleration";
import MaxLoadDeceleration from "./MaxLoadDeceleration";
import MaxFreeDeceleration from "./MaxFreeDeceleration";
import LoadSecurity from "./LoadSecurity";
import FreeSecurity from "./FreeSecurity";
import Actions from "../CommonAttrs/Actions";
import UserDefinedProperties from "../CommonAttrs/UserDefinedProperties";
import { useI18n } from "@/hooks/useI18n";

interface EdgeAttributeProps {
    stage: Konva.Stage | null;
    selectShapes: Konva.Shape[];
}

export default (props: EdgeAttributeProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { stage, selectShapes } = props;

    const [form] = Form.useForm();

    return (
        <Form
            name="edgeShapeAttribute"
            style={{ height: "calc(100vh - 300px)", overflow: "auto" }}
            labelCol={{
                span: 12,
                style: {
                    fontSize: 18,
                    fontWeight: 550
                }
            }}
            wrapperCol={{ span: 12 }}
            autoComplete="off"
            labelAlign="left"
            variant="underlined"
            colon={false}
            requiredMark={false}
            form={form}
            validateTrigger={["onChange", "onBlur"]}
        >
            <BatchModifyTips
                selectShapes={selectShapes}
            />

            <NameItem
                stage={stage}
                selectShapes={selectShapes}
            />

           {/* <LimitV
                selectShapes={selectShapes}
            />*/}

            <LoadType
                selectShapes={selectShapes}
            />

            <IsBackEdge
                selectShapes={selectShapes}
            />

            <EnableLimitForkLiftReturn
                selectShapes={selectShapes}
            />

            {/* 高精度标记 */}
            <HighPrecision
                selectShapes={selectShapes}
            />

            <AllowVehicleGroups
                selectShapes={selectShapes}
            />

            {/* <AvoidMap
                selectShapes={selectShapes}
            /> */}

            <LoadSecurity
                selectShapes={selectShapes}
            />

            <FreeSecurity
                selectShapes={selectShapes}
            />

            <MaxLoadSpeed
                selectShapes={selectShapes}
            />

            <MaxFreeSpeed
                selectShapes={selectShapes}
            />

            <MaxLoadRotationSpeed
                selectShapes={selectShapes}
            />

            <MaxFreeRotationSpeed
                selectShapes={selectShapes}
            />

            <MaxLoadAcceleration
                selectShapes={selectShapes}
            />

            <MaxFreeAcceleration
                selectShapes={selectShapes}
            />

            <MaxLoadDeceleration
                selectShapes={selectShapes}
            />

            <MaxFreeDeceleration
                selectShapes={selectShapes}
            />

            <ControlPoints
                selectShapes={selectShapes}
            />

            <Actions
                selectShapes={selectShapes}
            />

            <UserDefinedProperties
                selectShapes={selectShapes}
            />

            {/* 路径上的传感器配置，先暂时不会用，里面也没开发完 */}
            {/* <Avoid
                selectShapes={selectShapes}
            /> */}

        </Form>
    )
};
