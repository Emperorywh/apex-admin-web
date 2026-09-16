/**
 * @description 交通信号灯新增/编辑弹窗组件
 * @date 2026-5-19
 */
import { addTrafficLight, updateTrafficLight } from "@/api";
import { useI18n } from "@/hooks/useI18n";
import type {
  AddTrafficLightParams,
  TrafficLightDriver,
  TrafficLightRecord,
} from "@/types/TriDevice/TrafficLight";
import { Form, Input, Modal, Select, Switch, message } from "antd";
import { useEffect } from "react";

/**
 * 弹窗组件属性定义
 * open 控制弹窗显示隐藏
 * modifyRecord 编辑时传入的记录，为空则新增
 * onSuccess 操作成功后的回调
 * onCancel 关闭弹窗的回调
 */
interface EditTrafficLightProps {
  open: boolean;
  modifyRecord?: TrafficLightRecord;
  trafficLightDrivers: TrafficLightDriver[];
  onSuccess: () => void;
  onCancel: () => void;
}

export default ({
  open,
  modifyRecord,
  trafficLightDrivers,
  onSuccess,
  onCancel,
}: EditTrafficLightProps) => {
  /* 国际化翻译方法 */ const { t } = useI18n();
  const [form] = Form.useForm();

  /* 解析请求参数字符串为对象，组装deviceConfig嵌套结构 */
  const buildSubmitValues = (
    values: Record<string, any>,
  ): AddTrafficLightParams | null => {
    const { deviceConfig, syncWaitResponse, deviceName, driverKey, ...rest } =
      values;
    const config = { ...deviceConfig };
    if (config.requestParam && typeof config.requestParam === "string") {
      try {
        config.requestParam = JSON.parse(config.requestParam);
      } catch {
        message.warning(t("请求参数JSON格式不正确"));
        return null;
      }
    }
    return {
      deviceName,
      deviceConfig: config,
      syncWaitResponse,
      driverKey,
    } as AddTrafficLightParams;
  };

  /* 弹窗提交 */
  const handleOk = async () => {
    const validate = await form.validateFields();
    if (!validate) return;
    const rawValues = form.getFieldsValue(true);
    const values = buildSubmitValues(rawValues);
    if (!values) return;
    if (modifyRecord) {
      /* 编辑模式 */
      updateTrafficLight({ ...values, deviceKey: modifyRecord.deviceKey! })
        .then((res) => {
          if (res.code === 200 && res.message === "success") {
            form.resetFields();
            onSuccess();
            message.success(t("编辑交通灯成功"));
          } else {
            message.warning(t("编辑交通灯出错") + res?.message);
          }
        })
        .catch((err) => {
          if (err) {
            message.error(t("编辑交通灯出错") + err?.message);
          }
        });
    } else {
      /* 新增模式 */
      addTrafficLight(values)
        .then((res) => {
          if (res.code === 200 && res.message === "success") {
            form.resetFields();
            onSuccess();
            message.success(t("新增交通灯成功"));
          } else {
            message.warning(t("新增交通灯出错") + res?.message);
          }
        })
        .catch((err) => {
          if (err) {
            message.error(t("新增交通灯出错") + err?.message);
          }
        });
    }
  };

  /* 弹窗关闭 */
  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  /* 弹窗打开时初始化表单 */
  useEffect(() => {
    if (open && modifyRecord) {
      form.setFieldsValue({
        deviceName: modifyRecord.deviceName,
        driverKey: modifyRecord.driverKey,
        syncWaitResponse: modifyRecord.syncWaitResponse,
        deviceConfig: {
          url: modifyRecord.deviceConfig?.url,
          responseSuccessExpression:
            modifyRecord.deviceConfig?.responseSuccessExpression,
          requestParam: modifyRecord.deviceConfig?.requestParam
            ? JSON.stringify(modifyRecord.deviceConfig.requestParam, null, 2)
            : undefined,
        },
      });
    } else if (open) {
      form.resetFields();
    }
  }, [open, modifyRecord]);

  return (
    <Modal
      title={modifyRecord ? t("编辑交通灯") : t("新增交通灯")}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      forceRender
      width={1000}
    >
      <Form
        name="trafficLightForm"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
        form={form}
      >
        <Form.Item<AddTrafficLightParams>
          label={t("交通灯名称")}
          name="deviceName"
          rules={[{ required: true, message: t("请输入交通灯名称") }]}
        >
          <Input placeholder={t("请输入交通灯名称")} maxLength={64} />
        </Form.Item>

        <Form.Item<AddTrafficLightParams>
          label={t("设备驱动")}
          name="driverKey"
          rules={[{ required: true, message: t("请选择设备驱动") }]}
        >
          <Select
            placeholder={t("请选择设备驱动")}
            allowClear
            showSearch
            optionFilterProp="name"
            fieldNames={{ label: "name", value: "key" }}
            options={trafficLightDrivers}
            onChange={(val) => {
              if (val) {
                const driver = trafficLightDrivers.find((d) => d.key === val);
                if (driver?.driverProtocol) {
                  form.setFieldValue(
                    ["deviceConfig", "requestParam"],
                    JSON.stringify(driver.driverProtocol, null, 4),
                  );
                } else {
                  form.setFieldValue(
                    ["deviceConfig", "requestParam"],
                    undefined,
                  );
                }
              } else {
                form.setFieldValue(["deviceConfig", "requestParam"], undefined);
              }
            }}
          />
        </Form.Item>

        <Form.Item
          label={t("请求地址")}
          name={["deviceConfig", "url"]}
          rules={[{ required: true, message: t("请输入请求地址") }]}
        >
          <Input placeholder={t("请输入请求地址")} />
        </Form.Item>

        <Form.Item
          label={t("请求参数")}
          name={["deviceConfig", "requestParam"]}
        >
          <Input.TextArea placeholder={t("请输入JSON格式请求参数")} rows={10} />
        </Form.Item>

        <Form.Item
          label={t("响应成功表达式")}
          name={["deviceConfig", "responseSuccessExpression"]}
          rules={[{ required: true, message: t("请输入响应成功表达式") }]}
        >
          <Input placeholder={t("请输入响应成功表达式")} />
        </Form.Item>

        <Form.Item<AddTrafficLightParams>
          label={t("到点通知")}
          name="syncWaitResponse"
          valuePropName="checked"
          rules={[{ required: true, message: t("请选择是否同步等待响应") }]}
          initialValue={false}
        >
          <Switch checkedChildren={t("是")} unCheckedChildren={t("否")} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
