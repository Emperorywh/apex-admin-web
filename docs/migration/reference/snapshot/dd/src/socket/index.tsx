/**
 * @description websocket的创建组件
 * @date 2025-5-26
 * @example https://ahooks.js.org/zh-CN/hooks/use-web-socket
 * @example https://blog.csdn.net/csdn1940879828/article/details/145637796
 */
import { createContext, useContext } from "react";
import type { ReadyState } from "ahooks/es/useWebSocket";

export interface SocketContext {
    sendMessage: (message: string | object) => void
    readyState: ReadyState
    lastMessage: MessageEvent<any> | null
    connect: () => void
    disconnect: () => void
    webSocketIns: WebSocket | null
}

export const WebSocketContext = createContext<SocketContext>({} as SocketContext);

export const useWebSocketContext = () => useContext(WebSocketContext);
