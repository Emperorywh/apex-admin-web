/**
 * @description 侧边栏订单栏
 * @date 2025-6-22
 */
import React, { memo, useState, useEffect, useRef, startTransition, useMemo } from "react";
import { Card, Button, Dropdown, Divider, Tag, Input, Select, theme, message, Typography } from "antd";
import { EllipsisOutlined, SearchOutlined } from "@ant-design/icons";
import { useRequest } from "ahooks";
import { useModel } from "@umijs/max";
import VirtualList from "rc-virtual-list";
import { orderTaskOperate, getSimpleVehicles, pageOrderTasks } from "@/api";
import type { Records, MenuInfo, TaskOperate } from "@/types/OrderRecord";
import type { SimpleVehicle } from "@/types/VehicleDeploy/GroupType";
import { orderStateUnfold, orderOperates, orderStateOptions } from "@/constants/OrderRecord/orderRecord";
import { disableOrderOperates } from "@/utils/format";
import OrderCancelModal from "@/components/OrderCancelModal";
import MockDispatchModal from "@/components/MockDispatchModal";
import OrderInfoModal from "@/components/OrderInfoModal";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

const { useToken } = theme;

/**
 * 订单列表组件的属性接口
 */
interface OrderListProps {
    /**
     * 面板的高度引用，用于动态设置组件容器的高度
     */
    panelHeight: React.MutableRefObject<number>;
}

