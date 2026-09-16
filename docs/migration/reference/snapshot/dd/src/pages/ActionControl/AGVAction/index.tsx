/**
 * @description AGV动作控制
 * @date 2025-9-8
 */
import { useEffect, useState } from "react";
import { Input, Space, Button, Table, message, Descriptions, Popconfirm } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import styles from "./index.less";
import type { GetProps, TableProps, PaginationProps } from "antd";
import { pageAGVActions, deleteAGVAction } from "@/api";
import type { PageAgvActionTypes, AGVActionResult, ActionRecord, ActionParameters } from "@/types/ActionControl/AGVActions";
import ActionModal from "./ActionModal";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

const { Search } = Input;

type SearchProps = GetProps<typeof Input.Search>;

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();

    /* 按钮级权限判定（SPEC §8.3）：车辆动作 新增/编辑/删除 */
    const { hasPerm } = useAccess();
    const canAdd = hasPerm(PERM_BUTTON.ACTION_VEHICLE_ADD); // 新增动作（§7.1）
    const canUpdate = hasPerm(PERM_BUTTON.ACTION_VEHICLE_UPDATE); // 编辑动作（§7.2）
    const canDelete = hasPerm(PERM_BUTTON.ACTION_VEHICLE_DELETE); // 删除动作（§7.2）

    const [searchParams, setSearchParams] = useState<PageAgvActionTypes>({
        pageSize: 10,
        pageNo: 1,
        query: ""
    });
    // openModal
    const [openModal, setOpenModal] = useState<boolean>(false);
    // pagination
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        pageSize: 10,
        current: 1,
        total: 0
    });
    // records
    const [actionRecords, setActionRecords] = useState<ActionRecord[]>([]);
    // 当前是不是编辑状态
    const [isModify, setIsModify] = useState<boolean>(false);
    // 编辑的行
    const [modifyRow, setModifyRow] = useState<ActionRecord>();
    // 表格的加载状态
    const [loading, setLoading] = useState<boolean>(false);

    // 查询动作数据
    const pageActions = () => {
        setLoading(true);
        pageAGVActions(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: AGVActionResult = res?.data;
                const { records, total, size, current } = data;
                setActionRecords(records);
                setPaginationProps({
                    pageSize: size,
                    current,
                    total
                });
            } else {
                message.warning(t("查询动作数据出错") + res?.message);
            }
            setLoading(false);
        }).catch(err => {
            if (err) {
                setLoading(false);
                message.error(t("查询动作数据出错") + err?.message)
            }
        })
    };

    // 搜索框的事件
    const onSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            pageNo: 1,
            query: value
        });
    };

    // 表格的onChange事件
    const onTableChange: TableProps<ActionRecord>["onChange"] = (pagination) => {
        const { pageSize = 10, current = 1 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize
        });
    };

    // 新增动作的函数
    const handleAddAction = () => {
        setIsModify(false);
        setModifyRow(undefined);
        setOpenModal(true);
    };

    // 修改动作参数
    const handleModifyAction = (record: ActionRecord) => {
        setIsModify(true);
        setModifyRow(record);
        setOpenModal(true);
    };

    // 删除函数
    const deleteConfirm = ({ id }: ActionRecord) => {
        deleteAGVAction({ id }).then(res => {
            if (res.code === 200 && res.message === "success") {
                pageActions();
                message.success(t("删除动作成功"));
            } else {
                message.warning(t("删除动作出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除动作出错") + err?.message);
            }
        })
    };

    const columns: TableProps<ActionRecord>["columns"] = [
        {
            title: t("动作类型"),
            dataIndex: "actionType",
            ellipsis: { showTitle: true }
        },
        {
            title: t("动作描述"),
            dataIndex: "actionDescription",
            ellipsis: { showTitle: true }
        },
        {
            title: t("阻塞类型"),
            dataIndex: "blockingType",
            ellipsis: { showTitle: true }
        },
        {
            title: t("动作参数"),
            dataIndex: "actionParameters",
            render: (value: ActionParameters[]) => (
                <Descriptions
                    items={value.map(p => ({
                        key: p.key,
                        label: p.key,
                        children: p.value
                    }))}
                    size="small"
                    column={1}
                />
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            fixed: "right",
            width: 200,
            render: (_, record) => (
                <Space>
                    {/* 编辑动作：无权限隐藏（§7.2） */}
                    {canUpdate && (
                        <Button
                            type="primary"
                            onClick={() => handleModifyAction(record)}
                        >
                            {t("编辑")}
                        </Button>
                    )}
                    {/* 删除动作：无权限隐藏（§7.2） */}
                    {canDelete && (
                        <Popconfirm
                            title={t("删除")}
                            description={t("确认删除当前数据?")}
                            onConfirm={() => deleteConfirm(record)}
                            okText={t("确认")}
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
        pageActions()
    }, [searchParams])

    return (
        <div className={styles.agv_action}>
            <div className={styles.actions}>
                <Search
                    style={{ width: 360 }}
                    placeholder={t("查询车辆动作")}
                    onSearch={onSearch}
                    enterButton
                />
                <Space>
                    {/* 新增动作：无权限隐藏（§7.1） */}
                    {canAdd && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleAddAction}
                        >
                            {t("新增动作")}
                        </Button>
                    )}
                </Space>
            </div>
            <Table<ActionRecord>
                style={{ marginTop: 10 }}
                loading={loading}
                columns={columns}
                dataSource={actionRecords}
                rowKey={r => r.id}
                scroll={{ x: 800, y: "calc(100vh - 250px)" }}
                pagination={{
                    ...paginationProps,
                    showTotal: (total) => t("总数{total}条", { total }),
                    hideOnSinglePage: false,
                    showSizeChanger: true
                }}
                onChange={onTableChange}
            />
            <ActionModal
                open={openModal}
                isModify={isModify}
                modifyRow={modifyRow}
                pageActions={pageActions}
                setOpenModal={setOpenModal}
                setModifyRow={setModifyRow}
            />
        </div>
    )
};
