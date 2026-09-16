/**
 * @description websocket的Provider
 * @date 2025-5-26
 * @enum enum ReadyState { Connecting = 0, Open = 1, Closing = 2, Closed = 3 }
 */
import { useWebSocket } from "ahooks";
import { useEffect, useMemo } from "react";
import { WebSocketContext } from "./index";

const WS_IP =
  process.env.NODE_ENV === "development"
    ? "10.11.2.67"
    : window.location.hostname;

export const WebSocketProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  /*
   * WebSocket 携带当前国际化语言：
   * 浏览器原生 WebSocket 握手阶段不支持自定义请求头，无法像 HTTP 那样
   * 设置 Accept-Language 头，因此改为通过 URL query 参数 accept-language
   * 下发给后端，语义与 HTTP 请求头保持一致，后端可据此返回对应语言文案。
   *
   * 读取时机：组件挂载时从 localStorage 读取 umi_locale。
   * ActionsRender / Login 的 setLocale(key, true) 会先写入 umi_locale
   * 再刷新整个页面，刷新后本 Provider 重新挂载，即可拿到最新的语言值，
   * 从而实现"切换语言 → WebSocket 以新语言重连"的联动。
   * 与 src/api/httpShared.ts 中 buildAuthHeaders 的语言读取方式保持一致。
   */
  const locale = localStorage.getItem("umi_locale") || "zh-CN";
  const WS_URL = `ws://${WS_IP}:8888/websocket/getDispatcherMonitor?accept-language=${encodeURIComponent(
    locale,
  )}`;

  const {
    readyState,
    sendMessage: originalSend,
    connect,
    disconnect,
    latestMessage,
    webSocketIns,
  } = useWebSocket(WS_URL, {
    reconnectLimit: 1000, // 最大重试次数
    reconnectInterval: 3000, // 重试间隔
    manual: true, // 手动启动连接
  });

  // 统一封装发送方法，支持对象自动序列化
  const sendMessage = useMemo(() => {
    return (message: string | object) => {
      let _message = message;
      if (typeof _message !== "string") {
        _message = JSON.stringify(message);
      }
      originalSend(_message);
    };
  }, [originalSend]);

  // 初始化连接逻辑
  useEffect(() => {
    connect(); // 启动连接
    return () => disconnect(); // 组件卸载时断开
  }, [connect, disconnect]);

  // 暴露给子组件的上下文值
  const contextValue = useMemo(
    () => ({
      sendMessage,
      readyState,
      lastMessage: latestMessage || null,
      connect,
      disconnect,
      webSocketIns: webSocketIns || null,
    }),
    [sendMessage, readyState, latestMessage, connect, disconnect],
  );

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};
