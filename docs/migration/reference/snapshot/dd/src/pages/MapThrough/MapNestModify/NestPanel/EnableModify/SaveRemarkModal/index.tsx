/**
 * @description 保存备注弹窗组件
 * @date 2026-6-1
 * @summary 用户保存地图版本时弹出，要求填写版本备注（必填）
 * 支持两种操作：确认保存（publish=false）和保存并发布（publish=true）
 */
import { useState, memo } from "react";
import { Modal, Input, Button } from "antd";
import { useI18n } from "@/hooks/useI18n";

const { TextArea } = Input;

interface SaveRemarkModalProps {
    /** 弹窗是否可见 */
    open: boolean;
    /**
     * 确认保存回调
     * @param remark 备注内容
     * @param publish 是否保存并发布
     */
    onConfirm: (remark: string, publish: boolean) => void;
    /** 取消回调 */
    onCancel: () => void;
    /** 确认按钮加载状态 */
    confirmLoading?: boolean;
}

export default memo((props: SaveRemarkModalProps) => {

    const { open, onConfirm, onCancel, confirmLoading } = props;

    /* 国际化翻译方法 */
    const { t } = useI18n();

    // 备注内容
    const [remark, setRemark] = useState<string>("");

    /**
     * 确认保存
     * 校验备注不为空后触发回调，publish 默认为 false
     */
    const handleConfirm = () => {
        if (!remark.trim()) return;
        onConfirm(remark.trim(), false);
    };

    /**
     * 保存并发布
     * 校验备注不为空后触发回调，publish 为 true
     */
    const handlePublish = () => {
        if (!remark.trim()) return;
        onConfirm(remark.trim(), true);
    };

    /**
     * 取消操作
     * 清空备注内容并关闭弹窗
     */
    const handleCancel = () => {
        setRemark("");
        onCancel();
    };

    return (
        <Modal
            title={t("保存版本备注")}
            open={open}
            onOk={handleConfirm}
            onCancel={handleCancel}
            okText={t("确认保存")}
            cancelText={t("取消")}
            okButtonProps={{ disabled: !remark.trim() }}
            confirmLoading={confirmLoading}
            destroyOnClose
            afterOpenChange={(visible) => {
                // 每次打开弹窗时清空备注
                if (visible) setRemark("");
            }}
            footer={(_, { OkBtn, CancelBtn }) => (
                <>
                    <CancelBtn />
                    <OkBtn />
                    <Button
                        type="primary"
                        disabled={!remark.trim()}
                        loading={confirmLoading}
                        onClick={handlePublish}
                    >
                        {t("保存并发布")}
                    </Button>
                </>
            )}
        >
            <TextArea
                value={remark}
                onChange={e => setRemark(e.target.value)}
                placeholder={t("请输入版本备注")}
                autoSize={{ minRows: 3, maxRows: 6 }}
                maxLength={500}
                showCount
                style={{marginBottom: 10}}
            />
        </Modal>
    );
});
