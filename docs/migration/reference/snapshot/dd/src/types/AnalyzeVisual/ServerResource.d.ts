/**
 * 磁盘分区信息（对应 DiskInfo）
 */
export interface DiskInfo {
    /** 设备名（Linux /dev/sda1，Windows C:） */
    device?: string;
    /** 挂载路径（Linux /data，Windows C:\） */
    mountPath?: string;
    /** 磁盘总空间 */
    total?: string;
    /** 磁盘空闲空间 */
    free?: string;
    /** 磁盘已用空间 */
    used?: string;
    /** 磁盘使用率 */
    usageRate?: number;
}

/**
 * 服务器实时资源快照（对应 ServerResourceSnapshot）
 * 对应后端接口 /fms/v1/serverResource/current
 */
export interface ServerResourceSnapshot {
    /** 系统总内存 */
    systemMemoryTotal?: string;
    /** 系统空闲内存 */
    systemMemoryFree?: string;
    /** 系统已用内存 */
    systemMemoryUsed?: string;
    /** 系统内存使用率 */
    systemMemoryUsageRate?: number;
    /** JVM堆已用内存 */
    jvmHeapUsed?: string;
    /** JVM堆最大内存 */
    jvmHeapMax?: string;
    /** JVM堆内存使用率 */
    jvmHeapUsageRate?: number;
    /** 磁盘分区列表 */
    disks?: DiskInfo[];
    /** CPU逻辑核心数 */
    cpuCores?: number;
    /** 系统CPU使用率 */
    systemCpuLoad?: number;
}

/**
 * 服务器实时资源快照响应结果（对应 ResultServerResourceSnapshot）
 */
export interface ResultServerResourceSnapshot {
    /** 返回码，200 正常 */
    code: number;
    /** 返回信息 */
    message: string;
    /** 时间戳 */
    timestamp: number;
    /** 服务器实时资源快照 */
    data: ServerResourceSnapshot;
}
