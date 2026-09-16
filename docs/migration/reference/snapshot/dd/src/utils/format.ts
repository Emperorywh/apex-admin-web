/**
 * @description 用来组合数据的方法
 * @date 2025-6-16
 */
import type { MenuProps, DescriptionsProps } from "antd";
import type { OperateOptions } from "@/types/OrderRecord";
import type { AutoDoorState } from "@/types/TriDevice/AutoDoor";
import type { AirDoorState } from "@/types/TriDevice/AirShowerDoor";
import type { ElevatorState } from "@/types/TriDevice/Elevators";
import type { ActionType, KeyValueType } from "./typing";

/**
 * @description 根据订单状态对操作项进行禁用
 * @param operates 操作项数组
 * @param record 表格数据
 * @returns 操作项数组
 */
export const disableOrderOperates = (operates: OperateOptions[], orderState: string): MenuProps["items"] => {
  const formatOperates: MenuProps["items"] = operates.map(operate => ({
    label: operate.label,
    key: operate.key,
    disabled: !operate.enabled.some(it => it === orderState)
  }))
  return formatOperates;
};

/**
 * @description 转化一个json为get请求在地址栏的参数格式 为对象时继续递归
 * @param object 任意对象
 * @returns {string} a=1&b=2
 */
export const transformJsonToParams = (object: Record<string, unknown>): string => {
  let getParams: string = "";
  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      if (object[key] && typeof object[key] === "object") {
        transformJsonToParams(object[key] as Record<string, unknown>);
      } else {
        getParams += `${key}=${typeof object[key] === "string" ? object[key] : JSON.stringify(object[key])}&`
      }
    }
  }
  return getParams.substring(0, getParams.length - 1);
};

/**
 * @description 转化字符串为一个json
 * @param params transformJsonToParams转化后的字符串
 * @returns json
 */
export const transformStringToJson = (params: string) => {
  const json: Record<string, unknown> = {};
  // 去掉问号
  const excuteParam = params.substring(1, params.length);
  const paramsList = excuteParam.split("&");
  paramsList.forEach(param => {
    const splitParam = param.split("=");
    const [key, value = ""] = splitParam;
    json[key] = value;
  })
  return json;
};

/**
 * @description 转化三方设备里面的自动门状态为描述列表
 * @param state AutoDoorState
 * @returns {DescriptionsProps["items"]}
 */
export const convertAutoDoorStateToDescription = (state: AutoDoorState) => {
  const { autoDoorState, simpleAGVS } = state;
  const items: DescriptionsProps["items"] = [];
  if (autoDoorState) {
    items.push({
      label: "自动门状态",
      children: autoDoorState?.doorState
    })
  }
  if (simpleAGVS?.length) {
    simpleAGVS.forEach(agv => {
      items.push({
        label: agv.name,
        children: agv.key
      })
    })
  }
  return items;
};

/**
 * @description 转化风淋门状态为表述列表
 * @param state 接口返回的风淋门状态
 * @returns {DescriptionsProps["items"]}
 */
export const convertAirDoorStateToDescription = (state: AirDoorState) => {
  // 后端 AirShowerDoorState 为扁平结构：在线状态 + 故障 + 风淋状态 + 前门状态 + 后门状态
  const items: DescriptionsProps["items"] = [];
  if (state) {
    const { onlineState, showerState, failed, frontDoorState, backDoorState } = state;
    items.push(...[
      {
        label: "在线状态",
        children: onlineState
      },
      {
        label: "故障",
        children: failed ? "是" : "否"
      },
      {
        label: "风淋状态",
        children: showerState
      },
      {
        label: "前门状态",
        children: frontDoorState
      },
      {
        label: "后门状态",
        children: backDoorState
      }
    ]);
  }
  return items;
};

/**
 * @description 转化三方设备的状态为描述列表
 * @param state 状态返回值
 * @returns DescriptionsProps["items"]
 */
