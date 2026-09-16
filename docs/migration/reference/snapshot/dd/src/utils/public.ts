/**
 * @description 公共函数
 * @date 2025-5-23
 */
import type { DescriptionsProps, SelectProps } from "antd";
import { orderRefer } from "@/constants/orderInfo";
import { OrderStatus, OrderTypes, RobotStatus, DispatchState } from "./enum";
import type { Records } from "@/types/OrderRecord";
import { agvTypes, eStops } from "@/constants/vehicle";
import type { OrderInfoType } from "@/types/OrderRecord/OrderInfo";
import type { GetVehicleStateData } from "@/types/OverLook";
import dayjs from "dayjs";
/**
 * @description js弧度转角度
 * @param rad 弧度
 * @returns 角度
 */
export const radToDeg = (rad: number) => {
    if (typeof rad !== "number") return;
    return rad * (180 / Math.PI);
}

/**
 * @description js角度转弧度
 * @param deg 弧度
 * @returns 角度
 */
export const degToRad = (deg: number) => {
    if (typeof deg !== "number") return;
    return deg * (Math.PI / 180);
}

/**
 * @description 模拟休眠
 * @param delay 休眠的事件
 * @returns resolve
 */
export const sleep = (delay: number = 300) => {
    return new Promise((resolve) => {
        setTimeout(function sleep() {
            resolve(true);
        }, delay)
    })
};

/**
 * @description 车辆固定字段的取值转中文（枚举/布尔类字段），字段未命中时返回 undefined
 * @param key 字段名
 * @param value 字段值
 * @returns 中文展示值
 */
export const getFixedFieldText = (key: string, value: unknown): string | undefined => {
    switch (key) {
        // 连接状态（ONLINE / OFFLINE / CONNECTIONBROKEN）
        case "connectionState":
            return RobotStatus[value as keyof typeof RobotStatus] ?? String(value);
        // 紧急停车（AUTOACK / MANUAL / REMOTE / NONE）
        case "estop":
            return (eStops?.find(eStop => eStop.value === value)?.label as string) ?? String(value);
        // 调度状态（ENABLE / DISABLE）
        case "dispatchState":
            return DispatchState[value as keyof typeof DispatchState] ?? String(value);
        // 安全域状态：true 表示违反安全域
        case "fieldViolation":
            return value ? "异常" : "正常";
        // agv坐标是否正常
        case "normal":
            return value ? "正常" : "异常";
        // 是否开启了定位
        case "positionInitialized":
            return value ? "已开启" : "未开启";
        // 暂停状态
        case "paused":
            return value ? "已暂停" : "未暂停";
        // 载货
        case "loaded":
            return value ? "是" : "否";
        default:
            return undefined;
    }
};

/**
 * @description 将json转化为描述列表的items
 * @param json 任意对象
 * @returns DescriptionsProps["items"]
 */
export const transformVehicleInfo = (json: GetVehicleStateData) => {
    const desctiptions: DescriptionsProps["items"] = [];
    const loop = (object: GetVehicleStateData) => {
        for (const key in object) {
            if (Object.prototype.hasOwnProperty.call(object, key)) {
                if (object[key as keyof typeof object] !== null && typeof object[key as keyof typeof object] === "object" && !Array.isArray(object[key as keyof typeof object])) {
                    // @ts-ignore
                    loop(object[key]);
                } else {
                    // 固定字段的取值统一转中文，未命中时走原有分支
                    const fixedText = getFixedFieldText(key, object[key as keyof typeof object]);
                    if (fixedText !== undefined) {
                        desctiptions.push({
                            key,
                            label: orderRefer[key as keyof unknown] || key,
                            children: fixedText
                        });
                        continue;
                    }
                    switch (key) {
                        case "type":
                            desctiptions.push({
                                key,
                                label: orderRefer[key as keyof unknown] || key,
                                children: agvTypes?.find(type => type.value === object[key])?.label || "小车"
                            });
                            break;
                        case "orderState":
                            desctiptions.push({
                                key,
                                label: orderRefer[key as keyof unknown] || key,
                                children: OrderStatus[object[key] as Records["orderState"]]
                            });
                            break;
                        case "vehicleProcStatus":
                            desctiptions.push({
                                key,
                                label: orderRefer[key as keyof unknown] || key,
                                children: RobotStatus[object[key] as "IDLE"]
                            });
                            break;
                        case "createTime":
                            desctiptions.push({
                                key,
                                label: orderRefer[key as keyof unknown] || key,
                                children: dayjs(object[key]).format("YYYY-MM-DD HH:mm:ss")
                            });
                            break;
                        default:
                            desctiptions.push({
                                key,
                                label: orderRefer[key as keyof unknown] || key,
                                children: typeof object[key as keyof typeof object] === "object" ? JSON.stringify(object[key as keyof typeof object] || undefined) : object[key as keyof typeof object].toString()
                            });
                            break;
                    }
                }
            }
        }
    };
    loop(json);
    return desctiptions;
};

