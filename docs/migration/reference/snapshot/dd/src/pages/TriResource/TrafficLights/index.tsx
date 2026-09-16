/**
 * @description 交通信号灯界面
 * @date 2026-5-19
 */
import {
  deleteTrafficLight,
  getTrafficLightDrivers,
  pageTrafficLights,
  testTrafficLight,
} from "@/api";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";
import type {
  TrafficLightDriver,
  TrafficLightRecord,
} from "@/types/TriDevice/TrafficLight";
import type { ResponseType, SearchType } from "@/types/typing";
import type { GetProps, PaginationProps, TableProps } from "antd";
import { Button, Input, message, Popconfirm, Space, Table } from "antd";
import { useEffect, useState } from "react";
import EditTrafficLight from "./EditTrafficLight/EditTrafficLight";
import styles from "./index.less";

const { Search } = Input;

type SearchProps = GetProps<typeof Input.Search>;

export default () => {
  /* 国际化翻译方法 */ const { t } = useI18n();
  /*
   * 按钮级权限判定
   * 无权限的动作触发型按钮条件渲染隐藏（root 短路全开）
   * 详见 docs/SPEC_button_permission.md §7
   */
  const { hasPerm } = useAccess();

  /* 查询参数 */
  const [searchParams, setSearchParams] = useState<SearchType>({
    pageNo: 1,
    pageSize: 10,
    query: "",
  });
  /* 分页参数 */
  const [paginationProps, setPaginationProps] = useState<PaginationProps>({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  /* 表格数据 */
  const [trafficLightRecords, setTrafficLightRecords] = useState<
    TrafficLightRecord[]
  >([]);
  /* 弹窗控制 */
  const [openModal, setOpenModal] = useState<boolean>(false);
  /* 当前编辑的记录 */
  const [modifyRecord, setModifyRecord] = useState<TrafficLightRecord>();
  /* 测试弹窗加载状态 */
  const [testingKey, setTestingKey] = useState<string>("");
  /* 交通灯驱动列表 */
  const [trafficLightDrivers, setTrafficLightDrivers] = useState<
    TrafficLightDriver[]
  >([]);

  /* 分页查询交通灯数据 */
  const getTrafficLightList = () => {
    pageTrafficLights(searchParams)
      .then((res) => {
        if (res.code === 200 && res.message === "success") {
          const data: ResponseType<TrafficLightRecord> = res?.data;
          const { records, size, current, total } = data;
          setTrafficLightRecords(records);
          setPaginationProps({
            current,
            pageSize: size,
            total,
          });
        } else {
          message.warning(t("查询交通灯数据出错") + res?.message);
        }
      })
      .catch((err) => {
        if (err) {
          message.error(t("查询交通灯数据出错") + err?.message);
        }
      });
  };

  /* 搜索事件 */
  const onSearch: SearchProps["onSearch"] = (value) => {
    setSearchParams({
      ...searchParams,
      pageNo: 1,
      query: value,
    });
  };

  /* 表格分页改变 */
  const onTableChange: TableProps<TrafficLightRecord>["onChange"] = (
    pagination,
  ) => {
    const { current = 1, pageSize = 10 } = pagination;
    setSearchParams({
      ...searchParams,
      pageNo: current,
      pageSize,
    });
  };

  /* 点击新增按钮 */
  const handleOpenModal = () => {
    setModifyRecord(undefined);
    setOpenModal(true);
  };

  /* 点击编辑按钮 */
  const handleModifyClick = (record: TrafficLightRecord) => {
    setModifyRecord(record);
    setOpenModal(true);
  };

  /* 弹窗操作成功回调 */
  const handleModalSuccess = () => {
    setOpenModal(false);
    setModifyRecord(undefined);
    getTrafficLightList();
  };

  /* 弹窗关闭回调 */
  const handleModalCancel = () => {
    setModifyRecord(undefined);
    setOpenModal(false);
  };

  /* 确认删除 */
  const onDeleteConfirm = (record: TrafficLightRecord) => {
    const { deviceKey } = record;
    if (!deviceKey) return;
    deleteTrafficLight({ deviceKey })
      .then((res) => {
        if (res.code === 200 && res.message === "success") {
          getTrafficLightList();
          message.success(t("删除交通灯成功"));
        } else {
          message.warning(t("删除交通灯出错") + res?.message);
        }
      })
      .catch((err) => {
        if (err) {
          message.error(t("删除交通灯出错") + err?.message);
        }
      });
  };

  /* 测试交通灯连通性 */
  const handleTestTrafficLight = (record: TrafficLightRecord) => {
    const { deviceKey } = record;
    if (!deviceKey) return;
    setTestingKey(deviceKey);
    testTrafficLight({ deviceKey })
      .then((res) => {
        if (res.code === 200 && res.message === "success") {
          message.success(t("交通灯测试成功，连通性正常"));
        } else {
          message.warning(t("交通灯测试失败：") + res?.message);
        }
      })
      .catch((err) => {
        if (err) {
          message.error(t("交通灯测试出错") + err?.message);
        }
      })
      .finally(() => {
        setTestingKey("");
      });
  };

  /* 表格列定义 */
  const columns: TableProps<TrafficLightRecord>["columns"] = [
    {
      title: t("设备标识"),
      dataIndex: "deviceKey",
        ellipsis: { showTitle: true }
    },
    {
      title: t("设备名称"),
      dataIndex: "deviceName",
        ellipsis: { showTitle: true }
    },
    {
      title: t("请求地址"),
      dataIndex: ["deviceConfig", "url"],
      ellipsis: true,
    },
    {
      title: t("请求参数"),
      dataIndex: ["deviceConfig", "requestParam"],
      ellipsis: true,
      render: (value) => (value ? JSON.stringify(value) : "-"),
    },
    {
      title: t("响应成功表达式"),
      dataIndex: ["deviceConfig", "responseSuccessExpression"],
      ellipsis: true,
    },
    {
      title: t("同步等待响应"),
      dataIndex: "syncWaitResponse",
      render: (value) => (value ? t("是") : t("否")),
        ellipsis: { showTitle: true }
    },
    {
      title: t("创建时间"),
      dataIndex: "createTime",
        ellipsis: { showTitle: true }
    },
    {
      title: t("操作"),
      width: 280,
      fixed: "right",
      render: (_, record) => (
        <Space>
          {/*
           * 测试（发起连通性请求，属设备控制操作）：粗粒度码 device:traffic-light:operate
           * 交通灯无独立 test 码，归入 operate（§7.4）
           */}
          {hasPerm(PERM_BUTTON.DEVICE_TRAFFIC_LIGHT_OPERATE) && (
            <Button
              type="primary"
              loading={testingKey === record.deviceKey}
              onClick={() => handleTestTrafficLight(record)}
            >
              {t("测试")}
            </Button>
          )}
          {/* 编辑：无 device:traffic-light:update 权限隐藏（操作列单项隐藏，保留空列 §7.2） */}
          {hasPerm(PERM_BUTTON.DEVICE_TRAFFIC_LIGHT_UPDATE) && (
            <Button type="primary" onClick={() => handleModifyClick(record)}>
              {t("编辑")}
            </Button>
          )}
          {/* 删除：无 device:traffic-light:delete 权限隐藏（§7.2） */}
          {hasPerm(PERM_BUTTON.DEVICE_TRAFFIC_LIGHT_DELETE) && (
            <Popconfirm
              title={t("删除")}
              description={t("确认删除当前交通灯?")}
              onConfirm={() => onDeleteConfirm(record)}
              okText={t("确定")}
              cancelText={t("取消")}
            >
              <Button danger>{t("删除")}</Button>
            </Popconfirm>
          )}
        </Space>
      ),
        ellipsis: { showTitle: true }
    },
  ];

  /* 查询参数变化时重新请求数据 */
  useEffect(() => {
    getTrafficLightList();
  }, [searchParams]);

  /* 加载交通灯驱动列表 */
  useEffect(() => {
    getTrafficLightDrivers().then((res) => {
      if (res.code === 200 && res.message === "success") {
        setTrafficLightDrivers(res.data || []);
      }
    });
  }, []);

  return (
    <div className={styles.traffic_light}>
      <div className={styles.search}>
        <Search
          placeholder={t("请输入交通灯名称或唯一key查询")}
          enterButton
          style={{ width: 361 }}
          onSearch={onSearch}
        />
        <Space>
          {/* 新增交通灯：无 device:traffic-light:add 权限条件渲染隐藏（§7.1） */}
          {hasPerm(PERM_BUTTON.DEVICE_TRAFFIC_LIGHT_ADD) && (
            <Button type="primary" onClick={handleOpenModal}>
              {t("新增交通灯")}
            </Button>
          )}
        </Space>
      </div>
      <Table<TrafficLightRecord>
        columns={columns}
        dataSource={trafficLightRecords}
        scroll={{ x: 1400, y: "calc(100vh - 320px)" }}
        rowKey={(r) => r.id as unknown as string}
        pagination={{
          ...paginationProps,
          showSizeChanger: true,
          hideOnSinglePage: false,
          showTotal: (total) => t("总数{total}条", { total }),
        }}
        onChange={onTableChange}
      />
      <EditTrafficLight
        open={openModal}
        modifyRecord={modifyRecord}
        trafficLightDrivers={trafficLightDrivers}
        onSuccess={handleModalSuccess}
        onCancel={handleModalCancel}
      />
    </div>
  );
};
