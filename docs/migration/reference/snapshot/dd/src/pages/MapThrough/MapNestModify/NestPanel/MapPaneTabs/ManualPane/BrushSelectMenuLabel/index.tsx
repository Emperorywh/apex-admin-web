/**
 * @description 框选菜单项的悬浮操作提示
 * @date 2026-8-4
 */
import { InfoCircleOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import { useI18n } from "@/hooks/useI18n";
import styles from "./index.less";

/** 框选模式枚举，与 BrushSelect 组件内 manualKey 的分支一一对应（sameDir 已迁至右键菜单，v2 §4.12） */
type BrushSelectMode = "default" | "node" | "edge";

/** 菜单中展示的框选模式名称翻译键（与 EdgeDrawingMenuLabel 的 labelKey 保持一致的命名风格） */
type BrushSelectLabelKey = "默认" | "节点" | "路径";

interface BrushSelectMenuLabelProps {
    /** 菜单中展示的框选模式名称翻译键 */
    labelKey: BrushSelectLabelKey;
    /** 框选模式，决定命中目标的差异说明 */
    mode: BrushSelectMode;
}

/**
 * 框选菜单标签 + 帮助图标的纯展示组件。
 * 只负责提示呈现，不读取或修改 manualKey，避免菜单视图与画布状态耦合（同 EdgeDrawingMenuLabel）。
 */
export default (props: BrushSelectMenuLabelProps) => {

    const { labelKey, mode } = props;
    const { t } = useI18n();

    /**
     * 各框选模式命中目标的差异说明。
     * 文案需与 BrushSelect 组件内 manualKey 分支保持同步：
     * - default：节点和路径都参与命中
     * - node：只命中节点
     * - edge：只命中路径（直线按端点连线、曲线按采样点与选框相交）
     */
    const featureText: Record<BrushSelectMode, string> = {
        default: t("同时框选范围内的节点和路径。"),
        node: t("仅框选范围内的节点，路径不参与命中。"),
        edge: t("仅框选范围内的路径；直线以端点连线、曲线以采样点与选框相交命中。")
    };

    const label = t(labelKey);

    const tooltipContent = (
        <div className={styles.content}>
            <div className={styles.title}>{t("{label}框选方法", { label })}</div>
            <div className={styles.steps}>
                <div className={styles.step}>
                    <span className={styles.stepIndex}>1</span>
                    <span>{t("在画布空白处按住鼠标左键")}</span>
                </div>
                <div className={styles.step}>
                    <span className={styles.stepIndex}>2</span>
                    <span>{t("拖动鼠标，蓝色矩形覆盖目标元素")}</span>
                </div>
                <div className={styles.step}>
                    <span className={styles.stepIndex}>3</span>
                    <span>{t("松开鼠标完成框选")}</span>
                </div>
            </div>
            <div className={styles.featureTip}>{featureText[mode]}</div>
            <div className={styles.ctrlTip}>
                {t("按住 Ctrl 框选可翻转选中（已选取消、未选加入）；空白处极小拖拽时，非 Ctrl 会清空选中、Ctrl 保持原选中。")}
            </div>
            <div className={styles.exitTip}>
                {t("再次点击该菜单项可退出框选模式；右键不会退出，可直接打开右键菜单继续操作。")}
            </div>
        </div>
    );

    return (
        <Tooltip
            title={tooltipContent}
            placement="left"
            mouseEnterDelay={0.25}
            rootClassName={styles.tooltip}
            arrow
        >
            {/*
             * 触发区域铺满菜单标签，悬浮文字或提示图标时都能看到说明。
             * 图标只承担"这里有帮助信息"的可发现性，不参与菜单状态判断。
             */}
            <span className={styles.trigger}>
                <span>{label}</span>
                <InfoCircleOutlined className={styles.hintIcon} />
            </span>
        </Tooltip>
    );
};
