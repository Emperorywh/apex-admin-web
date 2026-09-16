import { getTaskProgress, uploadPlaybackFile } from '@/api';
import { CheckCircleOutlined, InboxOutlined } from '@ant-design/icons';
import { Button, Modal, Progress, Steps, Upload, message } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/hooks/useI18n';
import styles from './index.less';

const { Dragger } = Upload;

/** 导入弹窗组件的属性接口 */
interface ImportModalProps {
    open: boolean;
    onCancel: () => void;
    onSuccess?: () => void;
}

/** 导入弹窗组件，负责处理文件上传、数据解析和展示导入结果 */
export const ImportModal: React.FC<ImportModalProps> = ({
    open,
    onCancel,
    onSuccess,
}) => {
    const { t } = useI18n();
    // currentStep: 0: 上传中, 1: 解析处理中, 2: 已完成
    const [currentStep, setCurrentStep] = useState(0);
    // progress: 当前步骤的进度百分比
    const [progress, setProgress] = useState(0);
    // isUploading: 标识当前是否正在上传文件
    const [isUploading, setIsUploading] = useState(false);
    // 轮询定时器引用
    const pollIntervalRef = useRef<NodeJS.Timeout>();

    // 当弹窗打开时，重置组件状态
    useEffect(() => {
        if (open) {
            setCurrentStep(0);
            setProgress(0);
            setIsUploading(false);
        }
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, [open]);

    /**
     * 真实文件上传和后续的数据处理流程
     * @param file 用户选择上传的文件对象
     */
    const simulateUploadAndProcess = async (file: File) => {
        setIsUploading(true);
        setCurrentStep(0);
        setProgress(0);

        try {
            setProgress(50);

            const res = await uploadPlaybackFile(file);
            if (res.code === 200 && res.data) {
                setProgress(100);
                setTimeout(() => {
                    startProcessing(res.data);
                }, 400);
            } else {
                message.error(res.message || t('上传文件失败'));
                setIsUploading(false);
            }
        } catch (error) {
            message.error(t('上传过程发生异常'));
            setIsUploading(false);
        }
    };

    /**
     * 真实数据处理和解析流程
     * @param taskId 数据处理任务 ID
     */
    const startProcessing = (taskId: string) => {
        setCurrentStep(1);
        setProgress(0);

        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

        pollIntervalRef.current = setInterval(async () => {
            try {
                const res = await getTaskProgress({ taskId });
                if (res.code === 200 && res.data) {
                    const { percent, status, errorMessage } = res.data;
                    setProgress(percent);

                    if (status === 'completed' || percent >= 100) {
                        clearInterval(pollIntervalRef.current);
                        setProgress(100);
                        setTimeout(() => {
                            setCurrentStep(2);
                            message.success(t('导入成功！'));
                            if (onSuccess) {
                                onSuccess();
                            }
                        }, 400);
                    } else if (status === 'failed') {
                        clearInterval(pollIntervalRef.current);
                        message.error(errorMessage || t('数据解析失败'));
                        setIsUploading(false);
                    }
                }
            } catch (error) {
                clearInterval(pollIntervalRef.current);
                message.error(t('获取解析进度异常'));
                setIsUploading(false);
            }
        }, 1000);
    };

    // 文件上传组件配置
    const uploadProps = {
        name: 'file',
        multiple: false,
        showUploadList: false,
        beforeUpload: (file: File) => {
            simulateUploadAndProcess(file);
            return false; // 阻止默认上传行为，手动处理
        },
    };

    return (
        <Modal
            title={t("导入数据")}
            open={open}
            onCancel={!isUploading || currentStep === 2 ? onCancel : undefined}
            footer={null}
            closable={!isUploading || currentStep === 2}
            maskClosable={false}
            width={520}
            centered
        >
            <div className={styles.container}>
                {!isUploading && currentStep === 0 ? (
                    <div className={styles.dragger_wrapper}>
                        <Dragger {...uploadProps}>
                            <p className="ant-upload-drag-icon">
                                <InboxOutlined style={{ color: '#3b82f6' }} />
                            </p>
                            <p
                                className={`ant-upload-text ${styles.dragger_text}`}
                            >
                                {t("点击或拖拽文件到此区域进行上传")}
                            </p>
                            <p
                                className={`ant-upload-hint ${styles.dragger_hint}`}
                            >
                                {t("支持 .json, .csv 等格式的轨迹数据文件")}
                            </p>
                        </Dragger>
                    </div>
                ) : (
                    <div className={styles.wrapper}>
                        <Steps
                            current={currentStep}
                            items={[
                                { title: t('上传文件') },
                                { title: t('数据解析') },
                                { title: t('完成') },
                            ]}
                            className={styles.steps}
                        />

                        {currentStep < 2 ? (
                            <div className={styles.progress_container}>
                                <Progress
                                    type="circle"
                                    percent={progress}
                                    strokeColor={{
                                        '0%': '#3b82f6',
                                        '100%': '#10b981',
                                    }}
                                    size={160}
                                    strokeWidth={8}
                                />
                                <div className={styles.progress_text}>
                                    {currentStep === 0
                                        ? t('正在上传文件，请勿关闭窗口...')
                                        : t('正在解析数据，这可能需要一些时间...')}
                                </div>
                            </div>
                        ) : (
                            <div className={styles.result_container}>
                                <CheckCircleOutlined
                                    className={styles.success_icon}
                                />
                                <div className={styles.success_text}>
                                    {t("数据导入成功")}
                                </div>
                                <Button
                                    type="primary"
                                    size="large"
                                    onClick={onCancel}
                                    className={styles.close_btn}
                                >
                                    {t("完成并查看")}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ImportModal;
