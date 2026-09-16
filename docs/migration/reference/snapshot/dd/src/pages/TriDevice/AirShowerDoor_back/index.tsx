/**
 * @description 风淋门组件
 * @date 2025-7-22
 */
import { useState, useEffect } from "react";
import { Input, Space, Button, Table, message, Dropdown, Popconfirm, Popover, Descriptions } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { TableProps, PaginationProps, MenuProps, DescriptionsProps } from "antd";
import type { MenuInfo } from "rc-menu/lib/interface";
import styles from "./index.less";
import AirDoorModal from "./AirDoorModal";
import { getAirShowerDoorDrivers, pageAirShowerDoors, deleteAirShowerDoor, getAirShowerDoorState, shower, clearAirShowerDoorOccupy } from "@/api";
import type { AirDoorDriver, PageAirDoor, AirDoorData, AirDoorRecord, AirDoorState } from "@/types/TriDevice/AirShowerDoor";
import ControlModal from "./ControlModal";
import { convertAirDoorStateToDescription } from "@/utils/format";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";
import NetworkStateTag from "@/components/NetworkStateTag";
import JsonViewer from "@/components/JsonViewer";

const { Search } = Input;

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();
    /*
     * 按钮级权限判定
     * 无权限的动作触发型按钮条件渲染隐藏（root 短路全开）
     * 详见 docs/SPEC_button_permission.md §7
     */
    const { hasPerm } = useAccess();

    /* 风淋门操作菜单 */
    const items: MenuProps["items"] = [
        {
            key: "openDoor",
            label: t("开门")
        },
        {
            key: "closeDoor",
            label: t("关门")
        },
        // {
        //     key: "clearAirShowerDoorOccupy",
        //     label: t("清除占用风淋门车辆")
        // }
    ];

    // 风淋门表格数据
    const [airShowerDoors, setAirShowerDoors] = useState<AirDoorRecord[]>([]);
    // 风淋门弹窗
    const [openAirDoor, setOpenAirDoor] = useState<boolean>(false);
    // 风淋门驱动
    const [airDoorDrivers, setAirDoorDrivers] = useState<AirDoorDriver[]>([]);
    // 查询参数
    const [searchParams, setSearchParams] = useState<PageAirDoor>({
        pageNo: 1,
        pageSize: 10,
        query: ""
    });
    // 分页的属性
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        current: 1,
        pageSize: 10,
        total: 0
    });
    // 当前是不是编辑状态
    const [isModify, setIsModify] = useState<boolean>(false);
    // 当前编辑的行
    const [modifyRow, setModifyRow] = useState<AirDoorRecord>();
    // 风淋门操作
    const [openControl, setOpenControl] = useState<boolean>(false);
    // 当前的操作
    const [currentControlKey, setCurrentControlKey] = useState<string>("");
    // 当前行的设备key
    const [curDeviceKey, setCurDeviceKey] = useState<string>("");
    // 风淋门的状态
    const [airDoorState, setAirDoorState] = useState<DescriptionsProps["items"]>([]);
    // 表格的loading
    const [tableLoading, setTableLoading] = useState<boolean>(false);

    // 查询风淋门分页列表（刷新表格数据）
    const refreshAirShowerDoorList = () => {
        setTableLoading(true);
        pageAirShowerDoors(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: AirDoorData = res.data;
                const { records, current, size, total } = data;
                setAirShowerDoors(records);
                setPaginationProps({
                    current,
                    pageSize: size,
                    total
                });
            } else {
                message.warning(t("查询风淋门出错") + res?.message);
            }
            setTableLoading(false);
        }).catch(err => {
            if (err) {
                setTableLoading(false);
                message.error(t("查询风淋门出错") + err?.message);
            }
        })
    };

    const onAirShowerDoorSearch = (value: string) => {
        setSearchParams(prev => ({
            ...prev,
            query: value,
            pageNo: 1
        }));
    };

    const handleOpenAirShower = () => {
        setIsModify(false);
        setModifyRow(undefined);
        setOpenAirDoor(true);
    };

    const onTableChange: TableProps<AirDoorRecord>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize
        });
    };

    const handleModifyAirDoor = (record: AirDoorRecord) => {
        setIsModify(true);
        setModifyRow(record);
        setOpenAirDoor(true);
    };

    // 风淋门开门 / 关门（需在弹窗中选择前门 / 后门）
    const handleOpenControl = (key: string, deviceKey: string) => {
        setCurDeviceKey(deviceKey);
        setCurrentControlKey(key);
        setOpenControl(true);
    };

    // 风淋门风淋操作（无需选择门类型，点击菜单直接触发）
    const handleShower = (deviceKey: string) => {
        shower({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("风淋门风淋成功"));
            } else {
                message.warning(t("风淋门风淋出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("风淋门风淋出错") + err?.message);
            }
        })
    };

    // 清除占用风淋门车辆（无需选择门类型，点击菜单直接触发）
    const handleClearAirShowerDoorOccupy = (deviceKey: string) => {
        clearAirShowerDoorOccupy({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("清除占用风淋门车辆成功"));
            } else {
                message.warning(t("清除占用风淋门车辆出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("清除占用风淋门车辆出错") + err?.message);
            }
        })
    };

    const handleMenuClick = ({ key }: MenuInfo, record: AirDoorRecord) => {
        const { deviceKey } = record;
        if (!deviceKey) return;
        switch (key) {
            case "shower":
                handleShower(deviceKey);
                break;
            case "openDoor":
                handleOpenControl(key, deviceKey);
                break;
            case "closeDoor":
                handleOpenControl(key, deviceKey);
                break;
            case "clearAirShowerDoorOccupy":
                handleClearAirShowerDoorOccupy(deviceKey);
                break;
            default:
                break;
        }
    };

    // 删除风淋门
    const onDeleteconfirm = (record: AirDoorRecord) => {
        const { deviceKey } = record;
        if (!deviceKey) return;
        deleteAirShowerDoor({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                refreshAirShowerDoorList();
                message.success(t("删除风淋门成功"));
            } else {
                message.warning(t("删除风淋门出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除风淋门出错") + err?.message);
            }
        })
    };

    const handleAirDoorState = (record: AirDoorRecord) => {
        const { deviceKey } = record;
        getAirShowerDoorState({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: AirDoorState = res?.data;
                const items = convertAirDoorStateToDescription(data);
                /* 将风淋门状态描述列表的标签与字符串型取值翻译为当前语言 */
                setAirDoorState(items.map(item => ({
                    ...item,
                    label: t(item.label as string),
                    children: typeof item.children === "string" ? t(item.children) : item.children
                })));
            } else {
                message.warning(t("查询风淋门状态出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询风淋门状态出错") + err?.message);
            }
        })
    };

    const columns: TableProps<AirDoorRecord>["columns"] = [
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
            title: t("设备状态"),
            dataIndex: "deviceStatus",
            render: (value) => value ? t("启用") : t("禁用"),
            ellipsis: { showTitle: true }
        },
        {
            title: t("风淋状态"),
            dataIndex: "showerStatus",
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
        /**
         * 设备配置统一使用 JSON 查看器渲染，列表中保留紧凑预览。
         * 完整内容与复制能力由查看器内部负责，避免页面重复维护弹层逻辑。
         */
        {
            title: t("设备配置"),
            dataIndex: "deviceConfig",
            render: (value: AirDoorRecord["deviceConfig"]) => <JsonViewer data={value} />,
            ellipsis: { showTitle: false }
        },
        /**
         * 网络状态由分页接口直接提供，展示层仅负责映射为统一语义徽标。
         * 固定列宽可避免状态文案挤压设备配置与右侧操作区域。
         */
        {
            title: t("网络状态"),
            dataIndex: "onlineState",
            width: 120,
            align: "center",
            render: (value: AirDoorRecord["onlineState"]) => <NetworkStateTag state={value} />
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
                        title={t("风淋门状态")}
                        trigger={["click"]}
                        content={
                            <Descriptions
                                style={{ width: 200 }}
                                size="small"
                                column={1}
                                items={airDoorState}
                            />
                        }
                    >
                        <Button
                            type="primary"
                            onClick={() => handleAirDoorState(record)}
                        >
                            {t("状态")}
                        </Button>
                    </Popover>
                    {/* 编辑：无 device:air-shower-door:update 权限隐藏（操作列单项隐藏，保留空列 §7.2） */}
                    {hasPerm(PERM_BUTTON.DEVICE_AIR_SHOWER_DOOR_UPDATE) && (
                        <Button
                            type="primary"
                            onClick={() => handleModifyAirDoor(record)}
                        >
                            {t("编辑")}
                        </Button>
                    )}
                    {/* 删除：无 device:air-shower-door:delete 权限隐藏（§7.2） */}
                    {hasPerm(PERM_BUTTON.DEVICE_AIR_SHOWER_DOOR_DELETE) && (
                        <Popconfirm
                            title={t("删除")}
                            description={t("确定删除当前风淋门?")}
                            onConfirm={() => onDeleteconfirm(record)}
                            okText={t("确定")}
                            cancelText={t("取消")}
                        >
                            <Button color="danger" variant="outlined">
                                {t("删除")}
                            </Button>
                        </Popconfirm>
                    )}
                    {/*
                     * 操作项 Dropdown（粗粒度码）：风淋/开门/关门/清除占用等设备控制操作
                     * 无 device:air-shower-door:operate 权限隐藏入口，子项不再细分（§7.2/§7.4）
                     */}
                    {hasPerm(PERM_BUTTON.DEVICE_AIR_SHOWER_DOOR_OPERATE) && (
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
                </Space>
            ),
            ellipsis: { showTitle: true }
        }
    ];

    useEffect(() => {
        getAirShowerDoorDrivers().then(res => {
            if (res.code === 200 && res.message === "success") {
                setAirDoorDrivers(res?.data || []);
            } else {
                message.warning(t("查询风淋门驱动出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询风淋门驱动出错") + err?.message);
            }
        })
    }, [])

    useEffect(() => {
        refreshAirShowerDoorList();
    }, [searchParams])

    return (
        <div className={styles.air_shower_door}>
            <div className={styles.shower_actions}>
                <Search
                    style={{ width: 300 }}
                    placeholder={t("根据(名称/标识)查询")}
                    onSearch={onAirShowerDoorSearch}
                    enterButton
                />
                <Space>
                    {/*
                     * 新增设备：无 device:air-shower-door:add 权限条件渲染隐藏（§7.1）
                     */}
                    {hasPerm(PERM_BUTTON.DEVICE_AIR_SHOWER_DOOR_ADD) && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleOpenAirShower}
                        >
                            {t("新增设备")}
                        </Button>
                    )}
                </Space>
            </div>
            <Table<AirDoorRecord>
                columns={columns}
                dataSource={airShowerDoors}
                loading={tableLoading}
                rowKey={r => r.deviceKey}
                scroll={{ x: 800, y: "calc(100vh - 320px)" }}
                pagination={{
                    ...paginationProps,
                    showSizeChanger: true,
                    hideOnSinglePage: false,
                    responsive: true,
                    showTotal: (total) => t("总数{total}条", { total })
                }}
                onChange={onTableChange}
            />
            <AirDoorModal
                open={openAirDoor}
                isModify={isModify}
                modifyRow={modifyRow}
                airDoorDrivers={airDoorDrivers}
                setModifyRow={setModifyRow}
                setOpenAirDoor={setOpenAirDoor}
                refreshAirShowerDoorList={refreshAirShowerDoorList}
            />
            <ControlModal
                open={openControl}
                curDeviceKey={curDeviceKey}
                currentControlKey={currentControlKey}
                setOpenControl={setOpenControl}
            />
        </div>
    )
};
