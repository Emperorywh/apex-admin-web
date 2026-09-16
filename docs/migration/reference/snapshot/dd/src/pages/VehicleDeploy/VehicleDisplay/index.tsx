/**
 * @description 车辆的表格组件
 * @date 2025-6-4
 */
import { useState, useEffect } from "react";
import { Table, Space, Button, Input, Popconfirm, message, Tag, Switch, Dropdown } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import styles from "./index.less";
import type { TableProps, GetProps, TablePaginationConfig, MenuProps, DescriptionsProps } from "antd";
import VehicleModal from "./VehicleModal";
import { pageVehicles, deleteVehicle, updateVehicle, allVehicleOperate, vehicleOperate, getUnRelationSimpleVehicles } from "@/api";
import type { QueryVehiclesParams, VehicleResultData, Records, VehicleForm as VehicleFormTypes, AllVehicleOperate, VehicleOperate, UnRelationSimpleVehicle } from "@/types/VehicleDeploy/VehicleType";
import VehicleDrawer from "./VehicleDrawer";
import { shuttleActions, vehicleActions } from "@/constants/vehicle";
import { agvTypes, eStops } from "@/constants/vehicle";
import { MenuInfo } from "rc-menu/lib/interface";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

type SearchProps = GetProps<typeof Input.Search>;

const { Search } = Input;

