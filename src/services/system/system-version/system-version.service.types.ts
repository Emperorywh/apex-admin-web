/**
 * 系统版本服务类型（P25 版本管理；OpenAPI「系统版本控制类」六 operation）。
 *
 * SystemVersionDto 对应 OpenAPI schema SystemVersion（GET getSystemVersions 的
 * 列表项）：后端扁平化的 Git 构建信息；gitCommitTime/gitBuildTime 协议声明为
 * date-time（响应实测为 yyyy-MM-dd HH:mm:ss 秒级字符串，展示层经共享
 * displayDateTime 转换，不改协议值）。type 为受控枚举 PENDING/CURRENT/BACKUP，
 * 未知枚举按纪律显示协议原值，不臆造中文。
 */

/** 系统版本列表项（getSystemVersions 返回集合元素；字段与 OpenAPI SystemVersion 一致） */
export interface SystemVersionDto {
  /** git 提交的 tag */
  gitTags?: string | null
  /** git 版本号 */
  gitBuildVersion?: string | null
  /** git 提交用户 */
  gitCommitUserName?: string | null
  /** git 提交分支 */
  gitBranch?: string | null
  /** git 提交描述 */
  gitCommitIdDescribe?: string | null
  /** git 提交 id */
  gitCommitId?: string | null
  /** git 提交时间（秒级字符串，展示层转换） */
  gitCommitTime?: string | null
  /** git 构建时间（秒级字符串，展示层转换） */
  gitBuildTime?: string | null
  /** maven 构建时间 id（回滚/删除待升级/下载的定位键，OpenAPI SystemVersionParam.buildId） */
  gitBuildId?: string | null
  /** git 提交详细信息 */
  gitCommitMessageFull?: string | null
  /** 版本类型：待升级 PENDING / 当前版本 CURRENT / 备份版本 BACKUP */
  type?: 'PENDING' | 'CURRENT' | 'BACKUP' | string | null
}

/** 版本操作定位参数（rollback/deletePendingJar/downloadSystemVersionJar 请求体，OpenAPI SystemVersionParam） */
export interface SystemVersionParam {
  /** jar 包唯一构建标识（列表行 gitBuildId 原值） */
  buildId: string
}
