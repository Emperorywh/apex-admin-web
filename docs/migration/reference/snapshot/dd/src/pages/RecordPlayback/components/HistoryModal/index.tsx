import { deleteImportRecording, pageImportRecordings } from '@/api';
import { ImportRecording } from '@/types/PlaybackTypings';
import { DeleteOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Popconfirm, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/hooks/useI18n';
import styles from './index.less';

/**
 * 历史回放弹窗组件的属性接口
 * 用于控制弹窗的显示、关闭以及选中录制文件后的回调
 */
interface HistoryModalProps {
    /**
     * 弹窗是否打开
     */
    open: boolean;
    /**
     * 关闭弹窗的回调
     */
    onCancel: () => void;
    /**
     * 用户选中某条录制记录后的回调，
     * 将选中的录制记录传递给父组件
     */
    onSelect?: (record: ImportRecording) => void;
}

/**
 * 默认每页显示的记录条数
 */
const DEFAULT_PAGE_SIZE = 10;

/**
 * 历史回放弹窗组件
 * 展示已导入的录制文件列表，支持关键字搜索、分页浏览、
 * 删除记录以及选择某条记录进行回放
 */
export const HistoryModal: React.FC<HistoryModalProps> = ({
    open,
    onCancel,
    onSelect,
}) => {
    const { t } = useI18n();
    /**
     * 录制文件记录列表数据
     */
    const [dataSource, setDataSource] = useState<ImportRecording[]>([]);

    /**
     * 记录总数，用于分页组件显示
     */
    const [total, setTotal] = useState(0);

    /**
     * 当前页码（从1开始）
     */
    const [currentPage, setCurrentPage] = useState(1);

    /**
     * 每页显示的记录条数
     */
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    /**
     * 搜索关键字，对应文件名/名称的模糊匹配
     */
    const [keyword, setKeyword] = useState('');

    /**
     * 表格数据是否正在加载中
     */
    const [loading, setLoading] = useState(false);

    /**
     * 从服务端获取已导入录制文件的分页数据
     * @param page 当前页码
     * @param size 每页条数
     * @param kw 搜索关键字
     */
    const fetchData = useCallback(
        async (page: number, size: number, kw: string) => {
            setLoading(true);
            try {
                const res = await pageImportRecordings({
                    pageNo: page,
                    pageSize: size,
                    keyword: kw || undefined,
                });
                if (res.code === 200 && res.data) {
                    setDataSource(res.data.records || []);
                    setTotal(res.data.total || 0);
                } else {
                    message.error(res.message || t('查询录制列表失败'));
                }
            } catch {
                message.error(t('查询录制列表异常'));
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    /**
     * 弹窗打开时重置状态并拉取第一页数据，
     * 弹窗关闭时清空搜索关键字和分页状态
     */
    useEffect(() => {
        if (open) {
            setCurrentPage(1);
            setKeyword('');
            fetchData(1, pageSize, '');
        }
    }, [open]);

    /**
     * 处理搜索操作：将页码重置为1并使用关键字请求数据
     */
    const handleSearch = () => {
        setCurrentPage(1);
        fetchData(1, pageSize, keyword);
    };

    /**
     * 处理分页变化：更新页码和每页条数并重新请求数据
     * @param page 新的页码
     * @param size 新的每页条数
     */
    const handlePageChange = (page: number, size: number) => {
        setCurrentPage(page);
        setPageSize(size);
        fetchData(page, size, keyword);
    };

    /**
     * 删除指定的录制记录，
     * 删除成功后刷新当前页数据
     * @param record 要删除的录制记录
     */
    const handleDelete = async (record: ImportRecording) => {
        try {
            const res = await deleteImportRecording({ id: record.id });
            if (res.code === 200) {
                message.success(t('删除成功'));
                fetchData(currentPage, pageSize, keyword);
            } else {
                message.error(res.message || t('删除失败'));
            }
        } catch {
            message.error(t('删除操作异常'));
        }
    };

    /**
     * 用户选中某条录制记录进行回放，
     * 触发 onSelect 回调并关闭弹窗
     * @param record 用户选中的录制记录
     */
    const handleSelect = (record: ImportRecording) => {
        if (onSelect) {
            onSelect(record);
        }
        onCancel();
    };

    /**
     * 格式化时间戳字符串为可读的日期时间格式
     * @param ts 时间戳字符串（毫秒级数字字符串或 ISO 格式）
     * @returns 格式化后的时间字符串
     */
    const formatTime = (ts: string) => {
        if (!ts) return '-';
        const parsed = dayjs(Number(ts) || ts);
        return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : ts;
    };

    /**
     * 表格列定义，描述每一列的标题、数据映射和渲染规则
     */
    const columns: ColumnsType<ImportRecording> = [
        {
            title: t('名称'),
            dataIndex: 'name',
            key: 'name',
            width: 160,
            ellipsis: true,
        },
        {
            title: t('文件名'),
            dataIndex: 'fileName',
            key: 'fileName',
            width: 180,
            ellipsis: true,
        },
        {
            title: t('地图ID'),
            dataIndex: 'mapId',
            key: 'mapId',
            width: 120,
            ellipsis: true,
            render: (mapId: string) => (
                <Tag color="blue">{mapId}</Tag>
            ),
        },
        {
            title: t('开始时间'),
            dataIndex: 'startTs',
            key: 'startTs',
            width: 170,
            render: (ts: string) => formatTime(ts),
            ellipsis: { showTitle: true }
        },
        {
            title: t('结束时间'),
            dataIndex: 'endTs',
            key: 'endTs',
            width: 170,
            render: (ts: string) => formatTime(ts),
            ellipsis: { showTitle: true }
        },
        {
            title: t('导入时间'),
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 170,
            render: (ts: string) => formatTime(ts),
            ellipsis: { showTitle: true }
        },
        {
            title: t('操作'),
            key: 'action',
            width: 200,
            fixed: 'right',
            render: (_, record) => (
                <div className={styles.action_column}>
                    <Button
                        type="link"
                        size="small"
                        icon={<PlayCircleOutlined />}
                        onClick={() => handleSelect(record)}
                    >
                        {t('回放')}
                    </Button>
                    <Popconfirm
                        title={t("确认删除")}
                        description={t("删除后无法恢复，确定要删除这条记录吗？")}
                        onConfirm={() => handleDelete(record)}
                        okText={t("确定")}
                        cancelText={t("取消")}
                    >
                        <Button
                            type="link"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                        >
                            {t('删除')}
                        </Button>
                    </Popconfirm>
                </div>
            ),
            ellipsis: { showTitle: true }
        },
    ];

    return (
        <Modal
            title={t("历史回放")}
            open={open}
            onCancel={onCancel}
            footer={null}
            width={1000}
            centered
            destroyOnClose
        >
            <div className={styles.container}>
                <div className={styles.toolbar}>
                    <Input.Search
                        placeholder={t("搜索名称或文件名")}
                        allowClear
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        onSearch={handleSearch}
                        onPressEnter={handleSearch}
                        style={{ width: 280 }}
                    />
                </div>
                <Table<ImportRecording>
                    rowKey="id"
                    columns={columns}
                    dataSource={dataSource}
                    loading={loading}
                    scroll={{ x: 1100 }}
                    pagination={{
                        current: currentPage,
                        pageSize,
                        total,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total) => t("共 {total} 条", { total }),
                        onChange: handlePageChange,
                    }}
                />
            </div>
        </Modal>
    );
};

export default HistoryModal;
