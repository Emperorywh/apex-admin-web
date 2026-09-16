/**
 * @description 地图版本管理弹窗组件
 * 以独立弹窗形式展示某个地图的版本列表，
 * 支持关键字搜索、发布状态筛选、分页，
 * 以及编辑、发布、推送、下载操作
 * @date 2026-6-1
 */
import { downloadMap, pageMapInfoVersions, publishMapInfoVersion } from "@/api";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";
import type {
  MapInfoVersion,
  PageMapInfoVersionsParams,
} from "@/types/MapVersion";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { history } from "@umijs/max";
import { useDebounceFn } from "ahooks";
import type { TablePaginationConfig, TableProps } from "antd";
import {
  Button,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import PushVersionModal from "../PushVersionModal";
import styles from "./index.less";

/**
 * 版本管理弹窗组件属性
 * @param open 弹窗是否可见
 * @param mapId 当前地图id
 * @param mapName 当前地图名称（用于弹窗标题）
 * @param onClose 关闭弹窗回调（父组件负责刷新主列表）
 */
interface VersionModalProps {
  open: boolean;
  mapId: string | null;
  mapName: string | null;
  onClose: () => void;
}

/**
 * 发布状态筛选选项
 * all-全部 / published-已发布 / unpublished-未发布
 */
const PUBLISH_FILTER_OPTIONS = [
  { label: "全部", value: "all" },
  { label: "已发布", value: "published" },
  { label: "未发布", value: "unpublished" },
];

export default ({ open, mapId, mapName, onClose }: VersionModalProps) => {
  /* 国际化翻译方法 */ const { t } = useI18n();

  /* 按钮级权限判定（SPEC §8.2 版本弹窗内按钮，§7.7）：弹窗内按钮仍挂权限码 */
  const { hasPerm } = useAccess();
  const canUpdate = hasPerm(PERM_BUTTON.MAP_VERSION_UPDATE); // 编辑版本
  const canPublish = hasPerm(PERM_BUTTON.MAP_VERSION_PUBLISH); // 发布版本
  const canDownload = hasPerm(PERM_BUTTON.MAP_VERSION_DOWNLOAD); // 下载版本
  /* 版本列表原始数据（接口返回） */
  const [versionList, setVersionList] = useState<MapInfoVersion[]>([]);
  /* 加载状态 */
  const [loading, setLoading] = useState<boolean>(false);
  /* 分页配置 */
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  /* 推送弹窗可见状态 */
  const [pushModalOpen, setPushModalOpen] = useState<boolean>(false);
  /* 当前推送的版本id */
  const [pushVersionId, setPushVersionId] = useState<number | null>(null);
  /* 操作loading状态集合（防止并发操作） */
  const [operatingIds, setOperatingIds] = useState<Set<number>>(new Set());

  /* 搜索关键字 */
  const [searchQuery, setSearchQuery] = useState<string>("");
  /* 用 ref 保存最新搜索关键字，避免 fetchVersions 依赖 searchQuery 导致不必要的重建 */
  const searchQueryRef = useRef<string>(searchQuery);
  /* 防抖搜索：输入停止 300ms 后自动触发查询 */
  const { run: debouncedSearch } = useDebounceFn(
    (value: string) => {
      fetchVersions(1, pagination.pageSize as number, value);
    },
    { wait: 300 },
  );

  /**
   * 查询版本列表数据
   * searchQuery 通过 ref 读取，不作为 useCallback 依赖
   */
  const fetchVersions = useCallback(
    (pageNo: number = 1, pageSize: number = 10, query?: string) => {
      if (!mapId) return;
      setLoading(true);
      const params: PageMapInfoVersionsParams = {
        mapId,
        pageNo,
        pageSize,
        query: query ?? searchQueryRef.current,
      };
      pageMapInfoVersions(params)
        .then((res: any) => {
          if (res.code === 200 && res.message === "success") {
            const { records, current, size, total } = res?.data || {};
            setVersionList(records || []);
            setPagination({
              current: current || pageNo,
              pageSize: size || pageSize,
              total: total || 0,
            });
          } else {
            message.warning(t("查询版本数据出错") + res?.message);
            setVersionList([]);
          }
        })
        .catch((err: any) => {
          message.error(t("查询版本数据出错") + err?.message);
          setVersionList([]);
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [mapId],
  );

  /**
   * 弹窗打开时加载第一页数据（依赖 open 状态变化）
   */
  useEffect(() => {
    if (open && mapId) {
      /* 重置搜索和分页状态 */
      setSearchQuery("");
      searchQueryRef.current = "";
      setPagination({ current: 1, pageSize: 10, total: 0 });
      fetchVersions(1, 10, "");
    }
  }, [open, mapId]);

  /**
   * 搜索按钮回调：重置到第一页并重新查询
   */
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    searchQueryRef.current = value;
    fetchVersions(1, pagination.pageSize as number, value);
  };

  /**
   * 搜索框内容变更，防抖后自动触发查询
   * 清空时立即重置查询（无防抖）
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    searchQueryRef.current = val;
    /* 输入框清空时立即重置查询 */
    if (!val) {
      fetchVersions(1, pagination.pageSize as number, "");
      return;
    }
    /* 输入内容防抖 300ms 后自动触发搜索 */
    debouncedSearch(val);
  };

  /**
   * 刷新当前页数据
   */
  const handleRefresh = () => {
    fetchVersions(pagination.current as number, pagination.pageSize as number);
  };

  /**
   * 分页变更回调
   */
  const handleTableChange: TableProps<MapInfoVersion>["onChange"] = (pag) => {
    const { current = 1, pageSize = 10 } = pag;
    fetchVersions(current, pageSize);
  };

  /**
   * 添加操作loading标记
   */
  const addOperating = (id: number) => {
    setOperatingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  /**
   * 移除操作loading标记
   */
  const removeOperating = (id: number) => {
    setOperatingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  /**
   * 跳转到地图编辑器（查看/编辑）
   * 先关闭弹窗再跳转，返回后重新打开版本管理即可
   */
  const handleViewOrEdit = (record: MapInfoVersion) => {
    onClose();
    history.push(
      `/map-through/map-nest-modify?mapId=${record.mapId}&mapVersionId=${record.id}`,
    );
  };

  /**
   * 发布版本
   */
  const handlePublish = (record: MapInfoVersion) => {
    addOperating(record.id);
    publishMapInfoVersion({ mapVersionId: record.id })
      .then((res: any) => {
        if (res.code === 200 && res.message === "success") {
          message.success(t("发布版本成功"));
          fetchVersions(
            pagination.current as number,
            pagination.pageSize as number,
          );
        } else {
          message.warning(t("发布版本出错") + res?.message);
        }
      })
      .catch((err: any) => {
        message.error(t("发布版本出错") + err?.message);
      })
      .finally(() => {
        removeOperating(record.id);
      });
  };

  /**
   * 打开推送弹窗
   */
  const handleOpenPushModal = (record: MapInfoVersion) => {
    setPushVersionId(record.id);
    setPushModalOpen(true);
  };

  /**
   * 推送成功回调
   */
  const handlePushSuccess = () => {
    setPushModalOpen(false);
    setPushVersionId(null);
    fetchVersions(pagination.current as number, pagination.pageSize as number);
  };

  /**
   * 关闭推送弹窗
   */
  const handlePushClose = () => {
    setPushModalOpen(false);
    setPushVersionId(null);
  };

  /**
   * 下载地图文件
   * getResponse: true 时返回 Response 对象，res.data 为 ArrayBuffer，
   * res.headers 为 Headers 对象
   */
  const handleDownload = (record: MapInfoVersion) => {
    downloadMap({ mapInfoVersionId: record.id })
      .then((res: any) => {
        /* 从 content-disposition 解析文件名 */
        const disposition =
          res?.headers?.get?.("content-disposition") ||
          res?.headers?.["content-disposition"];
        let fileName = `${record.mapName || t("地图")}_${record.mapVersion || t("未知版本")
          }.zip`;
        if (disposition) {
          const match = disposition.match(
            /filename\*?=(?:UTF-8''|"?)([^";]+)/i,
          );
          if (match) {
            fileName = decodeURIComponent(match[1].replace(/"/g, ""));
          }
        }
        /* res.data 是 ArrayBuffer，直接创建 Blob */
        const blob = new Blob([res.data], {
          type: "application/zip",
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      })
      .catch((err: any) => {
        message.error(t("下载地图文件出错") + err?.message);
      });
  };

  /**
   * 版本列表列定义
   */
  const columns: TableProps<MapInfoVersion>["columns"] = [
    {
      title: t("版本号"),
      dataIndex: "mapVersion",
      width: 260,
      ellipsis: { showTitle: true }
    },
    {
      title: t("是否发布"),
      dataIndex: "currentMapInfoVersion",
      width: 100,
      render: (value) =>
        value ? (
          <Tag color="green">{t("是")}</Tag>
        ) : (
          <Tag color="default">{t("否")}</Tag>
        ),
      ellipsis: { showTitle: true }
    },
    {
      title: t("备注"),
      dataIndex: "mapRemark",
      ellipsis: true,
    },
    {
      title: t("来源版本"),
      dataIndex: "parentMapVersion",
      ellipsis: { showTitle: true }
    },
    {
      title: t("创建人"),
      dataIndex: "createUser",
      width: 100,
      ellipsis: { showTitle: true }
    },
    {
      title: t("创建时间"),
      dataIndex: "createTime",
      width: 170,
      ellipsis: { showTitle: true }
    },
    {
      title: t("操作"),
      width: 280,
      render: (_, record) => {
        const isOperating = operatingIds.has(record.id);
        return (
          <Space size={4}>
            {/* 编辑版本：无权限隐藏（§7.2） */}
            {canUpdate && (
              <Button
                size="small"
                type="primary"
                onClick={() => handleViewOrEdit(record)}
              >
                {t("编辑")}
              </Button>
            )}
            {/* 发布版本：无权限隐藏（§7.2） */}
            {canPublish && (
              <Popconfirm
                title={t("发布版本")}
                description={t("确定发布此版本？发布后将替换当前线上地图数据")}
                onConfirm={() => handlePublish(record)}
                okText={t("确定")}
                cancelText={t("取消")}
              >
                <Button
                  size="small"
                  loading={isOperating}
                  disabled={isOperating || !!record.published}
                >
                  {t("发布")}
                </Button>
              </Popconfirm>
            )}
            <Button
              size="small"
              onClick={() => handleOpenPushModal(record)}
              disabled={isOperating}
            >
              {t("推送")}
            </Button>
            {/* 下载版本：无权限隐藏（§7.2） */}
            {canDownload && (
              <Button size="small" onClick={() => handleDownload(record)}>
                {t("下载")}
              </Button>
            )}
          </Space>
        );
      },
      ellipsis: { showTitle: true }
    },
  ];

  return (
    <Modal
      title={`${t("版本管理")} - ${mapName || ""}`}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width="80vw"
      maskClosable
    >
      <div className={styles.version_modal_content}>
        {/* 紧凑型搜索栏 */}
        <div className={styles.search_bar}>
          <Input.Search
            size="small"
            style={{ width: 220 }}
            placeholder={t("搜索版本号/备注")}
            allowClear
            value={searchQuery}
            onChange={handleSearchChange}
            onSearch={handleSearch}
            enterButton={
              <Button size="small" type="primary" icon={<SearchOutlined />} />
            }
          />
          <Button
            size="small"
            type="text"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            title={t("刷新")}
          />
        </div>
        {/* 版本列表表格 */}
        <Table<MapInfoVersion>
          className={styles.version_table}
          columns={columns}
          dataSource={versionList}
          rowKey={(r) => String(r.id)}
          loading={loading}
          size="small"
          bordered
          locale={{
            emptyText: <Empty description={t("暂无版本数据")} />,
          }}
          pagination={{
            ...pagination,
            size: "small",
            pageSizeOptions: [10, 20, 50],
            showSizeChanger: true,
          }}
          onChange={handleTableChange}
        />
        {/* 推送版本弹窗（嵌套二层弹窗） */}
        <PushVersionModal
          open={pushModalOpen}
          mapVersionId={pushVersionId}
          onClose={handlePushClose}
          onSuccess={handlePushSuccess}
        />
      </div>
    </Modal>
  );
};
