/**
 * @description 历史版本界面
 * @date 2025-11-4
 */
import { useEffect, useState, useRef } from "react";
import { Space, Button, Table, message, Popconfirm, Modal, Typography, Tag, Tooltip } from "antd";
import type { TableProps } from "antd";
import { UndoOutlined, RedoOutlined, ExclamationCircleFilled, DeleteOutlined, ReloadOutlined, DownloadOutlined } from "@ant-design/icons";
import { history, useModel } from "@umijs/max";
import { getSystemVersions, restartSystem, rollback, deletePendingJar, downloadSystemVersionJar } from "@/api";
import styles from "./index.less";
import UpdateVersion from "./UpdateVersion";
import type { SystemVersionInfo } from "@/types/SystemInvolve/VersionControl";
import FakeProgressModal, { type FakeProgressModalRef } from "@/components/FakeProgressModal";
import { useLocalStorageState } from "ahooks";
import type { AccessInfo } from "@/types/Login";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

const { confirm } = Modal;
const { Text } = Typography;

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();
    /*
     * 按钮级权限判定
     * 无权限的动作触发型按钮条件渲染隐藏（root 短路全开）
     * 详见 docs/SPEC_button_permission.md §7
     */
    const { hasPerm } = useAccess();

    // 表格数据
    const [versionRecord, setVersionRecord] = useState<SystemVersionInfo[]>([]);
    const [, setAccessInfo] = useLocalStorageState<AccessInfo>("accessInfo");
    // 下载进度条
    const progressRef = useRef<FakeProgressModalRef>(null);
    // 清空初始化状态
    const { refresh } = useModel("@@initialState");

    // 查询版本包
    const getUpdateJarList = () => {
        getSystemVersions().then(res => {
            if (res.code === 200 && res.message === "success") {
                setVersionRecord(res?.data || []);
            } else {
                message.warning(t("查询版本包列表出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询版本包列表出错") + err?.message);
            }
        })
    };

    // 重启程序
    const handleRestartSystem = () => {
        confirm({
            title: t("确认重启程序?"),
            icon: <ExclamationCircleFilled />,
            content: t("重启前请确认是否具备重启条件！（危险操作）"),
            onOk() {
                restartSystem().then(async res => {
                    if (res.code === 200 && res.message === "success") {
                        setAccessInfo({
                            username: "",
                            token: ""
                        });
                        await refresh();
                        history.replace({
                            pathname: "/login"
                        });
                        message.success(t("重启程序成功"));
                    } else {
                        message.warning(t("重启程序出错") + res?.message);
                    }
                }).catch(err => {
                    if (err) {
                        message.error(t("重启程序出错") + err?.message);
                    }
                })
            },
            onCancel() {
                // .
            },
        });
    };

    // 回滚版本
    const handleRollback = (record: SystemVersionInfo) => {
        const { gitBuildId } = record;
        if (!gitBuildId) return;
        confirm({
            title: t("确认回滚到当前版本?"),
            icon: <ExclamationCircleFilled />,
            content: t("回滚前请确认是否具备回滚条件！（危险操作）"),
            onOk() {
                // 弹出加载提示，让用户感知接口已开始调用
                // duration 传 0 表示不自动关闭，返回 hide 用于手动关闭
                const hide = message.loading(t("正在回滚版本，请稍候..."), 0);
                rollback({ buildId: gitBuildId }).then(async res => {
                    // 接口返回后关闭加载提示
                    hide();
                    if (res.code === 200 && res.message === "success") {
                        setAccessInfo({
                            username: "",
                            token: ""
                        });
                        await refresh();
                        history.replace({
                            pathname: "/login"
                        });
                        message.success(t("回滚版本成功"));
                    } else {
                        message.warning(t("回滚版本出错") + res?.message);
                    }
                }).catch(err => {
                    // 出错时同样关闭加载提示
                    hide();
                    message.error(t("回滚版本出错") + err?.message);
                })
            },
            onCancel() {
                // .
            },
        });
    };

    // 删除待升级 jar
    const handleDeletePendingJar = (record: SystemVersionInfo) => {
        const { gitBuildId } = record;
        if (!gitBuildId) return;
        deletePendingJar({ buildId: gitBuildId }).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("删除待升级版本成功"));
                getUpdateJarList();
            } else {
                message.warning(t("删除待升级版本出错") + res?.message);
            }
        }).catch(err => {
            message.error(t("删除待升级版本出错") + err?.message);
        });
    };

    // 下载版本包（jar），使用伪进度条
    const handleDownloadVersionJar = (record: SystemVersionInfo) => {
        const { gitBuildId } = record;
        if (!gitBuildId) return;
        progressRef.current?.start();
        downloadSystemVersionJar({ buildId: gitBuildId }).then((res: any) => {
            // 优先从 content-disposition 解析文件名，兜底用 buildId.jar
            const disposition = res?.headers?.["content-disposition"];
            let fileName = `${gitBuildId}.jar`;
            if (disposition) {
                const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
                if (match) {
                    fileName = decodeURIComponent(match[1].replace(/"/g, ""));
                }
            }
            const url = URL.createObjectURL(new Blob([res.data], { type: "application/java-archive" }));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", fileName);
            link.click();
            URL.revokeObjectURL(url);
            progressRef.current?.stop(true);
            message.success(t("版本包下载完成"));
        }).catch(err => {
            progressRef.current?.stop(false);
            if (err) {
                message.error(t("下载版本包出错") + err?.message);
            }
        });
    };

    // 版本类型文案映射：当前版本 / 备份版本 / 待升级
    const versionTypeText = (type: string) => {
        const map: Record<string, string> = {
            CURRENT: t("当前版本"),
            BACKUP: t("备份版本"),
            PENDING: t("待升级")
        };
        return map[type] || type || "-";
    };

    /**
     * 版本类型对应的标签颜色映射
     * 当前版本用绿色（运行中）、备份版本用灰色（历史归档）、待升级用金色（待处理）
     * 未知类型回退为灰色，保持视觉中性，便于辨识
     */
    const versionTypeColor = (type: string) => {
        const map: Record<string, string> = {
            CURRENT: "green",
            BACKUP: "default",
            PENDING: "gold"
        };
        return map[type] || "default";
    };

    const columns: TableProps<SystemVersionInfo>["columns"] = [
        {
            title: t("版本类型"),
            dataIndex: "type",
            // 以彩色 Tag 呈现版本类型，提升状态辨识度
            render: (value) => <Tag color={versionTypeColor(value)}>{versionTypeText(value)}</Tag>,
            ellipsis: { showTitle: true }
        },
        {
            title: t("提交描述"),
            dataIndex: "gitCommitIdDescribe",
            width: 200,
            // 提交描述通常较长（含 tag、commit 计数、commit id 简写等），悬浮显示完整值，单元格内单行省略
            render: (value) => (
                <Tooltip title={value} placement="topLeft">
                    <Text style={{ maxWidth: 200 }} ellipsis>
                        {value || "-"}
                    </Text>
                </Tooltip>
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("Git标签"),
            dataIndex: "gitTags",
            render: (value) => value || "-",
            ellipsis: { showTitle: true }
        },
        {
            title: "BuildId",
            dataIndex: "gitBuildId",
            width: 180,
            // 内容较长，悬浮显示完整值，单元格内单行省略
            render: (value) => (
                <Tooltip title={value} placement="topLeft">
                    <Text style={{ maxWidth: 180 }} ellipsis>
                        {value || "-"}
                    </Text>
                </Tooltip>
            )
        },
        {
            title: t("提交信息"),
            dataIndex: "gitCommitMessageFull",
            width: 300,
            // 提交信息通常较长，悬浮显示完整内容，单元格内单行省略
            render: (value) => (
                <Tooltip title={value} placement="topLeft">
                    <Text style={{ maxWidth: 280 }} ellipsis>
                        {value || "-"}
                    </Text>
                </Tooltip>
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("提交时间"),
            dataIndex: "gitCommitTime",
            ellipsis: { showTitle: true }
        },
        {
            title: t("构建时间"),
            dataIndex: "gitBuildTime",
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            dataIndex: "actions",
            // 英文下 Download/Rollback 按钮约需 270px，中文约 200px，取 280 兼容各语言避免按钮被 ellipsis 裁切
            width: 280,
            fixed: "right",
            render: (_, record) => (
                <Space>
                    {/* 下载版本包：无 system:version:download 权限隐藏（操作列单项隐藏，保留空列 §7.2） */}
                    {hasPerm(PERM_BUTTON.SYSTEM_VERSION_DOWNLOAD) && (
                        <Button
                            icon={<DownloadOutlined />}
                            onClick={() => handleDownloadVersionJar(record)}
                        >
                            {t("下载")}
                        </Button>
                    )}
                    {/* 回滚版本：无 system:version:rollback 权限隐藏（§7.2） */}
                    {record.type === "BACKUP" && hasPerm(PERM_BUTTON.SYSTEM_VERSION_ROLLBACK) && (
                        <Button
                            danger
                            type="primary"
                            icon={<UndoOutlined />}
                            onClick={() => handleRollback(record)}
                        >
                            {t("回滚")}
                        </Button>
                    )}
                    {/* 删除待升级版本：无 system:version:delete 权限隐藏（§7.2） */}
                    {record.type === "PENDING" && hasPerm(PERM_BUTTON.SYSTEM_VERSION_DELETE) && (
                        <Popconfirm
                            title={t("确认删除该待升级版本?")}
                            onConfirm={() => handleDeletePendingJar(record)}
                        >
                            <Button danger icon={<DeleteOutlined />}>
                                {t("删除")}
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
            ),
            ellipsis: { showTitle: true }
        }
    ];

    useEffect(() => {
        getUpdateJarList();
    }, []);

    return (
        <div className={styles.history_version}>
            <div className={styles.search}>
                <div></div>
                <Space>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={getUpdateJarList}
                    >
                        {t("刷新")}
                    </Button>
                    {/* 重启程序：无 system:version:restart 权限条件渲染隐藏（§7.1） */}
                    {hasPerm(PERM_BUTTON.SYSTEM_VERSION_RESTART) && (
                        <Button
                            type="primary"
                            danger
                            icon={<RedoOutlined />}
                            onClick={handleRestartSystem}
                        >
                            {t("重启程序")}
                        </Button>
                    )}
                    <UpdateVersion onSuccess={getUpdateJarList} />
                </Space>
            </div>
            <Table<SystemVersionInfo>
                columns={columns}
                dataSource={versionRecord}
                rowKey={r => r.gitBuildId}
                // 后端固定返回约 10 条数据，关闭分页并取消纵向滚动，保证整表无滚动条完整展示
                scroll={{ x: 1000 }}
                pagination={false}
            />
            <FakeProgressModal
                ref={progressRef}
                title={t("正在下载版本包")}
                loadingText={t("版本包下载中，请勿关闭页面...")}
                successText={t("下载完成！")}
            />
        </div>
    )
};
