/**
 * @description AGV节点映射页面
 * @date 2026-08-18
 */
import { useState, useEffect } from "react";
import { Table, Input, Space, Button, message, Popconfirm, Tag, Tooltip } from "antd";
import { PlusOutlined, SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import type { TableColumnsType, TableProps, TablePaginationConfig } from "antd";
import styles from "./index.less";
import MappingModal from "./MappingModal";
import type { AGVNodeMapping, AGVNodeMappingPageParam } from "@/types/VehicleDeploy/NodeMappingType";
import { pageAGVNodeMappings, deleteAGVNodeMapping } from "@/api";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

export default () => {
    /* 国际化翻译方法 */ const { t } = useI18n();

    /* 按钮级权限判定（SPEC_node_mapping §6）：新增/编辑/删除节点映射，动作触发型无权限隐藏 */
    const { hasPerm } = useAccess();
    const canAdd = hasPerm(PERM_BUTTON.NODE_MAPPING_ADD); // 新增节点映射
    const canUpdate = hasPerm(PERM_BUTTON.NODE_MAPPING_UPDATE); // 编辑节点映射
    const canDelete = hasPerm(PERM_BUTTON.NODE_MAPPING_DELETE); // 删除节点映射

    /**
     * 弹窗显示状态
     */
    const [openModal, setOpenModal] = useState<boolean>(false);
    /**
     * 表格数据
     */
    const [mappingData, setMappingData] = useState<AGVNodeMapping[]>([]);
    /**
     * 表格加载状态
     */
    const [tableLoading, setTableLoading] = useState<boolean>(false);
    /**
     * 查询参数
     */
    const [searchParams, setSearchParams] = useState<AGVNodeMappingPageParam>({
        pageNo: 1,
        pageSize: 10,
        mappingName: "",
    });
    /**
     * 分页参数
     */
    const [paginationParams, setPaginationParams] = useState<TablePaginationConfig>({
        current: 1,
        pageSize: 10,
        total: 0,
    });
    /**
     * 是否编辑模式
     */
    const [isModify, setIsModify] = useState<boolean>(false);
    /**
     * 编辑行的数据
     */
    const [modifyRow, setModifyRow] = useState<AGVNodeMapping>();

    /**
     * 分页查询节点映射列表
     */
    const getMappingList = (params?: AGVNodeMappingPageParam) => {
        setTableLoading(true);
        pageAGVNodeMappings(params || searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const { records, total, size, current } = res.data;
                setMappingData(records || []);
                setPaginationParams({
                    current,
                    pageSize: size,
                    total,
                });
            } else {
                message.warning(t("查询节点映射失败") + res?.message);
            }
            setTableLoading(false);
        }).catch(err => {
            if (err) {
                setTableLoading(false);
                message.error(t("查询节点映射失败") + err?.message);
            }
        })
    };

    /**
     * 查询关键字暂存（输入时不直接触发查询）
     */
    const [keyword, setKeyword] = useState<string>("");

    /**
     * 点击查询按钮，统一触发搜索
     */
    const onSearch = () => {
        setSearchParams(prev => ({
            ...prev,
            pageNo: 1,
            mappingName: keyword,
        }));
    };

    /**
     * 重置搜索条件
     */
    const onReset = () => {
        setKeyword("");
        setSearchParams({
            pageNo: 1,
            pageSize: 10,
            mappingName: "",
        });
    };

    /**
     * 打开新增弹窗
     */
    const handleAdd = () => {
        setIsModify(false);
        setModifyRow(undefined);
        setOpenModal(true);
    };

    /**
     * 打开编辑弹窗
     */
    const handleEdit = (record: AGVNodeMapping) => {
        if (!record) return;
        setIsModify(true);
        setModifyRow(record);
        setOpenModal(true);
    };

    /**
     * 删除节点映射（按映射唯一key）
     */
    const onConfirmDelete = (record: AGVNodeMapping) => {
        const { mappingKey } = record;
        if (!mappingKey) return;
        deleteAGVNodeMapping({ mappingKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getMappingList();
                message.success(t("删除节点映射成功"));
            } else {
                message.warning(t("删除节点映射失败") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除节点映射失败") + err?.message);
            }
        })
    };

    /**
     * 分页改变事件
     */
    const onTableChange: TableProps<AGVNodeMapping>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize,
        });
    };

    /**
     * 表格列配置
     */
    const columns: TableColumnsType<AGVNodeMapping> = [
        {
            title: t("映射名称"),
            dataIndex: "mappingName",
            ellipsis: { showTitle: true }
        },
        {
            title: t("关联AGV数"),
            align: "center",
            width: 120,
            render: (_, record) => {
                const keys = record.agvKeys ?? [];
                /* key 本身不具备可读性，仅展示数量，完整 key 列表悬浮查看 */
                return keys.length > 0 ? (
                    <Tooltip title={keys.join("、")}>{keys.length}</Tooltip>
                ) : 0;
            },
        },
        {
            title: t("映射地图"),
            render: (_, record) => (
                (record.mapNodeMapping ?? []).map(group => (
                    <Tag key={group.mapId}>{group.mapName || group.mapId}</Tag>
                ))
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("映射点数"),
            align: "center",
            width: 100,
            render: (_, record) => (
                (record.mapNodeMapping ?? []).reduce((sum, group) => sum + (group.nodeMappings?.length ?? 0), 0)
            ),
        },
        {
            title: t("创建时间"),
            dataIndex: "createTime",
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            fixed: "right",
            width: 180,
            render: (_, record) => (
                <Space>
                    {/* 编辑节点映射：无权限隐藏（SPEC_node_mapping §6） */}
                    {canUpdate && (
                        <Button type="primary" onClick={() => handleEdit(record)}>{t("编辑")}</Button>
                    )}
                    {/* 删除节点映射：无权限隐藏（SPEC_node_mapping §6） */}
                    {canDelete && (
                        <Popconfirm
                            title={t("删除节点映射")}
                            description={t("确定删除当前节点映射?")}
                            onConfirm={() => onConfirmDelete(record)}
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

    /**
     * 监听查询参数变化，重新查询列表
     */
    useEffect(() => {
        getMappingList(searchParams);
    }, [searchParams])

    return (
        <div className={styles.mapping_table}>
            <div className={styles.mapping_header}>
                <div className={styles.search}>
                    <Input
                        placeholder={t("映射名称")}
                        value={keyword}
                        onChange={e => setKeyword(e.target.value)}
                        onPressEnter={onSearch}
                        allowClear
                    />
                    <Button type="primary" icon={<SearchOutlined />} onClick={onSearch}>{t("查询")}</Button>
                    <Button icon={<ReloadOutlined />} onClick={onReset}>{t("重置")}</Button>
                </div>
                <div className={styles.actions}>
                    <Space>
                        {/* 新增节点映射：无权限隐藏（SPEC_node_mapping §6） */}
                        {canAdd && (
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleAdd}
                            >
                                {t("新增节点映射")}
                            </Button>
                        )}
                    </Space>
                </div>
            </div>
            <Table<AGVNodeMapping>
                columns={columns}
                loading={tableLoading}
                dataSource={mappingData}
                rowKey={r => r.mappingKey ?? String(r.id)}
                scroll={{ x: 800, y: "calc(100vh - 320px)" }}
                pagination={{
                    ...paginationParams,
                    hideOnSinglePage: false,
                    showSizeChanger: true,
                    showTotal: (total) => t("总数{total}条", { total })
                }}
                onChange={onTableChange}
            />
            <MappingModal
                open={openModal}
                isModify={isModify}
                modifyRow={modifyRow}
                setOpenModal={setOpenModal}
                getMappings={() => getMappingList()}
            />
        </div>
    )
};
