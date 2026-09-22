/** 动作组合是可复用的顺序执行模板；状态只表示配置是否启用，不代表机器人运行状态。 */
export interface ActionCombination {
  id: string
  code: string
  name: string
  scene: string
  robotType: string
  enabled: boolean
  remark: string
  steps: ActionStep[]
  updatedAt: string
}

/** 每个步骤包含动作、目标说明及超时秒数；顺序由数组位置决定，超时后终止组合。 */
export interface ActionStep {
  action: string
  target: string
  timeout: number
}

/** 列表筛选使用当前支持的场景和车型分类。 */
export const sceneOptions = ['入库作业', '出库作业', '产线配送', '库内转运', '自动充电'].map((value) => ({ label: value, value }))
export const robotTypeOptions = ['潜伏顶升式 AGV', '叉车式 AGV', '辊筒式 AGV'].map((value) => ({ label: value, value }))

/** 预制组合覆盖取放货、配送、转运和充电；仅作为页面演示，不向设备下发动作。 */
export const initialCombinations: ActionCombination[] = [
  { id: 'action-01', code: 'ACT-IN-001', name: '原料托盘入库', scene: '入库作业', robotType: '叉车式 AGV', enabled: true, remark: '从入库接驳位取货，运送至原料库指定库位。', updatedAt: '2026-09-22 09:40:00', steps: [{ action: '导航到点', target: '入库接驳位 A01', timeout: 120 }, { action: '精确对接', target: '托盘取货位', timeout: 30 }, { action: '叉取', target: '原料托盘', timeout: 45 }, { action: '导航到点', target: '原料库 A-01', timeout: 180 }, { action: '放货', target: '一层库位', timeout: 45 }] },
  { id: 'action-02', code: 'ACT-OUT-001', name: '成品托盘出库', scene: '出库作业', robotType: '叉车式 AGV', enabled: true, remark: '成品从存储库位转运至出库交接区。', updatedAt: '2026-09-22 09:15:00', steps: [{ action: '导航到点', target: '成品库 B-02', timeout: 180 }, { action: '叉取', target: '成品托盘', timeout: 45 }, { action: '导航到点', target: '出库交接区', timeout: 120 }, { action: '放货', target: '出库缓存位', timeout: 45 }] },
  { id: 'action-03', code: 'ACT-LINE-001', name: '装配线物料配送', scene: '产线配送', robotType: '潜伏顶升式 AGV', enabled: true, remark: '等待工位允许信号后完成料架交接。', updatedAt: '2026-09-21 16:32:00', steps: [{ action: '导航到点', target: '备料区 C01', timeout: 120 }, { action: '顶升', target: '满载料架', timeout: 20 }, { action: '导航到点', target: '装配线 01 工位', timeout: 180 }, { action: '等待信号', target: '工位允许放料', timeout: 60 }, { action: '下降', target: '工位料架位', timeout: 20 }, { action: '退出站点', target: '工位安全点', timeout: 30 }] },
  { id: 'action-04', code: 'ACT-MOVE-001', name: '空料架回收', scene: '库内转运', robotType: '潜伏顶升式 AGV', enabled: true, remark: '回收产线空料架至备料区。', updatedAt: '2026-09-21 14:20:00', steps: [{ action: '导航到点', target: '空架回收位', timeout: 120 }, { action: '顶升', target: '空料架', timeout: 20 }, { action: '导航到点', target: '备料区空架位', timeout: 180 }, { action: '下降', target: '空料架放置位', timeout: 20 }] },
  { id: 'action-05', code: 'ACT-LINE-002', name: '辊筒工位接驳', scene: '产线配送', robotType: '辊筒式 AGV', enabled: true, remark: '对接输送线，收到允许信号后进行辊筒收发货。', updatedAt: '2026-09-20 11:08:00', steps: [{ action: '精确对接', target: '输送线接货口', timeout: 30 }, { action: '等待信号', target: '输送线允许接货', timeout: 60 }, { action: '辊筒接货', target: '接货传感器确认', timeout: 45 }, { action: '导航到点', target: '包装线送货口', timeout: 150 }, { action: '精确对接', target: '包装线接驳位', timeout: 30 }, { action: '辊筒送货', target: '送货完成信号', timeout: 45 }] },
  { id: 'action-06', code: 'ACT-CHG-001', name: '低电量自动充电', scene: '自动充电', robotType: '潜伏顶升式 AGV', enabled: true, remark: '前往空闲充电位并完成充电对接。', updatedAt: '2026-09-20 10:05:00', steps: [{ action: '导航到点', target: '充电等待点', timeout: 180 }, { action: '精确对接', target: '充电桩 CH-01', timeout: 60 }, { action: '开始充电', target: '充电连接确认', timeout: 30 }] },
  { id: 'action-07', code: 'ACT-IN-002', name: '来料缓存区转存', scene: '入库作业', robotType: '潜伏顶升式 AGV', enabled: false, remark: '缓存区布局调整中，暂不启用。', updatedAt: '2026-09-19 15:46:00', steps: [{ action: '导航到点', target: '来料缓存区', timeout: 120 }, { action: '顶升', target: '来料料架', timeout: 20 }, { action: '导航到点', target: '临时存储区', timeout: 120 }, { action: '下降', target: '缓存放置位', timeout: 20 }] },
  { id: 'action-08', code: 'ACT-MOVE-002', name: '跨区托盘转运', scene: '库内转运', robotType: '叉车式 AGV', enabled: false, remark: '用于 A 区与 B 区之间的托盘转运。', updatedAt: '2026-09-18 08:30:00', steps: [{ action: '导航到点', target: 'A 区取货位', timeout: 150 }, { action: '叉取', target: '待转运托盘', timeout: 45 }, { action: '导航到点', target: 'B 区缓存位', timeout: 240 }, { action: '放货', target: '跨区交接位', timeout: 45 }] },
]
