/**
 * @description 车辆管理里面的分组管理
 * @date 2025-6-5
 */
import { useState, useEffect } from "react";
import { Table, Input, Space, Button, message, Tag, Popconfirm } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { TableColumnsType, GetProps, TableProps, TablePaginationConfig } from "antd";
import styles from "./index.less";
import GroupModal from "./GroupModal";
import type { VehicleGroupParams, VehicleGroupResult, Records, VehicleGroupForm } from "@/types/VehicleDeploy/GroupType";
import { pageVehicleGroups, deleteVehicleGroup } from "@/api";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

const { Search } = Input;

type SearchProps = GetProps<typeof Input.Search>;

export default () => {

    /* 国际化翻译方法，用于将车辆分组管理的所有文案进行多语言转换 */
    const { t } = useI18n();

    /* 按钮级权限判定（SPEC §8.1）：新增/编辑/删除分组 */
    const { hasPerm } = useAccess();
    const canAdd = hasPerm(PERM_BUTTON.VEHICLE_GROUP_ADD); // 新增分组（§7.1）
    const canUpdate = hasPerm(PERM_BUTTON.VEHICLE_GROUP_UPDATE); // 编辑分组（§7.2）
    const canDelete = hasPerm(PERM_BUTTON.VEHICLE_GROUP_DELETE); // 删除分组（§7.2）

    const [openModal, setOpenModal] = useState<boolean>(false);
    // 车辆分组表格数据
    const [vehicleGroups, setVehicleGroups] = useState<Records[]>([]);
    // 查询参数
    const [searchParams, setSearchParams] = useState<VehicleGroupParams>({
        query: "",
        pageNo: 1,
        pageSize: 10
    });
    // 页码参数
    const [paginationParams, setPaginationParams] = useState<TablePaginationConfig>({
        current: 1,
        pageSize: 10,
        total: 0
    });
    // 当前是不是在编辑分组
    const [isModify, setIsModify] = useState<boolean>(false);
    // 编辑Row的数据
    const [modifyRow, setModifyRow] = useState<VehicleGroupForm>({
        groupName: "",
        vehicleKeys: []
    });
    const [tableLoading, setTableLoading] = useState<boolean>(false);

    const getVehicleGroups = () => {
        setTableLoading(true);
        pageVehicleGroups(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: VehicleGroupResult = res.data;
                const { total, size, current, records } = data;
                setVehicleGroups(records);
                setPaginationParams({
                    current,
                    pageSize: size,
                    total
                });
            } else {
                message.warning(t("查询车辆分组失败") + res?.message);
            }
            setTableLoading(false);
        }).catch(err => {
            if (err) {
                setTableLoading(false);
                message.error(t("查询车辆分组失败") + err?.message);
            }
        })
    };

    const onGroupSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            pageNo: 1,
            query: value
        });
    };

    const handleAddGroup = () => {
        setIsModify(false);
        setOpenModal(true);
    };

    // 表格事件改变
    const onTableChange: TableProps<Records>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize
        });
    };

    // 删除事件
    const onConfirmDelete = (key: string) => {
        deleteVehicleGroup({ key }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getVehicleGroups();
                message.success(t("删除车辆分组成功"));
            } else {
                message.warning(t("删除车辆分组出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除车辆分组出错") + err?.message);
            }
        })
    };

    // 点击编辑
    const handleOpenModify = (record: Records) => {
        if (!record) return;
        const vehicleKeys = record.simpleAGVs.map(agv => agv.key);
        setOpenModal(true);
        setIsModify(true);
        setModifyRow({
            groupKey: record.agvGroupKey,
            groupName: record.agvGroupName,
            vehicleKeys
        });
    };

    const columns: TableColumnsType<Records> = [
        {
            title: t("分组名称"),
            dataIndex: "agvGroupName",
            ellipsis: { showTitle: true }
        },
        {
            title: t("标识"),
            dataIndex: "agvGroupKey",
            ellipsis: { showTitle: true }
        },
        {
            title: t("创建时间"),
            dataIndex: "createTime",
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            fixed: "right",
            render: (_, record) => (
                <Space>
                    {/* 编辑分组：无权限隐藏（§7.2） */}
                    {canUpdate && (
                        <Button type="primary" onClick={() => handleOpenModify(record)}>{t("编辑")}</Button>
                    )}
                    {/* 删除分组：无权限隐藏（§7.2） */}
                    {canDelete && (
                        <Popconfirm
                            title={t("删除")}
                            description={t("确认删除此项?")}
                            okText={t("确定")}
                            cancelText={t("取消")}
                            onConfirm={() => onConfirmDelete(record.agvGroupKey)}
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
        getVehicleGroups();
    }, [searchParams])

    return (
        <div className={styles.group_table}>
            <div className={styles.group_header}>
                <div className={styles.search}>
                    <Search
                        placeholder={t("根据(名称/标识)查询")}
                        onSearch={onGroupSearch}
                        enterButton
                    />
                </div>
                <div className={styles.actions}>
                    <Space>
                        {/* 新增分组：无权限隐藏（§7.1） */}
                        {canAdd && (
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleAddGroup}
                            >
                                {t("新增分组")}
                            </Button>
                        )}
                    </Space>
                </div>
            </div>
            <Table<Records>
                columns={columns}
                expandable={{
                    expandedRowRender: (record) => (
                        <Space wrap>
                            {
                                record.simpleAGVs.map(agv => (
                                    <Tag color="#1677FF">{agv?.name}</Tag>
                                ))
                            }
                        </Space>
                    ),
                    rowExpandable: (record) => record.simpleAGVs?.length !== 0,
                }}
                indentSize={30}
                loading={tableLoading}
                dataSource={vehicleGroups}
                rowKey={r => r.agvGroupKey}
                scroll={{ x: 600, y: "calc(100vh - 320px)" }}
                pagination={{
                    ...paginationParams,
                    hideOnSinglePage: false,
                    showSizeChanger: true,
                    showTotal: (total) => t("总数{total}条", { total })
                }}
                onChange={onTableChange}
            />
            <GroupModal
                open={openModal}
                isModify={isModify}
                modifyRow={modifyRow}
                setOpenModal={setOpenModal}
                getVehicleGroups={getVehicleGroups}
            />
        </div>
    )
};
