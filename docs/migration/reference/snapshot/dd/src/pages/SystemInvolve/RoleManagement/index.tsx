/**
 * @description 角色管理页面
 * 支持角色的分页查询、新增、编辑、删除以及权限分配
 */
import { useEffect, useState } from "react";
import { Input, Space, Button, Table, message, Popconfirm } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { GetProps, TableProps, PaginationProps } from "antd";
import styles from "./index.less";
import { pageRoles, deleteRole } from "@/api";
import type { AuthRole } from "@/api";
import RoleModal from "./RoleModal";
import PermissionModal from "./PermissionModal";
import { useI18n } from "@/hooks/useI18n";

const { Search } = Input;
type SearchProps = GetProps<typeof Input.Search>;

export default () => {
    /* 国际化翻译方法 */ const { t } = useI18n();

    // 查询参数
    const [searchParams, setSearchParams] = useState<{
        pageSize: number;
        pageNo: number;
        query: string;
    }>({ pageSize: 10, pageNo: 1, query: "" });
    // 新增 / 编辑弹窗
    const [openModal, setOpenModal] = useState<boolean>(false);
    // 是否编辑状态
    const [isModify, setIsModify] = useState<boolean>(false);
    // 编辑的行
    const [modifyRow, setModifyRow] = useState<AuthRole>();
    // 分页参数
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        pageSize: 10,
        current: 1,
        total: 0,
    });
    // 表格数据
    const [roleRecords, setRoleRecords] = useState<AuthRole[]>([]);
    // 表格加载状态
    const [loading, setLoading] = useState<boolean>(false);
    // 权限分配弹窗
    const [openPermissionModal, setOpenPermissionModal] = useState<boolean>(false);
    // 当前分配权限的角色
    const [currentRole, setCurrentRole] = useState<AuthRole>();

    /**
     * 分页查询角色列表
     */
    const getRoles = () => {
        setLoading(true);
        pageRoles(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data = res?.data;
                const { records, total, size, current } = data;
                setRoleRecords(records || []);
                setPaginationProps({
                    pageSize: size,
                    current,
                    total,
                });
            } else {
                message.warning(t("查询角色列表失败") + res?.message);
            }
            setLoading(false);
        }).catch(err => {
            if (err) {
                setLoading(false);
                message.error(t("查询角色列表失败") + err?.message);
            }
        });
    };

    /**
     * 关键字搜索（重置到第一页）
     */
    const onSearch: SearchProps["onSearch"] = (value) => {
        setSearchParams({
            ...searchParams,
            pageNo: 1,
            query: value,
        });
    };

    /**
     * 表格分页变化
     */
    const onTableChange: TableProps<AuthRole>["onChange"] = (pagination) => {
        const { pageSize = 10, current = 1 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize,
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
    const handleEdit = (record: AuthRole) => {
        setIsModify(true);
        setModifyRow(record);
        setOpenModal(true);
    };

    /**
     * 打开权限分配弹窗
     */
    const handleAssignPermission = (record: AuthRole) => {
        setCurrentRole(record);
        setOpenPermissionModal(true);
    };

    /**
     * 删除角色
     */
    const deleteConfirm = (record: AuthRole) => {
        deleteRole({ id: record.id }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getRoles();
                message.success(t("删除角色成功"));
            } else {
                message.warning(t("删除角色失败") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除角色失败") + err?.message);
            }
        });
    };

    /**
     * 表格列配置
     */
    const columns: TableProps<AuthRole>["columns"] = [
        {
            title: t("角色编码"),
            dataIndex: "code",
            ellipsis: { showTitle: true },
        },
        {
            title: t("角色名称"),
            dataIndex: "name",
            ellipsis: { showTitle: true },
        },
        {
            title: t("状态"),
            dataIndex: "state",
            width: 90,
            render: (value: string) => (value === "ENABLED" ? t("启用") : t("禁用")),
            ellipsis: { showTitle: true },
        },
        {
            title: t("创建时间"),
            dataIndex: "createTime",
            ellipsis: { showTitle: true },
        },
        {
            title: t("更新时间"),
            dataIndex: "updateTime",
            ellipsis: { showTitle: true },
        },
        {
            title: t("操作"),
            fixed: "right",
            width: 260,
            render: (_, record) => (
                <Space>
                    <Button type="primary" onClick={() => handleEdit(record)}>
                        {t("编辑")}
                    </Button>
                    <Button onClick={() => handleAssignPermission(record)}>
                        {t("分配权限")}
                    </Button>
                    <Popconfirm
                        title={t("删除角色")}
                        description={t("确定删除当前角色?")}
                        onConfirm={() => deleteConfirm(record)}
                        okText={t("确定")}
                        cancelText={t("取消")}
                    >
                        <Button danger>{t("删除")}</Button>
                    </Popconfirm>
                </Space>
            ),
            ellipsis: { showTitle: true },
        },
    ];

    /**
     * 监听查询参数变化，重新查询列表
     */
    useEffect(() => {
        getRoles();
    }, [searchParams]);

    return (
        <div className={styles.role_management}>
            <div className={styles.role_header}>
                <Search
                    style={{ width: 360 }}
                    placeholder={t("查询角色")}
                    onSearch={onSearch}
                    enterButton
                />
                <Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                        {t("新增角色")}
                    </Button>
                </Space>
            </div>
            <Table<AuthRole>
                style={{ marginTop: 10 }}
                loading={loading}
                columns={columns}
                dataSource={roleRecords}
                rowKey={r => r.id}
                scroll={{ x: 800, y: "calc(100vh - 250px)" }}
                pagination={{
                    ...paginationProps,
                    showTotal: (total) => t("总数{total}条", { total }),
                    hideOnSinglePage: false,
                    showSizeChanger: true,
                }}
                onChange={onTableChange}
            />
            <RoleModal
                open={openModal}
                isModify={isModify}
                modifyRow={modifyRow}
                refreshList={getRoles}
                setOpenModal={setOpenModal}
            />
            <PermissionModal
                open={openPermissionModal}
                roleId={currentRole?.id}
                roleName={currentRole?.name}
                setOpenModal={setOpenPermissionModal}
            />
        </div>
    );
};
