/**
 * @description 用来存放memo的比较函数 请不要随意新增和删除 使用前请确认作用
 * @date 2025-6-13
 * @link https://zh-hans.react.dev/reference/react/memo
 */
import type { GraphStageProps } from "@/pages/Overlook/ForceGraph/GraphStage";

/**
 * @description 首页画布组件的memo第二个参数，优化组件的
 * @param oldProps 旧的props
 * @param newProps 新的props
 * @returns 判断新旧props是否相等
 * @argument 同一组件实例内：useState 返回的 setter 函数引用总是相同
 */
export const propsForceGraphIsEqual = (oldProps: GraphStageProps, newProps: GraphStageProps): boolean => {
    const { stageSize: { width: oldWidth, height: oldHeight }, overlayVisible: { nodeLabel: oldNodeLabel, edgeLabel: oldEdgeLabel, traffic: oldTraffic, robot: oldRobot, grid: oldGrid, device: oldDevice, actions: oldActions, loadSecurityColor: oldLoadSecurityColor, freeSecurityColor: oldFreeSecurityColor, allowVehicleGroupsColor: oldAllowVehicleGroupsColor }, gridSpacing: oldGridSpacing, visibleTrafficAgvKeys: oldVisibleTrafficAgvKeys, areaGroups: oldAreaGroups, highlightedAreaIds: oldHighlightedAreaIds } = oldProps;
    const { stageSize: { width, height }, overlayVisible: { nodeLabel, edgeLabel, traffic, robot, grid, device, actions, loadSecurityColor, freeSecurityColor, allowVehicleGroupsColor }, gridSpacing, visibleTrafficAgvKeys, areaGroups, highlightedAreaIds } = newProps;
    // 注意：overlayVisible 每新增一个字段，这里必须同步参与比较，否则该字段变化无法触发 GraphStage 重渲染（如 device/actions/loadSecurityColor 等开关失效）
    // visibleTrafficAgvKeys 同理：新增的交管白名单数组，用户选择变化时引用必变，必须参与比较，否则画布交管不更新（SPEC §5.5）
    // onVehiclesChange 为 useCallback 稳定引用，无需在此比较
    // 区域高亮（SPEC_area_highlight_monitoring_playback）：areaGroups / highlightedAreaIds 按引用比较，
    // 漏加则勾选高亮被 memo 拦截、静默失效（TS 不报错）
    return oldWidth === width && oldHeight === height && oldNodeLabel === nodeLabel && oldEdgeLabel === edgeLabel && oldTraffic === traffic && oldRobot === robot && oldGrid === grid && oldDevice === device && oldActions === actions && oldLoadSecurityColor === loadSecurityColor && oldFreeSecurityColor === freeSecurityColor && oldAllowVehicleGroupsColor === allowVehicleGroupsColor && oldGridSpacing === gridSpacing && oldVisibleTrafficAgvKeys === visibleTrafficAgvKeys && oldAreaGroups === areaGroups && oldHighlightedAreaIds === highlightedAreaIds;
};
