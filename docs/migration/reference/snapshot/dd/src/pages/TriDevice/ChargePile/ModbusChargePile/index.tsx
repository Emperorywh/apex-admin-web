/**
 * @description modbus充电桩
 * @date 2026-1-21
 */
import { useState, useEffect } from "react";
import { Input, Space, Button, Table, message, Popconfirm, Dropdown } from "antd";
import type { GetProps, TableProps, PaginationProps } from "antd";
import { pageChargePiles, deleteChargePile, startCharge, stopCharge, getChargePileDrivers } from "@/api";
import styles from "./index.less";
import type { SearchType, ResponseType } from "@/types/typing";
import type { ChargePileRecord, ChargeDriver } from "@/types/TriDevice/ModbusChargePie";
import ChargePileModal from "./ChargePileModal";
import { ChargeState } from "@/utils/enum";
import { chargePileCommands } from "@/constants/chargePile";
import { MenuInfo } from "@/types/OrderRecord";
import JsonViewer from "@/components/JsonViewer";
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
    const [chargeRecords, setChargeRecords] = useState<ChargePileRecord[]>([]);
    // 弹窗
    const [openModal, setOpenModal] = useState<boolean>(false);
    // 当前要编辑的数据
    const [modifyCharge, setModifyCharge] = useState<ChargePileRecord>();
    // 充电桩驱动
     const [chargeDrivers, setChargeDrivers] = useState<ChargeDriver[]>([]);

    // 查询数据
    const getChargePiles = () => {
        pageChargePiles(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: ResponseType<ChargePileRecord> = res?.data;
                const { records, size, total, current } = data;
                setChargeRecords(records);
                setPaginationProps({
                    current,
                    pageSize: size,
                    total
                });
            } else {
                message.warning(t("查询充电桩出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询充电桩出错") + err?.message);
            }
        })
    };

    // 查询事件
    const onSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            pageNo: 1,
            query: value
        });
    };

    // 表格的改变事件
    const onTableChange: TableProps<ChargePileRecord>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize
        });
    };

    // 新增充电桩
    const handleOpenModal = () => {
        setModifyCharge(undefined);
        setOpenModal(true);
    };

    // 编辑充电桩
    const handleUpdateCharge = (record: ChargePileRecord) => {
        setModifyCharge(record);
        setOpenModal(true);
    };

    // 删除充电桩
    const onDeleteConfirm = (record: ChargePileRecord) => {
        const { deviceKey } = record;
        deleteChargePile({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getChargePiles();
                message.success(t("删除当前充电桩成功"));
            } else {
                message.warning(t("删除当前充电桩出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除当前充电桩出错") + err?.message);
            }
        })
    };

    // 开始充电
    const handleStartCharge = (deviceKey: string) => {
        startCharge({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getChargePiles();
                message.success(t("开始充电成功"));
            } else {
                message.warning(t("开始充电出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("开始充电出错") + err?.message);
            }
        })
    };

    // 停止充电
    const handleStopCharge = (deviceKey: string) => {
        stopCharge({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getChargePiles();
                message.success(t("停止充电成功"));
            } else {
                message.warning(t("停止充电出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("停止充电出错") + err?.message);
            }
        })
    };

    // 充电桩的操作
    const onCommandClick = ({ key }: MenuInfo, record: ChargePileRecord) => {
        const { deviceKey } = record;
        switch (key) {
            case "startCharge":
                handleStartCharge(deviceKey);
                break;
            case "stopCharge":
                handleStopCharge(deviceKey);
                break;
            default:
                break;
        }
    };

    const columns: TableProps<ChargePileRecord>["columns"] = [
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
            title: t("关联的驱动"),
            dataIndex: "driverKey",
            render: (value) => chargeDrivers?.find(d => d.key === value)?.name || "",
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
            title: t("设备配置信息"),
            dataIndex: "deviceConfig",
            render: (value) => <JsonViewer data={value} />,
            ellipsis: { showTitle: true }
        },
        {
            title: t("充电桩状态"),
            dataIndex: "deviceChargePileState",
            render: (value) => {
                const state = ChargeState[value?.chargePileState?.state as keyof typeof ChargeState];
                return state ? t(state) : "";
            },
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            width: 300,
            fixed: "right",
            render: (_, record) => (
                <Space>
                    {/*
                     * 操作 Dropdown（粗粒度码）：开始/停止充电等设备控制操作
                     * 无 device:charge-pile:operate 权限隐藏入口，子项不再细分（§7.2/§7.4）
                     */}
                    {hasPerm(PERM_BUTTON.DEVICE_CHARGE_PILE_OPERATE) && (
                        <Dropdown
                            menu={{
                                items: chargePileCommands?.map(op => op && "label" in op ? { ...op, label: t(op.label as string) } : op),
                                onClick: (e) => onCommandClick(e, record)
                            }}
                        >
                            <Button type="primary">
                                {t("操作")}
                            </Button>
                        </Dropdown>
                    )}
                    {/* 编辑：无 device:charge-pile:update 权限隐藏（操作列单项隐藏，保留空列 §7.2） */}
                    {hasPerm(PERM_BUTTON.DEVICE_CHARGE_PILE_UPDATE) && (
                        <Button
                            type="primary"
                            onClick={() => handleUpdateCharge(record)}
                        >
                            {t("编辑")}
                        </Button>
                    )}
                    {/* 删除：无 device:charge-pile:delete 权限隐藏（§7.2） */}
                    {hasPerm(PERM_BUTTON.DEVICE_CHARGE_PILE_DELETE) && (
                        <Popconfirm
                            title={t("删除")}
                            description={t("确定删除当前项吗?")}
                            onConfirm={() => onDeleteConfirm(record)}
                            okText={t("确定")}
                            cancelText={t("取消")}
                        >
                            <Button danger>{t("删除")}</Button>
                        </Popconfirm>
                    )}
                </Space>
            ),
            ellipsis: { showTitle: true }
        },
    ];

    useEffect(() => {
        getChargePiles();
    }, [searchParams])

    useEffect(() => {
        getChargePileDrivers().then(res => {
            if (res.code === 200 && res.message === "success") {
                setChargeDrivers(res?.data || []);
            } else {
                message.warning(t("查询充电桩驱动出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询充电桩驱动出错") + err?.message);
            }
        })
    }, [])

    return (
        <div className={styles.charge_pie}>
            <div className={styles.search}>
                <Search
                    placeholder={t("请输入设备名称查询")}
                    style={{ width: 360 }}
                    enterButton
                    onSearch={onSearch}
                />
                <Space>
                    {/* 新增充电桩：无 device:charge-pile:add 权限条件渲染隐藏（§7.1） */}
                    {hasPerm(PERM_BUTTON.DEVICE_CHARGE_PILE_ADD) && (
                        <Button type="primary" onClick={handleOpenModal}>{t("新增充电桩")}</Button>
                    )}
                </Space>
            </div>
            <Table<ChargePileRecord>
                columns={columns}
                dataSource={chargeRecords}
                scroll={{ x: 1500, y: "calc(100vh - 320px)" }}
                rowKey={r => r.id as unknown as string}
                pagination={{
                    ...paginationProps,
                    showSizeChanger: true,
                    hideOnSinglePage: false,
                    showTotal: total => t("总数{total}条", { total })
                }}
                onChange={onTableChange}
            />
            <ChargePileModal
                open={openModal}
                modifyCharge={modifyCharge}
                chargeDrivers={chargeDrivers}
                setOpenModal={setOpenModal}
                getChargePiles={getChargePiles}
                setModifyCharge={setModifyCharge}
            />
        </div>
    )
};
