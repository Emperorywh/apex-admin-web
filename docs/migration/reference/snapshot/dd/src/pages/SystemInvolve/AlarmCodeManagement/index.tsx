/**
 * @description 车辆告警码管理
 * @date 2026-7-9
 *
 * 功能说明：
 * 1. 分页查询车辆告警码（按告警码模糊搜索）
 * 2. 创建 / 编辑 / 删除车辆告警码
 * 3. 上传车辆告警码文件（全量覆盖，二次确认）
 * 4. 下载车辆告警码文件
 */
import { useState, useEffect } from "react";
import { getLocale } from "umi";
import { Input, Space, Button, Table, message, Popconfirm, Upload, Modal, theme } from "antd";
import type { GetProps, TableProps, PaginationProps, UploadProps } from "antd";
import { BulbOutlined, CloudUploadOutlined, DownloadOutlined } from "@ant-design/icons";
import {
    pageVehicleAlarmCodes,
    deleteVehicleAlarmCode,
    uploadVehicleAlarmCodeFile,
    downVehicleAlarmCodeFile,
} from "@/api";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";
import type {
    AGVAlarmCodePageParam,
    AGVAlarmCodeData,
    AGVAlarmCodeRecord,
    AlarmCodeRecord,
} from "@/types/SystemInvolve/AlarmCode";
import AlarmCodeModal from "./AlarmCodeModal";
import { createAlarmCodeThemeStyle } from "./themeStyle";
import styles from "./index.less";

const { Search } = Input;

type SearchProps = GetProps<typeof Input.Search>;

/**
 * 告警描述单元格
 * 跟随当前界面语言展示对应记录（匹配不到时回退简体中文，再回退第一条）：
 * - 描述行：告警描述（说明“是什么告警”）
 * - 建议行：灯泡图标 + 处理建议（说明“怎么处理这个告警”），无则省略
 */
function AlarmDescCell({ records }: { records?: AlarmCodeRecord[] }) {
    // 无任何语言记录时直接返回占位符
    if (!records || records.length === 0) {
        return <span className={styles.empty}>-</span>;
    }
    // 跟随界面语言：getLocale() 形如 zh-CN，转成后端 zh_CN；匹配不到则回退简体中文，再回退第一条
    const currentLocale = getLocale()?.replace("-", "_");
    const record =
        records.find(item => item?.locale === currentLocale) ??
        records.find(item => item?.locale === "zh_CN") ??
        records[0];
    const hint = record?.hint?.trim();
    return (
        <div className={styles.locale_item}>
            {/* 描述行：语言标签 + 告警描述 */}
            <div className={styles.locale_desc}>
                <span className={styles.locale_text}>{record?.desc || "-"}</span>
            </div>
            {/* 建议行：处理建议（轻量金色提示），无则不展示 */}
            {hint ? (
                <div className={styles.locale_hint}>
                    <BulbOutlined className={styles.hint_icon} />
                    <span className={styles.hint_text}>{hint}</span>
                </div>
            ) : null}
        </div>
    );
}

