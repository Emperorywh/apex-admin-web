/**
 * @description Overlook 画布右键节点快捷创建任务弹窗（精简版）
 *              与完整版 CreateOrderModal 并存、互不影响：
 *              单子任务、无 Form.List、无指定车辆分组；地图/站点由右键命中结果预填
 * @date 2026-07-29
 */
import {
  createOrderRecord,
  getAGVActionGroups,
  getAgvActions,
  getCrossMapStations,
  getSimpleMaps,
  getSimpleVehicles,
} from "@/api";
import { useI18n } from "@/hooks/useI18n";
import type { AgvGroupRecord } from "@/types/ActionControl/AGVActionGroup";
import type { ActionRecord } from "@/types/ActionControl/AGVActions";
import type { CrossMapStation, VehicleAction } from "@/types/MultipleMaps";
import type { CreateOrderRecord } from "@/types/OrderRecord";
import type { SimpleMapList } from "@/types/OverLook";
import type { SimpleVehicle } from "@/types/VehicleDeploy/GroupType";
import { Form, Input, InputNumber, Modal, Select, message } from "antd";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";

/**
 * 表单字段类型（单子任务扁平结构）
 * priority / appointVehicleKey 类型必填、运行时可空（优先级留空由后端定默认值，与完整版一致）
 */
type FieldType = {
  orderName: string;
  priority: number;
  appointVehicleKey: string;
  mapId: string;
  stationId: string;
  agvAction?: number;
  agvActionGroup?: number;
};

interface QuickCreateOrderModalProps {
  open: boolean;
  /** 右键命中的预填值（打开瞬间快照）：mapId 为当前地图，stationId 为命中节点 id */
  defaultMission: { mapId?: string; stationId?: string };
  onClose: () => void;
}

