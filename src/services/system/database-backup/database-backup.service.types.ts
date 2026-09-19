/**
 * 数据库备份服务类型（P30 数据库备份页；契约依据最新 OpenAPI dataBase 族 +
 * 旧实现 types/SystemInvolve/SystemLog.d.ts 等价迁移，P30 owner）。
 */

/** 查询数据库备份文件请求参数（GET query 平铺） */
export interface DataBaseBackupFilesParam {
  /** 数据库名称 */
  database?: string
}

/** 下载数据库备份文件请求参数（GET query，OpenAPI 双参数均 required） */
export interface DataBaseBackupDownloadParam {
  /** 选择的数据库 */
  database: string
  /** 选择下载的备份文件名 */
  backupFileName: string
}

/** 数据库备份文件信息（getDataBaseBackupFiles 行记录） */
export interface BackupFileRecord {
  /** 文件名 */
  fileName: string
  /** 文件大小（字节） */
  fileSize: number
  /** 文件大小（后端预格式化可读串，如 1.2 MB） */
  fileSizeReadable: string
  /** 创建时间（后端墙钟字符串） */
  createTime: string
  /** 文件完整路径 */
  filePath: string
}
