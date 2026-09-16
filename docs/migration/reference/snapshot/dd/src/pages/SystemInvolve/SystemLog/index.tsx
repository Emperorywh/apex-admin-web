/**
 * @description 系统日志
 * @date 2025-11-5
 */
import { useEffect, useState, useRef } from "react";
import { message, Table, Space, Button } from "antd";
import type { TableProps, PaginationProps, SelectProps } from "antd";
import { pageSystemLogs, getSystemLogTypes, downloadSystemLog } from "@/api";
import { SysLogParam, LogRecord, DownloadLogType } from "@/types/SystemInvolve/SystemLog";
import styles from "./index.less";
import SearchForm from "./SearchForm";
import type { ResponseType } from "@/types/typing";
import FakeProgressModal, { type FakeProgressModalRef } from "@/components/FakeProgressModal";
import { useI18n } from "@/hooks/useI18n";

type TableRowSelection<T extends object = object> = TableProps<T>["rowSelection"];

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();

    // 查询参数
    const [searchParams, setSearchParams] = useState<SysLogParam>({
        pageSize: 10,
        pageNo: 1,
        logType: "NORMAL"
    });
    // 表格数据
    const [logRecord, setLogRecord] = useState<LogRecord[]>([]);
    // 分页参数
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        pageSize: 10,
        current: 1,
        total: 0
    });
    // 日志类型
    const [logTypes, setLogTypes] = useState<SelectProps["options"]>([]);
    // 选中表格的keys
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    /* 伪进度条 ref */
    const progressRef = useRef<FakeProgressModalRef>(null);

    // 查询日志数据
    const getSysLogs = () => {
        pageSystemLogs(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: ResponseType<LogRecord> = res?.data;
                const { records, current, size, total } = data;
                setLogRecord(records);
                setPaginationProps({
                    pageSize: size,
                    current,
                    total
                });
            } else {
                message.warning(t("查询日志信息出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询日志信息出错") + err?.message);
            }
        })
    };



    // 表格改变事件
    const onTableChange: TableProps<LogRecord>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize
        });
    };

    // 下载日志文件
    const handleDownloadLogs = () => {
        if (!selectedRowKeys?.length) {
            message.warning(t("请选择要下载的日志"));
            return;
        }
        const data: DownloadLogType = {
            logType: searchParams.logType as string,
            logNames: selectedRowKeys as string[]
        };
        progressRef.current?.start();
        downloadSystemLog(data).then(res => {
            const filename = res?.headers["content-disposition"]?.split("=")[1] || "default.zip";
            // Create a URL for the file stream
            const url = URL.createObjectURL(new Blob([res.data]));
            // Create a link element and set its href to the file stream URL
            const link = document.createElement("a");
            link.href = url;
            // Set the link's download attribute to the file name
            link.setAttribute("download", filename);
            // Simulate a click on the link to initiate the download
            link.click();
            // Revoke the URL to free up memory
            URL.revokeObjectURL(url);
            progressRef.current?.stop(true);
            message.success(t("日志下载完成"));
        }).catch(err => {
            progressRef.current?.stop(false);
            if (err) {
                message.error(t("下载系统日志出错") + err?.message);
            }
        })
    };

    const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
        console.log('selectedRowKeys changed: ', newSelectedRowKeys);
        setSelectedRowKeys(newSelectedRowKeys);
    };

    const columns: TableProps<LogRecord>["columns"] = [
        {
            title: t("日志名称"),
            dataIndex: "name",
            ellipsis: { showTitle: true }
        },
        {
            title: t("最后修改时间"),
            dataIndex: "time",
            ellipsis: { showTitle: true }
        }
    ];

    const rowSelection: TableRowSelection<LogRecord> = {
        selectedRowKeys,
        onChange: onSelectChange,
    };

    useEffect(() => {
        getSysLogs();
    }, [searchParams])

    useEffect(() => {
        getSystemLogTypes().then(res => {
            if (res.code === 200 && res.message === "success") {
                const opts = res.data.map((type: string) => ({
                    label: type,
                    value: type
                }));
                setLogTypes(opts);
            } else {
                message.warning(t("查询日志文件类型出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询日志文件类型出错") + err?.message);
            }
        })
    }, [])

    return (
        <div className={styles.system_log}>
            <SearchForm
                logTypes={logTypes}
                searchParams={searchParams}
                setSearchParams={setSearchParams}
                handleDownloadLogs={handleDownloadLogs}
            />
            <Table<LogRecord>
                columns={columns}
                dataSource={logRecord}
                rowKey={r => r.name}
                scroll={{ x: 600, y: "calc(100vh - 350px)" }}
                rowSelection={rowSelection}
                pagination={{
                    ...paginationProps,
                    showSizeChanger: true,
                    hideOnSinglePage: false,
                    showQuickJumper: true,
                    showTotal: (total) => t("总数{total}条", { total })
                }}
                onChange={onTableChange}
            />
            <FakeProgressModal
                ref={progressRef}
                title={t("正在下载日志")}
                loadingText={t("日志下载中，请勿关闭页面...")}
                successText={t("下载完成！")}
            />
        </div>
    )
};
