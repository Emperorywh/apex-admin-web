// 运行时配置
// 注册画布的自定义节点
// import "@/plugins/graph";
import React from "react";
import { history, defineApp } from "@umijs/max";
import Konva from "konva";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import zhTW from "antd/locale/zh_TW";
import jaJP from "antd/locale/ja_JP";
import koKR from "antd/locale/ko_KR";
import { ConfigProvider } from "antd";
import "dayjs/locale/zh-cn";
import "dayjs/locale/en";
import "dayjs/locale/zh-tw";
import "dayjs/locale/ja";
import "dayjs/locale/ko";
import dayjs from "dayjs";
import { GlobalTypes } from "./types/typing";
import { WebSocketProvider } from "@/socket/WebSocketProvider";
import HeaderSvg from "@/assets/images/header-logo.svg";
import ActionsRender from "./components/ActionsRender";
import UnAccess from "@/pages/UnAccess";
import type { AccessInfo } from "@/types/Login";
import { fetchSystemImage } from "@/api";
import { useI18n } from "@/hooks/useI18n";
import type { MenuDataItem } from "@umijs/max";
import { flattenPermissionCodes, expandWithAncestors, isRootUser } from "@/utils/permission";
import { PERM, PERM_BUTTON } from "@/constants/permission";
import { buildAuthHeaders, dispatchBusinessCode } from "@/api/httpShared";

/**
 * antd locale 映射表
 * 根据当前语言标识动态注入对应的 antd 组件内置文案（分页、日期选择器等）
 * 覆盖项目已开放的 5 种语言，不得让日/韩/繁中界面混入简中组件文案（§3.3）
 */
const ANTD_LOCALE_MAP: Record<string, any> = {
  "zh-CN": zhCN,
  "en-US": enUS,
  "zh-TW": zhTW,
  "ja-JP": jaJP,
  "ko-KR": koKR,
};

/**
 * dayjs locale 映射表
 * 跟随语言切换同步更新日期格式化行为（覆盖 5 种语言，§3.3）
 */
const DAYJS_LOCALE_MAP: Record<string, string> = {
  "zh-CN": "zh-cn",
  "en-US": "en",
  "zh-TW": "zh-tw",
  "ja-JP": "ja",
  "ko-KR": "ko",
};

dayjs.locale("zh-cn");

// Use degree values for angle properties. You may set this property to false if you want to use radian values.
Konva.angleDeg = false;

function setFavicon(url: string) {
  let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
}

async function fetchImageUrl(key: string): Promise<string | undefined> {
  try {
    const blob = await fetchSystemImage(key);
    if (blob && blob.size > 0 && blob.type.includes("image")) return URL.createObjectURL(blob);
  } catch {
    // 获取失败则使用默认图片
  }
  return undefined;
}

/**
 * 菜单数据后处理：递归移除「无可见子菜单」的父分组节点（D12）
 * 配合 umi access 自动过滤，实现「随子联动隐藏空父节点」
 * 仅剪除空父节点，不改变层级深度，菜单 3 层嵌套原样保留
 *
 * 与 expandWithAncestors 的分工（D12 双向联动）：
 *   - expandWithAncestors 解决「有子无父」—— 补全父分组 code 使其 access=true
 *   - pruneEmptyParents  解决「有父无子」—— 隐藏子项全被过滤的空壳父分组
 */
function pruneEmptyParents(menuData: MenuDataItem[]): MenuDataItem[] {
  return menuData
    .map((item) => {
      if (item.children?.length) {
        item.children = pruneEmptyParents(item.children);
      }
      return item;
    })
    .filter((item) => {
      // 有 children 的父节点：至少要有一个可见子项才保留
      // 无 children 的叶子节点：已被 access 过滤，此处保留即可
      if (item.children) {
        return item.children.length > 0;
      }
      return true;
    });
}

