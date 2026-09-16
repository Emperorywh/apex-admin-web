/**
 * @description 订单详情里面的动作子表格
 * @date 2025-9-25
 */
import { Table, Descriptions, Popover, Typography, Tooltip } from "antd";
import type { TableColumnsType } from "antd";
import type { Actions } from "@/types/OrderRecord/OrderInfo";
import { ActionStatus } from "@/utils/enum";
import dayjs from "dayjs";
import { useI18n } from "@/hooks/useI18n";

interface ExpandedActionProps {
    data: Actions[];
}

export default (props: ExpandedActionProps) => {

    const { data } = props;

    /* 国际化翻译方法，用于将动作子表格的列标题进行多语言转换 */
    const { t } = useI18n();

    const expandColumns: TableColumnsType<Actions> = [
        {
            title: "ID",
            dataIndex: "actionId",
            width: 100,
            render: (value: string) => (
                <Typography.Text copyable ellipsis style={{ width: 100 }}>
                    {value}
                </Typography.Text>
            )
        },
        {
            title: t("动作类型"),
            dataIndex: "actionType",
            width: 110,
            ellipsis: { showTitle: true }
        },
        {
            title: t("动作描述"),
            dataIndex: "actionDescription",
            width: 140,
            ellipsis: { showTitle: true }
        },
        {
            title: t("阻塞类型"),
            dataIndex: "blockingType",
            width: 120,
            ellipsis: { showTitle: true }
        },
        {
            title: t("动作状态"),
            dataIndex: "actionStatus",
            render: (value: Actions["actionStatus"]) => t(ActionStatus[value] ?? value ?? ""),
            width: 140,
            ellipsis: { showTitle: true }
        },
        {
            title: t("执行结果"),
            dataIndex: "resultDescription",
            width: 180,
            render: (value: string) => {
                // 执行结果可能为空（动作尚未产生结果），空值展示占位符 "-"
                if (!value) return "-";
                // 非空时省略超长文本，鼠标悬浮通过 Tooltip 展示完整内容，避免撑乱行高
                return (
                    <Tooltip title={value}>
                        <Typography.Text
                            ellipsis
                            style={{ width: 180, whiteSpace: "nowrap" }}
                        >
                            {value}
                        </Typography.Text>
                    </Tooltip>
                );
            }
        },
        {
            title: t("开始时间"),
            dataIndex: "startTime",
            ellipsis: { showTitle: true }
        },
        {
            title: t("结束时间"),
            dataIndex: "finalTime",
            ellipsis: { showTitle: true }
        },
        {
            title: t("耗时"),
            width: 120,
            render: (_, record) => {
                if (!record.startTime || !record.finalTime) return "";
                const diff = dayjs(record.finalTime).diff(dayjs(record.startTime), "second");
                const h = Math.floor(diff / 3600);
                const m = Math.floor((diff % 3600) / 60);
                const s = diff % 60;
                return (
                    <Typography.Text
                        ellipsis
                        style={{ width: 120, whiteSpace: "nowrap" }}
                    >
                        {`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`}
                    </Typography.Text>
                );
            },
            ellipsis: { showTitle: true }
        },
        {
            // 条件标识：展示动作触发/执行所依赖的条件字符串，置于倒数第二列
            title: t("条件标识"),
            dataIndex: "conditionStr",
            width: 140,
            ellipsis: { showTitle: true }
        },
        {
            title: t("动作参数"),
            dataIndex: "actionParameters",
            width: 300,
            render: (value) => (
                <Popover
                    content={
                        <div
                            style={{ height: "40vh", width: "30vw", overflowY: "auto", whiteSpace: "pre-wrap" }}
                        >
                            {JSON.stringify(value, null, 4)}
                        </div>
                    }
                    title={
                        <Typography.Text copyable={{ text: JSON.stringify(value, null, 4) }}>
                            {t("配置内容")}
                        </Typography.Text>
                    }
                >
                    <div
                        style={{
                            width: "300px",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis"
                        }}
                    >
                        {JSON.stringify(value)}
                    </div>
                </Popover>
            ),
            ellipsis: { showTitle: true }
        }
    ];

    return (
        <Table<Actions>
            columns={expandColumns}
            dataSource={data}
            pagination={false}
            scroll={{ x: 1680 }}
            rowKey={r => r.actionId}
        />
    )
};
