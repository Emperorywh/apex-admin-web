/**
 * @description JSON数据展示组件，支持Popover弹窗和复制功能
 * @date 2026-4-15
 */
import { useMemo } from "react";
import { Popover, Typography } from "antd";
import { useI18n } from "@/hooks/useI18n";

interface JsonViewerProps {
    /** JSON数据，支持对象或JSON字符串 */
    data: Record<string, unknown> | string | null | undefined;
    /** 空数据时的占位符 */
    emptyText?: string;
    /** 自定义标题 */
    title?: string;
    /** 预览区域宽度 */
    previewWidth?: number | string;
    /** 弹窗内容区域宽度 */
    popoverWidth?: string;
    /** 弹窗内容区域高度 */
    popoverHeight?: string;
}

const parseJsonData = (data: Record<string, unknown> | string | null | undefined): Record<string, unknown> | null => {
    if (!data) return null;
    if (typeof data === "string") {
        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    }
    return data;
};

export default function JsonViewer(props: JsonViewerProps) {
    const { t } = useI18n();

    const {
        data,
        emptyText = t("暂无数据"),
        title = t("配置内容"),
        previewWidth = "100%",
        popoverWidth = "30vw",
        popoverHeight = "40vh"
    } = props;

    const parsedData = useMemo(() => parseJsonData(data), [data]);

    const formattedJson = useMemo(() => {
        if (!parsedData) return "";
        return JSON.stringify(parsedData, null, 4);
    }, [parsedData]);

    if (!parsedData || Object.keys(parsedData).length === 0) {
        return <span>{emptyText}</span>;
    }

    return (
        <Popover
            content={
                <div
                    style={{
                        height: popoverHeight,
                        width: popoverWidth,
                        overflowY: "auto",
                        whiteSpace: "pre-wrap"
                    }}
                >
                    {formattedJson}
                </div>
            }
            title={
                <Typography.Text copyable={{ text: formattedJson }}>
                    {title}
                </Typography.Text>
            }
        >
            <div
                style={{
                    maxWidth: typeof previewWidth === "number" ? `${previewWidth}px` : previewWidth,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    cursor: "pointer"
                }}
            >
                {JSON.stringify(parsedData)}
            </div>
        </Popover>
    );
}
