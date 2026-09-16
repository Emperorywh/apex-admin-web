/**
 * @description 组合任务的页面
 * @date 2025-10-29
 */
import { useState, useEffect } from "react";
import { Table, Input, Space, Button, message, Popconfirm } from "antd";
import type { TableProps, GetProps, PaginationProps } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { pageOrderTemplates, deleteOrderTemplate } from "@/api";
import styles from "./index.less";
import MissionModal from "./MissionModal";
import type { PageOrderGroupType, OrderGroupResultType, OrderTemplateRecord } from "@/types/MissionCluster/MissionCreate";
import MissionTable from "./MissionTable";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

type SearchProps = GetProps<typeof Input.Search>;

const { Search } = Input;

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();

    /* 按钮级权限判定（SPEC §8.3）：任务工艺 新增/复制/编辑/删除 */
    const { hasPerm } = useAccess();
    const canAdd = hasPerm(PERM_BUTTON.MISSION_FLOW_ADD); // 创建任务（§7.1）
    const canCopy = hasPerm(PERM_BUTTON.MISSION_FLOW_COPY); // 复制任务（§7.2）
    const canUpdate = hasPerm(PERM_BUTTON.MISSION_FLOW_UPDATE); // 编辑任务（§7.2）
    const canDelete = hasPerm(PERM_BUTTON.MISSION_FLOW_DELETE); // 删除任务（§7.2）

    // 任务的弹窗
    const [openModal, setOpenModal] = useState<boolean>(false);
    // 查询的参数
    const [searchParams, setSearchParams] = useState<PageOrderGroupType>({
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
    const [orderTemplates, setOrderTemplates] = useState<OrderTemplateRecord[]>([]);
    // 当前编辑的项
    const [modifyRow, setModifyRow] = useState<OrderTemplateRecord>();
    // 当前是不是在编辑状态
    const [isModify, setIsModify] = useState<boolean>(false);

    const getOrderGroups = () => {
        pageOrderTemplates(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: OrderGroupResultType = res.data;
                const { records, total, current, size } = data;
                setOrderTemplates(records);
                setPaginationProps({
                    current,
                    pageSize: size,
                    total
                });
            } else {
                message.warning(t("查询任务组合列表出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询任务组合列表出错") + err?.message);
            }
        })
    };

    // 搜索任务事件
    const onMissionSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            pageNo: 1,
            query: value
        });
    };

    // 表格的改变事件
    const onTableChange: TableProps<OrderTemplateRecord>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize
        });
    };

    // 打开新增的弹窗
    const handleAddMission = () => {
        setModifyRow(undefined);
        setIsModify(false);
        setOpenModal(true);
    };

    // 编辑按钮
    const handleModifyClick = (record: OrderTemplateRecord) => {
        setModifyRow(record);
        setIsModify(true);
        setOpenModal(true);
    };

    // 删除订单组合
    const onDeleteConfirm = (record: OrderTemplateRecord) => {
        const { orderTemplateKey } = record;
        if (!orderTemplateKey) return;
        deleteOrderTemplate({ orderTemplateKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getOrderGroups();
                message.success(t("删除任务成功"));
            } else {
                message.warning(t("删除任务出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除任务出错") + err?.message);
            }
        })
    };

    // 复制任务
    const handleCopyMission = (record: OrderTemplateRecord) => {
        setModifyRow(record);
        setIsModify(false);
        setOpenModal(true);
    };

    const columns: TableProps<OrderTemplateRecord>["columns"] = [
        {
            title: t("任务名称"),
            dataIndex: "orderTemplateName",
            ellipsis: { showTitle: true }
        },
        {
            title: t("任务标识"),
            dataIndex: "orderTemplateKey",
            ellipsis: { showTitle: true }
        },
        {
            title: t("指定车辆（组）"),
            dataIndex: "appointVehicleName",
            render: (value, record) => value || record.appointVehicleGroupName,
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            fixed: "right",
            width: 260,
            render: (_, record) => (
                <Space>
                    {/* 复制任务：无权限隐藏（§7.2） */}
                    {canCopy && (
                        <Button
                            type="primary"
                            onClick={() => handleCopyMission(record)}
                        >
                            {t("复制")}
                        </Button>
                    )}
                    {/* 编辑任务：无权限隐藏（§7.2） */}
                    {canUpdate && (
                        <Button
                            type="primary"
                            onClick={() => handleModifyClick(record)}
                        >
                            {t("编辑")}
                        </Button>
                    )}
                    {/* 删除任务：无权限隐藏（§7.2） */}
                    {canDelete && (
                        <Popconfirm
                            title={t("删除")}
                            description={t("确定删除当前任务?")}
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
        getOrderGroups();
    }, [searchParams])

    return (
        <div className={styles.mission_create}>
            <div className={styles.mission_search}>
                <Search
                    style={{ width: 256 }}
                    placeholder={t("搜索任务")}
                    onSearch={onMissionSearch}
                    enterButton
                />
                <Space>
                    {/* 创建任务：无权限隐藏（§7.1） */}
                    {canAdd && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleAddMission}
                        >
                            {t("创建任务")}
                        </Button>
                    )}
                </Space>
            </div>
            <Table<OrderTemplateRecord>
                columns={columns}
                dataSource={orderTemplates}
                rowKey={r => r.id}
                scroll={{ x: 800, y: "calc(100vh - 250px)" }}
                expandable={{ expandedRowRender: (props) => <MissionTable {...props} /> }}
                pagination={{
                    ...paginationProps,
                    showSizeChanger: true,
                    hideOnSinglePage: false
                }}
                onChange={onTableChange}
            />
            <MissionModal
                open={openModal}
                isModify={isModify}
                modifyRow={modifyRow}
                setOpenModal={setOpenModal}
                setModifyRow={setModifyRow}
                getOrderGroups={getOrderGroups}
            />
        </div>
    )
};