// 全局初始化数据配置，用于 Layout 用户信息和权限初始化
// 更多信息见文档：https://umijs.org/docs/api/runtime-config#getinitialstate
export async function getInitialState(): Promise<GlobalTypes.InitialState> {
  const accessInfo = localStorage.getItem("accessInfo");
  const localInfo: AccessInfo = accessInfo ? JSON.parse(accessInfo || "{}") : {};
  if (!localInfo?.username || !localInfo?.token) {
    history.replace({ pathname: "/login" });
    return { username: localInfo?.username, token: localInfo?.token };
  }

  const [headerLogoUrl, faviconUrl] = await Promise.all([
    fetchImageUrl("headerLogo"),
    fetchImageUrl("favicon"),
  ]);
  if (faviconUrl) {
    setFavicon(faviconUrl);

  }
  // 权限集合（双源分算，B2/B3）：
  // ① 菜单源：permissionsTree 扁平化（默认只收 MENU 码）+ 祖先填充 → permissions，仅供 access.ts 消费
  //    祖先填充保证「有任一后代 code → 其全部祖先分组 code 进入集合」，
  //    使 access.ts 对父分组路由的判定（map[code]）为 true，防御后端权限树断链（§3.4）
  const rawCodes = flattenPermissionCodes(localInfo?.permissionsTree);
  const permissions = expandWithAncestors(rawCodes);
  // ② 按钮源：data.permissions 平铺数组直接 new Set，不做祖先填充 → buttonPermissions，仅供 useAccess 消费
  //    按钮判定与菜单判定解耦，互不影响（B1/B3）
  const buttonPermissions = new Set<string>(localInfo?.flatPermissions ?? []);

  // dev 三向一致性告警（§10，B4）：因两源同源靠后端保证、前端不做运行时兜底，
  // 此处是唯一早期预警，仅 dev 期生效，生产环境不校验、不拦截
  if (process.env.NODE_ENV === "development") {
    const flatArr = localInfo?.flatPermissions ?? [];
    const flatSet = new Set(flatArr);
    const knownButton = new Set<string>(Object.values(PERM_BUTTON));
    const menuCodes = new Set<string>(Object.values(PERM)); // 菜单码（PERM，含祖先分组码）

    // ① 后端有、前端 PERM_BUTTON 未收录（漂移）：提示补录常量
    //    排除菜单码与祖先分组码（它们在 PERM 中）
    const missingInFront = flatArr.filter(
      (code) => !knownButton.has(code) && !menuCodes.has(code)
    );
    // ② 前端死码：PERM_BUTTON 收录、但后端 data.permissions 已无（后端删码/改名）
    //    仅对超管（拥有全部权限）有意义：普通用户本就不会拥有未分配的码，
    //    若不限定 root 会把「未分配的码」误报为「死码」造成刷屏
    const deadCodes = isRootUser(localInfo?.username)
      ? [...knownButton].filter((code) => !flatSet.has(code))
      : [];
    // ③ 两源不一致：data.permissions（平铺）vs permissionsTree（树）对同一码结论不同
    //    ——半残态根因（菜单可见但按钮缺码）。用全集版 flattenPermissionCodes（含 BUTTON）
    const treeAll = flattenPermissionCodes(localInfo?.permissionsTree, true); // includeButtons=true
    const flatOnly = flatArr.filter((code) => !treeAll.has(code)); // 平铺有、树无
    const treeOnly = [...treeAll].filter((code) => !flatSet.has(code)); // 树有、平铺无

    if (missingInFront.length || deadCodes.length || flatOnly.length || treeOnly.length) {
      console.warn(
        "[permission] dev 一致性告警：\n" +
        (missingInFront.length ? `  ① 后端有前端未收录：${missingInFront.join(", ")}\n` : "") +
        (deadCodes.length ? `  ② 前端死码（后端已删/改名）：${deadCodes.join(", ")}\n` : "") +
        (flatOnly.length || treeOnly.length
          ? `  ③ 两源不一致（平铺 vs 树）——半残态风险：平铺独有[${flatOnly.join(", ")}] / 树独有[${treeOnly.join(", ")}]\n`
          : "")
      );
    }
  }

  return {
    username: localInfo?.username,
    token: localInfo?.token,
    headerLogoUrl,
    faviconUrl,
    permissionsTree: localInfo?.permissionsTree,
    permissions, // 菜单用（不变）
    buttonPermissions, // 按钮用（新增）
  };
}

export default defineApp({
  // 全局样式
  layout: ({ initialState }: { initialState?: GlobalTypes.InitialState }) => {
    // Umi Max 的 layout 回调被当作 React 组件渲染，支持 hooks
    const { t, locale: currentLocale } = useI18n();
    // 动态设置 dayjs locale，跟随用户语言切换
    dayjs.locale(DAYJS_LOCALE_MAP[currentLocale] || "zh-cn");

    return {
      layout: "mix",
      menu: {
        locale: true,
      },
      siderWidth: 256,
      title: t("调度系统"),
      logo: initialState?.headerLogoUrl || HeaderSvg,
      loading: false,
      // 自定义操作列表
      actionsRender: () => <ActionsRender />,
      onMenuHeaderClick: () => {
        history.push({
          pathname: "/over-look",
        });
      },
      // D12：access 已自动过滤无权限菜单，此处再剪除「子项全被过滤」的空父分组节点
      menuDataRender: (menuData) => pruneEmptyParents(menuData),
      unAccessible: <UnAccess />,
    };
  },
  // 根组件
  // rootContainer 回调不在 React 组件上下文中，不能调用 hooks
  // 通过 localStorage.getItem("umi_locale") 获取当前语言偏好
  rootContainer: (container) => {
    const currentLocale = localStorage.getItem("umi_locale") || "zh-CN";
    return React.createElement(
      ConfigProvider,
      { locale: ANTD_LOCALE_MAP[currentLocale] },
      React.createElement(WebSocketProvider, null, container),
    );
  },
  // 拦截器
  request: {
    timeout: 1000 * 60 * 60,
    errorConfig: {
      errorHandler() {},
      errorThrower() {},
    },
    requestInterceptors: [
      (url, options) => {
        // 鉴权头注入复用 httpShared（与 uploadWithProgress 共用同一份真相源）
        options.headers = {
          ...(options?.headers || {}),
          // 鉴权头 + 国际化语言头统一由 buildAuthHeaders 注入
          // 与 uploadWithProgress（XHR 上传）共用同一份真相源，避免两处漂移
          ...buildAuthHeaders()
        };
        return { url, options };
      },
    ],
    responseInterceptors: [
      (response) => {
        // 业务码路由（1001000 跳授权 / 1000000 清 token 跳登录）复用 httpShared
        // @ts-ignore
        dispatchBusinessCode(response?.data?.code);
        return response;
      },
    ],
  },
});

// 仅在开发环境生效
if (process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args) => {
    // 过滤包含 findDOMNode 警告的日志 应该是umi库的告警
    const first = args[0];
    if (typeof first === "string" && first.includes("findDOMNode is deprecated")) {
      return;
    }
    originalError.call(console, ...args);
  };
}
