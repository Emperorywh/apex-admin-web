/**
 * @description 多地图点边组合页面（列表查询、创建、更新、删除）
 * @date 2026-6-22
 */
import { useState, useEffect, type CSSProperties } from "react";
import { Button, Table, message, Space, Input, Popconfirm, Tag, Tooltip, theme } from "antd";
import type { TableProps, PaginationProps, GetProps } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import styles from "./index.less";
import { pageSystemNodeEdgeGroups, deleteSystemNodeEdgeGroup } from "@/api";
import type {
    PageSystemNodeEdgeGroupParam,
    SystemNodeEdgeGroupRecord,
    NodeEdgeGroup
} from "@/types/PointEdgeCombination";
import PointEdgeCombinationModal from "./PointEdgeCombinationModal";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

const { Search } = Input;

type SearchProps = GetProps<typeof Input.Search>;

/**
 * 页面自定义样式只消费 Ant Design 的语义色变量。
 * 主题切换时由 ConfigProvider 驱动 token 更新，避免页面感知主题名称或维护两套颜色。
 */
type PointEdgeCombinationThemeStyle = CSSProperties & {
    "--point-edge-color-text": string;
    "--point-edge-color-text-secondary": string;
};

export default function PointEdgeCombination() {
    /* 国际化翻译方法 */ const { t } = useI18n();

    /**
     * 页面只消费权限查询结果，并据此控制新增、编辑和删除入口。
     * 权限编码统一由权限常量模块维护，避免在视图层散落字符串。
     */
    const { hasPerm } = useAccess();
    const canAdd = hasPerm(PERM_BUTTON.POINT_EDGE_COMBINATION_ADD);
    const canUpdate = hasPerm(PERM_BUTTON.POINT_EDGE_COMBINATION_UPDATE);
    const canDelete = hasPerm(PERM_BUTTON.POINT_EDGE_COMBINATION_DELETE);

    const { token } = theme.useToken();

    /**
     * 将组件上下文中的主题 token 暴露给 CSS Module。
     * 页面内所有自定义文字层级共用该语义映射，明暗模式下会同步更新。
     */
    const themeStyle: PointEdgeCombinationThemeStyle = {
        "--point-edge-color-text": token.colorText,
        "--point-edge-color-text-secondary": token.colorTextSecondary
    };

    /* 列表数据 */
    const [list, setList] = useState<SystemNodeEdgeGroupRecord[]>([]);
    /* 查询参数 */
    const [searchParams, setSearchParams] = useState<PageSystemNodeEdgeGroupParam>({
        pageNo: 1,
        pageSize: 10,
        query: ""
    });
    /* 弹窗开关 */
    const [open, setOpen] = useState<boolean>(false);
    /* 分页属性 */
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        current: 1,
        pageSize: 10,
        total: 0
    });
    /* 是否为编辑状态 */
    const [isModify, setIsModify] = useState<boolean>(false);
    /* 当前编辑的行 */
    const [modifyRow, setModifyRow] = useState<SystemNodeEdgeGroupRecord>();
    /* 表格加载状态 */
    const [loading, setLoading] = useState<boolean>(false);

    /* 分页查询多地图点边组合 */
    const getList = () => {
        setLoading(true);
        pageSystemNodeEdgeGroups(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data = res?.data || {};
                setList(data.records || []);
                setPaginationProps({
                    current: data.current,
                    pageSize: data.size,
                    total: data.total
                });
            } else {
                message.warning(t("查询多地图点边组合出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询多地图点边组合出错") + err?.message);
            }
        }).finally(() => {
            setLoading(false);
        });
    };

    /* 新增多地图点边组合 */
    const onAddClick = () => {
        setIsModify(false);
        setModifyRow(undefined);
        setOpen(true);
    };

    /* 刷新列表 */
    const onReloadClick = () => {
        getList();
    };

    /* 编辑某一行 */
    const handleEdit = (record: SystemNodeEdgeGroupRecord) => {
        setIsModify(true);
        setModifyRow(record);
        setOpen(true);
    };

    /* 删除某一行 */
    const onDeleteConfirm = (record: SystemNodeEdgeGroupRecord) => {
        deleteSystemNodeEdgeGroup({ systemNodeEdgeGroupId: record.id }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getList();
                message.success(t("删除多地图点边组合成功"));
            } else {
                message.warning(t("删除多地图点边组合出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除多地图点边组合出错") + err?.message);
            }
        });
    };

    /* 分页改变事件 */
    const onTableChange: TableProps<SystemNodeEdgeGroupRecord>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize
        });
    };

    /* 按名称搜索 */
    const onSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            pageNo: 1,
            query: value
        });
    };

    /* 展开行的子表格列：展示每个点边组合的明细
       注意：接口返回的每一项为 { nodeEdgeGroup, simpleMap } 嵌套结构，
       字段需从子对象中读取 */
    const groupColumns: TableProps<NodeEdgeGroup>["columns"] = [
        {
            title: t("点边组合名称"),
            dataIndex: "nodeEdgeGroup",
            width: 220,
            render: (_, record) => record.nodeEdgeGroup?.name || "-",
            ellipsis: { showTitle: true }
        },
        {
            title: t("所属地图"),
            dataIndex: "simpleMap",
            ellipsis: true,
            width: 240,
            render: (_, record) => {
                /* 优先展示地图名称，地图id 作为 tooltip 便于排查 */
                const mapName = record.simpleMap?.mapName;
                const mapId = record.simpleMap?.mapId;
                if (!mapName && !mapId) return "-";
                return (
                    <Tooltip title={mapId}>
                        <span className={styles.cell_muted}>{mapName || mapId}</span>
                    </Tooltip>
                );
            }
        },
        {
            title: t("节点数量"),
            width: 100,
            render: (_, record) => record.nodeEdgeGroup?.nodeIds?.length ?? 0,
            ellipsis: { showTitle: true }
        },
        {
            title: t("边数量"),
            width: 100,
            render: (_, record) => record.nodeEdgeGroup?.edgeIds?.length ?? 0,
            ellipsis: { showTitle: true }
        }
    ];

    /* 展开行渲染：明细子表格 */
    const expandedRowRender = (record: SystemNodeEdgeGroupRecord) => (
        <Table<NodeEdgeGroup>
            columns={groupColumns}
            dataSource={record.nodeEdgeGroups || []}
            pagination={false}
            rowKey={r => (r.nodeEdgeGroup?.id || "") + (r.simpleMap?.mapId || "")}
            size="small"
        />
    );

    /* 主表格列定义 */
    const columns: TableProps<SystemNodeEdgeGroupRecord>["columns"] = [
        {
            title: t("组合名称"),
            dataIndex: "nodeEdgeGroupName",
            width: 220,
            render: (text: string) => (
                <span className={styles.cell_primary}>{text || "-"}</span>
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("组合Key"),
            dataIndex: "nodeEdgeGroupKey",
            ellipsis: true,
            render: (text: string) => (
                <Tooltip title={text}>
                    <span className={styles.cell_muted}>{text || "-"}</span>
                </Tooltip>
            )
        },
        {
            title: t("包含组合"),
            dataIndex: "nodeEdgeGroups",
            render: (groups: NodeEdgeGroup[]) => (
                <Space size={[4, 4]} wrap>
                    {(groups || []).map(group => (
                        <Tag
                            key={(group.nodeEdgeGroup?.id || "") + (group.simpleMap?.mapId || "")}
                            color="blue"
                        >
                            {group.nodeEdgeGroup?.name}
                        </Tag>
                    ))}
                </Space>
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("更新时间"),
            dataIndex: "updateTime",
            width: 180,
            render: (text: string) => (
                <span className={styles.cell_muted}>{text || "-"}</span>
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            fixed: "right",
            width: 180,
            render: (_, record) => (
                <Space>
                    {/* 编辑组合：无权限隐藏（§7.2） */}
                    {canUpdate && (
                        <Button
                            type="primary"
                            onClick={() => handleEdit(record)}
                        >
                            {t("编辑")}
                        </Button>
                    )}
                    {/* 删除组合：无权限隐藏（§7.2） */}
                    {canDelete && (
                        <Popconfirm
                            title={t("删除多地图点边组合")}
                            description={t("确定删除当前多地图点边组合？删除后不可恢复")}
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
        }
    ];

    /* 查询参数变化时重新拉取列表 */
    useEffect(() => {
        getList();
    }, [searchParams]);

    return (
        <div className={styles.point_edge_combination} style={themeStyle}>
            <div className={styles.actions}>
                <Search
                    style={{ width: 320 }}
                    placeholder={t("根据组合名称查询")}
                    onSearch={onSearch}
                    enterButton
                    allowClear
                />
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={onReloadClick}>
                        {t("刷新")}
                    </Button>
                    {/* 新增组合：无权限隐藏（§7.1） */}
                    {canAdd && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={onAddClick}
                        >
                            {t("新增组合")}
                        </Button>
                    )}
                </Space>
            </div>
            <Table<SystemNodeEdgeGroupRecord>
                columns={columns}
                dataSource={list}
                rowKey={r => r.id}
                scroll={{ x: 1100, y: "calc(100vh - 320px)" }}
                expandable={{ expandedRowRender }}
                pagination={{
                    ...paginationProps,
                    showSizeChanger: true,
                    showTotal: (total) => t("总数{total}条", { total })
                }}
                onChange={onTableChange}
                loading={loading}
            />
            <PointEdgeCombinationModal
                open={open}
                isModify={isModify}
                modifyRow={modifyRow}
                getList={getList}
                setModifyRow={setModifyRow}
                setOpen={setOpen}
            />
        </div>
    );
}
