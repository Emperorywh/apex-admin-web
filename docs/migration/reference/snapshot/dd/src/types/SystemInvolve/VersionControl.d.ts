/**
 * 系统版本操作参数
 * 用于回滚版本包、删除待升级 jar 等操作，buildId 为 jar 包的唯一构建标识
 */
export interface SystemVersionParam {
    buildId: string;
}

/**
 * 系统版本信息（getSystemVersions 返回项）
 * 字段为后端扁平化后的 Git 构建信息，与分页接口 SystemVersion 的嵌套结构不同
 */
export interface SystemVersionInfo {
    // git 提交的 tag
    gitTags: string;
    // git 版本号
    gitBuildVersion: string;
    // git 提交用户
    gitCommitUserName: string;
    // git 提交分支
    gitBranch: string;
    // git 提交描述
    gitCommitIdDescribe: string;
    // git 提交 id
    gitCommitId: string;
    // git 提交时间
    gitCommitTime: string;
    // git 构建时间
    gitBuildTime: string;
    // maven 构建时间 id（对应回滚/删除待升级 jar 接口的 buildId）
    gitBuildId: string;
    // git 提交详细信息
    gitCommitMessageFull: string;
    // 版本类型：待升级 PENDING / 当前版本 CURRENT / 备份版本 BACKUP
    type: "PENDING" | "CURRENT" | "BACKUP" | string;
}

export interface VersionResult {
    record: VersionRecord[];
}

export interface SystemVersion {
    id: number;
    createTime: string;
    updateTime: string;
    createUser: string;
    updateUser: string;
    jarKey: string;
    jarName: string;
    commitId: string;
    gitInfo: {
        tags: string;
        dirty: string;
        branch: string;
        "commit.id": string;
        "build.host": string;
        "build.time": string;
        "commit.time": string;
        "build.version": string;
        "commit.id.full": string;
        "build.user.name": string;
        "build.user.email": string;
        "closest.tag.name": string;
        "commit.id.abbrev": string;
        "commit.user.name": string;
        "commit.user.email": string;
        "remote.origin.url": string;
        "commit.id.describe": string;
        "local.branch.ahead": string;
        "total.commit.count": string;
        "commit.message.full": string;
        "local.branch.behind": string;
        "commit.message.short": string;
        "closest.tag.commit.count": string;
        "commit.id.describe-short": string;
    },
    inuse: boolean;
    jarResource: string | null;
}
