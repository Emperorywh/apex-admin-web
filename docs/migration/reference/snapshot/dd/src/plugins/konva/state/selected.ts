/**
 * @description 元素被选中时的状态配置
 * @date 2025-6-25
 */
import type { SelectedState } from "@/plugins/konva/typings";

// 元素被选中时半径有2倍的变化 lineWidth有3倍的变化
export const selectedState: SelectedState = {
    radius: 2,
    lineWidth: 2
};
