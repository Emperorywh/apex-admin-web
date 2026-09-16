/**
 * @description 操作日志
 * @date 2026-4-21
 */
import { useEffect, useRef, useState, useMemo } from "react";
import { Table, message, Tag, Tooltip } from "antd";
import type { TableProps, TablePaginationConfig } from "antd";
import { useRequest, useSize } from "ahooks";
import { pageSysLogs } from "@/api";
import type { PageSysLogsParams, SysLogRecord } from "@/types/SystemInvolve/SystemLog";
import { operationLogModuleOptions } from "@/constants";
import styles from "./index.less";
import SearchForm from "./SearchForm";
import JsonViewer from "@/components/JsonViewer";
import { useI18n } from "@/hooks/useI18n";

/**
 * 模块枚举值 → 中文标签的映射
 * 用于表格列渲染和过滤时的中文展示
 */
const MODULE_LABEL_MAP = operationLogModuleOptions.reduce<Record<string, string>>((acc, cur) => {
    acc[cur.value] = cur.label;
    return acc;
}, {});

/**
 * Table 表头的预估高度（单位：px）
 * 用于从容器总高度中扣除，得到表体的可视滚动高度
 */
const TABLE_HEADER_HEIGHT = 55;

/**
 * Table 分页器区域的预估高度（单位：px）
 * 包含分页器自身高度及其上边距
 */
const TABLE_PAGINATION_HEIGHT = 64;

const ellipsisRender = (value: string) => (
    <span
        style={{
            display: "inline-block",
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
        }}
    >
        <Tooltip
            placement="topLeft"
            title={value}
        >
            {value}
        </Tooltip>
    </span>
);

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();

    // 查询的参数
    const [searchParams, setSearchParams] = useState<PageSysLogsParams>({
        pageNo: 1,
        pageSize: 15
    });
    // 表格数据
    const [sysLogs, setSysLogs] = useState<SysLogRecord[]>([]);
    // 分页的参数
    const [paginationParams, setPaginationParams] = useState<TablePaginationConfig>({});

    /**
     * 表格容器的 ref
     * 用于获取容器的实时尺寸，进而动态计算 Table 的 scroll.y
     */
    const tableWrapperRef = useRef<HTMLDivElement>(null);
    // 实时监听表格容器的尺寸变化
    const tableWrapperSize = useSize(tableWrapperRef);

    /**
     * 表体的可滚动高度
     * 由容器总高度减去表头与分页器高度得到，最小保留一定值避免负数
     */
    const tableScrollY = useMemo(() => {
        const wrapperHeight = tableWrapperSize?.height ?? 0;
        const scrollY = wrapperHeight - TABLE_HEADER_HEIGHT - TABLE_PAGINATION_HEIGHT;
        return scrollY > 0 ? scrollY : 100;
    }, [tableWrapperSize?.height]);

    // 查询操作日志
    const { data } = useRequest(async () => {
        const result = await pageSysLogs(searchParams);
        return result
    }, {
        refreshDeps: [searchParams],
        onError: (err) => message.error(t("查询操作日志出错") + err?.message)
    })

    // 根据请求更新表格
    useEffect(() => {
        if (data?.code === 200 && data?.message === "success") {
            const { records, current, size, total } = data.data;
            setSysLogs(records);
            setPaginationParams({
                current,
                total,
                pageSize: size
            });
        }
    }, [data])

    // 表格改变事件
    const onTableChange: TableProps<SysLogRecord>["onChange"] = (pagination) => {
        const { current, pageSize } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current as number,
            pageSize: pageSize as number
        });
    };

    const columns: TableProps<SysLogRecord>["columns"] = [
        {
            title: t("日志标题"),
            dataIndex: "title",
            width: 180,
            align: "center",
            fixed: "left",
            render: ellipsisRender,
            ellipsis: { showTitle: true }
        },
        {
            title: t("日志类型"),
            dataIndex: "logType",
            width: 100,
            align: "center",
            render: (value) => (
                <Tag color={value === "ERROR" ? "red" : "green"}>
                    {value === "ERROR" ? t("异常") : value === "NORMAL" ? t("正常") : value || "NULL"}
                </Tag>
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作用户"),
            dataIndex: "username",
            width: 120,
            align: "center",
            render: ellipsisRender,
            ellipsis: { showTitle: true }
        },
        {
            title: t("请求IP"),
            dataIndex: "requestIp",
            width: 140,
            align: "center",
            ellipsis: { showTitle: true }
        },
        {
            title: t("目标名称"),
            dataIndex: "targetName",
            width: 200,
            align: "center",
            render: ellipsisRender,
            ellipsis: { showTitle: true }
        },
        {
            title: t("模块"),
            dataIndex: "module",
            width: 120,
            align: "center",
            render: (value) => {
                const label = MODULE_LABEL_MAP[value as string] ?? value ?? "";
                return label ? <Tag color="blue">{t(label)}</Tag> : null;
            },
            ellipsis: { showTitle: true }
        },
        {
            title: t("请求参数"),
            dataIndex: "requestParam",
            width: 220,
            align: "center",
            render: (value) => <JsonViewer data={value} title={t("请求参数")} />,
            ellipsis: { showTitle: true }
        },
        {
            title: t("响应参数"),
            dataIndex: "responseParam",
            width: 220,
            align: "center",
            render: (value) => <JsonViewer data={value} title={t("响应参数")} />,
            ellipsis: { showTitle: true }
        },
        {
            title: t("异常详情"),
            dataIndex: "exceptionDetail",
            width: 220,
            align: "center",
            render: ellipsisRender,
            ellipsis: { showTitle: true }
        },
        {
            title: t("请求耗时(ms)"),
            dataIndex: "requestDuration",
            width: 120,
            align: "center",
            ellipsis: { showTitle: true }
        },
        {
            title: t("请求时间"),
            dataIndex: "requestTime",
            width: 250,
            align: "center",
            fixed: "right",
            ellipsis: { showTitle: true }
        }
    ];

    return (
        <div className={styles.operation_log}>
            <div className={styles.search_form_wrapper}>
                <SearchForm
                    searchParams={searchParams}
                    setSearchParams={setSearchParams}
                />
            </div>
            <div className={styles.table_wrapper} ref={tableWrapperRef}>
                <Table<SysLogRecord>
                    columns={columns}
                    dataSource={sysLogs}
                    pagination={{
                        ...paginationParams,
                        hideOnSinglePage: false,
                        showSizeChanger: true,
                        pageSizeOptions: [10, 15, 20, 50, 100, 200],
                        showTotal: (total) => t("总数{total}条", { total }),
                        responsive: true
                    }}
                    onChange={onTableChange}
                    rowKey={row => row.id}
                    scroll={{ x: 1800, y: tableScrollY, scrollToFirstRowOnChange: true }}
                />
            </div>
        </div>
    )
};
