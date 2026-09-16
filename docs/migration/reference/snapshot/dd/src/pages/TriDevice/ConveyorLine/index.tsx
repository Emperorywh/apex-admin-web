/**
 * @description 输送线信息
 * @date 2026-2-10
 */
import { useState, useEffect } from "react";
import { Input, Space, Button, Table, message, Popconfirm, Popover, Descriptions } from "antd";
import type { GetProps, TableProps, PaginationProps } from "antd";
import styles from "./index.less";
import { pageConveyorLines, getConveyorLineDrivers, deleteConveyorLine, getConveyLineState } from "@/api";
import type { SearchType, ResponseType } from "@/types/typing";
import type { LineRecord, LineDriver, LineState } from "@/types/TriDevice/ConveyorLine";
import ConveyorLineModal from "./ConveyorLineModal";
import { useI18n } from "@/hooks/useI18n";

type SearchProps = GetProps<typeof Input.Search>;

const { Search } = Input;

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();

    // 查询参数
    const [searchParams, setSearchParams] = useState<SearchType>({
        pageNo: 1,
        pageSize: 10,
        query: ""
    });
    // 分页数据
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        current: 1,
        pageSize: 10,
        total: 0
    });
    // 表格数据
    const [conveyorLines, setConveyorLines] = useState<LineRecord[]>([]);
    // 输送线弹窗
    const [openModal, setOpenModal] = useState<boolean>(false);
    // 输送线驱动
    const [conveyorLineDrivers, setConveyorLineDrivers] = useState<LineDriver[]>([]);
    // 编辑的输送线
    const [modifyLine, setModifyLine] = useState<LineRecord>();
    // 输送线状态
    const [conveyorState, setConveyorState] = useState<LineState>();

    // 查询输送线
    const getConveyorLines = () => {
        pageConveyorLines(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: ResponseType<LineRecord> = res?.data;
                const { records, size, current, total } = data;
                setConveyorLines(records);
                setPaginationProps({
                    current,
                    pageSize: size,
                    total
                });
            } else {
                message.warning(t("查询输送线出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询输送线出错") + err?.message);
            }
        })
    };

    // 搜索事件
    const onSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            pageNo: 1,
            query: value
        });
    };

    // 表格的改变事件
    const onTableChange: TableProps<LineRecord>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize
        });
    };

    // 新增输送线
    const handleOpenModal = () => {
        setModifyLine(undefined);
        setOpenModal(true);
    };

    // 编辑输送线
    const handleModifyLine = (record: LineRecord) => {
        setModifyLine(record);
        setOpenModal(true);
    };

    // 删除输送线
    const onDeleteConfirm = (record: LineRecord) => {
        const { deviceKey } = record;
        deleteConveyorLine({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getConveyorLines();
                message.success(t("删除输送线成功"));
            } else {
                message.warning(t("删除输送线出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除输送线出错") + err?.message);
            }
        })
    };

    const getConveyorState = (record: LineRecord) => {
        const { deviceKey } = record;
        getConveyLineState({ deviceKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data = res?.data;
                setConveyorState(data);
            } else {
                message.warning(t("查询输送线出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询输送线出错") + err?.message);
            }
        })
    };

    const columns: TableProps<LineRecord>["columns"] = [
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
            title: t("设备驱动"),
            dataIndex: "driverKey",
            render: (value) => conveyorLineDrivers.find(val => val.clazz === value)?.name || "",
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
            render: (value) => (
                <Descriptions
                    items={
                        Object.entries(value || {}).map(([key, value]) => ({
                            key,
                            label: key,
                            children: value
                        })) as []
                    }
                />
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            fixed: "right",
            width: 300,
            render: (_, record) => (
                <Space>
                    <Popover content={
                        <div>
                            <p>{t("是否故障")}：{conveyorState?.fault ? t("是") : t("否")}</p>
                            <p>{t("是否允许进入")}{conveyorState?.allowEntry ? t("是") : t("否")}</p>
                        </div>
                    } title={t("状态")} trigger="click">
                        <Button
                            type="primary"
                            onClick={() => getConveyorState(record)}
                        >
                            {t("查看状态")}
                        </Button>
                    </Popover>

                    <Button
                        type="primary"
                        onClick={() => handleModifyLine(record)}
                    >
                        {t("编辑")}
                    </Button>
                    <Popconfirm
                        title={t("删除")}
                        description={t("确认删除当前项?")}
                        onConfirm={() => onDeleteConfirm(record)}
                    >
                        <Button danger>{t("删除")}</Button>
                    </Popconfirm>
                </Space>
            ),
            ellipsis: { showTitle: true }
        },
    ];

    useEffect(() => {
        getConveyorLines();
    }, [searchParams])

    useEffect(() => {
        getConveyorLineDrivers().then(res => {
            if (res.code === 200 && res.message === "success") {
                setConveyorLineDrivers(res?.data || []);
            } else {
                message.warning(t("查询输送线驱动出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询输送线驱动出错") + err?.message);
            }
        })
    }, [])

    return (
        <div className={styles.conveyor_line}>
            <div className={styles.search}>
                <Search
                    style={{ width: 360 }}
                    placeholder={t("请输入输送线名称查询")}
                    onSearch={onSearch}
                    enterButton
                />
                <Space>
                    <Button
                        type="primary"
                        onClick={handleOpenModal}
                    >
                        {t("新增输送线")}
                    </Button>
                </Space>
            </div>
            <Table<LineRecord>
                dataSource={conveyorLines}
                columns={columns}
                rowKey={r => r.deviceKey}
                scroll={{ x: 1000, y: "calc(100vh - 280px)" }}
                pagination={{
                    ...paginationProps,
                    showSizeChanger: true,
                    hideOnSinglePage: false,
                    showTotal: total => t("总数{total}条", { total })
                }}
                onChange={onTableChange}
            />
            <ConveyorLineModal
                open={openModal}
                modifyLine={modifyLine}
                conveyorLineDrivers={conveyorLineDrivers}
                setOpenModal={setOpenModal}
                setModifyLine={setModifyLine}
                getConveyorLines={getConveyorLines}
            />
        </div>
    )
};
