/**
 * 通用加密工具：登录密码摘要。
 *
 * 与旧系统 utils/crypto.ts（@ e570b8df）行为一致：
 * 采用 spark-md5 输出 32 位小写十六进制 MD5，保证与旧后端密码协议逐字节兼容；
 * 独立成模块以集中"密码协议"这一约束，业务代码不直接依赖具体加密库。
 */

import SparkMD5 from 'spark-md5'

/** 对字符串做 MD5 摘要，返回 32 位小写十六进制（源登录协议格式） */
export function md5(value: string): string {
  return SparkMD5.hash(value)
}
