/**
 * 服务器资源快照 DTO（P40 owner；逐字段对齐基线 OpenAPI，SHA-256 A82E…49C7C）。
 *
 * 契约来源：GET /fms/v1/serverResource/current → ResultServerResourceSnapshot。
 * OpenAPI 未声明任何 required 字段：全部按可空建模，缺失由纯计算层
 * （resourcePolicy.normRate）归一为「不可计算」，绝不补 0（DoD 14 / G15）。
 * 容量字段（total/used/free）后端返回已格式化字符串（如「15.6 GB」），
 * 前端只透传展示，不做单位换算（资源单位按契约=后端原文）。
 */

/** 磁盘分区信息（DiskInfo） */
export interface DiskInfoDto {
  /** 设备名（Linux /dev/sda1、Windows C:） */
  device?: string | null
  /** 挂载路径（Linux /data、Windows C:\） */
  mountPath?: string | null
  /** 磁盘总空间（后端格式化字符串） */
  total?: string | null
  /** 磁盘空闲空间（后端格式化字符串） */
  free?: string | null
  /** 磁盘已用空间（后端格式化字符串） */
  used?: string | null
  /** 磁盘使用率（number；口径 0~1 比例或 0~100 百分比，normRate 兼容双口径） */
  usageRate?: number | null
}

/** 服务器实时资源快照（ServerResourceSnapshot） */
export interface ServerResourceSnapshotDto {
  /** 系统 CPU 使用率（number） */
  systemCpuLoad?: number | null
  /** 系统内存使用率（number） */
  systemMemoryUsageRate?: number | null
  /** JVM 堆内存使用率（number） */
  jvmHeapUsageRate?: number | null
  /** CPU 逻辑核心数（int32） */
  cpuCores?: number | null
  /** 系统总内存（后端格式化字符串） */
  systemMemoryTotal?: string | null
  /** 系统空闲内存（后端格式化字符串） */
  systemMemoryFree?: string | null
  /** 系统已用内存（后端格式化字符串） */
  systemMemoryUsed?: string | null
  /** JVM 堆最大内存（后端格式化字符串） */
  jvmHeapMax?: string | null
  /** JVM 堆已用内存（后端格式化字符串） */
  jvmHeapUsed?: string | null
  /** 磁盘分区列表；后端未上报时缺失 */
  disks?: DiskInfoDto[] | null
}
