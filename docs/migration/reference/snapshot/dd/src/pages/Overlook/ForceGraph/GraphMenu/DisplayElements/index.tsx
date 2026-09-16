/**
 * @description 元素的显示隐藏
 * @date 2025-6-19
 */
import { memo, useState } from "react";
import { Dropdown, Checkbox, Row, Col, InputNumber } from "antd";
import type { DropDownProps, GetProp } from "antd";
import type { OverlayVisible, DisplayElementsItem } from "@/types/OverLook";
import { useI18n } from "@/hooks/useI18n";

interface DisplayElementsProps {
    openDisplays: boolean;
    /** 当前网格间距（米） */
    gridSpacing: number;
    setOverlayVisible: (value: React.SetStateAction<OverlayVisible>) => void;
    /** 设置网格间距的回调 */
    setGridSpacing: (value: React.SetStateAction<number>) => void;
    /** 输入框聚焦时的回调 */
    onInputFocus?: () => void;
    /** 输入框失焦时的回调 */
    onInputBlur?: () => void;
}

export default memo((props: DisplayElementsProps) => {

    const { openDisplays, gridSpacing, setOverlayVisible, setGridSpacing, onInputFocus, onInputBlur } = props;

    /* 国际化翻译方法，用于将显示隐藏菜单的文案进行多语言转换 */
    const { t } = useI18n();

    /**
     * 复选框勾选项：勾选 = 隐藏对应图层。
     * 初始值必须与父组件 overlayVisible 的初始值反向对应，否则会出现
     * 「状态隐藏但复选框未勾选」的脱节问题。
     * 其中 "device" 对应 overlayVisible.device: false（默认隐藏三方设备）。
     */
    const [checkedValues, setCheckedValues] = useState<string[]>(["edgeLabel", "hiddenGrid", "actions", "device", "loadSecurityColor", "freeSecurityColor", "allowVehicleGroupsColor"]);

    const items: DisplayElementsItem[] = [
        {
            label: t("隐藏所有节点标签"),
            value: "nodeLabel"
        },
        {
            label: t("隐藏所有线路标签"),
            value: "edgeLabel"
        },
        {
            label: t("隐藏所有交管信息"),
            value: "traffic"
        },
        {
            label: t("隐藏所有车辆"),
            value: "robot"
        },
        {
            label: t("隐藏网格"),
            value: "hiddenGrid"
        },
        {
            label: t("隐藏三方设备"),
            value: "device"
        },
        {
            label: t("隐藏动作角标"),
            value: "actions"
        },
        // 路径属性着色开关（SPEC edge_attribute_color_toggle D7/D8：直接追加，无分组）
        {
            label: t("隐藏载货避障着色"),
            value: "loadSecurityColor"
        },
        {
            label: t("隐藏空载避障着色"),
            value: "freeSecurityColor"
        },
        {
            label: t("隐藏车辆分组着色"),
            value: "allowVehicleGroupsColor"
        }
    ];

    const onChecboxChange: GetProp<typeof Checkbox.Group, "onChange"> = (checkedValues) => {
        setCheckedValues(checkedValues as string[]);
        setOverlayVisible({
            nodeLabel: !checkedValues.some(value => value === "nodeLabel"),
            edgeLabel: !checkedValues.some(value => value === "edgeLabel"),
            traffic: !checkedValues.some(value => value === "traffic"),
            robot: !checkedValues.some(value => value === "robot"),
            grid: !checkedValues.some(value => value === "hiddenGrid"),
            // Overlook 监控视图未暴露「路径夹角」图层开关（items 无 hiddenAngle），
            // overlayVisible.angle 在本视图无消费，保持与父组件初始值一致（默认隐藏）
            angle: false,
            device: !checkedValues.some(value => value === "device"),
            actions: !checkedValues.some(value => value === "actions"),
            // 路径属性着色：勾选 = 隐藏（SPEC D4），与上方各项同构
            loadSecurityColor: !checkedValues.some(value => value === "loadSecurityColor"),
            freeSecurityColor: !checkedValues.some(value => value === "freeSecurityColor"),
            allowVehicleGroupsColor: !checkedValues.some(value => value === "allowVehicleGroupsColor")
        });
    };

    const customPopupRender: DropDownProps["popupRender"] = (): React.ReactNode => {
        return (
            <Checkbox.Group
                value={checkedValues}
                style={{ width: 220 }}
                onChange={onChecboxChange}
            >
                <Row gutter={[0, 15]}>
                    {
                        items.map((item: DisplayElementsItem) => (
                            <Col key={item.value} span={24}>
                                <Checkbox value={item.value}>
                                    <span
                                        style={{
                                            fontSize: 16,
                                            fontWeight: 500,
                                            color: "var(--ant-color-text)",
                                            marginLeft: 20
                                        }}
                                    >
                                        {item.label}
                                    </span>
                                </Checkbox>
                            </Col>
                        ))
                    }
                    {
                        !checkedValues.includes("hiddenGrid") && (
                            <Col span={24} style={{ paddingLeft: 24 }}>
                                <span
                                    style={{
                                        fontSize: 14,
                                        fontWeight: 500,
                                        color: "var(--ant-color-text-secondary)",
                                        marginRight: 8
                                    }}
                                >
                                    {t("网格间距")}
                                </span>
                                <InputNumber
                                    size="small"
                                    min={0.5}
                                    max={10}
                                    step={0.5}
                                    value={gridSpacing}
                                    onChange={(val) => {
                                        if (val !== null) setGridSpacing(val);
                                    }}
                                    onFocus={onInputFocus}
                                    onBlur={onInputBlur}
                                    addonAfter="m"
                                    style={{ width: 100 }}
                                />
                            </Col>
                        )
                    }
                </Row>
            </Checkbox.Group>
        )
    };

    return (
        <Dropdown
            open={openDisplays}
            placement="bottomRight"
            popupRender={customPopupRender}
            overlayStyle={{
                backgroundColor: "var(--ant-color-bg-elevated)",
                padding: "var(--ant-padding-xxs)",
                borderRadius: "var(--ant-border-radius-lg)",
                boxShadow: "var(--ant-box-shadow-secondary)"
            }}
        >
            {t("展示")}
        </Dropdown>
    )
});
