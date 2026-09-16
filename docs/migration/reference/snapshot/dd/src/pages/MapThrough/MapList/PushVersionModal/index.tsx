/**
 * @description 推送地图版本弹窗
 * 包含车辆列表多选和SLAM底图开关
 * @date 2026-6-1
 */
import { getSimpleVehicles, pushMapInfoVersion } from "@/api";
import { useI18n } from "@/hooks/useI18n";
import type { MapInfoVersionPushParam } from "@/types/MapVersion";
import type { TransferProps } from "antd";
import { Form, Modal, Switch, Transfer, message } from "antd";
import { useEffect, useState } from "react";

/**
 * 推送版本弹窗组件属性
 * @param open 弹窗是否可见
 * @param mapVersionId 地图版本id
 * @param onClose 关闭弹窗回调
 * @param onSuccess 推送成功后的回调（刷新版本列表）
 */
interface PushVersionModalProps {
  open: boolean;
  mapVersionId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * 简单车辆数据类型
 */
interface SimpleVehicle {
  key: string;
  name: string;
}

export default ({
  open,
  mapVersionId,
  onClose,
  onSuccess,
}: PushVersionModalProps) => {
  /* 国际化翻译方法 */ const { t } = useI18n();
  /* 车辆列表数据源 */
  const [vehicles, setVehicles] = useState<SimpleVehicle[]>([]);
  /* 已选中的车辆key列表 */
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  /* SLAM底图开关 */
  const [enabledPushSlamMap, setEnabledPushSlamMap] = useState<boolean>(false);
  /* 车辆列表加载状态 */
  const [loading, setLoading] = useState<boolean>(false);
  /* 推送操作loading状态 */
  const [pushing, setPushing] = useState<boolean>(false);

  /**
   * 弹窗打开时加载车辆列表
   */
  useEffect(() => {
    if (open) {
      fetchVehicles();
    }
  }, [open]);

  /**
   * 获取车辆列表
   */
  const fetchVehicles = () => {
    setLoading(true);
    getSimpleVehicles()
      .then((res: any) => {
        if (res.code === 200 && res.message === "success") {
          const list: SimpleVehicle[] = (res.data || []).map((item: any) => ({
            key: item.key,
            name: item.name || item.key,
          }));
          setVehicles(list);
        } else {
          message.warning(t("获取车辆列表出错") + res?.message);
        }
      })
      .catch((err: any) => {
        message.error(t("获取车辆列表出错") + err?.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  /**
   * 穿梭框选择变更
   */
  const handleTransferChange: TransferProps["onChange"] = (newTargetKeys) => {
    setTargetKeys(newTargetKeys as string[]);
  };

  /**
   * 确认推送
   */
  const handleOk = () => {
    if (targetKeys.length === 0) {
      message.warning(t("请至少选择一辆车辆"));
      return;
    }
    setPushing(true);
    const params: MapInfoVersionPushParam = {
      mapVersionId: mapVersionId!,
      vehicleKeys: targetKeys,
      enabledPushSlamMap,
    };
    pushMapInfoVersion(params)
      .then((res: any) => {
        if (res.code === 200 && res.message === "success") {
          message.success(t("推送版本成功"));
          onSuccess();
          handleCancel();
        } else {
          message.warning(t("推送版本出错") + res?.message);
        }
      })
      .catch((err: any) => {
        message.error(t("推送版本出错") + err?.message);
      })
      .finally(() => {
        setPushing(false);
      });
  };

  /**
   * 关闭弹窗并重置状态
   */
  const handleCancel = () => {
    setTargetKeys([]);
    setEnabledPushSlamMap(false);
    onClose();
  };

  return (
    <Modal
      title={t("推送地图版本")}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={pushing}
      okText={t("确认推送")}
      cancelText={t("取消")}
      width={1000}
      destroyOnClose
    >
      <Form layout="vertical">
        <Form.Item label={t("选择车辆")}>
          <Transfer
            dataSource={vehicles}
            titles={[t("未选车辆"), t("已选车辆")]}
            targetKeys={targetKeys}
            onChange={handleTransferChange}
            render={(item) => item.name || item.key}
            rowKey={(item) => item.key}
            listStyle={{
              width: 450,
              height: 400,
            }}
            showSearch
            filterOption={(inputValue, item) =>
              (item.name || item.key)
                .toLowerCase()
                .includes(inputValue.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item label={t("推送SLAM底图")}>
          <Switch
            checked={enabledPushSlamMap}
            onChange={setEnabledPushSlamMap}
            checkedChildren={t("开")}
            unCheckedChildren={t("关")}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
