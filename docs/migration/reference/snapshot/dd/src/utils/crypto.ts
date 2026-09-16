/**
 * @description 通用加密工具函数
 * 提供MD5等加密方法，用于密码等敏感信息的加密处理
 */
import SparkMD5 from "spark-md5";

/**
 * 对字符串进行MD5加密
 * @param value 需要加密的原始字符串
 * @returns MD5加密后的32位小写十六进制字符串
 */
export const md5 = (value: string): string => {
    return SparkMD5.hash(value);
};