export default memo((props: OrderListProps) => {

    /**
     * 解构获取外部传入的面板高度引用
     */
    const { panelHeight } = props;

    /* 国际化翻译方法，用于将订单列表的所有文案进行多语言转换 */
    const { t } = useI18n();

    /* 按钮级权限判定（SPEC §8.3）：订单 检测/操作 */
    const { hasPerm } = useAccess();
    const canCheck = hasPerm(PERM_BUTTON.OVERVIEW_ORDER_RECORD_CHECK); // 检测订单（§7.2）
    const canOperate = hasPerm(PERM_BUTTON.OVERVIEW_ORDER_RECORD_OPERATE); // 操作 Dropdown（§7.2/§7.4 粗粒度码）

    const { currentMapInfo } = useModel("currentMapInfo");

    /**
     * 控制模拟调度弹窗的显示与隐藏状态
     */
    const [openModal, setOpenModal] = useState<boolean>(false);

    /**
     * 当前选中的订单任务唯一标识，用于传递给操作弹窗
     */
    const [orderTaskKey, setOrderTaskKey] = useState<string>("");

    /**
     * 控制取消订单弹窗的显示与隐藏状态
     */
    const [openCancelModal, setOpenCancelModal] = useState<boolean>(false);

    /**
     * 当前选中的订单唯一标识，用于取消订单等操作
     */
    const [orderKey, setOrderKey] = useState<string>("");

    /**
     * 控制订单详情弹窗的显示与隐藏状态
     */
    const [openOrderInfoModal, setOpenOrderInfoModal] = useState<boolean>(false);

    /**
     * 订单详情弹窗对应的订单标识
     */
    const [orderInfoKey, setOrderInfoKey] = useState<string>("");

    /**
     * 当前地图下的全量订单任务数据（由后端一次性返回）
     * 顶部筛选条件统一在前端基于该数据进行本地过滤
     */
    const [orderRecords, setOrderRecords] = useState<Records[]>([]);

    const [searchName, setSearchName] = useState<string>("");

    const [searchState, setSearchState] = useState<string | undefined>(undefined);

    const [searchVehicleKey, setSearchVehicleKey] = useState<string | undefined>(undefined);

    const [simpleVehicles, setSimpleVehicles] = useState<SimpleVehicle[]>([]);

    const prevFingerprintRef = useRef<string>("");

    /**
     * 获取 Ant Design 的设计 token，用于应用主题样式
     */
    const { token } = useToken();

    /**
     * 弹出菜单的自定义样式容器，使用主题 token 设置背景、圆角和阴影
     */
    const contentStyle: React.CSSProperties = {
        backgroundColor: token.colorBgElevated,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
    };

    /**
     * 使用 ahooks 的 useRequest 查询当前地图下的全部订单任务
     * 后端一次性返回全量数据，仅依赖地图 id 触发重新拉取
     * 顶部的任务名称/状态/执行车辆筛选均在前端基于返回结果进行本地过滤
     * 包含轮询配置及成功/失败的回调处理
     */
    const { run } = useRequest(async () => {
        const result = await pageOrderTasks({ mapId: currentMapInfo?.mapId });
        return result;
    }, {
        pollingInterval: 3000,
        pollingWhenHidden: false,
        pollingErrorRetryCount: 1,
        refreshDeps: [currentMapInfo?.mapId],
        onSuccess: (data) => {
            if (data?.code === 200 && data?.message === "success") {
                const formatData = data?.data?.map?.((item: any) => {
                    return {
                        ...item,
                        id: item?.key,
                        orderKey: item?.key,
                        orderName: item?.name,
                        orderState: item?.state,
                        executeVehicleKey: item?.processingVehicle?.key,
                        executeVehicleName: item?.processingVehicle?.name,
                    }
                });
                const fingerprint = JSON.stringify(
                    formatData?.map((item: any) => [item.orderKey, item.orderState, item.executeVehicleKey, item.executeVehicleName])
                );
                if (fingerprint !== prevFingerprintRef.current) {
                    prevFingerprintRef.current = fingerprint;
                    startTransition(() => {
                        setOrderRecords(formatData);
                    });
                }
            }
        },
        onError: (err) => message.error(t("查询订单记录出错") + err?.message)
    });

    /**
     * 前端过滤：根据任务名称、任务状态、执行车辆对全量订单数据进行本地筛选
     * 任务名称支持按订单名称或编号模糊匹配（忽略大小写）
     * 任务状态与执行车辆为精确匹配；任一筛选条件为空时该条件不参与过滤
     */
    const filteredOrderRecords = useMemo(() => {
        return orderRecords.filter(item => {
            if (searchName) {
                const keyword = searchName.toLowerCase();
                const matchedName = (item.orderName || "").toLowerCase().includes(keyword);
                const matchedKey = (item.orderKey || "").toLowerCase().includes(keyword);
                if (!matchedName && !matchedKey) return false;
            }
            if (searchState && item.orderState !== searchState) return false;
            if (searchVehicleKey && item.executeVehicleKey !== searchVehicleKey) return false;
            return true;
        });
    }, [orderRecords, searchName, searchState, searchVehicleKey]);

    /**
     * 组件挂载时执行的副作用钩子
     * 用于获取并设置车辆下拉列表的数据
     */
    useEffect(() => {
        getSimpleVehicles().then(res => {
            if (res.code === 200 && res.message === "success") {
                setSimpleVehicles(res?.data || []);
            } else {
                message.warning(t("查询车辆出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询车辆出错") + err?.message);
            }
        });
    }, []);

    /**
     * 处理订单标题的点击事件
     * 打开订单详情弹窗
     * @param record 当前点击的订单记录数据
     */
    const handleOrderInfoClick = (record: Records) => {
        setOrderInfoKey(record?.orderKey);
        setOpenOrderInfoModal(true);
    };

    /**
     * 处理“检测”（模拟调度）按钮的点击事件
     * 打开模拟调度弹窗并设置当前订单的任务 Key
     * @param record 当前操作的订单记录数据
     */
    const handleMockDispatch = (record: Records) => {
        setOpenModal(true);
        setOrderTaskKey(record.orderKey);
    };

    /**
     * 发起订单任务操作（如下发、暂停、恢复等）的网络请求
     * 操作成功后会重新刷新列表数据
     * @param operate 包含操作类型及订单信息的参数对象
     */
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

    /**
     * 处理“操作”下拉菜单的点击事件
     * 根据点击的菜单项（如取消订单或其他操作）执行对应逻辑
     * @param menuInfo 下拉菜单返回的点击信息，包含选中的 key
     * @param record 当前操作的订单记录数据
     */
    const onMenuClick = ({ key }: MenuInfo, record: Records) => {
        if (key === "CMD_ORDER_CANCEL") {
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

    /**
     * 根据订单状态获取对应的状态标签（Tag 组件）
     * @param orderState 订单的状态枚举值
     * @returns 渲染好的 Ant Design Tag 组件
     */
    const getStateTag = (orderState: Records["orderState"]) => {
        const target = orderStateUnfold.find(item => item.enum === orderState);
        return <Tag color={target?.color}>{t(target?.chName || "NULL")}</Tag>;
    };

    return (
        <div style={{ height: panelHeight?.current + 50, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "0 0 8px", display: "flex", flexDirection: "column", gap: 6 }}>
                <Input
                    size="small"
                    placeholder={t("任务名称")}
                    prefix={<SearchOutlined />}
                    allowClear
                    value={searchName}
                    onChange={e => setSearchName(e.target.value)}
                />
                <div style={{ display: "flex", gap: 6 }}>
                    <Select
                        size="small"
                        placeholder={t("任务状态")}
                        allowClear
                        style={{ flex: 1 }}
                        options={orderStateOptions?.filter(opt => !["SUCCEEDED", "CANCELLED", "FAILED"].includes(opt?.value as string))?.map(opt => ({ ...opt, label: t(opt.label as string) })) || []}
                        value={searchState}
                        onChange={val => {
                            setSearchState(val);
                        }}
                    />
                    <Select
                        size="small"
                        placeholder={t("执行车辆")}
                        allowClear
                        showSearch
                        optionFilterProp="name"
                        fieldNames={{ label: "name", value: "key" }}
                        style={{ flex: 1 }}
                        options={simpleVehicles}
                        value={searchVehicleKey}
                        onChange={val => {
                            setSearchVehicleKey(val);
                        }}
                    />
                </div>
            </div>

            <div style={{ flex: 1 }}>
                <VirtualList
                    data={filteredOrderRecords}
                    height={panelHeight.current}
                    itemHeight={160}
                    itemKey="orderKey"
                >
                    {(record: Records) => {
                        const operates = disableOrderOperates(orderOperates, record.orderState);
                        /* 将操作菜单项的中文 label 翻译为当前语言 */
                        const translatedOperates = operates?.map(op => (op && 'label' in op) ? { ...op, label: t(op.label as string) } : op) || [];

                        return (
                            <Card
                                key={record.orderKey}
                                size="small"
                                style={{ marginBottom: 8 }}
                                title={
                                    <span
                                        style={{ color: "#1677FF", cursor: "pointer", fontSize: 13 }}
                                        onClick={() => handleOrderInfoClick(record)}
                                    >
                                        {record.orderName || record.orderKey}
                                    </span>
                                }
                                extra={getStateTag(record.orderState)}
                            >
                                <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 8 }}>
                                    <div style={{ marginBottom: 4, display: "flex", alignItems: "center" }}>
                                        <span style={{ color: token.colorTextTertiary, flexShrink: 0 }}>{t("编号：")}</span>
                                        <Typography.Text
                                            copyable
                                            ellipsis={{ tooltip: record.orderKey }}
                                            style={{ flex: 1, minWidth: 0 }}
                                        >
                                            {record.orderKey}
                                        </Typography.Text>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center" }}>
                                        <span style={{ color: token.colorTextTertiary, flexShrink: 0 }}>{t("执行车辆：")}</span>
                                        <Typography.Text
                                            copyable={!!record.executeVehicleName}
                                            ellipsis={{ tooltip: record.executeVehicleName || "-" }}
                                            style={{ flex: 1, minWidth: 0 }}
                                        >
                                            {record.executeVehicleName || "-"}
                                        </Typography.Text>
                                    </div>
                                </div>
                                <Divider style={{ margin: "8px 0" }} />
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    {/* 检测订单：无权限隐藏（§7.2） */}
                                    {canCheck && (
                                        <Button
                                            type="primary"
                                            size="small"
                                            disabled={record.orderState !== "IN_QUEUE"}
                                            onClick={() => handleMockDispatch(record)}
                                        >
                                            {t("检测")}
                                        </Button>
                                    )}
                                    {/* 操作 Dropdown（粗粒度码 §7.4）：无权限隐藏入口 */}
                                    {canOperate && (
                                        <Dropdown
                                            placement="bottomRight"
                                            menu={{
                                                items: translatedOperates,
                                                onClick: (event) => onMenuClick(event, record)
                                            }}
                                            popupRender={(menu) => (
                                                <div style={contentStyle}>
                                                    {React.cloneElement(
                                                        menu as React.ReactElement<{
                                                            style: React.CSSProperties;
                                                        }>,
                                                        { style: { boxShadow: "none" } }
                                                    )}
                                                </div>
                                            )}
                                        >
                                            <Button size="small" icon={<EllipsisOutlined />}>{t("操作")}</Button>
                                        </Dropdown>
                                    )}
                                </div>
                            </Card>
                        );
                    }}
                </VirtualList>
            </div>

            <MockDispatchModal
                open={openModal}
                orderTaskKey={orderTaskKey}
                setOpenModal={setOpenModal}
            />
            <OrderCancelModal
                open={openCancelModal}
                orderKey={orderKey}
                setOpenCancelModal={setOpenCancelModal}
            />
            <OrderInfoModal
                open={openOrderInfoModal}
                orderKey={orderInfoKey}
                onClose={() => setOpenOrderInfoModal(false)}
            />
        </div>
    )
});