export default () => {

    /* 国际化翻译方法，用于将车辆列表的所有文案进行多语言转换 */
    const { t } = useI18n();

    /* 按钮级权限判定（SPEC §8.1）：动作触发型无权限隐藏、调度状态 Switch 用 disabled */
    const { hasPerm } = useAccess();
    const canAdd = hasPerm(PERM_BUTTON.VEHICLE_LIST_ADD); // 新增车辆（§7.1）
    const canUpdate = hasPerm(PERM_BUTTON.VEHICLE_LIST_UPDATE); // 编辑车辆（§7.2）
    const canDelete = hasPerm(PERM_BUTTON.VEHICLE_LIST_DELETE); // 删除车辆（§7.2）
    const canOperate = hasPerm(PERM_BUTTON.VEHICLE_LIST_OPERATE); // 行级操作 Dropdown（§7.2/§7.4 粗粒度码）
    const canEnable = hasPerm(PERM_BUTTON.VEHICLE_LIST_ENABLE); // 调度状态 Switch（§7.3 disabled）
    const canBatchOperate = hasPerm(PERM_BUTTON.VEHICLE_LIST_BATCH_OPERATE); // 一键操作 Dropdown（§7.1/§7.5）

    /**
     * 格式化坐标/速度等数值分量
     * 后端返回的 x、y、theta、vx、vy、omega 等字段类型声明为 number，
     * 但运行时实际可能为 null/undefined，直接调用 toFixed 会抛出 TypeError 导致页面崩溃，
     * 故在此统一做容错：非有效数值时以占位符 "--" 展示
     */
    const formatNum = (val: number | null | undefined): string =>
        val == null ? "--" : val.toFixed(3);

    // 弹窗
    const [openModal, setOpenModal] = useState<boolean>(false);
    // 表格数据
    const [tableVehicles, setTableVehicles] = useState<Records[]>([]);
    // 表格的Loading
    const [loading, setLoading] = useState<boolean>(false);
    // 查询需要用到的参数
    const [searchParams, setSearchParams] = useState<QueryVehiclesParams>({
        pageSize: 10,
        pageNo: 1,
        query: ""
    })
    // 页码需要用到的数据
    const [paginationParams, setPaginationParams] = useState<TablePaginationConfig>({
        // 一页展示的数量
        pageSize: 10,
        // 总数
        total: 0,
        // 当前第几页
        current: 1
    });

    // 编辑的表格行
    const [modifyRow, setModifyRow] = useState<VehicleFormTypes>();

    // 当前是不是编辑表格
    const [isModify, setIsModify] = useState<boolean>(false);

    // 详情的抽屉
    const [openDrawer, setOpenDrawer] = useState<boolean>(false);
    // 当前点击的车辆详情row
    const [vehicleInfo, setVehicleInfo] = useState<DescriptionsProps["items"]>([]);
    // 关联上报车辆
    const [unRelativeVehicles, setUnRelativeVehicles] = useState<UnRelationSimpleVehicle[]>([]);

    // 跨页勾选的车辆 key 集合（受控），配合 preserveSelectedRowKeys 在翻页/查询替换数据源后仍保留已选项
    const [selectedVehicleKeys, setSelectedVehicleKeys] = useState<string[]>([]);

    /**
     * 表格行勾选配置：
     * - 表头勾选框仅作用于当前页，选中项跨页累计保留
     * - selections 下拉自定义"全选/清空"文案走 t() 国际化，
     *   不启用 antd 内置 selections（ConfigProvider locale 硬编码 zh-cn，英文环境会露出中文）
     * - "全选"为合并式：追加当前页到既有已选，不清掉其他页已勾选的行
     */
    const rowSelection: TableProps<Records>["rowSelection"] = {
        type: "checkbox",
        selectedRowKeys: selectedVehicleKeys,
        preserveSelectedRowKeys: true,
        onChange: (keys) => setSelectedVehicleKeys(keys as string[]),
        selections: [
            {
                key: "selectAll",
                text: t("全选"),
                onSelect: (changableRowKeys) => {
                    setSelectedVehicleKeys(Array.from(new Set([...selectedVehicleKeys, ...(changableRowKeys as string[])])));
                }
            },
            {
                key: "selectNone",
                text: t("清空"),
                onSelect: () => setSelectedVehicleKeys([])
            }
        ]
    };

    // 查询表格数据
    const getPageVehicles = (params: QueryVehiclesParams) => {
        setLoading(true);
        pageVehicles(params).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: VehicleResultData = res.data || [];
                const { records, size, total, current } = data;
                setTableVehicles(records || []);
                // 设置分页信息
                setPaginationParams({
                    pageSize: size,
                    total,
                    current
                });
            } else {
                message.warning(t("查询车辆出错") + res?.message);
            }
            setLoading(false);
        }).catch(err => {
            if (err) {
                setLoading(false);
                message.error(t("查询车辆出错") + err?.message);
            }
        })
    };

    // 查询未管理的上报车辆
    const getUnRelationVehicles = () => {
        getUnRelationSimpleVehicles().then(res => {
            if (res.code === 200 && res.message === "success") {
                setUnRelativeVehicles(res?.data || []);
            } else {
                message.warning(t("查询未加入到调度系统的车辆出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询未加入到调度系统的车辆出错") + err?.message);
            }
        })
    };

    // 查询车辆
    const onVehicleSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            pageNo: 1,
            query: value
        });
    };

    // 打开新增车辆的弹窗
    const handleAddVehicle = () => {
        setModifyRow(undefined);
        setIsModify(false);
        setOpenModal(true);
    };

    // 分页改变的事件
    const onTableChange: TableProps<Records>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize
        });
    };

    // 删除车辆
    const onConfirmDeleteVehicle = (record: Records) => {
        const { key } = record;
        if (!key) return;
        deleteVehicle({ key }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getPageVehicles(searchParams);
                getUnRelationVehicles();
                message.success(t("删除车辆成功"));
                // 被删车辆若在跨页勾选集中需同步移除，避免残留失效 key 传给批量操作接口
                setSelectedVehicleKeys(prev => prev.filter(k => k !== key));
            } else {
                message.warning(t("删除车辆失败") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除车辆失败") + err?.message);
            }
        })
    };

    // 点击编辑车辆
    const handleEditVehicle = (record: Records) => {
        if (!record) return;
        const { key, name, vehicleType, agvDimension: { width, length, loadWidth, loadLength, centerOffset}, dispatchState } = record;
        setModifyRow({
            agvKey: key,
            agvName: name,
            agvType: vehicleType,
            length,
            width,
            loadLength,
            loadWidth,
            centerOffset,
            dispatchState
        });
        setIsModify(true);
        setOpenModal(true);
    };

    // 切换调度状态
    const onDispatchStateChange = (record: Records) => {
        if (!record?.key) return;
        const { key, name, vehicleType, agvDimension: { width, length, loadWidth, loadLength, centerOffset}, dispatchState } = record;
        const data: VehicleFormTypes = {
            agvKey: key,
            agvName: name,
            agvType: vehicleType,
            length,
            width,
            loadLength,
            loadWidth,
            centerOffset,
            dispatchState: dispatchState === "ENABLE" ? "DISABLE" : "ENABLE"
        };
        updateVehicle(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("编辑车辆成功") + res?.message);
                getPageVehicles(searchParams);
            } else {
                message.warning(t("编辑车辆出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("编辑车辆出错") + err?.message);
            }
        })
    };

    // 打开车辆详情抽屉
    const handleOpenDrawer = (record: Records) => {
        const {
            key,
            name,
            vehicleType,
            dispatchState,
            connectionState,
            createTime,
            state
        } = record;
        setVehicleInfo([
            {
                key: name,
                label: t("名称"),
                children: name
            },
            {
                key,
                label: t("唯一标识"),
                children: key
            },
            {
                key: vehicleType,
                label: t("类型"),
                children: t(agvTypes?.find(agv => agv.value === vehicleType)?.label as string || "")
            },
            {
                key: "dispatchState",
                label: t("调度状态"),
                children: dispatchState === 'ENABLE' ? t('启用') : t('禁用')
            },
            {
                key: state.agvPosition.mapDescription,
                label: t("地图"),
                children: state.agvPosition.mapDescription
            },
            {
                key: state.agvPosition.localizationScore,
                label: t("定位置信度"),
                children: state.agvPosition.localizationScore
            },
            {
                key: "agvPosition",
                label: t("坐标"),
                children: `[${formatNum(state.agvPosition.x)}, ${formatNum(state.agvPosition.y)}, ${formatNum(state.agvPosition.theta)}]`
            },
            {
                key: "velocity",
                label: t("速度"),
                children: `[${formatNum(state.velocity.vx)}, ${formatNum(state.velocity.vy)}, ${formatNum(state.velocity.omega)}]`
            },
            {
                key: "loads",
                label: t("是否载货"),
                children: state.loads.some(element => element) ? t('是') : t('否')
            },
            {
                key: "paused",
                label: t("是否暂停"),
                children: state.paused ? t('是') : t('否')
            },
            {
                key: "connectionState",
                label: t("网络状态"),
                children: connectionState === 'ONLINE' ? t('在线') : t('离线')
            },
            {
                key: "batteryCharge",
                label: t("剩余电量"),
                children: state.batteryState.batteryCharge
            },
            {
                key: "charging",
                label: t("充电中"),
                children: state.batteryState.charging ? t("是") : t("否")
            },
            {
                key: "safety",
                label: t("安全状态"),
                children: t(eStops?.find(eStop => eStop.value === state.safetyState.estop)?.label as string || "")
            },
            {
                key: "orderId",
                label: t("车辆当前订单标识"),
                children: state.orderId
            },
            {
                key: "orderUpdateId",
                label: t("车辆当前订单更新标识"),
                children: state.orderUpdateId
            },
            {
                key: "lastNodeId",
                label: t("车辆当前所在的节点"),
                children: state.lastNodeId
            },
            {
                key: "lastNodeSequenceId",
                label: t("车辆最后节点序列号"),
                children: state.lastNodeSequenceId
            },
            {
                key: "nodeStates",
                label: t("车辆的剩余的点"),
                children: JSON.stringify(state.nodeStates)
            },
            {
                key: "edgeStates",
                label: t("车辆的剩余的边"),
                children: JSON.stringify(state.edgeStates)
            },
            {
                key: "actions",
                label: t("车辆的所有动作状态"),
                children: JSON.stringify(state.actionStates)
            },
            {
                key: state.operatingMode,
                label: t("车辆模式"),
                children: state.operatingMode === 'AUTOMATIC' ? t('自动') : t('手动')
            },
            {
                key: "errors",
                label: t("错误信息"),
                children: JSON.stringify(state.errors)
            },
            {
                key: createTime,
                label: t("创建时间"),
                children: createTime
            },
        ]);
        setOpenDrawer(true);
    };

    // 一键操作
    const onShuttleClick: MenuProps["onClick"] = ({ key }) => {
        /**
         * 勾选了车辆时仅对勾选车辆操作（传 vehicleKeys）；
         * 未勾选时保持原语义——接口不传 vehicleKeys 即对全部车辆操作
         */
        const data: AllVehicleOperate = {
            operate: key as AllVehicleOperate["operate"],
            ...(selectedVehicleKeys.length > 0 ? { vehicleKeys: selectedVehicleKeys } : {})
        };
        allVehicleOperate(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("一键操作成功"));
                // 启用/禁用会改变表格"调度状态"列，操作成功后刷新列表；
                // 勾选集已消费完毕，同步清空避免误作用到下一次操作
                setSelectedVehicleKeys([]);
                getPageVehicles(searchParams);
            } else {
                message.warning(t("一键操作出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("一键操作出错") + err?.message);
            }
        })
    };

    // 车辆列表项的操作
    const onVehicleShuttleClick = ({ key }: MenuInfo, record: Records) => {
        if (!key) return;
        // 菜单 key 为宽泛 string，断言收窄为接口定义的操作类型（与上方一键操作写法一致）
        vehicleOperate({ operate: key as VehicleOperate["operate"], vehicleKey: record.key }).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("车辆操作成功"));
            } else {
                message.warning(t("车辆操作出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("车辆操作出错") + err?.message);
            }
        })
    };

    const columns: TableProps<Records>["columns"] = [
        {
            title: t("车辆名称"),
            dataIndex: "name",
            ellipsis: { showTitle: true }
        },
        {
            title: t("车辆标识"),
            dataIndex: "key",
            ellipsis: { showTitle: true }
        },
        {
            title: t("车辆类型"),
            dataIndex: "vehicleType",
            render: (value) => <span>{value === 1 ? t("叉车") : t("小车")}</span>,
            ellipsis: { showTitle: true }
        },
        {
            title: t("网络状态"),
            dataIndex: "connectionState",
            render: (value) => (
                <Space>
                    <Tag color={value === "ONLINE" ? "#87D068" : "#D50000"}>{value === "ONLINE" ? t("在线") : t("离线")}</Tag>
                </Space>
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("调度状态"),
            dataIndex: "dispatchState",
            render: (value, record) => (
                <Switch
                    value={value === "ENABLE"}
                    // 状态展示型控件（§7.3）：无权限 disabled 而非隐藏，避免该列数据行空荡
                    disabled={!canEnable}
                    onChange={() => onDispatchStateChange(record)}
                />
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("绑定地图"),
            align: "center",
            dataIndex: ["state", "agvPosition", "mapDescription"],
            ellipsis: { showTitle: true }
        },
        {
            title: t("长度(m)"),
            align: "center",
            dataIndex: ["agvDimension", "length"],
            ellipsis: { showTitle: true }
        },
        {
            title: t("宽度(m)"),
            align: "center",
            dataIndex: ["agvDimension", "width"],
            ellipsis: { showTitle: true }
        },
        {
            title: t("载货长度(m)"),
            align: "center",
            dataIndex: ["agvDimension", "loadLength"],
            ellipsis: { showTitle: true }
        },
        {
            title: t("载货宽度(m)"),
            align: "center",
            dataIndex: ["agvDimension", "loadWidth"],
            ellipsis: { showTitle: true }
        },
        {
            title: t("偏移量(m)"),
            align: "center",
            dataIndex: ["agvDimension", "centerOffset"],
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            key: 'action',
            align: "center",
            fixed: "right",
            width: 330,
            render: (_, record) => (
                <Space>
                    {/* 详情：view 行为，不限权 */}
                    <Button type="link" onClick={() => handleOpenDrawer(record)}>{t("详情")}</Button>
                    {/* 编辑车辆：无权限隐藏（§7.2） */}
                    {canUpdate && (
                        <Button type="primary" onClick={() => handleEditVehicle(record)}>{t("编辑")}</Button>
                    )}
                    {/* 行级操作 Dropdown（粗粒度码 G2）：无权限隐藏入口，子项不再细分（§7.4） */}
                    {canOperate && (
                        <Dropdown
                            menu={{
                                items: vehicleActions?.map(op => op && "label" in op ? { ...op, label: t(op.label as string) } : op),
                                onClick: (evt) => onVehicleShuttleClick(evt, record)
                            }}
                        >
                            <Button type="primary">
                                {t("操作")}
                            </Button>
                        </Dropdown>
                    )}
                    {/* 删除车辆：无权限隐藏（§7.2） */}
                    {canDelete && (
                        <Popconfirm
                            title={t("删除车辆")}
                            description={t("确定删除当前车辆?")}
                            onConfirm={() => onConfirmDeleteVehicle(record)}
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
        getPageVehicles(searchParams);
    }, [searchParams])

    return (
        <div className={styles.vehicle_table}>
            <div className={styles.header}>
                <div className={styles.search}>
                    <Search
                        style={{ width: 300 }}
                        placeholder={t("根据(名称/标识)查询")}
                        onSearch={onVehicleSearch}
                        enterButton
                    />
                </div>
                <div className={styles.actions}>
                    <Space>
                        {/* 跨页已选车辆数量提示与清空入口，仅勾选了行时出现 */}
                        {selectedVehicleKeys.length > 0 && (
                            <>
                                <span>{t("已选 {count} 辆", { count: selectedVehicleKeys.length })}</span>
                                <Button onClick={() => setSelectedVehicleKeys([])}>{t("清空")}</Button>
                            </>
                        )}
                        {/* 一键操作 Dropdown（粗粒度码，§7.1/§7.5）：勾选了车辆时仅作用于勾选项，无权限隐藏整个入口 */}
                        {canBatchOperate && (
                            <Dropdown
                                menu={{
                                    items: shuttleActions?.map(op => op && "label" in op ? { ...op, label: t(op.label as string) } : op),
                                    onClick: onShuttleClick
                                }}
                            >
                                <Button type="primary" danger>
                                    {t("一键操作")}
                                </Button>
                            </Dropdown>
                        )}
                        {/* 新增车辆：无权限隐藏（§7.1） */}
                        {canAdd && (
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleAddVehicle}
                            >
                                {t("新增车辆")}
                            </Button>
                        )}
                    </Space>
                </div>
            </div>
            <Table<Records>
                loading={{ spinning: loading, delay: 200 }}
                columns={columns}
                dataSource={tableVehicles}
                rowKey={r => r.key}
                rowSelection={rowSelection}
                scroll={{ x: 1550, y: "calc(100vh - 250px)" }}
                pagination={{
                    ...paginationParams,
                    hideOnSinglePage: false,
                    showSizeChanger: true,
                    responsive: true,
                    showTotal: (total) => t("总数{total}条", { total })
                }}
                onChange={onTableChange}
            />
            <VehicleModal
                open={openModal}
                modifyRow={modifyRow}
                isModify={isModify}
                searchParams={searchParams}
                unRelativeVehicles={unRelativeVehicles}
                setOpenModal={setOpenModal}
                getPageVehicles={getPageVehicles}
                getUnRelationVehicles={getUnRelationVehicles}
            />
            <VehicleDrawer
                open={openDrawer}
                vehicleInfo={vehicleInfo}
                setOpenDrawer={setOpenDrawer}
            />
        </div>
    )
};
