/**
 * @description modbus电梯
 * @date 2026-1-19
 */
import { useState, useEffect } from "react";
import { Table, Input, Space, Button, Popconfirm, Dropdown, Popover, Descriptions } from "antd";
import type { TableProps, GetProps, PaginationProps, DescriptionsProps } from "antd";
import type { SearchType, ResponseType } from "@/types/typing";
import { pageModbusElevators, deleteModbusElevator, openDoor, closeDoor, clearElevatorOccupy, getElevatorState } from "@/api";
import { message } from "antd/lib";
import styles from "./index.less";
import ElevatorModal from "./ElevatorModal";
import type { ModbusElevator, ElevatorState } from "@/types/TriDevice/ModbusElevator";
import CommandModal from "./CommandModal";
import { elevatorCommands } from "@/constants/elevator";
import type { MenuInfo } from "@/types/OrderRecord";
import { convertElevatorToDescription } from "@/utils/format";
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
    // 弹窗
    const [openModal, setOpenModal] = useState<boolean>(false);
    // 表格数据
    const [elevatorRecord, setElevatorRecord] = useState<ModbusElevator[]>([]);
    // 分页数据
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        current: 1,
        pageSize: 10,
        total: 0
    });
    // 编辑的数据
    const [modifyElevator, setModifyElevator] = useState<ModbusElevator>();
    // 电梯操作弹窗
    const [openCommandModal, setOpenCommandModal] = useState<boolean>(false);
    // 当前操作的设备Key
    const [deviceKey, setDeviceKey] = useState<string>("");
    // 电梯当前的操作key
    const [commandKey, setCommandKey] = useState<string>("");
    // 当前电梯的状态
    const [elevatorState, setElevatorState] = useState<DescriptionsProps["items"]>([]);

    // 查询电梯
    const getElevators = () => {
        pageModbusElevators(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: ResponseType<ModbusElevator> = res?.data;
                const { records, size, current, total } = data;
                setElevatorRecord(records);
                setPaginationProps({
                    current,
                    pageSize: size,
                    total
                });
            } else {
                message.warning(t("查询modbus电梯出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询modbus电梯出错") + err?.message);
            }
        })
    };

    // 查询函数
    const onSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            pageNo: 1,
            query: value
        });
    };

    // 新增电梯
    const handleOpenModal = () => {
        setModifyElevator(undefined);
        setOpenModal(true);
    };

    // 编辑电梯
    const handleModifyClick = (record: ModbusElevator) => {
        setModifyElevator(record);
        setOpenModal(true);
    };

    // 表格的改变事件
    const onTableChange: TableProps<ModbusElevator>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...paginationProps,
            pageNo: current,
            pageSize
        });
    };

    // 删除
    const onDeleteConfirm = (record: ModbusElevator) => {
        const { deviceKey } = record;
        if (!deviceKey) return;
        deleteModbusElevator({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getElevators();
                message.success(t("删除modbus电梯成功"));
            } else {
                message.warning(t("删除modbus电梯出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除modbus电梯出错") + err?.message);
            }
        })
    };

    // 电梯开门
    const handleElevatorOpenDoor = (deviceKey: string) => {
        openDoor({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("电梯开门成功"));
            } else {
                message.warning(t("电梯开门出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("电梯开门出错") + err?.message);
            }
        })
    };

    // 电梯关门
    const handleElevatorCloseDoor = (deviceKey: string) => {
        closeDoor({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("电梯关门成功"));
            } else {
                message.warning(t("电梯关门出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("电梯关门出错") + err?.message);
            }
        })
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

    // 电梯的相关操作
    const handleCommand = (e: MenuInfo, record: ModbusElevator) => {
        console.log(e, record)
        const { key } = e;
        setCommandKey(key);
        const { deviceKey = "" } = record;
        setDeviceKey(deviceKey);
        switch (key) {
            case "outerCall":
                setOpenCommandModal(true);
                break;
            case "openDoor":
                handleElevatorOpenDoor(deviceKey);
                break;
            case "innerCall":
                setOpenCommandModal(true);
                break;
            case "closeDoor":
                handleElevatorCloseDoor(deviceKey);
                break;
            case "clearElevatorOccupied":
                handleClearElevatorOccupied(deviceKey);
                break;
            default:
                break;
        }
    };

    // 查询电梯状态
    const handleElevatorState = (record: ModbusElevator) => {
        const { deviceKey = "" } = record;
        getElevatorState({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: ElevatorState = res.data;
                const descriptions = convertElevatorToDescription(data);
                /* 将电梯状态描述列表的标签与字符串型取值翻译为当前语言 */
                setElevatorState(descriptions.map(item => ({
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

    const columns: TableProps<ModbusElevator>["columns"] = [
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
            title: t("设备的ip地址"),
            dataIndex: "ip",
            ellipsis: { showTitle: true }
        },
        {
            title: t("设备的端口号"),
            dataIndex: "port",
            ellipsis: { showTitle: true }
        },
        {
            title: t("设备状态"),
            dataIndex: "deviceStatus",
            render: (value) => value ? t("启用") : t("禁用"),
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
            title: t("故障位(读)"),
            dataIndex: "faultSignal",
            ellipsis: { showTitle: true }
        },
        {
            title: t("占用标识位(读)"),
            dataIndex: "occupySignal",
            ellipsis: { showTitle: true }
        },
        {
            title: t("前门开门到位信号位(读)"),
            dataIndex: "frontDoorFullyOpenSignal",
            ellipsis: { showTitle: true }
        },
        {
            title: t("前门关门到位信号位(读)"),
            dataIndex: "frontDoorFullyCloseSignal",
            ellipsis: { showTitle: true }
        },
        {
            title: t("后门开门到位信号位(读)"),
            dataIndex: "backDoorFullyOpenSignal",
            ellipsis: { showTitle: true }
        },
        {
            title: t("后门关门到位信号位(读)"),
            dataIndex: "backDoorFullyCloseSignal",
            ellipsis: { showTitle: true }
        },
        {
            title: t("当前楼层信号位(读)"),
            dataIndex: "currentFloor",
            ellipsis: { showTitle: true }
        },
        {
            title: t("写类型"),
            dataIndex: "writeFunction",
            ellipsis: { showTitle: true }
        },
        {
            title: t("前门开门信号位(写)"),
            dataIndex: "frontDoorOpeningSignal",
            ellipsis: { showTitle: true }
        },
        {
            title: t("前门关门信号位(写)"),
            dataIndex: "frontDoorClosingSignal",
            ellipsis: { showTitle: true }
        },
        {
            title: t("后门开门信号位(写)"),
            dataIndex: "backDoorOpeningSignal",
            ellipsis: { showTitle: true }
        },
        {
            title: t("后门关门信号位(写)"),
            dataIndex: "backDoorClosingSignal",
            ellipsis: { showTitle: true }
        },
        {
            title: t("目标楼层信号位(写)"),
            dataIndex: "targetFloor",
            ellipsis: { showTitle: true }
        },
        {
            title: t("占用电梯的车辆"),
            dataIndex: "occupyVehicleKey",
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
                    <Dropdown
                        menu={{
                            items: elevatorCommands?.map(op => op && "label" in op ? { ...op, label: t(op.label as string) } : op),
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
                        description={t("确认删除当前数据?")}
                        onConfirm={() => onDeleteConfirm(record)}
                        okText={t("确定")}
                        cancelText={t("取消")}
                    >
                        <Button danger>{t("删除")}</Button>
                    </Popconfirm>
                </Space>
            ),
            ellipsis: { showTitle: true }
        }
    ];

    useEffect(() => {
        getElevators();
    }, [searchParams])

    return (
        <div className={styles.modbus_elevator}>
            <div className={styles.search}>
                <Search
                    style={{ width: 360 }}
                    placeholder={t("请输入电梯名查询")}
                    enterButton
                    onSearch={onSearch}
                />
                <Space>
                    <Button type="primary" onClick={handleOpenModal}>{t("新增电梯")}</Button>
                </Space>
            </div>
            <Table<ModbusElevator>
                columns={columns}
                dataSource={elevatorRecord}
                scroll={{ x: 4200, y: "calc(100vh - 320px)" }}
                rowKey={r => r.id as unknown as string}
                pagination={{
                    ...paginationProps,
                    showSizeChanger: true,
                    hideOnSinglePage: false,
                    showTotal: total => t("总数{total}条", { total })
                }}
                onChange={onTableChange}
            />
            <ElevatorModal
                open={openModal}
                modifyElevator={modifyElevator}
                setOpenModal={setOpenModal}
                getElevators={getElevators}
                setModifyElevator={setModifyElevator}
            />
            <CommandModal
                open={openCommandModal}
                deviceKey={deviceKey}
                commandKey={commandKey}
                openModal={setOpenCommandModal}
            />
        </div>
    )
};
