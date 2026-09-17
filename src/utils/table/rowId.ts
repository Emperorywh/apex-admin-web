/**
 * ApexTable 行 ID 取值纯函数（T00.5 表格公共设施，DoD 5「稳定行 ID」）。
 *
 * 背景：排序、筛选、翻页、展开与选择都依赖 getRowId 返回唯一稳定标识；
 * 行 ID 取自业务主键字段，禁止用数组下标等位置性 ID。
 *
 * 精度约束（G10）：调度后端 int64 主键在 DTO 层必须以字符串承载；
 * 若字段值是不安全整数（超过 2^53−1），说明 DTO 定义或后端返回已丢精度，
 * 本函数保留原值继续转字符串（不二次破坏），但立即在控制台报错提示，
 * 让问题在联调期显性化，而不是静默产出错乱的选择/展开行为。
 */

export type RowIdGetter<D> = (row: D) => string

/** 判定值可否直接作为行 ID：非空字符串，或安全范围内的数字 */
function isUsableRowIdValue(value: unknown): value is string | number {
  if (typeof value === 'string') return value.length > 0
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * 生成按指定字段取行 ID 的 getRowId 回调。
 * 字段值缺失或为空时抛错：空/重复行 ID 会被表格判为配置错误（duplicateRowId），
 * 提前抛错能把「哪个页面的哪个字段没配好」定位到具体调用点。
 */
export function stringFieldRowId<D>(field: keyof D & string): RowIdGetter<D> {
  return (row: D): string => {
    const value: unknown = row[field]

    if (!isUsableRowIdValue(value)) {
      throw new Error(
        `[表格行 ID] 字段「${String(field)}」的值为空或不可用（${String(value)}），` +
          '请确认该记录主键已返回且 getRowId 指向稳定业务字段',
      )
    }

    // int64 主键必须是字符串承载（G10）；出现不安全整数说明精度已丢失，立即报错提示
    if (typeof value === 'number' && !Number.isSafeInteger(value)) {
      throw new Error(
        `[表格行 ID] 字段「${String(field)}」收到超出安全范围的整数 ${String(value)}，` +
          'int64 主键必须以字符串承载（G10 契约），请检查 DTO 类型定义',
      )
    }

    return String(value)
  }
}