export default function AlarmCodeManagement() {
    const { t } = useI18n();
    const { token } = theme.useToken();

    /**
     * 自定义单元格样式统一消费当前 ConfigProvider 下的语义令牌。
     * 主题切换由全局主题上下文驱动，本页面不维护额外的主题状态。
     */
    const themeStyle = createAlarmCodeThemeStyle(token);

    /* 按钮级权限判定（SPEC §7）：新增/上传/下载/编辑/删除车辆告警码 */
    const { hasPerm } = useAccess();
    const canAdd = hasPerm(PERM_BUTTON.VEHICLE_ALARM_CODE_ADD); // 新增告警码（§7.1）
    const canUpload = hasPerm(PERM_BUTTON.VEHICLE_ALARM_CODE_UPLOAD); // 上传告警码文件（§7.1）
    const canDownload = hasPerm(PERM_BUTTON.VEHICLE_ALARM_CODE_DOWNLOAD); // 下载告警码文件（§7.1）
    const canUpdate = hasPerm(PERM_BUTTON.VEHICLE_ALARM_CODE_UPDATE); // 编辑告警码（§7.2）
    const canDelete = hasPerm(PERM_BUTTON.VEHICLE_ALARM_CODE_DELETE); // 删除告警码（§7.2）

    // 查询参数
    const [searchParams, setSearchParams] = useState<AGVAlarmCodePageParam>({
        pageNo: 1,
        pageSize: 10,
        alarmCode: "",
    });
    // 分页参数
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        current: 1,
        pageSize: 10,
        total: 0,
    });
    // 表格数据
    const [alarmRecords, setAlarmRecords] = useState<AGVAlarmCodeRecord[]>([]);
    // 弹窗
    const [openModal, setOpenModal] = useState<boolean>(false);
    // 当前要编辑的数据
    const [modifyAlarm, setModifyAlarm] = useState<AGVAlarmCodeRecord>();
    // 上传中
    const [uploading, setUploading] = useState<boolean>(false);

    // 查询车辆告警码
    const getAlarmCodes = () => {
        pageVehicleAlarmCodes(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: AGVAlarmCodeData = res?.data;
                const { records, size, total, current } = data;
                setAlarmRecords(records);
                setPaginationProps({
                    current,
                    pageSize: size,
                    total,
                });
            } else {
                message.warning(t("查询车辆告警码出错：{msg}", { msg: res?.message ?? "" }));
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询车辆告警码出错：{msg}", { msg: err?.message ?? "" }));
            }
        });
    };

    // 搜索事件
    const onSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            pageNo: 1,
            alarmCode: value,
        });
    };

    // 表格分页变化事件
    const onTableChange: TableProps<AGVAlarmCodeRecord>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize,
        });
    };

    // 新增车辆告警码
    const handleOpenModal = () => {
        setModifyAlarm(undefined);
        setOpenModal(true);
    };

    // 编辑车辆告警码
    const handleUpdateAlarm = (record: AGVAlarmCodeRecord) => {
        setModifyAlarm(record);
        setOpenModal(true);
    };

    // 删除车辆告警码
    const onDeleteConfirm = (record: AGVAlarmCodeRecord) => {
        deleteVehicleAlarmCode({ alarmCode: record.alarmCode }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getAlarmCodes();
                message.success(t("删除车辆告警码成功"));
            } else {
                message.warning(t("删除车辆告警码出错：{msg}", { msg: res?.message ?? "" }));
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除车辆告警码出错：{msg}", { msg: err?.message ?? "" }));
            }
        });
    };

    // 执行上传（全量覆盖）
    const doUpload = (file: File) => {
        setUploading(true);
        uploadVehicleAlarmCodeFile(file).then(res => {
            if (res.code === 200 && res.message === "success") {
                getAlarmCodes();
                message.success(t("上传车辆告警码文件成功"));
            } else {
                message.warning(t("上传车辆告警码文件出错：{msg}", { msg: res?.message ?? "" }));
            }
        }).catch(err => {
            if (err) {
                message.error(t("上传车辆告警码文件出错：{msg}", { msg: err?.message ?? "" }));
            }
        }).finally(() => {
            setUploading(false);
        });
    };

    // 上传前：校验文件类型，并二次确认（全量覆盖）
    const beforeUpload: UploadProps["beforeUpload"] = (file) => {
        const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
        if (!isExcel) {
            message.warning(t("仅支持 .xlsx / .xls 格式的文件"));
            return Upload.LIST_IGNORE;
        }
        Modal.confirm({
            title: t("上传将全量覆盖"),
            content: t("上传后将用文件内容覆盖当前所有车辆告警码，是否继续？"),
            okText: t("继续上传"),
            okButtonProps: { danger: true },
            cancelText: t("取消"),
            onOk: () => doUpload(file),
        });
        // 返回 false 阻止 antd 自动上传，由 doUpload 手动调用接口
        return false;
    };

    // 下载车辆告警码文件
    const handleDownload = () => {
        downVehicleAlarmCodeFile().then(res => {
            // 文件名取服务器在响应头 content-disposition 中返回的原始文件名，取不到时回退到默认名
            const filename =
                res?.headers["content-disposition"]?.split("=")[1]?.replace(/^["']|["']$/g, "") ||
                t("车辆告警码.xlsx");
            const blob: Blob = res.data;
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            message.success(t("下载车辆告警码文件成功"));
        }).catch(err => {
            if (err) {
                message.error(t("下载车辆告警码文件出错：{msg}", { msg: err?.message ?? "" }));
            }
        });
    };

    const columns: TableProps<AGVAlarmCodeRecord>["columns"] = [
        {
            title: t("告警码"),
            dataIndex: "alarmCode",
            width: 300,
        },
        {
            title: t("告警描述"),
            dataIndex: "alarmCodeRecords",
            render: (records: AGVAlarmCodeRecord["alarmCodeRecords"]) => (
                <AlarmDescCell records={records} />
            ),
        },
        {
            title: t("创建时间"),
            dataIndex: "createTime",
            width: 180,
        },
        {
            title: t("操作"),
            width: 180,
            fixed: "right",
            render: (_, record) => (
                <Space>
                    {/* 编辑告警码：无权限隐藏（§7.2） */}
                    {canUpdate && (
                        <Button
                            type="primary"
                            onClick={() => handleUpdateAlarm(record)}
                        >
                            {t("编辑")}
                        </Button>
                    )}
                    {/* 删除告警码：无权限隐藏（§7.2） */}
                    {canDelete && (
                        <Popconfirm
                            title={t("删除")}
                            description={t("确定删除当前车辆告警码吗?")}
                            onConfirm={() => onDeleteConfirm(record)}
                            okText={t("确定")}
                            cancelText={t("取消")}
                        >
                            <Button danger>{t("删除")}</Button>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    useEffect(() => {
        getAlarmCodes();
    }, [searchParams]);

    const uploadProps: UploadProps = {
        accept: ".xlsx,.xls",
        showUploadList: false,
        beforeUpload,
    };

    return (
        <div className={styles.alarm_code} style={themeStyle}>
            <div className={styles.search}>
                <Search
                    placeholder={t("请输入告警码查询")}
                    style={{ width: 360 }}
                    enterButton
                    onSearch={onSearch}
                    allowClear
                />
                <Space>
                    {/* 新增告警码：无权限隐藏（§7.1） */}
                    {canAdd && (
                        <Button type="primary" onClick={handleOpenModal}>{t("新增告警码")}</Button>
                    )}
                    {/* 上传告警码文件：无权限隐藏（§7.1） */}
                    {canUpload && (
                        <Upload {...uploadProps}>
                            <Button type="primary" icon={<CloudUploadOutlined />} loading={uploading}>
                                {t("上传告警码文件")}
                            </Button>
                        </Upload>
                    )}
                    {/* 下载告警码文件：无权限隐藏（§7.1） */}
                    {canDownload && (
                        <Button icon={<DownloadOutlined />} onClick={handleDownload}>
                            {t("下载告警码文件")}
                        </Button>
                    )}
                </Space>
            </div>
            <Table<AGVAlarmCodeRecord>
                columns={columns}
                dataSource={alarmRecords}
                scroll={{ x: 1000, y: "calc(100vh - 320px)" }}
                rowKey={r => r.id}
                pagination={{
                    ...paginationProps,
                    showSizeChanger: true,
                    hideOnSinglePage: false,
                    showTotal: total => t("总数{total}条", { total }),
                }}
                onChange={onTableChange}
            />
            <AlarmCodeModal
                open={openModal}
                modifyAlarm={modifyAlarm}
                setOpenModal={setOpenModal}
                getAlarmCodes={getAlarmCodes}
                setModifyAlarm={setModifyAlarm}
            />
        </div>
    );
}
