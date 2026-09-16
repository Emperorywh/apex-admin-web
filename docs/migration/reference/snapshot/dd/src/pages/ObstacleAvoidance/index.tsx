/**
 * @description 
 * @date 2026-1-12
 */
import { useState, useEffect } from "react";
import { Input, Space, Button, Table, message, Popconfirm } from "antd";
import type { GetProps, TableProps, PaginationProps } from "antd";
import styles from "./index.less";
import type { SearchParamsType, ObstacleResponseType, ObstacleRecord, ObstacleParameters } from "@/types/ObstacleAvoidance";
import { pageObstacleAvoidance, deleteObstacleAvoidance } from "@/api";
import ObstacleTemplateModal from "./ObstacleTemplateModal";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

const { Search } = Input;

type SearchProps = GetProps<typeof Input.Search>

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();

    /* 按钮级权限判定（SPEC §8.3）：避障模板 新增/编辑/删除 */
    const { hasPerm } = useAccess();
    const canAdd = hasPerm(PERM_BUTTON.OBSTACLE_AVOIDANCE_ADD); // 新增避障（§7.1）
    const canUpdate = hasPerm(PERM_BUTTON.OBSTACLE_AVOIDANCE_UPDATE); // 编辑避障（§7.2）
    const canDelete = hasPerm(PERM_BUTTON.OBSTACLE_AVOIDANCE_DELETE); // 删除避障（§7.2）

    // 查询参数
    const [searchParams, setSearchParams] = useState<SearchParamsType>({
        pageNo: 1,
        pageSize: 10,
        query: ""
    });
    // 查询页码
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        current: 1,
        pageSize: 10,
        total: 0
    });
    // 表格数据
    const [obstacleRecords, setObstacleRecords] = useState<ObstacleRecord[]>([]);
    // 避障弹窗（新增/编辑统一入口）
    const [openTemplateModal, setOpenTemplateModal] = useState<boolean>(false);
    // 编辑的数据
    const [updateRecord, setUpdateRecord] = useState<ObstacleRecord>();

    // 查询表格数据
    const getObstacleAvoidance = () => {
        pageObstacleAvoidance(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: ObstacleResponseType = res?.data;
                const { records, total, size, current } = data;
                setObstacleRecords(records);
                setPaginationProps({
                    current,
                    pageSize: size,
                    total
                });
            } else {
                message.warning(t("查询避障数据出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询避障数据出错") + err?.message);
            }
        })
    };

    // 查询事件
    const onSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            pageNo: 1,
            query: value
        })
    };

    // 表格改变事件
    const onTableChange: TableProps<ObstacleRecord>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize
        });
    };

    const handleOpenTemplateModal = () => {
        setUpdateRecord(undefined);
        setOpenTemplateModal(true);
    };

    // 删除确认事件
    const deleteConfirm = (record: ObstacleRecord) => {
        if (typeof record.id !== "number") return;
        const params = new URLSearchParams();
        params.append("id", record?.id as unknown as string);
        deleteObstacleAvoidance(params).then(res => {
            if (res.code === 200 && res.message === "success") {
                getObstacleAvoidance();
                message.success(t("删除避障数据成功"));
            } else {
                message.warning(t("删除避障数据出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除避障数据出错") + err?.message);
            }
        })
    };

    const handleUpdateObstacle = (record: ObstacleRecord) => {
        setUpdateRecord(record);
        setOpenTemplateModal(true);
    };

    const columns: TableProps<ObstacleRecord>["columns"] = [
        {
            title: t("避障名称"),
            dataIndex: "obstacleAvoidanceName",
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            width: 200,
            fixed: "right",
            render: (_, record) => (
                <Space>
                    {/* 编辑避障：无权限隐藏（§7.2） */}
                    {canUpdate && (
                        <Button type="primary" onClick={() => handleUpdateObstacle(record)}>{t("编辑")}</Button>
                    )}
                    {/* 删除避障：无权限隐藏（§7.2） */}
                    {canDelete && (
                        <Popconfirm
                            title={t("删除")}
                            description={t("确认删除当前数据?")}
                            onConfirm={() => deleteConfirm(record)}
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

    const expandColumns: TableProps<ObstacleParameters>["columns"] = [
        {
            title: t("避障参数名称"),
            dataIndex: "name",
            ellipsis: { showTitle: true }
        },
        {
            title: t("避障参数类型"),
            dataIndex: "avoid",
            ellipsis: { showTitle: true }
        },
        {
            title: t("是否启用避障参数"),
            dataIndex: "enable",
            render: (text) => text ? t("启用") : t("未启用"),
            ellipsis: { showTitle: true }
        },
    ];

    useEffect(() => {
        getObstacleAvoidance();
    }, [searchParams])

    return (
        <div className={styles.obstacle_avoidance}>
            <div className={styles.search}>
                <Search
                    style={{ width: 360 }}
                    placeholder={t("输入避障策略名称查询")}
                    onSearch={onSearch}
                    enterButton
                />
                <Space>
                    {/* 新增避障：无权限隐藏（§7.1） */}
                    {canAdd && (
                        <Button type="primary" onClick={handleOpenTemplateModal}>{t("新增避障")}</Button>
                    )}
                </Space>
            </div>
            <Table<ObstacleRecord>
                columns={columns}
                dataSource={obstacleRecords}
                scroll={{ x: 800, y: "calc(100vh - 260px)" }}
                rowKey={r => r.id as unknown as string}
                expandable={{ expandedRowRender: (record) => <Table columns={expandColumns} dataSource={record.parameters || []} pagination={false} /> }}
                pagination={{
                    ...paginationProps,
                    showSizeChanger: true,
                    hideOnSinglePage: false,
                    showTotal: total => t("总数{total}条", { total })
                }}
                onChange={onTableChange}
            />
            <ObstacleTemplateModal
                open={openTemplateModal}
                updateRecord={updateRecord}
                setOpenModal={setOpenTemplateModal}
                setUpdateRecord={setUpdateRecord}
                getObstacleAvoidance={getObstacleAvoidance}
            />
        </div>
    )
};
