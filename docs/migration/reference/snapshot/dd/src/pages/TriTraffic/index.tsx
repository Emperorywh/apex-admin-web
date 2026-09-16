/**
 * @description 三方交管
 * @date 2026-1-15
 */
import { useState, useEffect } from "react";
import { Input, Space, Button, Table, message, Popconfirm, Dropdown } from "antd";
import type { GetProps, TableProps, PaginationProps, MenuProps } from "antd";
import styles from "./index.less";
import TrafficModal from "./TrafficModal";
import { pageTripartiteTraffics, deleteTripartiteTraffic, testCommunication, getSimpleTripartiteTrafficEdgeGroups } from "@/api";
import type { PageTrafficType, TriTrafficResponse, TriTrafficRecord, TestCommunicationType, SimpleTrafficEdgeGroups } from "@/types/TriTraffic";
import { testControls } from "@/constants/TriTraffic";
import { MenuInfo } from "@/types/OrderRecord";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

const { Search } = Input;

type SearchProps = GetProps<typeof Input.Search>;

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();
/* 按钮级权限判定（三方交管 新增/编辑/删除/检测） */ const { hasPerm } = useAccess();

    // 弹窗
    const [openModal, setOpenModal] = useState<boolean>(false);
    // 查询参数
    const [searchParams, setSearchParams] = useState<PageTrafficType>({
        pageNo: 1,
        pageSize: 10,
        areaCode: ""
    });
    // 页码参数
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        current: 1,
        pageSize: 10,
        total: 0
    });
    // 表格数据
    const [trafficRecords, setTrafficRecords] = useState<TriTrafficRecord[]>([]);
    // 要编辑的项目
    const [updateRecord, setUpdateRecord] = useState<TriTrafficRecord>();
    // 点边组合
    const [edgeGroups, setEdgeGroups] = useState<SimpleTrafficEdgeGroups[]>([]);

    // 查询交管信息
    const getTraffics = () => {
        pageTripartiteTraffics(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: TriTrafficResponse = res?.data;
                const { records, current, size, total } = data;
                setTrafficRecords(records);
                setPaginationProps({
                    current,
                    pageSize: size,
                    total
                });
            } else {
                message.warning(t("查询交管信息出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询交管信息出错") + err?.message);
            }
        })
    };

    // 查询事件
    const onSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            pageNo: 1,
            areaCode: value
        });
    };

    const onTableChange: TableProps<TriTrafficRecord>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize
        });
    };

    const handleOpenModal = () => {
        setOpenModal(true);
        setUpdateRecord(undefined);
    };

    const handleUpdateRecord = (record: TriTrafficRecord) => {
        setOpenModal(true);
        setUpdateRecord(record);
    };

    // 删除的事件
    const onDleteConfirm = (record: TriTrafficRecord) => {
        deleteTripartiteTraffic(record).then(res => {
            if (res.code === 200 && res.message === "success") {
                getTraffics();
                message.success(t("删除三方交管成功"));
            } else {
                message.warning(t("删除三方交管出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除三方交管出错") + err?.message);
            }
        })
    };

    // 检测
    const onTestCommunicationClick = ({ key }: MenuInfo, record: TriTrafficRecord) => {
        const data: TestCommunicationType = {
            applyType: key,
            areaCode: record.areaCode,
            systemCode: "rxx"
        };
        testCommunication(data).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("三方交管测试成功"));
            } else {
                message.warning(t("三方交管测试出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("三方交管测试出错") + err?.message);
            }
        })
    };

    const columns: TableProps<TriTrafficRecord>["columns"] = [
        {
            title: t("区域编号"),
            dataIndex: "areaCode",
            ellipsis: { showTitle: true }
        },
        {
            title: t("点边组合"),
            dataIndex: "nodeEdgeGroupId",
            render: (value) => edgeGroups.find(group => group.id === value)?.name || value,
            ellipsis: { showTitle: true }
        },
        {
            title: t("当前占用系统"),
            dataIndex: "lockedSys",
            ellipsis: { showTitle: true }
        },
        {
            title: t("是否外部系统作为仲裁方"),
            dataIndex: "isExternalArbitrator",
            render: (value) => value ? t("是") : t("否"),
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            width: 300,
            fixed: "right",
            render: (_, record) => (
                <Space size="middle">
                    {/* 检测 Dropdown（粗粒度码 traffic:tripartite:check）：无权限隐藏入口，子项不再细分（SPEC §7.4） */}
                    {hasPerm(PERM_BUTTON.TRAFFIC_TRIPARTITE_CHECK) && (
                        <Dropdown
                            menu={{
                                items: testControls?.map(op => op && "label" in op ? { ...op, label: t(op.label as string) } : op),
                                onClick: (event) => onTestCommunicationClick(event, record)
                            }}
                        >
                            <Button type="primary">
                                {t("检测")}
                            </Button>
                        </Dropdown>
                    )}
                    {/* 编辑：无 traffic:tripartite:update 权限时单项隐藏，保留空操作列（SPEC §7.2） */}
                    {hasPerm(PERM_BUTTON.TRAFFIC_TRIPARTITE_UPDATE) && (
                        <Button
                            type="primary"
                            onClick={() => handleUpdateRecord(record)}
                        >
                            {t("编辑")}
                        </Button>
                    )}
                    {/* 删除：无 traffic:tripartite:delete 权限时单项隐藏 */}
                    {hasPerm(PERM_BUTTON.TRAFFIC_TRIPARTITE_DELETE) && (
                        <Popconfirm
                            title={t("删除")}
                            description={t("确认删除当前项?")}
                            onConfirm={() => onDleteConfirm(record)}
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

    useEffect(() => {
        getTraffics();
    }, [searchParams])

    useEffect(() => {
        getSimpleTripartiteTrafficEdgeGroups().then(res => {
            if (res.code === 200 && res.message === "success") {
                setEdgeGroups(res?.data || []);
            } else {
                message.warning(t("查询三方交管点边组合出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询三方交管点边组合出错") + err?.message);
            }
        })
    }, [])

    return (
        <div className={styles.tri_traffic}>
            <div className={styles.search}>
                <Search
                    placeholder={t("请输入区域编号查询")}
                    style={{ width: 360 }}
                    enterButton
                    onSearch={onSearch}
                />
                <Space>
                    {/* 新增三方交管：无 traffic:tripartite:add 权限时隐藏入口 */}
                    {hasPerm(PERM_BUTTON.TRAFFIC_TRIPARTITE_ADD) && (
                        <Button type="primary" onClick={handleOpenModal}>{t("新增三方交管")}</Button>
                    )}
                </Space>
            </div>
            <Table<TriTrafficRecord>
                columns={columns}
                dataSource={trafficRecords}
                scroll={{ x: 1050, y: "calc(100vh - 280px)" }}
                rowKey={r => r.id as unknown as string}
                pagination={{
                    ...paginationProps,
                    showSizeChanger: true,
                    hideOnSinglePage: false,
                    showTotal: (total) => t("总数{total}条", { total })
                }}
                onChange={onTableChange}
            />
            <TrafficModal
                open={openModal}
                edgeGroups={edgeGroups}
                updateRecord={updateRecord}
                setOpenModal={setOpenModal}
                getTraffics={getTraffics}
            />
        </div>
    )
};
