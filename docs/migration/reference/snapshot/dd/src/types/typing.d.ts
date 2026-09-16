export interface AgvPosition {
  deviationRange: number;
  localizationScore: number;
  mapDescription: string;
  mapId: string;
  normal: boolean;
  positionInitialized: boolean;
  theta: number;
  x: number
  y: number;
}

export interface MapEdge {
  id: string;
  reverseEdgeId: string;
  name: string;
  type: number;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  cx: number | null,
  cy: number | null,
  dx: number | null,
  dy: number | null,
  radius: number;
  // 是否是反向路径
  isBackEdge: boolean;
  limitV: number;
  limitW: number;
  cost: number;
  rotateDirection: null,
  loadType: number;
  userDefinedProperties: null,
  snodeName: string;
  enode: string;
  snode: string;
  enodeName: string;
  efacing: number;
  sfacing: number;
}

export interface SoftwareActivationType {
  activationCode: string;
}

declare namespace GlobalTypes {
  interface InitialState {
    username?: string;
    token?: string;
    headerLogoUrl?: string;
    faviconUrl?: string;
    /**
     * 权限树（运行时消费）
     * 类型用 inline import 引用，避免顶层 import 影响 ambient namespace 的全局性（§6.1.2 U3）
     */
    permissionsTree?: import("./Login").PermissionNode[];
    /**
     * 菜单权限码集合（树扁平化 + 祖先填充，仅含 MENU 码，服务 access.ts 菜单判定）
     * Set 不可 JSON 序列化，仅存在于内存 initialState，不进 localStorage
     */
    permissions?: Set<string>;
    /**
     * 按钮权限码集合（来自 data.permissions 平铺数组，服务 useAccess 按钮判定）
     * 与 permissions 分离：按钮判定纯以此为准（B3）
     * Set 不可 JSON 序列化，仅存在于内存 initialState，不进 localStorage
     */
    buttonPermissions?: Set<string>;
  }
}

export interface SearchType {
  pageSize: number;
  pageNo: number;
  query?: string;
}

export interface ResponseType<Type> {
    records: Type[];
    total: number;
    size: number;
    current: number;
    pages: number;
}
