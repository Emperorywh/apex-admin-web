/**
 * @description 地图列表
 * 支持通过弹窗管理地图版本
 * @date 2025-7-7
 */
import {
  deleteMap,
  pageMapInfos,
  uploadMapFile,
  uploadVehicleMap,
} from "@/api";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";
import type { MapInfo, MapInfoSearchParams } from "@/types/MapList";
import {
  CarOutlined,
  PlusOutlined,
  VerticalAlignBottomOutlined,
} from "@ant-design/icons";
import type { GetProps, TablePaginationConfig, TableProps } from "antd";
import { Button, Input, message, Popconfirm, Space, Table } from "antd";
import { useEffect, useState } from "react";
import styles from "./index.less";
import MapModal from "./MapModal";
import PullModal from "./PullModal";
import UploadMapButton from "./UploadMapButton";
import VersionModal from "./VersionModal";

const { Search } = Input;
type SearchProps = GetProps<typeof Input.Search>;

export default () => {
  /* 国际化翻译方法 */ const { t } = useI18n();

  /* 按钮级权限判定（SPEC §8.2 地图列表） */
  const { hasPerm } = useAccess();
  const canAdd = hasPerm(PERM_BUTTON.MAP_LIST_ADD); // 创建地图（§7.1）
  const canUpdate = hasPerm(PERM_BUTTON.MAP_LIST_UPDATE); // 编辑地图（§7.2）
  const canDelete = hasPerm(PERM_BUTTON.MAP_LIST_DELETE); // 删除地图（§7.2）
  const canVersion = hasPerm(PERM_BUTTON.MAP_LIST_VERSION); // 版本管理入口（§7.1）
  const canUploadDispatcher = hasPerm(PERM_BUTTON.MAP_LIST_UPLOAD_DISPATCHER_MAP); // 导入调度地图（§7.1）
  const canUploadVehicle = hasPerm(PERM_BUTTON.MAP_LIST_UPLOAD_VEHICLE_MAP); // 导入车载地图（§7.1）

  // 查询参数
  const [searchParams, setSearchParams] = useState<MapInfoSearchParams>({
    pageNo: 1,
    pageSize: 10,
    query: "",
  });
  // 地图数据
  const [mapList, setMapList] = useState<MapInfo[]>([]);
  // 加载状态
  const [loading, setLoading] = useState<boolean>(false);
  // 分页
  const [paginationProps, setpaginationProps] = useState<TablePaginationConfig>(
    {
      current: 1,
      pageSize: 10,
      total: 0,
    },
  );
  // 编辑弹窗
  const [openMapModal, setOpenMapModal] = useState<boolean>(false);
  // 当前是不是编辑状态
  const [isModify, setIsModify] = useState<boolean>(false);
  // 编辑的行
  const [modifyRow, setModifyRow] = useState<MapInfo>();
  // 拉取地图的弹窗
  const [openPullModal, setOpenPullModal] = useState<boolean>(false);
  // 版本管理弹窗状态
  const [openVersionModal, setOpenVersionModal] = useState<boolean>(false);
  const [currentMapId, setCurrentMapId] = useState<string | null>(null);
  const [currentMapName, setCurrentMapName] = useState<string | null>(null);

  const getMapInfos = () => {
    setLoading(true);
    pageMapInfos(searchParams)
      .then((res) => {
        if (res.code === 200 && res.message === "success") {
          const { records, current, size, total } = res?.data;
          setMapList(records || []);
          setpaginationProps({
            current,
            pageSize: size,
            total,
          });
        } else {
          message.warning(t("查询地图数据出错") + res?.message);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err) {
          setLoading(false);
          message.error(t("查询地图数据出错") + err?.message);
        }
      });
  };

  // 地图搜索
  const onMapSearch: SearchProps["onSearch"] = (value) => {
    setSearchParams({
      ...searchParams,
      pageNo: 1,
      query: value,
    });
  };

  const onTableChange: TableProps<MapInfo>["onChange"] = (pagination) => {
    const { current = 1, pageSize = 10 } = pagination;
    setSearchParams({
      ...searchParams,
      pageNo: current,
      pageSize,
    });
  };

  const onDeleteConfirm = (record: MapInfo) => {
    deleteMap({ mapId: record.mapId })
      .then((res) => {
        if (res.code === 200 && res.message === "success") {
          getMapInfos();
          message.success(t("删除地图成功"));
        } else {
          message.warning(t("删除地图出错") + res?.message);
        }
      })
      .catch((err) => {
        if (err) {
          message.error(t("删除地图出错") + err?.message);
        }
      });
  };

  // 编辑地图
  const handleOpenMapModal = (record: MapInfo) => {
    setIsModify(true);
    setModifyRow(record);
    setOpenMapModal(true);
  };

  // 创建地图
  const handleCreateMap = () => {
    setIsModify(false);
    setModifyRow(undefined);
    setOpenMapModal(true);
  };

  const columns: TableProps<MapInfo>["columns"] = [
    {
      title: t("地图名称"),
      dataIndex: "mapName",
        ellipsis: { showTitle: true }
    },
    {
      title: t("地图标识"),
      dataIndex: "mapId",
      width: 300,
        ellipsis: { showTitle: true }
    },
    {
      title: t("地图状态"),
      dataIndex: "mapState",
      render: (value) => (value === "ENABLED" ? t("启用") : t("禁用")),
      width: 120,
        ellipsis: { showTitle: true }
    },
    {
      title: t("当前版本"),
      dataIndex: "mapVersion",
        ellipsis: { showTitle: true }
    },
    {
      title: t("楼层"),
      dataIndex: "floor",
      width: 80,
        ellipsis: { showTitle: true }
    },
    // {
    //     title: "创建人",
    //     dataIndex: "createUser",
    //     width: 100
    // },
    // {
    //     title: "创建时间",
    //     dataIndex: "createTime"
    // },
    {
      title: t("更新人"),
      dataIndex: "updateUser",
      width: 120  ,
        ellipsis: { showTitle: true }
    },
    {
      title: t("更新时间"),
      dataIndex: "updateTime",
        ellipsis: { showTitle: true }
    },
    {
      title: t("操作"),
      width: 350,
      render: (_, record) => (
        <Space>
          {/* 编辑地图：无权限隐藏（§7.2） */}
          {canUpdate && (
            <Button type="primary" onClick={() => handleOpenMapModal(record)}>
              {t("编辑")}
            </Button>
          )}
          {/* 删除地图：无权限隐藏（§7.2） */}
          {canDelete && (
            <Popconfirm
              title={t("删除")}
              description={t("确定永久删除当前地图?")}
              onConfirm={() => onDeleteConfirm(record)}
              okText={t("确定")}
              cancelText={t("取消")}
            >
              <Button danger>{t("删除")}</Button>
            </Popconfirm>
          )}
          {/* 版本管理入口：无权限隐藏（§7.1） */}
          {canVersion && (
            <Button
              onClick={() => {
                setCurrentMapId(record.mapId);
                setCurrentMapName(record.mapName);
                setOpenVersionModal(true);
              }}
            >
              {t("版本管理")}
            </Button>
          )}
        </Space>
      ),
        ellipsis: { showTitle: true }
    },
  ];

  useEffect(() => {
    getMapInfos();
  }, [searchParams]);

  return (
    <div className={styles.map_list}>
      <div className={styles.mapList_actions}>
        <div>
          <Search
            style={{ width: 300 }}
            placeholder={t("根据(名称/标识)查询")}
            onSearch={onMapSearch}
            enterButton
          />
        </div>
        <Space>
          {/* 创建地图：无权限隐藏（§7.1） */}
          {canAdd && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateMap}
            >
              {t("创建地图")}
            </Button>
          )}
          {/* 导入调度地图：无权限隐藏（§7.1） */}
          {canUploadDispatcher && (
            <UploadMapButton
              uploadFn={uploadMapFile}
              buttonText={t("导入调度地图")}
              modalTitle={t("正在导入调度地图")}
              progressText={t("地图导入中，请勿关闭页面...")}
              successText={t("上传地图成功，请前往版本管理中发布该地图")}
              errorText={t("上传地图出错")}
              icon={<VerticalAlignBottomOutlined />}
              onSuccess={getMapInfos}
              accept=".zip"
            />
          )}
          {/* 导入车载地图：无权限隐藏（§7.1） */}
          {canUploadVehicle && (
            <UploadMapButton
              uploadFn={uploadVehicleMap}
              buttonText={t("导入车载地图")}
              modalTitle={t("正在导入车载地图")}
              progressText={t("车载地图导入中，请勿关闭页面...")}
              successText={t("上传车载地图成功")}
              errorText={t("上传车载地图出错")}
              icon={<CarOutlined />}
              buttonType="default"
              accept=".bin"
              onSuccess={getMapInfos}
            />
          )}
        </Space>
      </div>
      <Table<MapInfo>
        style={{ marginTop: 10 }}
        columns={columns}
        dataSource={mapList}
        rowKey={(r) => r.mapId}
        loading={loading}
        scroll={{ y: "calc(100vh - 250px)" }}
        pagination={{
          ...paginationProps,
          hideOnSinglePage: false,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100, 200],
          responsive: true,
          showTotal: (total) => t("总数{total}条", { total }),
        }}
        onChange={onTableChange}
      />
      <MapModal
        open={openMapModal}
        isModify={isModify}
        modifyRow={modifyRow}
        getMapInfos={getMapInfos}
        setModifyRow={setModifyRow}
        setOpenMapModal={setOpenMapModal}
      />
      <PullModal
        open={openPullModal}
        getMapInfos={getMapInfos}
        setOpenPullModal={setOpenPullModal}
      />
      <VersionModal
        open={openVersionModal}
        mapId={currentMapId}
        mapName={currentMapName}
        onClose={() => {
          setOpenVersionModal(false);
          getMapInfos();
        }}
      />
    </div>
  );
};
