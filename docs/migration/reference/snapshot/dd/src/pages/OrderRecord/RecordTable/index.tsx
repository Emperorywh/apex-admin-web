/**
 * @description 历史记录的表格
 * @date 2025-6-10
 */
import { useEffect, useState } from "react";
import { Table, message, Tag, Space, Dropdown, Button, Tooltip } from "antd";
import type { TableProps, TablePaginationConfig } from "antd";
import { useRequest } from "ahooks";
import { pageOrderRecords, orderTaskOperate } from "@/api";
import type { PageOrderRecordsParams, Records, MenuInfo, TaskOperate } from "@/types/OrderRecord";
import { orderStateUnfold, orderOperates } from "@/constants/OrderRecord/orderRecord";
import styles from "./index.less";
import SearchForm from "./SearchForm";
import { disableOrderOperates } from "@/utils/format";
import OrderCancelModal from "@/components/OrderCancelModal";
import MockDispatchModal from "@/components/MockDispatchModal";
import CreateOrderModal from "@/components/CreateOrderModal";
import OrderInfoModal from "@/components/OrderInfoModal";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

export default () => {

    /* 国际化翻译方法，用于将任务记录表格的所有文案进行多语言转换 */
    const { t } = useI18n();

    /* 按钮级权限判定（SPEC §8.3）：任务管理 检测/操作（创建入口在 SearchForm） */
    const { hasPerm } = useAccess();
    const canCheck = hasPerm(PERM_BUTTON.ORDER_RECORD_CHECK); // 检测订单（§7.2）
    const canOperate = hasPerm(PERM_BUTTON.ORDER_RECORD_OPERATE); // 操作 Dropdown（§7.2/§7.4 粗粒度码）

    // 查询的参数
    const [searchParams, setSearchParams] = useState<PageOrderRecordsParams>({
        pageNo: 1,
        pageSize: 10
    });
    /**
     * 表格虚拟列表的可视区高度
     * antd 的虚拟滚动要求 scroll.y 为数字像素值，不能使用 calc(100vh - 380px) 字符串，
     * 这里先以初始视口尺寸推算一个值，后续由 resize 监听更新，等价于原先的 calc 表现
     */
    const [tableScrollY, setTableScrollY] = useState<number>(() =>
        typeof window === "undefined" ? 400 : Math.max(window.innerHeight - 380, 200)
    );
    // 表格数据 订单
    const [orderRecords, setOrderRecords] = useState<Records[]>([]);
    // 分页的参数
    const [paginationParams, setPaginationParams] = useState<TablePaginationConfig>({});
    // 取消原因弹窗的Modal
    const [openCancelModal, setOpenCancelModal] = useState<boolean>(false);
    // 点击取消的订单id
    const [orderKey, setOrderKey] = useState<string>("");
    // 模拟订单的弹窗
    const [openDispatchModal, setOpenDispatchModal] = useState<boolean>(false);
    // 模拟订单的KEY
    const [orderTaskKey, setOrderTaskKey] = useState<string>("");
    // 创建订单的弹窗
    const [openCreateOrder, setOpenCreateOrder] = useState<boolean>(false);
    // 订单详情弹窗
    const [openOrderInfoModal, setOpenOrderInfoModal] = useState<boolean>(false);
    // 订单详情弹窗对应的订单标识
    const [orderInfoKey, setOrderInfoKey] = useState<string>("");

    // 轮询查询表格数据
    const { data, run } = useRequest(async () => {
        const result = await pageOrderRecords(searchParams);
        return result
    }, {
        pollingInterval: 1000,
        pollingWhenHidden: false,
        pollingErrorRetryCount: 1,
        refreshDeps: [searchParams],
        onError: (err) => message.error(t("查询订单记录出错") + err?.message)
    })

    // 根据轮询更新表格
    useEffect(() => {
        if (data?.code === 200 && data?.message === "success") {
            const { records, current, size, total } = data.data;
            setOrderRecords(records);
            setPaginationParams({
                current,
                total,
                pageSize: size
            });
        }
    }, [data])

    /**
     * 视口尺寸变化时，重新计算表格虚拟列表的可视区高度，
     * 替代原先 calc(100vh - 380px) 的响应式行为
     */
    useEffect(() => {
        const updateHeight = () => setTableScrollY(Math.max(window.innerHeight - 380, 200));
        updateHeight();
        window.addEventListener("resize", updateHeight);
        return () => window.removeEventListener("resize", updateHeight);
    }, []);

    // 表格改变事件
    const onTableChange: TableProps<Records>["onChange"] = (pagination) => {
        const { current, pageSize } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current as number,
            pageSize: pageSize as number
        });
    };

    // 订单操作对应的请求
    const orderTaskRequest = (operate: TaskOperate) => {
        orderTaskOperate(operate).then(res => {
            if (res.code === 200 && res.message === "success") {
                run();
                message.success(t("订单操作成功"));
            } else {
                message.warning(t("订单操作失败") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("订单操作失败") + err?.message);
            }
        })
    };

    // 订单操作的点击事件
    const onOperateClick = ({ key }: MenuInfo, record: Records) => {
        if (key === "CMD_ORDER_CANCEL") {
            // 取消单独操作，需要填写取消的原因
            setOrderKey(record.orderKey);
            setOpenCancelModal(true);
        } else {
            const data: TaskOperate = {
                orderTaskKey: record.orderKey,
                cancelReason: "",
                operate: key as TaskOperate["operate"]
            };
            orderTaskRequest(data);
        }
    };

    // 打开订单详情弹窗
    const handleOpenDetailTab = (record: Records) => {
        setOrderInfoKey(record?.orderKey);
        setOpenOrderInfoModal(true);
    };

    const handleMockDispatch = (record: Records) => {
        setOpenDispatchModal(true);
        setOrderTaskKey(record.orderKey);
    };

    /**
     * 复制任务ID到剪贴板
     * 安全上下文(https/localhost)优先用 navigator.clipboard，
     * 否则降级 execCommand 兜底（部署环境可能为 http，clipboard API 不可用）
     */
    const copyTaskId = async (text: string) => {
        // 非安全上下文下的降级复制方案
        const fallbackCopy = (t: string): boolean => {
            const textarea = document.createElement("textarea");
            textarea.value = t;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            let ok = false;
            try {
                ok = document.execCommand("copy");
            } catch {
                ok = false;
            }
            document.body.removeChild(textarea);
            return ok;
        };
        try {
            if (window.isSecureContext && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else if (!fallbackCopy(text)) {
                message.warning(t("复制失败"));
                return;
            }
            message.success(t("已复制任务ID"));
        } catch {
            message.warning(t("复制失败"));
        }
    };

    const columns: TableProps<Records>["columns"] = [
        {
            title: t("任务编号"),
            dataIndex: "orderKey",
            width: 150,
            align: "center",
            fixed: "left",
            render: (value) => (
                <span
                    style={{
                        display: "inline-block",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}
                >
                    <Tooltip
                        placement="topLeft"
                        title={value}
                    >
                        {value}
                    </Tooltip>
                </span>
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("任务名称"),
            dataIndex: "orderName",
            width: 150,
            align: "center",
            fixed: "left",
            render: (value) => (
                <span
                    style={{
                        display: "inline-block",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}
                >
                    <Tooltip
                        placement="topLeft"
                        title={value}
                    >
                        {value}
                    </Tooltip>
                </span>
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("任务状态"),
            dataIndex: "orderState",
            render: (value) => {
                const target = orderStateUnfold.find(item => item.enum === value);
                return <Tag color={target?.color}>{t(target?.chName || "NULL")}</Tag>
            },
            align: "center",
            width: 100,
            fixed: "left",
            ellipsis: { showTitle: true }
        },
        {
            // 任务ID，可能为空（例如充电类订单后端返回 null），空值显示为 "-"
            // 有值时点击文本即可复制，hover 显示完整值并提示可复制
            title: t("任务ID"),
            dataIndex: "taskId",
            width: 150,
            align: "center",
            render: (value) => (
                <Tooltip placement="topLeft" title={value ? `${value}（${t("点击复制")}）` : undefined}>
                    <span
                        style={{
                            display: "inline-block",
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            cursor: value ? "pointer" : "default"
                        }}
                        onClick={() => {
                            if (value) {
                                copyTaskId(value);
                            }
                        }}
                    >
                        {value ?? ""}
                    </span>
                </Tooltip>
            )
        },
        {
            title: t("指定车辆"),
            dataIndex: "appointVehicleName",
            width: 180,
            align: "center",
            render: (value) => (
                <span
                    style={{
                        display: "inline-block",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}
                >
                    <Tooltip
                        placement="topLeft"
                        title={value}
                    >
                        {value}
                    </Tooltip>
                </span>
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("指定车辆组"),
            dataIndex: "appointVehicleGroupName",
            width: 180,
            align: "center",
            render: (value) => (
                <span
                    style={{
                        display: "inline-block",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}
                >
                    <Tooltip
                        placement="topLeft"
                        title={value}
                    >
                        {value}
                    </Tooltip>
                </span>
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("执行车辆"),
            dataIndex: "executeVehicleName",
            width: 180,
            align: "center",
            render: (value) => (
                <span
                    style={{
                        display: "inline-block",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}
                >
                    <Tooltip
                        placement="topLeft"
                        title={value}
                    >
                        {value}
                    </Tooltip>
                </span>
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("优先级"),
            dataIndex: "priority",
            width: 80,
            align: "center",
            ellipsis: { showTitle: true }
        },
        {
            title: t("开始执行时间"),
            dataIndex: "executeTime",
            width: 160,
            align: "center",
            ellipsis: { showTitle: true }
        },
        {
            title: t("结束执行时间"),
            dataIndex: "finalTime",
            width: 160,
            align: "center",
            ellipsis: { showTitle: true }
        },
        {
            title: t("创建时间"),
            dataIndex: "createTime",
            width: 160,
            align: "center",
            ellipsis: { showTitle: true }
        },
        {
            title: t("失败原因"),
            dataIndex: "failReason",
            width: 200,
            align: "center",
            render: (value) => (
                <span
                    style={{
                        display: "inline-block",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}
                >
                    <Tooltip
                        placement="topLeft"
                        title={value}
                    >
                        {value}
                    </Tooltip>
                </span>
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("挂起原因"),
            dataIndex: "hangReason",
            width: 200,
            align: "center",
            render: (value) => (
                <span
                    style={{
                        display: "inline-block",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}
                >
                    <Tooltip
                        placement="topLeft"
                        title={value}
                    >
                        {value}
                    </Tooltip>
                </span>
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("取消原因"),
            dataIndex: "cancelReason",
            width: 200,
            align: "center",
            render: (value) => (
                <span
                    style={{
                        display: "inline-block",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}
                >
                    <Tooltip
                        placement="topLeft"
                        title={value}
                    >
                        {value}
                    </Tooltip>
                </span>
            ),
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            fixed: "right",
            width: 250,
            align: "center",
            render: (_, record) => {
                const operates = disableOrderOperates(orderOperates, record.orderState);
                /* 将操作菜单项的中文 label 翻译为当前语言 */
                const translatedOperates = operates?.map(op => (op && 'label' in op) ? { ...op, label: t(op.label as string) } : op) || [];
                return (
                    <Space>
                        {/* 检测订单：无权限隐藏（§7.2） */}
                        {canCheck && (
                            <Button
                                size="small"
                                type="link"
                                disabled={record.orderState !== "IN_QUEUE"}
                                onClick={() => handleMockDispatch(record)}
                            >
                                {t("检测")}
                            </Button>
                        )}
                        {/* 详情：view 行为，不限权 */}
                        <Button
                            size="small"
                            type="link"
                            onClick={() => handleOpenDetailTab(record)}
                        >
                            {t("详情")}
                        </Button>
                        {/* 操作 Dropdown（粗粒度码 §7.4）：无权限隐藏入口 */}
                        {canOperate && (
                            <Dropdown.Button
                                type="primary"
                                trigger={["click"]}
                                menu={{
                                    items: translatedOperates,
                                    onClick: (event) => onOperateClick(event, record)
                                }}
                            >
                                {t("操作项")}
                            </Dropdown.Button>
                        )}
                    </Space>
                )
            },
            ellipsis: { showTitle: true }
        }
    ];

    return (
        <div className={styles.record_table}>
            <SearchForm
                searchParams={searchParams}
                setSearchParams={setSearchParams}
                setOpenCreateOrder={setOpenCreateOrder}
            />
            <Table<Records>
                virtual
                columns={columns}
                dataSource={orderRecords}
                pagination={{
                    ...paginationParams,
                    hideOnSinglePage: false,
                    showSizeChanger: true,
                    pageSizeOptions: [10, 20, 50, 100, 200],
                    showTotal: (total) => t("总数{total}条", { total }),
                    responsive: true
                }}
                onChange={onTableChange}
                rowKey={row => row.orderKey}
                scroll={{ x: 1700, y: tableScrollY, scrollToFirstRowOnChange: true }}
            />
            <OrderCancelModal
                open={openCancelModal}
                orderKey={orderKey}
                setOpenCancelModal={setOpenCancelModal}
                run={run}
            />
            <MockDispatchModal
                open={openDispatchModal}
                setOpenModal={setOpenDispatchModal}
                orderTaskKey={orderTaskKey}
            />
            <CreateOrderModal
                open={openCreateOrder}
                setOpenCreateOrder={setOpenCreateOrder}
            />
            <OrderInfoModal
                open={openOrderInfoModal}
                orderKey={orderInfoKey}
                onClose={() => setOpenOrderInfoModal(false)}
            />
        </div>
    )
};
