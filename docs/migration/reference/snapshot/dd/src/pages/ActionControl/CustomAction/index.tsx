/**
 * @description 自定义动作
 * @date 2025-9-8
 */
import { useState, useEffect } from "react";
import { Input, Button, Space, Table, message, Descriptions, Popconfirm } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { TableProps, PaginationProps, GetProps } from "antd";
import styles from "./index.less";
import { pageSysActions, deleteSysAction } from "@/api";
import ActionModal from "./ActionModal";
import type { PageSysActionType, SysActionData, SysActionRecord, ActionParameters } from "@/types/ActionControl/SysActions";
import { useI18n } from "@/hooks/useI18n";

const { Search } = Input;

type SearchProps = GetProps<typeof Input.Search>;

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();

    // 查询参数
    const [searchParams, setSearchParams] = useState<PageSysActionType>({
        pageSize: 10,
        pageNo: 1,
        query: ""
    });
    // 动作数据
    const [sysActions, setSysActions] = useState<SysActionRecord[]>([]);
    // 弹窗
    const [openModal, setOpenModal] = useState<boolean>(false);
    // 分页
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        pageSize: 10,
        current: 1,
        total: 0
    });
    const [tableLoading, setTableLoading] = useState<boolean>(false);
    // 当前是不是编辑状态
    const [isModify, setIsModify] = useState<boolean>(false);
    // 当前编辑的行
    const [modifyRow, setModifyRow] = useState<SysActionRecord>();

    const getSysActions = () => {
        setTableLoading(true);
        pageSysActions(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: SysActionData = res.data;
                const { records, total, size, current } = data;
                setSysActions(records);
                setPaginationProps({
                    total,
                    pageSize: size,
                    current
                });
            } else {
                message.warning(t("查询系统动作列表出错") + res?.message);
            }
            setTableLoading(false);
        }).catch(err => {
            if (err) {
                setTableLoading(false);
                message.error(t("查询系统动作列表出错") + err?.message);
            }
        })
    };

    const onSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            query: value,
            pageNo: 1
        });
    };

    const onTableChange: TableProps<SysActionRecord>["onChange"] = (pagination) => {
        const { pageSize = 10, current = 1 } = pagination;
        setSearchParams({
            ...searchParams,
            pageSize,
            pageNo: current
        });
    };

    const handleAddAction = () => {
        setIsModify(false);
        setModifyRow(undefined);
        setOpenModal(true);
    };

    const handleModifyAction = (record: SysActionRecord) => {
        setIsModify(true);
        setModifyRow(record);
        setOpenModal(true);
    };

    const deleteConfirm = (record: SysActionRecord) => {
        const { id } = record;
        deleteSysAction({ id }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getSysActions();
                message.success(t("删除系统任务成功"));
            } else {
                message.warning(t("删除系统任务出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除系统任务出错") + err?.message);
            }
        })
    };

    const columns: TableProps<SysActionRecord>["columns"] = [
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
            width: 200,
            fixed: "right",
            render: (_, record) => (
                <Space>
                    <Button
                        type="primary"
                        onClick={() => handleModifyAction(record)}
                    >
                        {t("编辑")}
                    </Button>
                    <Popconfirm
                        title={t("删除")}
                        description={t("确认删除当前数据?")}
                        onConfirm={() => deleteConfirm(record)}
                        okText={t("确认")}
                        cancelText={t("取消")}
                    >
                        <Button danger>{t("删除")}</Button>
                    </Popconfirm>
                </Space>
            ),
            ellipsis: { showTitle: true }
        }
    ];

    useEffect(() => {
        getSysActions();
    }, [searchParams])

    return (
        <div className={styles.custom_action}>
            <div className={styles.actions}>
                <Search
                    style={{ width: 360 }}
                    placeholder={t("查询系统动作")}
                    onSearch={onSearch}
                    enterButton
                />
                <Space>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAddAction}
                    >
                        {t("新增动作")}
                    </Button>
                </Space>
            </div>
            <Table<SysActionRecord>
                style={{ marginTop: 10 }}
                columns={columns}
                dataSource={sysActions}
                rowKey={r => r.id}
                loading={tableLoading}
                scroll={{ x: 800, y: "calc(100vh - 200px)" }}
                pagination={{
                    ...paginationProps,
                    showTotal: (total) => t("总数{total}条", { total }),
                    showSizeChanger: true,
                    hideOnSinglePage: false
                }}
                onChange={onTableChange}
            />
            <ActionModal
                open={openModal}
                isModify={isModify}
                modifyRow={modifyRow}
                setOpenModal={setOpenModal}
                setModifyRow={setModifyRow}
                getSysActions={getSysActions}
            />
        </div>
    )
};
