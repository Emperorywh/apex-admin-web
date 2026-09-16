/**
 * @description 组合任务分组
 * @date 2025-10-29
 */
import { useState, useEffect } from "react";
import { Table, Input, Space, Button, message, Dropdown } from "antd";
import type { TableProps, GetProps, PaginationProps } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import styles from "./index.less";
import FlowModal from "./FlowModal";
import { pageOrderFlows, orderFlowOperation } from "@/api";
import type { OrderGroupQueryType, OrderGroupTaskResult, OrderGroupRecord, OrderFlowOperationType } from "@/types/MissionCluster/MissionFlow";
import SubFlowTable from "./SubFlowTable";
import { operates } from "@/constants/MissionCluster";
import type { MenuInfo } from "rc-menu/lib/interface";
import { triggerTypes } from "@/constants/MissionCluster";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

type SearchProps = GetProps<typeof Input.Search>;

const { Search } = Input;

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();

    /* 按钮级权限判定（SPEC §8.3）：工艺管理 创建/重发/操作 */
    const { hasPerm } = useAccess();
    const canCreate = hasPerm(PERM_BUTTON.MISSION_TEMPLATE_CREATE); // 创建工艺（§7.1）
    const canResend = hasPerm(PERM_BUTTON.MISSION_TEMPLATE_RESEND); // 重发工艺（§7.2）
    const canOperate = hasPerm(PERM_BUTTON.MISSION_TEMPLATE_OPERATE); // 操作 Dropdown（§7.2/§7.4 粗粒度码）

    // 弹窗
    const [openModal, setOpenModal] = useState<boolean>(false);
    // 查询参数
    const [searchParams, setSearchParams] = useState<OrderGroupQueryType>({
        pageNo: 1,
        pageSize: 10,
        query: ""
    })
    // 页码
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        current: 1,
        pageSize: 10,
        total: 0
    });
    // 表格数据
    const [orderGroupTasks, setOrderGroupTasks] = useState<OrderGroupRecord[]>([]);
    // 重发的数据
    const [repeatRow, setRepeatRow] = useState<OrderGroupRecord>();

    const getOrderFlows = () => {
        pageOrderFlows(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: OrderGroupTaskResult = res.data;
                const { records, current, size, total } = data;
                setOrderGroupTasks(records);
                setPaginationProps({
                    current,
                    pageSize: size,
                    total
                });
            } else {
                message.warning(t("查询任务分组出错"), res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询任务分组出错") + err?.message);
            }
        })
    };

    // 搜索任务事件
    const onFlowSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            query: value,
            pageNo: 1
        });
    };

    // 新增分组打开弹窗
    const handleAddFlow = () => {
        setRepeatRow(undefined);
        setOpenModal(true);
    };

    // 表格的改变事件
    const onTableChange: TableProps<OrderGroupRecord>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize
        });
    };

    const onOperateClick = ({ key }: MenuInfo, record: OrderGroupRecord) => {
        const { id } = record;
        const data: OrderFlowOperationType = {
            id,
            operation: key as unknown as ("PAUSE" | "CONTINUE" | "CANCEL")
        };
        orderFlowOperation(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                getOrderFlows();
                message.success(t("当前任务操作成功"));
            } else {
                message.warning(t("当前任务操作出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("当前任务操作出错") + err?.message);
            }
        })
    };

    // 重发操作
    const handleRepeatCreate = (record: OrderGroupRecord) => {
        console.log("重发的参数", record)
        setRepeatRow(record);
        setOpenModal(true);
    };

    const columns: TableProps<OrderGroupRecord>["columns"] = [
        {
            title: t("工艺名称"),
            dataIndex: "orderFlowName",
            ellipsis: { showTitle: true }
        },
        {
            title: t("工艺标识"),
            dataIndex: "orderFlowKey",
            ellipsis: { showTitle: true }
        },
        {
            title: t("时间表达式"),
            dataIndex: "cronExpression",
            ellipsis: { showTitle: true }
        },
        {
            title: t("循环次数"),
            dataIndex: "triggerTimes",
            ellipsis: { showTitle: true }
        },
        {
            title: t("执行方式"),
            dataIndex: "triggerType",
            render: (value) => {
                const target = triggerTypes?.find((item: any) => (item?.value) === value) as any;
                return target?.label ? t(target.label) : "";
            },
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            width: 220,
            fixed: "right",
            render: (_, record) => (
                <Space>
                    {/* 重发工艺：无权限隐藏（§7.2） */}
                    {canResend && (
                        <Button
                            type="primary"
                            onClick={() => handleRepeatCreate(record)}
                        >
                            {t("重发")}
                        </Button>
                    )}
                    {/* 操作 Dropdown（粗粒度码 §7.4）：无权限隐藏入口，子项不再细分 */}
                    {canOperate && (
                        <Dropdown.Button
                            type="primary"
                            menu={{
                                items: operates?.map(op => op && "label" in op ? { ...op, label: t(op.label as string) } : op),
                                onClick: (e) => onOperateClick(e, record)
                            }}
                        >
                            {t("操作")}
                        </Dropdown.Button>
                    )}
                </Space>
            ),
            ellipsis: { showTitle: true }
        }
    ];

    useEffect(() => {
        getOrderFlows();
    }, [searchParams])

    return (
        <div className={styles.mission_group}>
            <div className={styles.group_search}>
                <Search
                    style={{ width: 256 }}
                    placeholder={t("搜索工艺")}
                    onSearch={onFlowSearch}
                    enterButton
                />
                <Space>
                    {/* 创建工艺：无权限隐藏（§7.1） */}
                    {canCreate && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleAddFlow}
                        >
                            {t("创建工艺")}
                        </Button>
                    )}
                </Space>
            </div>
            <Table<OrderGroupRecord>
                columns={columns}
                dataSource={orderGroupTasks}
                scroll={{ x: 600, y: "calc(100vh - 250px)" }}
                rowKey={r => r.id}
                expandable={{ expandedRowRender: (props) => <SubFlowTable {...props} getOrderFlows={getOrderFlows} /> }}
                pagination={{
                    ...paginationProps,
                    hideOnSinglePage: false,
                    showSizeChanger: true,
                    showTotal: (total) => t("总数{total}条", { total })
                }}
                onChange={onTableChange}
            />
            <FlowModal
                open={openModal}
                repeatRow={repeatRow}
                setOpenModal={setOpenModal}
                setRepeatRow={setRepeatRow}
                getOrderFlows={getOrderFlows}
            />
        </div>
    )
};

