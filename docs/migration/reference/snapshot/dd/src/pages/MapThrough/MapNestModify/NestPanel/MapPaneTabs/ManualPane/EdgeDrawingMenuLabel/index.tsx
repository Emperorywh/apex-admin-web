/**
 * @description 路径绘制菜单项的悬浮操作提示
 * @date 2026-7-15
 */
import { InfoCircleOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import { useI18n } from "@/hooks/useI18n";
import styles from "./index.less";

type EdgeDrawingLabelKey = "正走直线" | "倒走直线" | "正走曲线" | "倒走曲线";

interface EdgeDrawingMenuLabelProps {
    /** 菜单中展示的路径类型翻译键 */
    labelKey: EdgeDrawingLabelKey;
    /** 是否补充贝塞尔曲线控制点的后续编辑说明 */
    isBezier?: boolean;
}

/**
 * 将 AddEdge 的真实鼠标状态流转换成用户可执行的短步骤说明。
 * 该组件只负责提示呈现，不读取或修改 manualKey，避免菜单视图与画布状态耦合。
 */
export default (props: EdgeDrawingMenuLabelProps) => {

    const { labelKey, isBezier = false } = props;
    const { t } = useI18n();

    /**
     * 菜单名称和提示标题共享同一个路径类型翻译结果。
     * 标题通过参数插值组合，避免把四种路径类型复制成四套提示文案。
     */
    const label = t(labelKey);

    const tooltipContent = (
        <div className={styles.content}>
            <div className={styles.title}>{t("{label}绘制方法", { label })}</div>
            <div className={styles.steps}>
                <div className={styles.step}>
                    <span className={styles.stepIndex}>1</span>
                    <span>{t("在起始节点按住鼠标左键")}</span>
                </div>
                <div className={styles.step}>
                    <span className={styles.stepIndex}>2</span>
                    <span>{t("拖动经过目标节点，可连续经过多个节点")}</span>
                </div>
                <div className={styles.step}>
                    <span className={styles.stepIndex}>3</span>
                    <span>{t("松开鼠标左键结束绘制")}</span>
                </div>
            </div>
            {
                isBezier && (
                    <div className={styles.curveTip}>
                        {t("曲线创建后，选中路径并拖动 A/B 控制点可调整弧度。")}
                    </div>
                )
            }
            <div className={styles.exitTip}>{t("右键可退出当前绘制模式")}</div>
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
             * 触发区域铺满菜单标签，使用户悬浮文字或提示图标时都能看到说明。
             * 图标只承担“这里有帮助信息”的可发现性，不参与菜单状态判断。
             */}
            <span className={styles.trigger}>
                <span>{label}</span>
                <InfoCircleOutlined className={styles.hintIcon} />
            </span>
        </Tooltip>
    );
};
