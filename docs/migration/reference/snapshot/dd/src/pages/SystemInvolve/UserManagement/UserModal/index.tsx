/**
 * @description 用户新增弹窗
 * 对应接口：新增用户 addUser（用户名 + 密码）
 */
import { Modal, Form, Input, message } from "antd";
import { addUser } from "@/api";
import { useI18n } from "@/hooks/useI18n";
import { md5 } from "@/utils/crypto";

/** 用户表单字段类型 */
type UserFormValues = {
    username: string;
    password: string;
    confirm: string;
};

interface UserModalProps {
    /** 弹窗是否打开 */
    open: boolean;
    /** 关闭弹窗 */
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
    /** 刷新列表回调 */
    refreshList: () => void;
}

export default (props: UserModalProps) => {
    const { open, setOpenModal, refreshList } = props;
    /* 国际化翻译方法 */ const { t } = useI18n();

    const [form] = Form.useForm<UserFormValues>();

    /**
     * 弹窗确认：校验通过后调用新增用户
     */
    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            // 对密码与确认密码进行 MD5 加密后再提交，避免明文传输
            addUser({
                username: values.username,
                password: md5(values.password),
                confirm: md5(values.confirm),
            })
                .then(res => {
                    if (res.code === 200 && res.message === "success") {
                        refreshList();
                        setOpenModal(false);
                        form.resetFields();
                        message.success(t("新增用户成功"));
                    } else {
                        message.warning(t("新增用户失败") + res?.message);
                    }
                })
                .catch(err => {
                    if (err) {
                        message.error(t("新增用户失败") + err?.message);
                    }
                });
        } catch {
            // 校验失败，无需处理
        }
    };

    /**
     * 弹窗取消：关闭并重置表单
     */
    const handleCancel = () => {
        setOpenModal(false);
        form.resetFields();
    };

    return (
        <Modal
            title={t("新增用户")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
            destroyOnClose
        >
            <Form
                name="user-form"
                labelCol={{ span: 5 }}
                wrapperCol={{ span: 17 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<UserFormValues>
                    label={t("用户名")}
                    name="username"
                    rules={[
                        { required: true, message: t("请输入用户名") },
                        {
                            // 用户名仅允许字母、数字、下划线，长度 4-16 位
                            pattern: /^[a-zA-Z0-9_]{4,16}$/,
                            message: t("用户名只能包含字母、数字、下划线，长度4-16位"),
                        },
                    ]}
                >
                    <Input placeholder={t("请输入用户名")} maxLength={16} showCount />
                </Form.Item>

                <Form.Item<UserFormValues>
                    label={t("密码")}
                    name="password"
                    rules={[
                        { required: true, message: t("请输入密码") },
                        {
                            // 密码必须同时包含字母和数字，长度不超过 64 位
                            pattern: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{1,64}$/,
                            message: t("密码必须包含字母和数字，长度不超过64位"),
                        },
                    ]}
                >
                    <Input.Password placeholder={t("请输入密码")} maxLength={64} />
                </Form.Item>

                <Form.Item<UserFormValues>
                    label={t("确认密码")}
                    name="confirm"
                    dependencies={["password"]}
                    rules={[
                        { required: true, message: t("请再次输入密码") },
                        {
                            // 确认密码同样需满足字母+数字、长度不超过 64 位
                            pattern: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{1,64}$/,
                            message: t("密码必须包含字母和数字，长度不超过64位"),
                        },
                        ({ getFieldValue }) => ({
                            validator(_, value) {
                                if (!value || getFieldValue("password") === value) {
                                    return Promise.resolve();
                                }
                                return Promise.reject(
                                    new Error(t("两次输入的密码不一致")),
                                );
                            },
                        }),
                    ]}
                >
                    <Input.Password placeholder={t("请再次输入密码")} maxLength={64} />
                </Form.Item>
            </Form>
        </Modal>
    );
};
