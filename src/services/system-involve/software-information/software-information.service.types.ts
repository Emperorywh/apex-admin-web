/**
 * 软件授权/许可证信息类型定义（T018，P02/P29 共用）。
 *
 * 字段与源 `LicenseProofRecord`（旧 src/types/SystemInvolve/SystemLog.d.ts @ e570b8df）
 * 一致，不改名不删减；P02 授权页只消费硬件码，P29 消费完整许可证。
 */

/** 软件激活请求参数（源 SoftwareActivationType） */
export interface SoftwareActivationParams {
  /** 管理员换发的激活码；源提交前 trim（页面层处理，服务层原样上送） */
  activationCode: string
}

/** 许可证信息（源 LicenseProofRecord；getLicense 信封 data） */
export interface LicenseInfoRecord {
  /** 硬件信息（多行机器指纹文本，源在卡片内 pre 滚动展示） */
  hardwareInfo: string
  /** 许可的最大 AGV 数量 */
  agvNumber: number
  /** 激活日期（源格式 YYYY-MM-DD HH:mm:ss，展示层格式化） */
  issueDate: string
  /** 过期日期（同上；剩余天数按日期差计算） */
  expirationDate: string
  /** 激活码（可能超长的密文，卡片内滚动展示并支持复制） */
  activationCode: string
}
