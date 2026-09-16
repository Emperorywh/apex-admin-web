/**
 * @description request方法
 * @date 2025-5-17
 */
import { request } from "@umijs/max";
import type { RequestOptions } from "@umijs/max";

export const get = <T = any>(url: string, params: object = {}, options: RequestOptions = {}): Promise<T> => {
  return request<T>(url, {
    method: "GET",
    withCredentials: true,
    params: {
      ...params,
    },
    ...(options || {})
  });
};

export const post = <T = any>(url: string, data: object = {}, options: RequestOptions = {}): Promise<T> => {
  return request<T>(url, {
    method: "POST",
    data,
    ...(options || {})
  });
};

export const put = <T = any>(url: string, body: object = {}, options: RequestOptions = {}): Promise<T> => {
  return request<T>(url, {
    method: "PUT",
    data: body,
    ...(options || {}),
  });
};

export const delet = <T = any>(url: string, params: object = {}, options: RequestOptions = {}): Promise<T> => {
  return request<T>(url, {
    method: "DELETE",
    params: { ...params },
    ...(options || {}),
  });
};
