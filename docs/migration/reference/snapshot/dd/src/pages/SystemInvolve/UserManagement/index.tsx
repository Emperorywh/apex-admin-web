/**
 * @description 用户管理页面
 * 支持用户的分页查询、新增、删除、状态切换、修改密码、重置密码以及角色分配
 */
import { useEffect, useState } from "react";
import { Input, Space, Button, Table, Switch, message, Popconfirm } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { GetProps, TableProps, PaginationProps } from "antd";
import styles from "./index.less";
import {
    pageUsers,
    deleteUser,
    updateUserState,
    resetPassword,
} from "@/api";
import type { AuthUser, AuthUserState } from "@/api";
import UserModal from "./UserModal";
import PasswordModal from "./PasswordModal";
import RoleAssignModal from "./RoleAssignModal";
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
    // 新增用户弹窗
    const [openUserModal, setOpenUserModal] = useState<boolean>(false);
    // 修改密码弹窗
    const [openPasswordModal, setOpenPasswordModal] = useState<boolean>(false);
    // 分配角色弹窗
    const [openRoleAssignModal, setOpenRoleAssignModal] = useState<boolean>(false);
    // 当前操作的用户（修改密码 / 分配角色）
    const [currentUser, setCurrentUser] = useState<AuthUser>();
    // 分页参数
    const [paginationProps, setPaginationProps] = useState<PaginationProps>({
        pageSize: 10,
        current: 1,
        total: 0,
    });
    // 表格数据
    const [userRecords, setUserRecords] = useState<AuthUser[]>([]);
    // 表格加载状态
    const [loading, setLoading] = useState<boolean>(false);
    // 状态切换中的用户 id（用于 Switch loading，防止重复点击）
    const [togglingId, setTogglingId] = useState<number>();

    /**
     * 分页查询用户列表
     */
    const getUsers = () => {
        setLoading(true);
        pageUsers(searchParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                const data = res?.data;
                const { records, total, size, current } = data;
                setUserRecords(records || []);
                setPaginationProps({
                    pageSize: size,
                    current,
                    total,
                });
            } else {
                message.warning(t("查询用户列表失败") + res?.message);
            }
            setLoading(false);
        }).catch(err => {
            if (err) {
                setLoading(false);
                message.error(t("查询用户列表失败") + err?.message);
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
    const onTableChange: TableProps<AuthUser>["onChange"] = (pagination) => {
        const { pageSize = 10, current = 1 } = pagination;
        setSearchParams({
            ...searchParams,
            pageNo: current,
            pageSize,
        });
    };

    /**
     * 打开新增用户弹窗
     */
    const handleAdd = () => {
        setOpenUserModal(true);
    };

    /**
     * 打开修改密码弹窗
     */
    const handlePassword = (record: AuthUser) => {
        setCurrentUser(record);
        setOpenPasswordModal(true);
    };

    /**
     * 打开分配角色弹窗
     */
    const handleAssignRoles = (record: AuthUser) => {
        setCurrentUser(record);
        setOpenRoleAssignModal(true);
    };

    /**
     * 切换用户状态：乐观更新本地，接口失败再刷新回滚
     */
    const handleToggleState = (record: AuthUser, checked: boolean) => {
        const nextState: AuthUserState = checked ? "ENABLED" : "DISABLED";
        // 乐观更新本地状态，使 Switch 即时响应
        setUserRecords(prev =>
            prev.map(u => (u.id === record.id ? { ...u, state: nextState } : u)),
        );
        setTogglingId(record.id);
        updateUserState({ username: record.username, state: nextState })
            .then(res => {
                if (res.code === 200 && res.message === "success") {
                    message.success(t("修改状态成功"));
                } else {
                    message.warning(t("修改状态失败") + res?.message);
                    getUsers(); // 接口失败，刷新列表回滚
                }
            })
            .catch(err => {
                if (err) {
                    message.error(t("修改状态失败") + err?.message);
                    getUsers();
                }
            })
            .finally(() => setTogglingId(undefined));
    };

    /**
     * 重置密码（一键重置为默认密码）
     */
    const resetConfirm = (record: AuthUser) => {
        resetPassword({ id: record.id }).then(res => {
            if (res.code === 200 && res.message === "success") {
                // 重置成功后提示默认新密码，便于告知操作人
                message.success(
                    t("重置密码成功，新密码为：{password}", {
                        password: "123456",
                    }),
                );
            } else {
                message.warning(t("重置密码失败") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("重置密码失败") + err?.message);
            }
        });
    };

    /**
     * 删除用户
     */
    const deleteConfirm = (record: AuthUser) => {
        deleteUser({ id: record.id }).then(res => {
            if (res.code === 200 && res.message === "success") {
                getUsers();
                message.success(t("删除用户成功"));
            } else {
                message.warning(t("删除用户失败") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("删除用户失败") + err?.message);
            }
        });
    };

    /**
     * 表格列配置
     */
    const columns: TableProps<AuthUser>["columns"] = [
        {
            title: t("用户名"),
            dataIndex: "username",
            ellipsis: { showTitle: true },
        },
        {
            title: t("状态"),
            dataIndex: "state",
            width: 100,
            render: (value: AuthUserState, record) => (
                <Switch
                    checked={value === "ENABLED"}
                    loading={togglingId === record.id}
                    onChange={checked => handleToggleState(record, checked)}
                    checkedChildren={t("启用")}
                    unCheckedChildren={t("禁用")}
                />
            ),
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
            width: 360,
            render: (_, record) => (
                <Space>
                    <Button onClick={() => handlePassword(record)}>
                        {t("修改密码")}
                    </Button>
                    <Popconfirm
                        title={t("重置密码")}
                        description={t("确定重置该用户密码?")}
                        onConfirm={() => resetConfirm(record)}
                        okText={t("确定")}
                        cancelText={t("取消")}
                    >
                        <Button>{t("重置密码")}</Button>
                    </Popconfirm>
                    <Button type="primary" onClick={() => handleAssignRoles(record)}>
                        {t("分配角色")}
                    </Button>
                    <Popconfirm
                        title={t("删除用户")}
                        description={t("确定删除当前用户?")}
                        onConfirm={() => deleteConfirm(record)}
                        okText={t("确定")}
                        cancelText={t("取消")}
                    >
                        <Button danger>{t("删除")}</Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    /**
     * 监听查询参数变化，重新查询列表
     */
    useEffect(() => {
        getUsers();
    }, [searchParams]);

    return (
        <div className={styles.user_management}>
            <div className={styles.user_header}>
                <Search
                    style={{ width: 360 }}
                    placeholder={t("查询用户")}
                    onSearch={onSearch}
                    enterButton
                />
                <Space>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAdd}
                    >
                        {t("新增用户")}
                    </Button>
                </Space>
            </div>
            <Table<AuthUser>
                style={{ marginTop: 10 }}
                loading={loading}
                columns={columns}
                dataSource={userRecords}
                rowKey={r => r.id}
                scroll={{ x: 1100, y: "calc(100vh - 250px)" }}
                pagination={{
                    ...paginationProps,
                    showTotal: (total) => t("总数{total}条", { total }),
                    hideOnSinglePage: false,
                    showSizeChanger: true,
                }}
                onChange={onTableChange}
            />
            <UserModal
                open={openUserModal}
                setOpenModal={setOpenUserModal}
                refreshList={getUsers}
            />
            <PasswordModal
                open={openPasswordModal}
                username={currentUser?.username}
                setOpenModal={setOpenPasswordModal}
            />
            <RoleAssignModal
                open={openRoleAssignModal}
                userId={currentUser?.id}
                username={currentUser?.username}
                setOpenModal={setOpenRoleAssignModal}
                refreshList={getUsers}
            />
        </div>
    );
};
