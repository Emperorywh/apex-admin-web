export interface SysLogParam {
    pageSize: number;
    pageNo: number;
    logType?: "NORMAL" | "ERROR";
    logName?: string;
    startTime?: string;
    endTime?: string;
}

export interface LogRecord {
    name: string;
    time: string;
}

export interface DownloadLogType {
    logType: string;
    logNames: string[];
}

export interface PageSysLogsParams {
    pageSize?: number;
    pageNo?: number;
    title?: string;
    logType?: "NORMAL" | "ERROR";
    startRequestTime?: string;
    endRequestTime?: string;
    /**
     * 操作目标名称（模糊查询）
     * 由搜索表单提交至后端，按目标名称模糊匹配
     */
    targetName?: string;
    /**
     * 操作所属模块（精确匹配）
     * 取值与 operationLogModuleOptions 的 value 一致
     */
    module?: string;
}

export interface SysLogRecord {
    id: number;
    title: string;
    logType: string;
    requestIp: string;
    requestUri: string;
    requestMethod: string;
    requestParam: string;
    requestDuration: number;
    username: string;
    exceptionDetail: string;
    responseParam: string;
    requestTime: string;
    /** 操作目标名称，用于表头输入框过滤 */
    targetName?: string;
    /** 操作所属模块（英文枚举，与 operationLogModuleOptions 的 value 对应） */
    module?: string;
}

export interface LicenseProofRecord {
    hardwareInfo: string;
    agvNumber: number;
    issueDate: string;
    expirationDate: string;
    activationCode: string;
}

/**
 * 下载数据库备份文件请求参数
 */
export interface DataBaseBackupDownloadParam {
    /** 选择的数据库 */
    database?: string;
    /** 选择导出的备份文件 */
    backupFileName?: string;
}

/**
 * 数据库备份文件信息
 */
export interface BackupFileRecord {
    /** 文件名 */
    fileName: string;
    /** 文件大小（字节） */
    fileSize: number;
    /** 文件大小（可读） */
    fileSizeReadable: string;
    /** 创建时间 */
    createTime: string;
    /** 文件完整路径 */
    filePath: string;
}

/**
 * 查询数据库备份文件请求参数
 */
export interface DataBaseBackupFilesParam {
    /** 数据库名称 */
    database?: string;
}
