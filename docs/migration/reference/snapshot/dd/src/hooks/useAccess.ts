/**
 * @description 按钮级权限判定 Hook（基于 initialState.buttonPermissions）
 *
 * 数据源：后端登录返回的 data.permissions 平铺数组（B1），
 *         与菜单级 permissions 集合分离（B2/B3），二者互不污染、互不做兜底。
 * - root 用户：短路全权限（B13，沿用 D5/D14）
 * - 普通用户：严格查 buttonPermissions 集合
 *
 * 用法：
 *   const { hasPerm } = useAccess();
 *   {hasPerm(PERM_BUTTON.VEHICLE_LIST_ADD) && <Button>新增车辆</Button>}
 *   <Button onClick={...} hidden={!hasPerm(PERM_BUTTON.VEHICLE_LIST_DELETE)}>...</Button>
 *   // 动作触发型（按钮/菜单项/Dropdown 入口/Icon 操作）：无权限条件渲染隐藏
 *   // 状态展示型（Switch 等承载信息的内联控件）：无权限用 disabled（见 SPEC §7）
 *
 * 详见 docs/SPEC_button_permission.md §5
 */
import { useModel } from "@umijs/max";
import type { PermButtonCode } from "@/constants/permission";
import { isRootUser } from "@/utils/permission";

export const useAccess = () => {
  const { initialState } = useModel("@@initialState");
  const isRoot = isRootUser(initialState?.username);

  /**
   * 判断当前用户是否拥有指定按钮权限码
   * @param code 按钮权限码，受 PermButtonCode 联合类型约束（B12），防拼写错误
   * @returns root 短路返回 true；其余按 buttonPermissions 集合判定
   *
   * 规范（B18）：禁止用 `as PermButtonCode` 绕过类型检查。
   *   后端新增按钮码时，必须先追加到 PERM_BUTTON 常量（SPEC §6）再引用，
   *   以保证编译期拼写检查生效、且 §10 死码告警能覆盖该码。
   */
  const hasPerm = (code: PermButtonCode): boolean => {
    if (isRoot) return true;
    return !!initialState?.buttonPermissions?.has(code);
  };

  return { hasPerm };
};
