/**
 * @description 多地图关联页面1
 * @date 2025-7-23
 */
import { useState, useEffect } from "react";
import { Button, Table, message, Space, Input, Popconfirm } from "antd";
import type { TableProps, PaginationProps, GetProps } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import styles from "./index.less";
import { pageCrossMaps, deleteCrossMap } from "@/api";
import type { PageCrossMaps, CrossMapData, CrossMapRecord, CrossMap } from "@/types/MultipleMaps";
import CrossMapModal from "./CrossMapModal";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

const { Search } = Input;

type SearchProps = GetProps<typeof Input.Search>;

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();

    /* 按钮级权限判定（SPEC §8.2 地图关联） */
    const { hasPerm } = useAccess();
    const canAdd = hasPerm(PERM_BUTTON.CROSS_MAP_ADD); // 新增关联（§7.1）
    const canUpdate = hasPerm(PERM_BUTTON.CROSS_MAP_UPDATE); // 编辑关联（§7.2）
    const canDelete = hasPerm(PERM_BUTTON.CROSS_MAP_DELETE); // 删除关联（§7.2）

    const [crossMaps, setCrossMaps] = useState<CrossMapRecord[]>([]);
    // 查询参数
    const [searchParams, setSearchParams] = useState<PageCrossMaps>({
        pageNo: 1,
        pageSize: 10,
        query: ""
    });
    // 地图关联的弹窗
    const [openMultip, setOpenMultip] = useState<boolean>(false);
    // 分页属性
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        current: 1,
        pageSize: 10,
        total: 0
    });
    // 当前是不是编辑状态
    const [isModify, setIsModify] = useState<boolean>(false);
    // 当前编辑的行
    const [modifyRow, setModifyRow] = useState<CrossMapRecord>();

    const getCrossMaps = () => {
        pageCrossMaps(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: CrossMapData = res?.data || {};
                const { records, size, total, current } = data;
                setCrossMaps(records);
                setPaginationProps({
                    current,
                    pageSize: size,
                    total
                });
            } else {
                message.warning(t("查询地图关联数据出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询地图关联数据出错") + err?.message);
            }
        })
    };

    const onOpenMultipClick = () => {
        setIsModify(false);
        setModifyRow(undefined);
        setOpenMultip(true);
    };

    // 分页改变的事件
    const onTableChange: TableProps<CrossMapRecord>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize
        });
    };

    const onCorssMapSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            pageNo: 1,
            query: value
        });
    };

    const handleOpenMultiple = (record: CrossMapRecord) => {
        setIsModify(true);
        setModifyRow(record);
        setOpenMultip(true);
    };

    const onDeleteConfirm = (record: CrossMapRecord) => {
        const { id } = record;
        deleteCrossMap({ id }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getCrossMaps();
                message.success(t("删除地图关联成功"));
            } else {
                message.warning(t("删除地图关联出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除地图关联出错") + err?.message);
            }
        })
    };

    const mapsColumns: TableProps<CrossMap>["columns"] = [
        {
            title: t("地图名称"),
            dataIndex: "mapName",
            ellipsis: { showTitle: true }
        },
        {
            title: t("地图ID"),
            dataIndex: "mapId",
            ellipsis: true
        },
        {
            title: t("节点名称"),
            dataIndex: "nodeName",
            ellipsis: { showTitle: true }
        },
        {
            title: t("节点ID"),
            dataIndex: "nodeId",
            ellipsis: true
        },
    ];

    const expandedRowRender = ({ crossMaps }: CrossMapRecord) => (
        <Table<CrossMap>
            columns={mapsColumns}
            dataSource={crossMaps || []}
            pagination={false}
            rowKey={r => r.nodeId + r.mapId}
            size="small"
            scroll={{ x: 800 }}
        />
    );

    const columns: TableProps<CrossMapRecord>["columns"] = [
        {
            title: t("跨地图名称"),
            dataIndex: "crossMapName",
            ellipsis: { showTitle: true }
        },
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
            title: t("操作"),
            fixed: "right",
            width: 180,
            render: (_, record) => (
                <Space>
                    {/* 编辑关联：无权限隐藏（§7.2） */}
                    {canUpdate && (
                        <Button
                            type="primary"
                            onClick={() => handleOpenMultiple(record)}
                        >
                            {t("编辑")}
                        </Button>
                    )}
                    {/* 删除关联：无权限隐藏（§7.2） */}
                    {canDelete && (
                        <Popconfirm
                            title={t("删除当前地图")}
                            description={t("确定删除当前地图? 删除之后不可恢复")}
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

    useEffect(() => {
        getCrossMaps();
    }, [searchParams])

    return (
        <div className={styles.multiple_maps}>
            <div className={styles.maps_actions}>
                <Search
                    style={{ width: 300 }}
                    placeholder={t("根据名称查询")}
                    onSearch={onCorssMapSearch}
                    enterButton
                />
                <Space>
                    {/* 新增关联：无权限隐藏（§7.1） */}
                    {canAdd && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={onOpenMultipClick}
                        >
                            {t("新增关联")}
                        </Button>
                    )}
                </Space>
            </div>
            <Table<CrossMapRecord>
                columns={columns}
                dataSource={crossMaps}
                rowKey={r => r.deviceKey}
                scroll={{ x: 1000, y: "calc(100vh - 270px)" }}
                expandable={{ expandedRowRender }}
                pagination={{
                    ...paginationProps,
                    showSizeChanger: true,
                    showTotal: (total) => t("总数{total}条", { total })
                }}
                onChange={onTableChange}
            />
            <CrossMapModal
                open={openMultip}
                isModify={isModify}
                modifyRow={modifyRow}
                getCrossMaps={getCrossMaps}
                setModifyRow={setModifyRow}
                setOpenMultip={setOpenMultip}
            />
        </div>
    )
};
