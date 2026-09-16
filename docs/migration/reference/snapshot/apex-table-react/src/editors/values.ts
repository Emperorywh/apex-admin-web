import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import 'dayjs/locale/zh-cn.js';

/*
 * 日期和时间只在控件边界转换，业务数据保持可序列化字符串。
 * 严格解析不接受溢出日期，也不把空值转换成当前时间。
 */
dayjs.extend(customParseFormat);
export function parseEditorDate(value: unknown, format: string) {
  if (value === null || value === undefined || value === '') return null;
  const result = dayjs.isDayjs(value) ? value : typeof value === 'string' ? dayjs(value, format, true) : value instanceof Date || typeof value === 'number' ? dayjs(value) : null;
  return result?.isValid() ? result : null;
}
export function editorText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}
