/**
 * @description 三方设备的电梯
 * @date 2025-7-21
 */
import { useState, useEffect } from "react";
import { Input, Space, Button, Table, message, Dropdown, Popconfirm, Popover, Descriptions, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { TableProps, GetProps, PaginationProps, MenuProps, DescriptionsProps } from "antd";
import type { MenuInfo } from "rc-menu/lib/interface";
import { pageElevators, getElevatorDrivers, deleteElevator, clearElevatorOccupy, getElevatorState } from "@/api";
import styles from "./index.less";
import type { PageElevators, ElevatorData, ElevatorRecord, ElevatorDriver, ElevatorState } from "@/types/TriDevice/Elevators";
import ElevatorModal from "./ElevatorModal";
import ControlModal from "./ControlModal";
import { convertElevatorToDescription } from "@/utils/format";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

const { Search } = Input;

type SearchProps = GetProps<typeof Input.Search>;

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();
    /*
     * 按钮级权限判定
     * 无权限的动作触发型按钮条件渲染隐藏（root 短路全开）
     * 详见 docs/SPEC_button_permission.md §7
     */
    const { hasPerm } = useAccess();

    /* 电梯操作菜单 */
    const items: MenuProps["items"] = [
        {
            key: "outerCall",
            label: t("呼叫电梯")
        },
        {
            key: "openDoor",
            label: t("电梯开门")
        },
        {
            key: "closeDoor",
            label: t("电梯关门")
        },
        {
            key: "clearElevatorOccupied",
            label: t("清除占用电梯车辆")
        }
    ];

    // 表格数据
    const [elevators, setElevators] = useState<ElevatorRecord[]>([]);
    // 查询表格参数
    const [searchParams, setSearchParams] = useState<PageElevators>({
        pageNo: 1,
        pageSize: 10,
        query: ""
    });
    // 电梯新增操作弹窗
    const [openElevator, setOpenElevator] = useState<boolean>(false);
    // 页脚分页
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        current: 1,
        pageSize: 10,
        total: 0
    });
    // 电梯的驱动列表
    const [elevatorDrivers, setElevatorDrivers] = useState<ElevatorDriver[]>([]);
    // 当前是不是编辑状态
    const [isModify, setIsModify] = useState<boolean>(false);
    // 当前编辑的行
    const [modifyRow, setModifyRow] = useState<ElevatorRecord | undefined>();
    // 电梯控制的弹窗
    const [openControl, setOpenControl] = useState<boolean>(false);
    // 当前控制的电梯key
    const [currentDeviceKey, setCurrentDeviceKey] = useState<string>("");
    // 当前的操作
    const [currentControl, setCurrentControl] = useState<string>("");
    // 当前电梯的状态
    const [elevatorState, setElevatorState] = useState<DescriptionsProps["items"]>([]);
    // 表格的loading
    const [tableLoading, setTableLoading] = useState<boolean>(false);

    // 查询表格数据
    const getElevators = () => {
        setTableLoading(true);
        pageElevators(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: ElevatorData = res?.data;
                const { records, total, current, size } = data;
                setElevators(records);
                setPaginationProps({
                    current,
                    pageSize: size,
                    total
                });
            } else {
                message.warning(t("查询电梯出错") + res?.message);
            }
            setTableLoading(false);
        }).catch(err => {
            setTableLoading(false);
            message.error(t("查询电梯出错") + err?.message);
        })
    };

    const onElevatorSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            pageNo: 1,
            query: value
        });
    };

    // 新增电梯
    const handleOpenElevator = () => {
        setIsModify(false);
        setModifyRow(undefined);
        setOpenElevator(true);
    };

    const onTableChange: TableProps<ElevatorRecord>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize
        });
    };

    // 点击编辑按钮
    const handleModifyClick = (record: ElevatorRecord) => {
        setIsModify(true);
        setModifyRow(record);
        setOpenElevator(true);
    };

    // 呼叫电梯
    const handleElevatorOuterCall = () => {
        setOpenControl(true);
    };

    // 电梯上楼
    const handleElevatorInnerCall = () => {
        setOpenControl(true);
    };

    // 清除占用电梯车辆
    const handleClearElevatorOccupied = (deviceKey: string) => {
        clearElevatorOccupy({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("清除占用电梯车辆成功"));
            } else {
                message.warning(t("清除占用电梯车辆出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("清除占用电梯车辆出错") + err?.message);
            }
        })
    };

    // 打开控制弹窗
    const handleOpenControlModal = () => {
        setOpenControl(true);
    };

    // 操作项按钮
    const onDropdownMenuClick = ({ key }: MenuInfo, record: ElevatorRecord) => {
        const { deviceKey } = record;
        if (!deviceKey) return;
        setCurrentControl(key);
        setCurrentDeviceKey(deviceKey);
        switch (key) {
            case "outerCall":
                handleElevatorOuterCall();
                break;
            case "openDoor":
                handleOpenControlModal();
                break;
            case "innerCall":
                handleElevatorInnerCall();
                break;
            case "closeDoor":
                handleOpenControlModal();
                break;
            case "clearElevatorOccupied":
                handleClearElevatorOccupied(deviceKey);
                break;
            default:
                break;
        }
    };

    const onDeleteconfirm = (record: ElevatorRecord) => {
        const { deviceKey } = record;
        if (!deviceKey) return;
        deleteElevator({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getElevators();
                message.success(t("删除电梯成功"));
            } else {
                message.warning(t("删除电梯出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除电梯出错") + err?.message);
            }
        })
    };

    // 查询电梯状态
    const handleElevatorState = (record: ElevatorRecord) => {
        const { deviceKey } = record;
        if (!deviceKey) return;
        getElevatorState({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: ElevatorState = res.data;
                const description = convertElevatorToDescription(data);
                /* 将电梯状态描述列表的标签与字符串型取值翻译为当前语言 */
                setElevatorState(description.map(item => ({
                    ...item,
                    label: t(item.label as string),
                    children: typeof item.children === "string" ? t(item.children) : item.children
                })));
            } else {
                message.warning(t("查询电梯的状态出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询电梯的状态出错") + err?.message);
            }
        })
    };

    const columns: TableProps<ElevatorRecord>["columns"] = [
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
            title: t("楼层"),
            dataIndex: "floors",
            ellipsis: { showTitle: true }
        },
        {
            title: t("设备状态"),
            dataIndex: "deviceStatus",
            render: (value) => value ? t("启用") : t("禁用"),
            ellipsis: { showTitle: true }
        },
        {
            title: t("设备驱动"),
            dataIndex: "driverKey",
            render: (value) => elevatorDrivers.find(driver => driver.key === value)?.name || "",
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
                        title={t("电梯状态")}
                        trigger={["click"]}
                        content={
                            <Descriptions
                                style={{ width: 200 }}
                                items={elevatorState}
                                size="small"
                                column={1}
                            />
                        }
                    >
                        <Button
                            type="primary"
                            onClick={() => handleElevatorState(record)}
                        >
                            {t("状态")}
                        </Button>
                    </Popover>
                    {/*
                     * 操作项 Dropdown（粗粒度码）：呼叫/开门/关门/清除占用等设备控制操作
                     * 无 device:elevator:operate 权限隐藏入口，子项不再细分（§7.2/§7.4）
                     */}
                    {hasPerm(PERM_BUTTON.DEVICE_ELEVATOR_OPERATE) && (
                        <Dropdown
                            menu={{
                                items,
                                onClick: (event) => onDropdownMenuClick(event, record)
                            }}
                        >
                            <Button type="primary">
                                {t("操作项")}
                            </Button>
                        </Dropdown>
                    )}
                    {/* 编辑：无 device:elevator:update 权限隐藏（操作列单项隐藏，保留空列 §7.2） */}
                    {hasPerm(PERM_BUTTON.DEVICE_ELEVATOR_UPDATE) && (
                        <Button
                            type="primary"
                            onClick={() => handleModifyClick(record)}
                        >
                            {t("编辑")}
                        </Button>
                    )}
                    {/* 删除：无 device:elevator:delete 权限隐藏（§7.2） */}
                    {hasPerm(PERM_BUTTON.DEVICE_ELEVATOR_DELETE) && (
                        <Popconfirm
                            title={t("删除")}
                            description={t("确定删除当前电梯?")}
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
        getElevatorDrivers().then(res => {
            if (res.code === 200 && res.message === "success") {
                setElevatorDrivers(res?.data || []);
            } else {
                message.warning(t("查询简单地图出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询简单地图出错") + err?.message);
            }
        })
    }, [])

    useEffect(() => {
        getElevators();
    }, [searchParams])

    return (
        <div className={styles.elevator}>
            <div className={styles.elevator_actions}>
                <Search
                    style={{ width: 300 }}
                    placeholder={t("根据(名称/标识)查询")}
                    onSearch={onElevatorSearch}
                    enterButton
                />
                <Space>
                    {/*
                     * 新增设备：无 device:elevator:add 权限条件渲染隐藏
                     * 动作触发型按钮（工具栏独立按钮，§7.1）
                     */}
                    {hasPerm(PERM_BUTTON.DEVICE_ELEVATOR_ADD) && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleOpenElevator}
                        >
                            {t("新增设备")}
                        </Button>
                    )}
                </Space>
            </div>
            <Table<ElevatorRecord>
                columns={columns}
                dataSource={elevators}
                loading={tableLoading}
                rowKey={r => r.deviceKey}
                scroll={{ x: 800, y: "calc(100vh - 320px)" }}
                pagination={{
                    ...paginationProps,
                    hideOnSinglePage: false,
                    showSizeChanger: true,
                    showTotal: (total) => t("总数{total}条", { total })
                }}
                onChange={onTableChange}
            />
            <ElevatorModal
                open={openElevator}
                isModify={isModify}
                modifyRow={modifyRow}
                elevatorDrivers={elevatorDrivers}
                getElevators={getElevators}
                setModifyRow={setModifyRow}
                setOpenElevator={setOpenElevator}
            />
            <ControlModal
                open={openControl}
                currentControl={currentControl}
                currentDeviceKey={currentDeviceKey}
                setOpenControl={setOpenControl}
            />
        </div>
    )
};
