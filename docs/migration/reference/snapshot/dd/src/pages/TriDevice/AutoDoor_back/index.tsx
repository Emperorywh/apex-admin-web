/**
 * @description 三方设备对接自动门
 * @date 2025-7-21
 */
import { useEffect, useState } from "react";
import { Table, message, Input, Space, Button, Popover, Popconfirm, Dropdown, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { TableProps, GetProps, PaginationProps, MenuProps } from "antd";
import type { MenuInfo } from "rc-menu/lib/interface";
import { pageAutoDoors, getAutoDoorDrivers, getAutoDoorState, deleteAutoDoor, autoDoorOpen, autoDoorClose, clearAutoDoorOccupy } from "@/api";
import type { PageAutoDoor, PageAutoDoorParams, AutoDoorRecord, AutoDoorDriver, AutoDoorState } from "@/types/TriDevice/AutoDoor";
import styles from "./index.less";
import AutoDoorModal from "./AutoDoorModal";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

type SearchProps = GetProps<typeof Input.Search>;

const { Search } = Input;

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();
    /*
     * 按钮级权限判定
     * 无权限的动作触发型按钮条件渲染隐藏（root 短路全开）
     * 详见 docs/SPEC_button_permission.md §7
     */
    const { hasPerm } = useAccess();

    /* 自动门操作菜单 */
    const items: MenuProps["items"] = [
        {
            key: "close",
            label: t("关门")
        },
        {
            label: t("开门"),
            key: "open"
        },
        {
            key: "clearAutoDoorOccupy",
            label: t("清除占用自动门车辆")
        }
    ];

    const [doorRecords, setDoorRecords] = useState<AutoDoorRecord[]>([]);
    const [searchParams, setSearchParams] = useState<PageAutoDoorParams>({
        pageNo: 1,
        pageSize: 10,
        query: ""
    });
    // 自动门弹窗
    const [openDoorModal, setDoorModal] = useState<boolean>(false);
    // 分页的参数
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        current: 1,
        pageSize: 10,
        total: 0
    });
    // 获取自动门驱动集合
    const [doorDrivers, setDoorDrivers] = useState<AutoDoorDriver[]>([]);
    // 自动门状态
    const [doorState, setDoorState] = useState<string>("");
    // 当前是不是编辑状态
    const [isModify, setIsModify] = useState<boolean>(false);
    // 编辑的行
    const [modifyRow, setModifyRow] = useState<AutoDoorRecord>();
    // 表格的loading
    const [tableLoading, setTableLoading] = useState<boolean>(false);

    // 查询安全门列表
    const getAutoDoors = () => {
        setTableLoading(true);
        pageAutoDoors(searchParams).then(res => {
            if (res.code === 200 && res.message === "success" && res.data) {
                const data: PageAutoDoor["data"] = res?.data || {};
                const { records, current, size, total } = data;
                setDoorRecords(records || []);
                setPaginationProps({
                    current,
                    pageSize: size,
                    total
                });
            } else {
                message.warning(t("查询自动门出错") + res?.message);
            }
            setTableLoading(false);
        }).catch(err => {
            if (err) {
                setTableLoading(false);
                message.error(t("查询自动门出错") + err?.message);
            }
        })
    };

    // 查询自动门驱动集合
    const getDoorDrivers = () => {
        getAutoDoorDrivers().then(res => {
            if (res.code === 200 && res.message === "success" && res?.data) {
                setDoorDrivers(res?.data || []);
            } else {
                message.warning(t("查询自动门驱动出错") + res?.message);
            }
        }).catch(err => {
            message.error(t("查询自动门驱动出错") + err?.message);
        })
    };

    const onAutoDoorSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            pageNo: 1,
            query: value
        });
    };

    // 打开自动门弹窗
    const handleOpenAutoDoorModal = () => {
        setIsModify(false);
        setDoorModal(true);
        setModifyRow(undefined);
    };

    const onTableChange: TableProps<AutoDoorRecord>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize
        });
    };

    // 查看安全门状态
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

    // 编辑按钮
    const handleAutoDoorModify = (record: AutoDoorRecord) => {
        setIsModify(true);
        setDoorModal(true);
        setModifyRow(record);
    };

    const onDeleteconfirm = (record: AutoDoorRecord) => {
        const { deviceKey } = record;
        if (!deviceKey) return;
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
        autoDoorOpen({ deviceKey }).then(res => {
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
        autoDoorClose({ deviceKey }).then(res => {
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

    const handleClearAutoDoorOccupy = (deviceKey: string) => {
        clearAutoDoorOccupy({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("清除占用自动门车辆成功"));
            } else {
                message.warning(t("清除占用自动门车辆出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("清除占用自动门车辆出错") + err?.message);
            }
        })
    };

    // 点击操作项
    const handleMenuClick = ({ key }: MenuInfo, record: AutoDoorRecord) => {
        const { deviceKey } = record;
        if (!deviceKey) return;
        switch (key) {
            case "open":
                handleOpenAutoDoor(deviceKey);
                break;
            case "close":
                handleCloseAutoDoor(deviceKey);
                break;
            case "clearAutoDoorOccupy":
                handleClearAutoDoorOccupy(deviceKey);
                break;
            default:
                break;
        }
    };

    const columns: TableProps<AutoDoorRecord>["columns"] = [
        {
            title: t("设备名称"),
            dataIndex: "deviceName",
            ellipsis: { showTitle: true }
        },
        {
            title: t("设备标识"),
            dataIndex: "deviceKey",
            ellipsis: { showTitle: true }
        },
        {
            title: t("驱动"),
            dataIndex: "driverKey",
            render: (value) => doorDrivers.find(driver => driver.key === value)?.name || value,
            ellipsis: { showTitle: true }
        },
        {
            title: t("启用状态"),
            dataIndex: "deviceStatus",
            render: (value) => value ? t("启用") : t("禁用"),
            ellipsis: { showTitle: true }
        },
        {
            title: t("IP地址"),
            dataIndex: "ip",
            ellipsis: { showTitle: true }
        },
        {
            title: t("端口"),
            dataIndex: "port",
            ellipsis: { showTitle: true }
        },
        {
            title: t("设备配置"),
            dataIndex: "deviceConfig",
            ellipsis: {
                showTitle: false
            },
            render: (value) => (
                <Popover
                    content={
                        <div
                            style={{ height: "40vh", width: "30vw", overflowY: "auto", whiteSpace: "pre-wrap" }}
                        >
                            {JSON.stringify(value, null, 2)}
                        </div>
                    }
                    title={t("配置内容")}
                >
                    {JSON.stringify(value)}
                </Popover>
            )
        },
        {
            title: t("网络状态"),
            dataIndex: "onlineState",
            render: (value) => (
                <Space>
                    <Tag color={value === "ONLINE" ? "#87D068" : "#D50000"}>{value === "ONLINE" ? t("在线") : t("离线")}</Tag>
                </Space>
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            fixed: "right",
            width: 360,
            render: (_, record) => (
                <Space>
                    {/* 状态：view 行为（查询设备状态），不控权 */}
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
                    {/*
                     * 操作项 Dropdown（粗粒度码）：开门/关门/清除占用等设备控制操作
                     * 无 device:auto-door:operate 权限隐藏入口，子项不再细分（§7.2/§7.4）
                     */}
                    {hasPerm(PERM_BUTTON.DEVICE_AUTO_DOOR_OPERATE) && (
                        <Dropdown
                            menu={{
                                items,
                                onClick: (evt) => handleMenuClick(evt, record)
                            }}
                        >
                            <Button type="primary">
                                {t("操作项")}
                            </Button>
                        </Dropdown>
                    )}
                    {/* 编辑：无 device:auto-door:update 权限隐藏（操作列单项隐藏，保留空列 §7.2） */}
                    {hasPerm(PERM_BUTTON.DEVICE_AUTO_DOOR_UPDATE) && (
                        <Button
                            type="primary"
                            onClick={() => handleAutoDoorModify(record)}
                        >
                            {t("编辑")}
                        </Button>
                    )}
                    {/* 删除：无 device:auto-door:delete 权限隐藏（§7.2） */}
                    {hasPerm(PERM_BUTTON.DEVICE_AUTO_DOOR_DELETE) && (
                        <Popconfirm
                            title={t("删除")}
                            description={t("确定删除当前自动门?")}
                            onConfirm={() => onDeleteconfirm(record)}
                            okText={t("确定")}
                            cancelText={t("取消")}
                        >
                            <Button color="danger" variant="outlined">
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
        getDoorDrivers();
    }, [])

    useEffect(() => {
        getAutoDoors();
    }, [searchParams])

    return (
        <div className={styles.auto_door}>
            <div className={styles.header_actions}>
                <Search
                    style={{ width: 300 }}
                    placeholder={t("根据(名称/标识)查询")}
                    onSearch={onAutoDoorSearch}
                    enterButton
                />
                <Space>
                    {/*
                     * 新增设备：无 device:auto-door:add 权限条件渲染隐藏（§7.1）
                     */}
                    {hasPerm(PERM_BUTTON.DEVICE_AUTO_DOOR_ADD) && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleOpenAutoDoorModal}
                        >
                            {t("新增设备")}
                        </Button>
                    )}
                </Space>
            </div>
            <Table<AutoDoorRecord>
                columns={columns}
                dataSource={doorRecords}
                loading={tableLoading}
                scroll={{ x: 800, y: "calc(100vh - 320px)" }}
                rowKey={r => r.deviceKey}
                pagination={{
                    ...paginationProps,
                    hideOnSinglePage: false,
                    showSizeChanger: true,
                    responsive: true,
                    showTotal: (total) => t("总数{total}条", { total }),
                }}
                onChange={onTableChange}
            />
            <AutoDoorModal
                open={openDoorModal}
                isModify={isModify}
                modifyRow={modifyRow}
                doorDrivers={doorDrivers}
                setDoorModal={setDoorModal}
                getAutoDoors={getAutoDoors}
                setModifyRow={setModifyRow}
            />
        </div>
    )
};
