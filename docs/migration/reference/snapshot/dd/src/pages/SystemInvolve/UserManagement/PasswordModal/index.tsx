/**
 * @description 修改用户密码弹窗
 * 对应接口：更新用户密码 updateUserPassword（按用户名设置新密码）
 */
import { Modal, Form, Input, message } from "antd";
import { updateUserPassword } from "@/api";
import { useI18n } from "@/hooks/useI18n";
import { md5 } from "@/utils/crypto";

/** 密码表单字段类型 */
type PasswordFormValues = {
    password: string;
    confirm: string;
};

interface PasswordModalProps {
    /** 弹窗是否打开 */
    open: boolean;
    /** 当前修改密码的用户名 */
    username?: string;
    /** 关闭弹窗 */
    setOpenModal: (value: React.SetStateAction<boolean>) => void;
}

export default (props: PasswordModalProps) => {
    const { open, username, setOpenModal } = props;
    /* 国际化翻译方法 */ const { t } = useI18n();

    const [form] = Form.useForm<PasswordFormValues>();

    /**
     * 弹窗确认：校验通过后调用更新密码
     */
    const handleOk = async () => {
        if (!username) return;
        try {
            const values = await form.validateFields();
            // 对新密码进行 MD5 加密后再提交，避免明文传输
            updateUserPassword({ username, password: md5(values.password) })
                .then(res => {
                    if (res.code === 200 && res.message === "success") {
                        setOpenModal(false);
                        form.resetFields();
                        message.success(t("修改密码成功"));
                    } else {
                        message.warning(t("修改密码失败") + res?.message);
                    }
                })
                .catch(err => {
                    if (err) {
                        message.error(t("修改密码失败") + err?.message);
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
            title={t("修改密码") + (username ? ` - ${username}` : "")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
            destroyOnClose
        >
            <Form
                name="password-form"
                labelCol={{ span: 5 }}
                wrapperCol={{ span: 17 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<PasswordFormValues>
                    label={t("新密码")}
                    name="password"
                    rules={[
                        { required: true, message: t("请输入新密码") },
                        { min: 6, message: t("密码至少6位") },
                    ]}
                >
                    <Input.Password placeholder={t("请输入新密码")} maxLength={32} />
                </Form.Item>

                <Form.Item<PasswordFormValues>
                    label={t("确认密码")}
                    name="confirm"
                    dependencies={["password"]}
                    rules={[
                        { required: true, message: t("请再次输入新密码") },
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
                    <Input.Password placeholder={t("请再次输入新密码")} maxLength={32} />
                </Form.Item>
            </Form>
        </Modal>
    );
};
