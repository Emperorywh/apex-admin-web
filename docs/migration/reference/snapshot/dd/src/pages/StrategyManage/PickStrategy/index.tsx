import { useEffect, useState } from "react";
import { Button, message, Popconfirm, Space, Table, TableProps, Input } from "antd";
import { PageParams, PickStrategyType } from "../type";
import EditStrategy from "../EditStrategy";
import { deleteActionStrategy, getActionStrategies } from "@/api";
import type { PaginationProps, GetProps } from "antd";
import { useI18n } from "@/hooks/useI18n";

type SearchProps = GetProps<typeof Input.Search>;

const { Search } = Input;

export default () => {
    /* 国际化翻译方法 */ const { t } = useI18n();
    const strategyColumns: TableProps<PickStrategyType>["columns"] = [
        {
            title: t("策略名称"),
            dataIndex: "strategyName",
            key: "strategyName",
            ellipsis: { showTitle: true }
        },
        {
            title: t("偏转横向偏移"),
            dataIndex: "lateralOffset",
            key: "lateralOffset",
            ellipsis: { showTitle: true }
        },
        {
            title: t("偏转纵向偏移"),
            dataIndex: "verticalOffset",
            key: "verticalOffset",
            ellipsis: { showTitle: true }
        },
        {
            title: t("叉尺抬升高度"),
            dataIndex: "forkLiftHeightDeviation",
            key: "forkLiftHeightDeviation",
            ellipsis: { showTitle: true }
        },
        {
            title: t("叉尺提前抬升距离"),
            dataIndex: "forkLiftAdvanceHeight",
            key: "forkLiftAdvanceHeight",
            ellipsis: { showTitle: true }
        },

        {
            title: t("托盘抬升高度"),
            dataIndex: "trayLiftHeight",
            key: "trayLiftHeight",
            ellipsis: { showTitle: true }
        },
        {
            title: t("货架层高补偿"),
            dataIndex: "shelfHeightCompensation",
            key: "shelfHeightCompensation",
            ellipsis: { showTitle: true }
        },
        {
            title: t("安全检测尺寸"),
            dataIndex: "safetyInspectionDimensions",
            key: "safetyInspectionDimensions",
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            key: "action",
            fixed: "right",
            width: 200,
            render: (_, record: PickStrategyType) => (
                <Space size="middle">
                    <Button type="primary" onClick={() => handleEditStrategy(record)}>{t("编辑")}</Button>
                    <Popconfirm
                        title={t("确认要删除这个策略吗")}
                        onConfirm={() => handleDeleteStrategy(record)}
                        okText={t("确认")}
                        cancelText={t("取消")}
                    >
                        <Button danger type="primary">{t("删除")}</Button>
                    </Popconfirm>
                </Space>

            ),
            ellipsis: { showTitle: true }
        },
    ];

    const [messageApi, contextHolder] = message.useMessage();
    const [showEditModal, setShowWditModal] = useState<boolean>(false)
    const [currentStrategyData, setCurrentStrategyData] = useState<PickStrategyType | null>(null)
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        total: 0,
        pageSize: 10,
        current: 1
    });
    const [pageParams, setPageParams] = useState<PageParams>({
        pageSize: 10,
        pageNo: 1,
        strategyType: 'pick',
        query: ""
    })
    const [strategyData, setStrategyData] = useState<PickStrategyType[]>();

    // 编辑策略
    const handleEditStrategy = (record: PickStrategyType | null) => {
        // console.log({ record })
        setCurrentStrategyData(record)
        setShowWditModal(true)
    }
    // 删除策略
    const handleDeleteStrategy = async (record: PickStrategyType) => {
        const { id } = record
        const formData = new FormData();
        formData.append("id", id as unknown as string);
        try {
            const { code, message } = await deleteActionStrategy(formData)
            if (code !== 200) {
                messageApi.warning(t("删除策略失败") + "," + message)
                return
            }
            messageApi.success(t("删除策略成功"))
            getTableData()
        } catch (e) {
            messageApi.error(t("删除策略失败") + "," + e)
        }
    }

    // 关键字查询
    const onStrategySearch: SearchProps["onSearch"] = (value) => {
        setPageParams({
            ...pageParams,
            query: value,
            pageNo: 1
        })
    };

    const onTableChange: TableProps<PickStrategyType>["onChange"] = (pagination) => {
        // console.log("点击分页", pagination)
        const { current = 1, pageSize = 10 } = pagination;
        setPageParams({
            ...pageParams,
            pageNo: current,
            pageSize
        });
    }

    const getTableData = () => {
        getActionStrategies(pageParams).then(res => {
            const { code, message, data: { records, total, size, current } } = res
            if (code !== 200) {
                messageApi.warning(t("查询策略数据出错") + "，" + message)
                return
            }
            setStrategyData(records)
            setPaginationProps({
                ...paginationProps,
                total,
                pageSize: size,
                current
            })
        }).catch(e => {
            messageApi.error(t("查询策略数据出错") + "，" + e)
        })
    }

    useEffect(() => {
        getTableData()
    }, [pageParams])


    return (
        <div style={{ padding: 20 }}>
            {contextHolder}
            <Space
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    margin: "0 0 20px 0"
                }}
            >
                <Search
                    style={{ width: 256 }}
                    placeholder={t("请输入策略名查询")}
                    onSearch={onStrategySearch}
                    enterButton
                />
                <Button type='primary' onClick={() => handleEditStrategy(null)}>{t("新增取货策略")}</Button>
            </Space>
            <Table<PickStrategyType>
                columns={strategyColumns}
                dataSource={strategyData}
                rowKey={r => r.id as number}
                onChange={onTableChange}
                scroll={{ x: 800, y: "calc(100vh - 280px)" }}
                pagination={{
                    ...paginationProps,
                    showSizeChanger: true,
                    hideOnSinglePage: false,
                    showTotal: total => t("共 {total} 条", { total })
                }}
            />
            <EditStrategy
                showEditModal={showEditModal}
                strategyData={currentStrategyData}
                setShowWditModal={setShowWditModal}
                strategyType={'pick'}
                getTableData={getTableData}
            />
        </div>
    );
};
