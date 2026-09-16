/**
 * @description 载具类型管理页面
 * @date 2025-5-19
 */
import { useState, useEffect } from "react";
import { Table, Input, Space, Button, message, Popconfirm } from "antd";
import { PlusOutlined, SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import type { TableColumnsType, TableProps, TablePaginationConfig } from "antd";
import styles from "./index.less";
import CarrierModal from "./CarrierModal";
import type { CarrierRecord, CarrierPageResult, PageCarrierParams } from "@/types/VehicleDeploy/CarrierType";
import { pageCarriers, deleteCarrier } from "@/api";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

export default () => {
    /* 国际化翻译方法 */ const { t } = useI18n();

    /* 按钮级权限判定（SPEC §8.1）：新增/编辑/删除载具类型 */
    const { hasPerm } = useAccess();
    const canAdd = hasPerm(PERM_BUTTON.CARRIER_ADD); // 新增载具类型（§7.1）
    const canUpdate = hasPerm(PERM_BUTTON.CARRIER_UPDATE); // 编辑载具类型（§7.2）
    const canDelete = hasPerm(PERM_BUTTON.CARRIER_DELETE); // 删除载具类型（§7.2）

    /**
     * 弹窗显示状态
     */
    const [openModal, setOpenModal] = useState<boolean>(false);
    /**
     * 表格数据
     */
    const [carrierData, setCarrierData] = useState<CarrierRecord[]>([]);
    /**
     * 表格加载状态
     */
    const [tableLoading, setTableLoading] = useState<boolean>(false);
    /**
     * 查询参数
     */
    const [searchParams, setSearchParams] = useState<PageCarrierParams>({
        pageNo: 1,
        pageSize: 10,
        carrierName: "",
        carrierCode: "",
    });
    /**
     * 分页参数
     */
    const [paginationParams, setPaginationParams] = useState<TablePaginationConfig>({
        current: 1,
        pageSize: 10,
        total: 0,
    });
    /**
     * 是否编辑模式
     */
    const [isModify, setIsModify] = useState<boolean>(false);
    /**
     * 编辑行的数据
     */
    const [modifyRow, setModifyRow] = useState<CarrierRecord>();

    /**
     * 查询载具类型列表
     */
    const getCarrierList = (params?: PageCarrierParams) => {
        setTableLoading(true);
        pageCarriers(params || searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data: CarrierPageResult = res.data;
                const { records, total, size, current } = data;
                setCarrierData(records || []);
                setPaginationParams({
                    current,
                    pageSize: size,
                    total,
                });
            } else {
                message.warning(t("查询载具类型失败") + res?.message);
            }
            setTableLoading(false);
        }).catch(err => {
            if (err) {
                setTableLoading(false);
                message.error(t("查询载具类型失败") + err?.message);
            }
        })
    };

    /**
     * 查询关键字暂存（输入时不直接触发查询）
     */
    const [keywordName, setKeywordName] = useState<string>("");
    const [keywordCode, setKeywordCode] = useState<string>("");

    /**
     * 点击查询按钮，统一触发搜索
     */
    const onSearch = () => {
        setSearchParams(prev => ({
            ...prev,
            pageNo: 1,
            carrierName: keywordName,
            carrierCode: keywordCode,
        }));
    };

    /**
     * 重置搜索条件
     */
    const onReset = () => {
        setKeywordName("");
        setKeywordCode("");
        setSearchParams({
            pageNo: 1,
            pageSize: 10,
            carrierName: "",
            carrierCode: "",
        });
    };

    /**
     * 打开新增弹窗
     */
    const handleAdd = () => {
        setIsModify(false);
        setModifyRow(undefined);
        setOpenModal(true);
    };

    /**
     * 打开编辑弹窗
     */
    const handleEdit = (record: CarrierRecord) => {
        if (!record) return;
        setIsModify(true);
        setModifyRow(record);
        setOpenModal(true);
    };

    /**
     * 删除载具类型
     */
    const onConfirmDelete = (record: CarrierRecord) => {
        const { id } = record;
        if (!id) return;
        deleteCarrier({ id }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getCarrierList();
                message.success(t("删除载具类型成功"));
            } else {
                message.warning(t("删除载具类型失败") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除载具类型失败") + err?.message);
            }
        })
    };

    /**
     * 分页改变事件
     */
    const onTableChange: TableProps<CarrierRecord>["onChange"] = (pagination) => {
        const { current = 1, pageSize = 10 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize,
        });
    };

    /**
     * 表格列配置
     */
    const columns: TableColumnsType<CarrierRecord> = [
        {
            title: t("载具名称"),
            dataIndex: "carrierName",
            ellipsis: { showTitle: true }
        },
        {
            title: t("载具编码"),
            dataIndex: "carrierCode",
            ellipsis: { showTitle: true }
        },
        {
            title: t("载具长度(mm)"),
            dataIndex: "carrierLength",
            align: "center",
            ellipsis: { showTitle: true }
        },
        {
            title: t("载具宽度(mm)"),
            dataIndex: "carrierWidth",
            align: "center",
            ellipsis: { showTitle: true }
        },
        {
            title: t("创建时间"),
            dataIndex: "createTime",
            ellipsis: { showTitle: true }
        },
        {
            title: t("操作"),
            fixed: "right",
            width: 180,
            render: (_, record) => (
                <Space>
                    {/* 编辑载具类型：无权限隐藏（§7.2） */}
                    {canUpdate && (
                        <Button type="primary" onClick={() => handleEdit(record)}>{t("编辑")}</Button>
                    )}
                    {/* 删除载具类型：无权限隐藏（§7.2） */}
                    {canDelete && (
                        <Popconfirm
                            title={t("删除载具类型")}
                            description={t("确定删除当前载具类型?")}
                            onConfirm={() => onConfirmDelete(record)}
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

    /**
     * 监听查询参数变化，重新查询列表
     */
    useEffect(() => {
        getCarrierList(searchParams);
    }, [searchParams])

    return (
        <div className={styles.carrier_table}>
            <div className={styles.carrier_header}>
                <div className={styles.search}>
                    <Input
                        placeholder={t("载具名称")}
                        value={keywordName}
                        onChange={e => setKeywordName(e.target.value)}
                        onPressEnter={onSearch}
                        allowClear
                    />
                    <Input
                        placeholder={t("载具编码")}
                        value={keywordCode}
                        onChange={e => setKeywordCode(e.target.value)}
                        onPressEnter={onSearch}
                        allowClear
                    />
                    <Button type="primary" icon={<SearchOutlined />} onClick={onSearch}>{t("查询")}</Button>
                    <Button icon={<ReloadOutlined />} onClick={onReset}>{t("重置")}</Button>
                </div>
                <div className={styles.actions}>
                    <Space>
                        {/* 新增载具类型：无权限隐藏（§7.1） */}
                        {canAdd && (
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleAdd}
                            >
                                {t("新增载具类型")}
                            </Button>
                        )}
                    </Space>
                </div>
            </div>
            <Table<CarrierRecord>
                columns={columns}
                loading={tableLoading}
                dataSource={carrierData}
                rowKey={r => String(r.id)}
                scroll={{ x: 800, y: "calc(100vh - 320px)" }}
                pagination={{
                    ...paginationParams,
                    hideOnSinglePage: false,
                    showSizeChanger: true,
                    showTotal: (total) => t("总数{total}条", { total })
                }}
                onChange={onTableChange}
            />
            <CarrierModal
                open={openModal}
                isModify={isModify}
                modifyRow={modifyRow}
                setOpenModal={setOpenModal}
                getCarriers={() => getCarrierList()}
            />
        </div>
    )
};
