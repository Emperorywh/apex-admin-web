/**
 * @description 画布右侧菜单的全局搜索组件
 * @date 2025-6-19
 */
import { useState, useRef, memo, useEffect } from "react";
import { Dropdown, Select } from "antd";
import type { DropDownProps, SelectProps } from "antd";
import type Konva from "konva";
import { sleep } from "@/utils/public";
import { useI18n } from "@/hooks/useI18n";

interface GlobalSearchProps {
    stage: Konva.Stage | null;
    focusId?: string;
    openSearch: boolean;
    setFocusId: (value: React.SetStateAction<string | undefined>) => void;
}

export default memo((props: GlobalSearchProps) => {

    const { stage, focusId, openSearch, setFocusId } = props;

    /* 国际化翻译方法，用于将搜索框的占位文案进行多语言转换 */
    const { t } = useI18n();

    const focusTimer = useRef<NodeJS.Timeout | null>(null);

    // 选项
    const [options, setOptions] = useState<SelectProps["options"]>([]);
    // 加载中状态
    const [loading, setLoading] = useState<boolean>(false);

    const setStagePosition = (target: Konva.Node) => {
        if (!stage) return;
        const scaleX = stage.scaleX() || 0;
        const scaleY = stage.scaleY() || 0;
        // 获取Group的绝对位置
        // 是路径的话 找到label对应的坐标 节点的话直接用节点的坐标
        const { attrs: { x = 0, y = 0 } } = target;
        // 计算新的stage位置，使Group居中
        const focusPos = {
            x: -x * scaleX + stage.width() / 2,
            y: -y * scaleY + stage.height() / 2
        };
        // 应用动画
        stage.to({
            ...focusPos,
            duration: 1
        });
    };

    // 输入框的输入触发的事件
    const onChange: SelectProps["onChange"] = async (value) => {
        if (!stage) return;
        setFocusId(value);
    };

    // 下拉框展开的回调
    const onOpenChange: SelectProps["onOpenChange"] = (open: boolean) => {
        if (!open || !stage) return;
        setLoading(true);
        const robots = stage.find((shape: Konva.Group) => shape.attrs?.isRobot && shape.getType() === "Shape");
        const options: SelectProps["options"] = robots.map(robot => ({
            name: robot.attrs?.agvName,
            id: robot.attrs?.id
        }))
        setOptions(options);
        setLoading(false);
    };

    useEffect(() => {
        if (!stage) return;
        focusTimer.current && clearInterval(focusTimer?.current)
        focusTimer.current = null;
        // 清空所有车辆的选择框
        const robots = stage.find((shape: Konva.Shape) => shape.attrs?.isRobot);
        robots.forEach(robot => {
            robot.setAttr("isFocus", false);
        });
        if (!focusId) return;
        // 如果选中的有车辆 显示选中的框
        const foucusRobot = stage.findOne((shape: Konva.Shape) => shape.id() === focusId);
        if (!foucusRobot) return;
        foucusRobot.setAttr("isFocus", true);
        // 轮询定位到车
        focusTimer.current = setInterval(() => {
            setStagePosition(foucusRobot);
        }, 1000)
    }, [focusId])

    const popupSearchRender: DropDownProps["popupRender"] = () => {
        return (
            <Select
                style={{ width: 256 }}
                value={focusId}
                allowClear
                showSearch
                virtual
                loading={loading}
                placeholder={t("定位车辆")}
                optionFilterProp="name"
                onChange={onChange}
                onOpenChange={onOpenChange}
                options={options}
                fieldNames={{ label: "name", value: "id" }}
                filterSort={(optionA, optionB) =>
                    (optionA?.name as string ?? "")?.localeCompare((optionB?.name as string ?? ""))
                }
            />
        )
    };

    return (
        <Dropdown
            open={openSearch}
            placement="bottomRight"
            popupRender={popupSearchRender}
            overlayStyle={{
                backgroundColor: "var(--ant-color-bg-elevated)",
                padding: "var(--ant-padding-xxs)",
                borderRadius: "var(--ant-border-radius-lg)",
                boxShadow: "var(--ant-box-shadow-secondary)"
            }}
        >
            {t("搜索")}
        </Dropdown>
    )
});
