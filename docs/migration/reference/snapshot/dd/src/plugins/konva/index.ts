/**
 * @description Konva中需要用到的数据
 * @date 2025-5-27
 */
import type { KonvaConfig } from "./typings";

export const konvaConfig: KonvaConfig = {
    // 超过这个数量的元素就会少渲染节点 性能优化
    maxCount: 20000,
    minZoom: 0,
    maxZoom: 2000
};
