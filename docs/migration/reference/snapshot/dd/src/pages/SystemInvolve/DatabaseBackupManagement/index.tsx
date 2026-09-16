/**
 * @description 数据库备份管理
 * @date 2025-11-5
 *
 * 功能说明：
 * 1. 查询所有备份数据库列表（下拉选择）
 * 2. 根据所选数据库查询对应的备份文件列表（表格展示）
 * 3. 每行提供下载按钮，通过浏览器原生 a 标签触发下载
 */
import { useEffect, useState, useCallback } from "react";
import { message, Table, Select, Button } from "antd";
import type { TableProps } from "antd";
import {
    getDataBases,
    getDataBaseBackupFiles,
} from "@/api";
import API_URL from "@/api/api";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";
import type {
    BackupFileRecord,
} from "@/types/SystemInvolve/SystemLog";
import { DownloadOutlined } from "@ant-design/icons";
import styles from "./index.less";

export default function DatabaseBackupManagement() {
    /**
     * 国际化 Hook：统一暴露 t() 翻译方法。
     * 页面内所有界面文案（列头、label、placeholder、提示消息、按钮等）
     * 均通过 t("中文原文") 进行转换，遵循项目国际化规范。
     */
    const { t } = useI18n();
    /*
     * 按钮级权限判定
     * 无权限的动作触发型按钮条件渲染隐藏（root 短路全开）
     * 详见 docs/SPEC_button_permission.md §7
     */
    const { hasPerm } = useAccess();

    /**
     * ======================== 状态定义 ========================
     */

    /* 备份数据库列表（下拉选项） */
    const [databaseOptions, setDatabaseOptions] = useState<string[]>([]);
    /* 当前选中的数据库名称 */
    const [selectedDatabase, setSelectedDatabase] = useState<string | undefined>(
        undefined,
    );
    /* 备份文件表格数据 */
    const [backupFiles, setBackupFiles] = useState<BackupFileRecord[]>([]);
    /* 表格加载状态 */
    const [loading, setLoading] = useState(false);

    /**
     * ======================== 数据请求 ========================
     */

    /**
     * 查询所有备份数据库
     * 页面加载时调用一次，获取数据库列表填充下拉选项
     */
    const fetchDatabases = useCallback(() => {
        getDataBases()
            .then((res) => {
                if (res.code === 200 && res.message === "success") {
                    setDatabaseOptions(res.data || []);
                    /* 默认选中第一个数据库 */
                    if (res.data?.length > 0) {
                        setSelectedDatabase(res.data[0]);
                    }
                } else {
                    /* 查询失败：提示前缀走国际化，后端返回的 message 直接拼接展示 */
                    message.warning(t("查询备份数据库出错：") + res?.message);
                }
            })
            .catch((err) => {
                if (err) {
                    /* 请求异常：提示前缀走国际化，错误信息 message 直接拼接展示 */
                    message.error(t("查询备份数据库出错：") + err?.message);
                }
            });
    }, []);

    /**
     * 根据所选数据库查询备份文件列表（全量加载，不分页）
     * @param database 数据库名称
     */
    const fetchBackupFiles = useCallback(
        (database: string) => {
            setLoading(true);
            getDataBaseBackupFiles({ database })
                .then((res) => {
                    if (res.code === 200 && res.message === "success") {
                        const records: BackupFileRecord[] = res.data || [];
                        setBackupFiles(records);
                    } else {
                        /* 查询失败：提示前缀走国际化，后端返回的 message 直接拼接展示 */
                        message.warning(t("查询备份文件出错：") + res?.message);
                    }
                })
                .catch((err) => {
                    if (err) {
                        /* 请求异常：提示前缀走国际化，错误信息 message 直接拼接展示 */
                        message.error(t("查询备份文件出错：") + err?.message);
                    }
                })
                .finally(() => {
                    setLoading(false);
                });
        },
        [],
    );

    /**
     * ======================== 事件处理 ========================
     */

    /**
     * 数据库下拉选择变化
     * 仅更新选中状态，备份文件列表由 useEffect 统一触发查询
     */
    const handleDatabaseChange = (value: string) => {
        setSelectedDatabase(value);
    };

    /**
     * 下载单个备份文件
     * 后端已改为 GET 接口，直接通过 a 标签触发浏览器原生下载
     *
     * @param record 当前行的备份文件记录
     */
    const handleDownload = (record: BackupFileRecord) => {
        if (!selectedDatabase) {
            message.warning(t("请先选择数据库"));
            return;
        }

        const params = new URLSearchParams({
            database: selectedDatabase,
            backupFileName: record.fileName,
        });
        const url = `${API_URL.DOWNLOADDATABASEBACKUPFILE}?${params.toString()}`;
        const a = document.createElement("a");
        a.href = url;
        a.download = record.fileName;
        a.click();
        message.info(t("浏览器即将开始下载，请注意查看下载栏"));
    };

    /**
     * ======================== 表格列定义 ========================
     */
    const columns: TableProps<BackupFileRecord>["columns"] = [
        {
            title: t("文件名"),
            dataIndex: "fileName",
            ellipsis: true,
        },
        {
            title: t("文件大小"),
            dataIndex: "fileSizeReadable",
            width: 150,
            ellipsis: { showTitle: true }
        },
        {
            title: t("创建时间"),
            dataIndex: "createTime",
            width: 200,
            ellipsis: { showTitle: true }
        },
        {
            title: t("路径"),
            dataIndex: "filePath",
            width: 600,
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            key: "action",
            width: 120,
            render: (_, record) => (
                /* 下载备份：无 system:database-backup:download 权限隐藏（操作列单项隐藏，保留空列 §7.2） */
                hasPerm(PERM_BUTTON.SYSTEM_DATABASE_BACKUP_DOWNLOAD) ? (
                    <Button
                        type="link"
                        icon={<DownloadOutlined />}
                        onClick={() => handleDownload(record)}
                    >
                        {t("下载")}
                    </Button>
                ) : null
            ),
            ellipsis: { showTitle: true }
        },
    ];

    /**
     * ======================== 生命周期 ========================
     */

    /* 页面加载时查询数据库列表 */
    useEffect(() => {
        fetchDatabases();
    }, [fetchDatabases]);

    /* 当选中数据库变化时查询备份文件 */
    useEffect(() => {
        if (selectedDatabase) {
            fetchBackupFiles(selectedDatabase);
        }
    }, [selectedDatabase, fetchBackupFiles]);

    /**
     * ======================== 渲染 ========================
     */
    return (
        <div className={styles.database_backup}>
            {/* 数据库选择下拉框 */}
            <div className={styles.search_bar}>
                <span>{t("备份数据库：")}</span>
                <Select
                    style={{ width: 300 }}
                    placeholder={t("请选择备份数据库")}
                    value={selectedDatabase}
                    onChange={handleDatabaseChange}
                    options={databaseOptions.map((db) => ({
                        label: db,
                        value: db,
                    }))}
                    allowClear
                />
            </div>

            {/* 备份文件表格（全量展示，不分页） */}
            <Table<BackupFileRecord>
                columns={columns}
                dataSource={backupFiles}
                rowKey="fileName"
                loading={loading}
                scroll={{ x: 600 }}
                pagination={false}
            />
        </div>
    );
}