export const convertElevatorToDescription = (state: ElevatorState) => {
  const items: DescriptionsProps["items"] = [];
  if (state) {
    const { onlineState, currentFloor, runningState, frontDoorState, backDoorState, occupyAgv } = state;
    items.push(...[
      {
        label: "在线状态",
        children: onlineState
      },
      {
        label: "当前楼层",
        children: currentFloor
      },
      {
        label: "运行状态",
        children: runningState
      },
      {
        label: "前电梯门状态",
        children: frontDoorState
      },
      {
        label: "后电梯门状态",
        children: backDoorState
      },
      {
        label: "占用电梯的车辆",
        children: occupyAgv?.name
      },
      // {
      //   label: "占用电梯的车辆标识",
      //   children: occupyAgv?.key
      // }
    ]);
  }
  return items;
};

/**
 * @description 转化路径的自定义属性
 * @param userDefined 自定义属性数组
 * @returns 自定义属性转化为json后的对象
 */
export const transformUserDefined = (userDefinedProperties?: { key?: string, value?: string }[]) => {
  if (!Array.isArray(userDefinedProperties)) return;
  const obj: Record<string, string> = {};
  userDefinedProperties?.forEach((item) => {
    if (item?.key && item?.value) {
      obj[item.key] = item.value;
    }
  })
  return obj;
};

/**
 * @description 采集自定义属性里面的三方设备属性
 * @param userDefinedProperties 自定义属性
 * @returns 三方设备属性
 */
export const excludeUserDefined = (userDefinedProperties: object) => {
  const obj: object = {};
  for (const key in userDefinedProperties) {
    if (Object.prototype.hasOwnProperty.call(userDefinedProperties, key)) {
      const element = userDefinedProperties[key as keyof typeof userDefinedProperties];
      if (key === "deviceType" || key === "deviceKey" || key === "applyDeviceOperationType" || key === "releaseDeviceOperationType" || key === "leavedEdge") {
        obj[key as keyof typeof userDefinedProperties] = element
      }
    }
  }
  return obj;
};

/**
 * @description 回显路径的三方设备的自定义属性
 * @param object 自定义属性对象
 * @returns 表单显示的自定义属性
 */
export const feedbackUserDefinedProperties = (object: Record<string, string>, isEdgeShape: boolean = false) => {
  const userDefined: { key: string, value: string }[] = [];
  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      const value = object[key];
      if (isEdgeShape) {
        // 是路径的时候过滤掉三方设备的key
        if (key !== "deviceType" && key !== "deviceKey" && key !== "applyDeviceOperationType" && key !== "releaseDeviceOperationType" && key !== "leavedEdge") {
          // 自定义属性中不是三方设备的字段的，回显到自定义属性中
          userDefined.push({
            key,
            value
          });
        }
      } else {
        // 是节点的时候全部回显
        userDefined.push({
          key,
          value
        });
      }
    }
  }
  return userDefined;
};

/**
 * @description 转化节点和路径的动作，过滤掉动作参数里面key或value缺失的项
 * @param actions 节点或路径的动作列表
 * @returns 动作列表
 */
export const transformActionsAttr = (actions?: ActionType[]) => {
  if (!actions) return;
  const transformActions: ActionType[] = [];
  actions?.forEach(action => {
    if (action) {
      const { actionParameters = [], ...rest } = action;
      transformActions.push({
        ...rest,
        actionParameters: actionParameters.filter(param => param?.key && param?.value)
      });
    }
  })
  return transformActions;
};

/**
 * @description 转化[{ key: "", value: "" }, ...]数据为一个json
 * @param list { KeyValueType[] }
 * @returns json
 */
export const transformListJson = (list: KeyValueType[]) => {
  const obj: Record<string, any> = {};

  list.forEach(({ key, value }) => {
    obj[key] = value
  })
  return obj;
};

/**
 * @description 转化json为一组 [{ key: "", value: "" }, ...]
 * @param obj 一个json
 * @returns { }
 */
export const transformJsonList = (obj: Record<string, any>) => {
  const list: KeyValueType[] = [];
  for (const key in obj) {
    if (!Object.hasOwn(obj, key)) continue;
    list.push({
      key: key,
      value: obj[key]
    });
  }
  return list;
};
