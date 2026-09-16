/**
 * 后端权限树节点结构
 * 与登录接口 data.permissionsTree 节点一一对应
 */
export interface PermissionNode {
  id: number;
  code: string; // 权限码，唯一标识，如 "overview:view"
  name: string; // 中文名，如 "调度监控"
  type: "MENU" | "BUTTON";
  parentCode: string; // 父节点 code，顶级为 ""
  path: string; // 前端路由路径（分组节点为空 ""）
  icon: string; // 图标名（仅顶级节点有值）
  sort: number; // 排序值
  state: string; // 状态，如 "ENABLED"
  childPermissions: PermissionNode[] | null;
}

export interface LoginType {
  username: string;
  password: string;
}

export interface AccessInfo {
  username?: string;
  token?: string;
  /**
   * 后端权限树（菜单级数据源，原样存储）
   * 用于菜单过滤、access.ts 路由判定、超管判定
   * 与 accessInfo 同生命周期（登出时一并清除）
   */
  permissionsTree?: PermissionNode[];
  /**
   * 后端登录返回的平铺权限码数组（按钮级数据源）
   * 来自 data.permissions，含 MENU + BUTTON + 祖先分组码全集
   *
   * 命名说明（B19）：刻意取名 flatPermissions 而非 permissions，
   * 以与 InitialState.permissions: Set<string>（菜单码集合，树派生）区分，
   * 二者同名异义、无派生关系，曾致维护者误读。
   * 注意：后端返回字段仍为 data.permissions，仅前端存储字段改名。
   */
  flatPermissions?: string[];
}
