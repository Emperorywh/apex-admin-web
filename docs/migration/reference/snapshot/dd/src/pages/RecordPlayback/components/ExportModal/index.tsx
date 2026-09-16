import {
    downloadExportedFile,
    getTaskProgress,
    startExportPlayback,
} from '@/api';
import { CheckCircleOutlined } from '@ant-design/icons';
import { Button, Modal, Progress, Steps, message } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/hooks/useI18n';
import styles from './index.less';

/** 导出弹窗组件的属性接口 */
interface ExportModalProps {
    open: boolean;
    onCancel: () => void;
    mapId?: string;
    startTs?: number;
    endTs?: number;
}

/** 导出弹窗组件，负责展示数据导出的整个流程：提交请求、生成数据、下载完成 */
export const ExportModal: React.FC<ExportModalProps> = ({
    open,
    onCancel,
    mapId,
    startTs,
    endTs,
}) => {
    const { t } = useI18n();
    // currentStep: 0: 请求中, 1: 处理中, 2: 已完成
    const [currentStep, setCurrentStep] = useState(0);
    // progress: 当前步骤的进度百分比
    const [progress, setProgress] = useState(0);
    // 轮询定时器引用
    const pollIntervalRef = useRef<NodeJS.Timeout>();
    // 心跳定时器引用
    const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
    // 是否正在导出中（用于 beforeunload 判断）
    const isExportingRef = useRef(false);

    // 页面关闭/刷新提醒
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isExportingRef.current) {
                e.preventDefault();
                e.returnValue = t('如果关闭页面，就会中断导出。');
                return e.returnValue;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    // 当弹窗打开时，重置状态并开始导出流程
    useEffect(() => {
        if (open) {
            if (!mapId || !startTs || !endTs) {
                message.error(t('请先选择地图并指定时间范围'));
                onCancel();
                return;
            }
            startExport();
        }
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
            isExportingRef.current = false;
        };
    }, [open, mapId, startTs, endTs]);

    /**
     * 开始导出流程
     */
    const startExport = async () => {
        setCurrentStep(0);
        setProgress(0);

        try {
            setProgress(50);
            const res = await startExportPlayback({
                mapId: mapId!,
                startTs: startTs!,
                endTs: endTs!,
            });
            if (res.code === 200 && res.data) {
                setProgress(100);
                setTimeout(() => {
                    pollProgress(res.data);
                }, 300);
            } else {
                message.error(res.message || t('发起导出请求失败'));
                onCancel();
            }
        } catch (error) {
            message.error(t('导出请求异常'));
            onCancel();
        }
    };

    /**
     * 清除心跳定时器
     */
    const clearHeartbeat = () => {
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = undefined;
        }
        isExportingRef.current = false;
    };

    /**
     * 轮询处理进度
     * @param taskId 任务 ID
     */
    const pollProgress = (taskId: string) => {
        setCurrentStep(1);
        setProgress(0);

        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

        pollIntervalRef.current = setInterval(async () => {
            try {
                const res = await getTaskProgress({ taskId });
                if (res.code === 200 && res.data) {
                    const { percent, status, errorMessage } = res.data;
                    setProgress(percent);

                    if (status === 'FINISHED' && percent >= 100) {
                        clearInterval(pollIntervalRef.current);
                        clearHeartbeat();
                        setProgress(100);
                        setTimeout(() => {
                            setCurrentStep(2);
                            downloadFile(taskId);
                        }, 400);
                    } else if (status === 'failed') {
                        clearInterval(pollIntervalRef.current);
                        clearHeartbeat();
                        message.error(errorMessage || t('生成导出数据失败'));
                        onCancel();
                    }
                }
            } catch (error) {
                clearInterval(pollIntervalRef.current);
                clearHeartbeat();
                message.error(t('获取进度异常'));
                onCancel();
            }
        }, 1000);
    };

    /**
     * 触发文件下载
     */
    const downloadFile = async (taskId: string) => {
        try {
            const blob = await downloadExportedFile({ taskId });
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `playback_export_${taskId}.zip`;
            document.body.appendChild(a);
            a.click();

            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            message.success(t('导出并下载成功！'));
        } catch (error) {
            message.error(t('下载导出文件失败'));
        }
    };

    return (
        <Modal
            title={t("导出数据")}
            open={open}
            onCancel={currentStep === 2 ? onCancel : undefined}
            footer={null}
            closable={currentStep === 2}
            maskClosable={false}
            width={520}
            centered
        >
            <div className={styles.container}>
                <Steps
                    current={currentStep}
                    items={[
                        { title: t('提交请求') },
                        { title: t('生成数据') },
                        { title: t('下载完成') },
                    ]}
                    className={styles.steps}
                />

                {currentStep < 2 ? (
                    <div className={styles.progress_container}>
                        <Progress
                            type="circle"
                            percent={progress}
                            strokeColor={{ '0%': '#3b82f6', '100%': '#10b981' }}
                            size={160}
                            strokeWidth={8}
                        />
                        <div className={styles.progress_text}>
                            {currentStep === 0
                                ? t('正在提交导出请求...')
                                : t('正在生成数据，请稍候...')}
                        </div>
                    </div>
                ) : (
                    <div className={styles.result_container}>
                        <CheckCircleOutlined className={styles.success_icon} />
                        <div className={styles.success_text}>
                            {t("文件已自动下载")}
                        </div>
                        <Button
                            type="primary"
                            size="large"
                            onClick={onCancel}
                            className={styles.close_btn}
                        >
                            {t("关闭")}
                        </Button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ExportModal;
