/**
 * @description modbus自动门
 * @date 2026-1-19
 */
import { useState, useEffect } from "react";
import { Input, Space, Button, Table, message, Popconfirm, Dropdown, Popover, Descriptions } from "antd";
import type { GetProps, TableProps, PaginationProps } from "antd";
import styles from "./index.less";
import type { SearchType, ResponseType } from "@/types/typing";
import { pageModbusAutoDoors, deleteAutoDoor, autoDoorOpenDoor, autoDoorCloseDoor, getAutoDoorState } from "@/api";
import type { AutoDoorRecord } from "@/types/TriDevice/ModbusAutodoor";
import AutodoorModal from "./AutodoorModal";
import { autodoorCommands } from "@/constants/autodoor";
import type { MenuInfo } from "@/types/OrderRecord";
import { useI18n } from "@/hooks/useI18n";

const { Search } = Input;

type SearchProps = GetProps<typeof Input.Search>;

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();

    // 查询参数
    const [searchParams, setSearchParams] = useState<SearchType>({
        pageNo: 1,
        pageSize: 10,
        query: ""
    });
    // 分页参数
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        current: 1,
        pageSize: 10,
        total: 0
    });
    // 表格数据
    const [doorRecords, setDoorRecords] = useState<AutoDoorRecord[]>([]);
    // 弹窗
    const [openModal, setOpenModal] = useState<boolean>(false);
    // 当前编辑的项
    const [modifyRecord, setModifyRecord] = useState<AutoDoorRecord>();
    // 自动门状态
    const [doorState, setDoorState] = useState<string>("");

    // 查询数据
    const getAutoDoors = () => {
        pageModbusAutoDoors(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: ResponseType<AutoDoorRecord> = res?.data;
                const { records, size, current, total } = data;
                setDoorRecords(records);
                setPaginationProps({
                    current,
                    pageSize: size,
                    total
                });
            } else {
                message.warning(t("查询自动门数据出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询自动门数据出错") + err?.message);
            }
        })
    };

    // 查询参数
    const onSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            pageNo: 1,
            query: value
        })
    };

    // 表格的改变事件
    const onTableChange: TableProps<AutoDoorRecord>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize
        })
    };

    // 新增自动门
    const handleOpenModal = () => {
        setModifyRecord(undefined);
        setOpenModal(true);
    };

    // 编辑按钮
    const handleModifyClick = (record: AutoDoorRecord) => {
        setModifyRecord(record);
        setOpenModal(true);
    };

    // 删除
    const onDeleteConfirm = (record: AutoDoorRecord) => {
        const { deviceKey } = record;
        deleteAutoDoor({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getAutoDoors();
                message.success(t("删除自动门成功"));
            } else {
                message.warning(t("删除自动门出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除自动门出错") + err?.message);
            }
        })
    };

    // 自动门开门请求
    const handleOpenAutoDoor = (deviceKey: string) => {
        autoDoorOpenDoor({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("自动门开门成功"));
            } else {
                message.warning(t("自动门开门出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("自动门开门出错"), +err?.message);
            }
        })
    };

    // 自动门关门请求
    const handleCloseAutoDoor = (deviceKey: string) => {
        autoDoorCloseDoor({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("自动门关门成功"));
            } else {
                message.warning(t("自动门关门出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("自动门关门出错"), +err?.message);
            }
        })
    };

    // 自动门的相关操作
    const handleCommand = (e: MenuInfo, record: AutoDoorRecord) => {
        console.log(e, record)
        const { key } = e;
        const { deviceKey } = record;
        if (!deviceKey) return;
        switch (key) {
            case "openDoor":
                handleOpenAutoDoor(deviceKey);
                break;
            case "closeDoor":
                handleCloseAutoDoor(deviceKey);
                break;
            default:
                break;
        }
    };

    // 自动门状态
    const handleAutoDoorState = (record: AutoDoorRecord) => {
        const { deviceKey } = record;
        if (!deviceKey) return;
        getAutoDoorState({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: string = res?.data?.doorState;
                setDoorState(data);
            } else {
                message.warning(t("查询自动门状态出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询自动门状态出错") + err?.message);
            }
        })
    };

    const columns: TableProps<AutoDoorRecord>["columns"] = [
        {
            title: t("设备标识"),
            dataIndex: "deviceKey",
            ellipsis: { showTitle: true }
        },
        {
            title: t("设备名称"),
            dataIndex: "deviceName",
            ellipsis: { showTitle: true }
        },
        {
            title: t("设备状态"),
            dataIndex: "deviceStatus",
            render: (value) => value ? t("启用") : t("禁用"),
            ellipsis: { showTitle: true }
        },
        {
            title: t("设备的IP地址"),
            dataIndex: "ip",
            ellipsis: { showTitle: true }
        },
        {
            title: t("设备的端口号"),
            dataIndex: "port",
            ellipsis: { showTitle: true }
        },
        {
            title: t("从站号"),
            dataIndex: "slaveId",
            ellipsis: { showTitle: true }
        },
        {
            title: t("读类型"),
            dataIndex: "readFunction",
            ellipsis: { showTitle: true }
        },
        {
            title: t("故障位"),
            dataIndex: "faultSignal",
            ellipsis: { showTitle: true }
        },
        {
            title: t("自动门开门到位(读)"),
            dataIndex: "doorFullyOpenSignal",
            ellipsis: { showTitle: true }
        },
        {
            title: t("自动门关门到位(读)"),
            dataIndex: "doorFullyCloseSignal",
            ellipsis: { showTitle: true }
        },
        {
            title: t("写类型"),
            dataIndex: "writeFunction",
            ellipsis: { showTitle: true }
        },
        {
            title: t("自动门开门(写)"),
            dataIndex: "doorOpeningSignal",
            ellipsis: { showTitle: true }
        },
        {
            title: t("自动门关门(写)"),
            dataIndex: "doorClosingSignal",
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            width: 350,
            fixed: "right",
            render: (_, record) => (
                <Space>
                    <Popover
                        placement="left"
                        title={t("自动门状态")}
                        trigger={["click"]}
                        content={doorState}
                    >
                        <Button
                            type="primary"
                            onClick={() => handleAutoDoorState(record)}
                        >
                            {t("状态")}
                        </Button>
                    </Popover>
                    <Dropdown
                        menu={{
                            items: autodoorCommands?.map(op => op && "label" in op ? { ...op, label: t(op.label as string) } : op),
                            onClick: (e) => handleCommand(e, record)
                        }}
                    >
                        <Button type="primary">
                            {t("操作")}
                        </Button>
                    </Dropdown>
                    <Button type="primary" onClick={() => handleModifyClick(record)}>{t("编辑")}</Button>
                    <Popconfirm
                        title={t("删除")}
                        description={t("确认删除当前项?")}
                        onConfirm={() => onDeleteConfirm(record)}
                        okText={t("确定")}
                        cancelText={t("取消")}
                    >
                        <Button danger>{t("删除")}</Button>
                    </Popconfirm>
                </Space>
            ),
            ellipsis: { showTitle: true }
        },
    ];

    useEffect(() => {
        getAutoDoors();
    }, [searchParams])

    return (
        <div className={styles.auto_door}>
            <div className={styles.search}>
                <Search
                    placeholder={t("请输入设备名称查询")}
                    enterButton
                    style={{ width: 361 }}
                    onSearch={onSearch}
                />
                <Space>
                    <Button type="primary" onClick={handleOpenModal}>{t("新增自动门")}</Button>
                </Space>
            </div>
            <Table<AutoDoorRecord>
                columns={columns}
                dataSource={doorRecords}
                scroll={{ x: 2400, y: "calc(100vh - 320px)" }}
                rowKey={r => r.id as unknown as string}
                pagination={{
                    ...paginationProps,
                    showSizeChanger: true,
                    hideOnSinglePage: false,
                    showTotal: total => t("总数{total}条", { total })
                }}
                onChange={onTableChange}
            />
            <AutodoorModal
                open={openModal}
                modifyRecord={modifyRecord}
                setOpenModal={setOpenModal}
                getAutoDoors={getAutoDoors}
                setModifyRecord={setModifyRecord}
            />
        </div>
    )
};
