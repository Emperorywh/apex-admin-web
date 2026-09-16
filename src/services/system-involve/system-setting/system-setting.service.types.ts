/**
 * 系统图片配置（P27/G04 共用读取链路）类型定义。
 *
 * placementKey 为旧系统约定的三个固定位置（快照 SystemSetting/ImageSettings）：
 * 外壳品牌图、登录背景、站点图标；上传链路（T074）沿用同一键集。
 */

/** 系统图片位置键（与旧系统 UploadCard/ImageSettings 的 key 一致） */
export type SystemImagePlacement = 'headerLogo' | 'loginBackground' | 'favicon'

/** 全部已知位置键（T074 上传页与外壳消费方共用） */
export const SYSTEM_IMAGE_PLACEMENTS = {
  headerLogo: 'headerLogo',
  loginBackground: 'loginBackground',
  favicon: 'favicon',
} as const satisfies Record<string, SystemImagePlacement>