/**
 * @description 获取随机字符串
 * @param length 字符串的长度
 * @returns 随机长度的字符串
 */
export const getRandomString = (length: number = 32) => {
    let result = "";
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789";
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

/**
 * @description 枚举转化为对象
 * @param enumObj 枚举值
 * @returns 转化后的对象
 */
export const enumToObject = <T extends Record<string, string>>(enumObj: T) => {
    return Object.keys(enumObj)
        .filter(key => isNaN(Number(key)))
        .reduce((obj, key) => {
            const value = enumObj[key];
            (obj[key] as string) = value;
            return obj;
        }, {} as { [K in keyof T]: T[K] });
}

/**
 * @description 把对象转化为下拉选选项
 * @param obj 任意对象
 * @returns SelectProps["options"]
 */
export const objectToOptions = (obj: Record<string, string>) => {
    const options: SelectProps["options"] = [];
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            options.push({
                label: obj[key],
                value: key
            })
        }
    }
    return options;
};

// 取消所有pending的请求
// export const abortPendingRequests = () => {
//     abortControllerMap.forEach((controller, key) => {
//       controller.abort();
//       abortControllerMap.delete(key);
//     });
//   };

/**
 * @description 处理订单详情接口的方法
 * @param object 接口返回的订单详情
 * @returns 描述列表
 */
export const transformOrderInfo = (object: OrderInfoType) => {
    const descriptions: DescriptionsProps["items"] = [];
    for (const key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
            // orderMissions 子任务列表改由分页表格单独展示，描述列表跳过该字段，避免把数组序列化进描述列表
            if (key === "orderMissions") continue;
            switch (key) {
                case "orderType":
                    descriptions.push({
                        key,
                        label: orderRefer[key as keyof unknown] || key,
                        children: OrderTypes[object[key]]
                    });
                    break;
                case "orderState":
                    descriptions.push({
                        key,
                        label: orderRefer[key as keyof unknown] || key,
                        children: OrderStatus[object[key]]
                    });
                    break;
                default:
                    descriptions.push({
                        key,
                        label: orderRefer[key as keyof unknown] || key,
                        children: getFixedFieldText(key, object[key as keyof typeof object]) ?? (typeof object[key as keyof typeof object] === "object" ? JSON.stringify(object[key as keyof typeof object] || undefined) : object[key as keyof typeof object]?.toString())
                    });
                    break;
            }
        }
    }
    return descriptions;
};

/**
 * @description 顺序查找第一个缺失的项
 * @param array number[]
 * @returns number
 */
export const findMissNumber = (array: number[]): number => {
    let expected = 1;  // 初始化期望值从1开始
    for (let i = 0; i < array.length; i++) {
        if (array[i] > expected) {
            // 当前元素大于期望值，说明期望值缺失
            return expected;
        } else if (array[i] === expected) {
            // 当前元素等于期望值，递增期望值
            expected++;
        }
        // 当 arr[i] < expected 时（重复元素），跳过不处理
    }
    return expected;  // 遍历结束返回期望值（即最后一项+1）
}

/**
 * @description 顺序找一个以数字结尾的字符串的空缺项
 * @param array string[]
 * @returns 缺失的数字
 */
export const sequenceStringArray = (array: string[]) => {
    // 匹配末尾数字的正则
    const regex = /\d+$/;
    const numbers = array.map(str => Number(str.match(regex)?.[0] || 0));
    numbers.sort((a, b) => a - b);
    const missNum = findMissNumber(numbers);
    return missNum;
};

/**
 * <zh/> 数组去重
 *
 * <en/> deduplicate array
 * @param arr - <zh/> 数组 | <en/> array
 * @param by - <zh/> 通过某个属性去重 | <en/> deduplicate by some property
 * @returns <zh/> 去重后的数组 | <en/> deduplicated array
 */
export function deduplicateArray<T>(arr: T[], by: (item: T) => unknown = (item) => item) {
    const set = new Set();
    return arr.filter((item) => {
      const key = by ? by(item) : item;
      return set.has(key) ? false : set.add(key);
    }) as T[];
  }
