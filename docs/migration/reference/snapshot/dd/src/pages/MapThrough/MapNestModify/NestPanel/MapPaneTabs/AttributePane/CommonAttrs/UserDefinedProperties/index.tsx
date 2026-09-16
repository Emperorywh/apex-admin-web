/**
 * @description 节点和路径的自定义属性
 * @date 2025-8-11
 */
import DefinedProperties from "./DefinedProperties";
import type Konva from "konva";
import ThirdDevice from "./ThirdDevice";

interface UserDefinedProperties {
    selectShapes: Konva.Shape[];
}

export default (props: UserDefinedProperties) => {

    const { selectShapes } = props;

    return (
        <>
            <ThirdDevice
                selectShapes={selectShapes}
            />
            <DefinedProperties
                selectShapes={selectShapes}
            />
        </>
    )
};