export default (props: QuickCreateOrderModalProps) => {
  const { open, defaultMission, onClose } = props;

  const { t } = useI18n();

  // 车辆列表
  const [simpleVehicles, setSimpleVehicles] = useState<SimpleVehicle[]>([]);
  // 地图列表
  const [simpleMaps, setSimpleMaps] = useState<SimpleMapList[]>([]);
  // 站点列表（当前选中地图；每次打开弹窗按 mapId 重新拉取，保证预填站点显示名称）
  const [crossMapStations, setCrossMapStations] = useState<CrossMapStation[]>(
    [],
  );
  // 车辆动作列表
  const [agvActions, setAgvActions] = useState<VehicleAction[]>([]);
  // 车辆动作组列表
  const [agvActionGroups, setAgvActionGroups] = useState<AgvGroupRecord[]>([]);

  const [form] = Form.useForm<FieldType>();

  // 确定按钮的 loading 状态；提交中同时锁定弹窗（取消/X/遮罩/Esc 均不可用）
  const [confirmLoading, setConfirmLoading] = useState(false);
  // 车辆/地图/动作/动作组仅首次打开时拉取并缓存，之后不再重复请求
  const fetchedRef = useRef(false);

  /**
   * @description 按地图 id 拉取站点列表（按 name 升序，与完整版一致）
   * @param mapId 地图 id
   */
  const fetchStations = (mapId: string) => {
    getCrossMapStations({ mapId })
      .then((res) => {
        if (res.code === 200 && res.message === "success") {
          // 按 name 升序排序（字母 a-z，数字从小到大）
          const sorted = [...(res?.data || [])].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true }),
          );
          setCrossMapStations(sorted);
        } else {
          message.warning(t("查询跨地图节点出错") + res?.message);
        }
      })
      .catch((err) => {
        if (err) {
          message.error(t("查询跨地图节点出错") + err?.message);
        }
      });
  };

  /**
   * 打开弹窗时的初始化（仅依赖 open：打开期间父组件重渲染不会重置用户已编辑的表单）
   * 1. 生成任务名称 PointToPoint-YYYYMMDDHHmmss，预填地图/站点
   * 2. 站点列表每次打开都按当前 mapId 拉取，保证预填站点显示名称而非裸 id
   * 3. 车辆/地图/动作/动作组仅首次打开拉取并缓存
   */
  useEffect(() => {
    if (!open) return;
    const { mapId, stationId } = defaultMission;
    form.setFieldsValue({
      orderName: `PointToPoint-${dayjs().format("YYYYMMDDHHmmss")}`,
      mapId,
      stationId,
    });
    if (mapId) {
      fetchStations(mapId);
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    getSimpleVehicles()
      .then((res) => {
        if (res.code === 200 && res.message === "success") {
          setSimpleVehicles(res?.data || []);
        } else {
          message.warning(t("查询车辆列表出错") + res?.message);
        }
      })
      .catch((err) => {
        if (err) {
          message.error(t("查询车辆列表出错") + err?.message);
        }
      });
    getSimpleMaps()
      .then((res) => {
        if (res.code === 200 && res.message === "success") {
          setSimpleMaps(res?.data || []);
        } else {
          message.warning(t("查询地图列表出错") + res?.message);
        }
      })
      .catch((err) => {
        if (err) {
          message.error(t("查询地图列表出错") + err?.message);
        }
      });
    getAgvActions()
      .then((res) => {
        if (res.code === 200 && res.message === "success") {
          setAgvActions(res?.data || []);
        } else {
          message.warning(t("查询车辆动作出错") + res?.message);
        }
      })
      .catch((err) => {
        if (err) {
          message.error(t("查询车辆动作出错") + err?.message);
        }
      });
    getAGVActionGroups()
      .then((res) => {
        if (res.code === 200 && res.message === "success") {
          setAgvActionGroups(res?.data || []);
        } else {
          message.warning(t("查询车辆动作组出错") + res?.message);
        }
      })
      .catch((err) => {
        if (err) {
          message.error(t("查询车辆动作组出错") + err?.message);
        }
      });
  }, [open]);

  // 重新选择地图时清空已选站点（沿用完整版 onMissionMapIdChange 语义，单字段版）
  const onMapIdChange = () => {
    form.setFieldValue("stationId", undefined);
  };

  // 站点下拉展开时按当前选中地图懒加载站点列表（沿用完整版模式）
  const onStationOpenChange = () => {
    const mapId = form.getFieldValue("mapId");
    if (!mapId) return;
    fetchStations(mapId);
  };

  const handleOk = async () => {
    // antd 校验失败是 rejected Promise，必须 catch，否则产生 unhandled rejection
    const validate = await form.validateFields().catch(() => null);
    if (!validate) return;
    // 提交期间禁用确定按钮并展示 loading，同时锁定弹窗
    setConfirmLoading(true);
    const {
      orderName,
      priority,
      appointVehicleKey,
      mapId,
      stationId,
      agvAction,
      agvActionGroup,
    } = form.getFieldsValue();
    // 车辆动作与动作组互斥，统一转换为子任务的 actions（与完整版一致）：
    // 车辆动作 → 传动作 id 对应的动作；动作组 → 传动作组下的所有动作；均无 → undefined
    const actions =
      typeof agvAction === "number" && !isNaN(agvAction)
        ? agvActions.filter((action) => action?.id === agvAction)
        : agvActionGroups.find((group) => group?.id === agvActionGroup)
            ?.agvActions;
    /**
     * 构造提交体。类型口径说明：OrderMission.extendParameters 类型必填、
     * actions 在类型上被注释，但运行时均可缺省/需要（与完整版一致）；
     * 这里显式声明宽松的中间类型，使整体断言与 CreateOrderRecord 双向可比
     */
    const orderMissions: {
      mapId: string;
      stationId: string;
      actions?: VehicleAction[] | ActionRecord[];
    }[] = [{ mapId, stationId, actions }];
    const initValues = {
      orderName,
      priority,
      appointVehicleKey,
      orderMissions,
    } as CreateOrderRecord;
    createOrderRecord(initValues)
      .then((res) => {
        if (res.code === 200 && res.message === "success") {
          form.resetFields();
          onClose();
          message.success(t("创建订单成功"));
        } else {
          message.warning(t("创建订单出错") + res?.message);
        }
      })
      .catch((err) => {
        message.error(t("创建订单出错") + err?.message);
      })
      .finally(() => {
        // 无论成功失败，都复位确定按钮的 loading
        setConfirmLoading(false);
      });
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={t("创建任务")}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={t("确定")}
      cancelText={t("取消")}
      confirmLoading={confirmLoading}
      cancelButtonProps={{ disabled: confirmLoading }}
      closable={!confirmLoading}
      maskClosable={!confirmLoading}
      keyboard={!confirmLoading}
    >
      <Form
        name="quickCreateOrderForm"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
        form={form}
      >
        <Form.Item<FieldType>
          label={t("任务名称")}
          name="orderName"
          rules={[{ required: true, message: t("请输入订单名称") }]}
        >
          <Input placeholder={t("请输入订单名称")} />
        </Form.Item>

        <Form.Item<FieldType> label={t("优先级")} name="priority">
          <InputNumber
            style={{ width: "100%" }}
            min={0}
            max={999}
            placeholder={t("请输入优先级[0-999]")}
          />
        </Form.Item>

        <Form.Item<FieldType> label={t("指定车辆")} name="appointVehicleKey">
          <Select
            placeholder={t("请选择订单指定车辆")}
            allowClear
            showSearch
            options={simpleVehicles}
            optionFilterProp="name"
            fieldNames={{ label: "name", value: "key" }}
          />
        </Form.Item>

        <Form.Item<FieldType>
          label={t("地图名称")}
          name="mapId"
          rules={[{ required: true, message: t("请选择地图") }]}
        >
          <Select
            placeholder={t("请选择地图")}
            allowClear
            showSearch
            optionFilterProp="mapName"
            options={simpleMaps}
            fieldNames={{ label: "mapName", value: "mapId" }}
            onChange={onMapIdChange}
          />
        </Form.Item>

        <Form.Item<FieldType>
          label={t("站点名称")}
          name="stationId"
          rules={[{ required: true, message: t("请选择站点") }]}
        >
          <Select
            placeholder={t("请选择站点")}
            allowClear
            showSearch
            optionFilterProp="name"
            fieldNames={{ label: "name", value: "id" }}
            options={crossMapStations}
            onOpenChange={(open) => open && onStationOpenChange()}
          />
        </Form.Item>

        {/* 车辆动作与动作组互斥隐藏：一方有值时隐藏另一方，避免两字段同时有值 */}
        <Form.Item
          noStyle
          shouldUpdate={(preValue, curValue) =>
            preValue.agvActionGroup !== curValue.agvActionGroup
          }
        >
          {({ getFieldValue }) =>
            !getFieldValue("agvActionGroup") && (
              <Form.Item<FieldType> label={t("车辆动作")} name="agvAction">
                <Select
                  placeholder={t("请选择车辆动作")}
                  allowClear
                  showSearch
                  optionFilterProp="actionDescription"
                  fieldNames={{ label: "actionDescription", value: "id" }}
                  options={agvActions}
                />
              </Form.Item>
            )
          }
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(preValue, curValue) =>
            preValue.agvAction !== curValue.agvAction
          }
        >
          {({ getFieldValue }) =>
            !getFieldValue("agvAction") && (
              <Form.Item<FieldType> label={t("动作分组")} name="agvActionGroup">
                <Select
                  placeholder={t("请选择车辆动作分组")}
                  allowClear
                  showSearch
                  optionFilterProp="actionGroupName"
                  fieldNames={{ label: "actionGroupName", value: "id" }}
                  options={agvActionGroups}
                />
              </Form.Item>
            )
          }
        </Form.Item>
      </Form>
    </Modal>
  );
};
