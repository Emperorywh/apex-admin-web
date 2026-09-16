/**
 * @description 计算方式提示组件（metric calculation hint）
 *
 * 封装 QuestionCircleOutlined + Ant Design Tooltip，为 KPI 卡片和图表标题
 * 提供统一的 ? 图标 hover/聚焦提示。
 *
 * 交互方式：
 *   - 鼠标 hover：Tooltip 原生处理（mouseEnterDelay 0.2s 避免快速划过闪烁）
 *   - 键盘聚焦：受控 open 状态（onFocus → true, onBlur → false）
 * 两者共用同一个 open state，叠加不冲突，满足 WCAG 无障碍要求。
 *
 * 样式规范：
 *   - 图标 12px（与 KPI 标签字号一致），colorTextTertiary 色
 *   - Tooltip placement=bottom，maxWidth 300px，长文案自动换行
 *   - overlayInnerStyle 设置 whiteSpace: pre-line，
 *     使 i18n 文案中的 \n\n 渲染为段落换行
 */
import { Tooltip, theme } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { useState, type ReactNode } from "react";
import { useI18n } from "@/hooks/useI18n";

export interface InfoHintProps {
    /** Tooltip 内容（已通过 t() 本地化的 ReactNode） */
    content: ReactNode;
}

/**
 * 计算方式提示图标。鼠标 hover 或键盘 Tab 聚焦时展示 Tooltip。
 */
export function InfoHint({ content }: InfoHintProps) {
    const { token } = theme.useToken();
    const { t } = useI18n();
    /*
     * 受控 open 状态：鼠标 hover 由 onOpenChange 驱动，
     * 键盘聚焦由 onFocus/onBlur 驱动，两者写入同一 state。
     */
    const [open, setOpen] = useState(false);

    return (
        <Tooltip
            placement="bottom"
            open={open}
            onOpenChange={setOpen}
            mouseEnterDelay={0.2}
            overlayStyle={{ maxWidth: 300 }}
            overlayInnerStyle={{ maxWidth: 300, whiteSpace: "pre-line" }}
            title={content}
        >
            <span
                tabIndex={0}
                role="button"
                aria-label={t("查看计算方式")}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}
            >
                <QuestionCircleOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
            </span>
        </Tooltip>
    );
}
