import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

/*
 * 直接编译数据更新与值转换模块，使用 Node 原生测试验证公开行为。
 * 不写入构建目录，也不依赖文档站或浏览器的内部状态。
 */
async function sourceModule(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { updateCellData, editorPath, readEditorField } = await sourceModule('src/internal/editing-data.ts');
const { parseEditorDate } = await sourceModule('src/editors/values.ts');

test('修改原始行索引对应的记录，并保留未修改记录和字段', () => {
  const rows = [{ id: 'a', stock: 3 }, { id: 'b', stock: 1 }];
  const result = updateCellData(rows, 1, 'b', 'stock', 1, 9, { type: 'InputNumber' }, 'stock');
  assert.deepEqual(result.data, [{ id: 'a', stock: 3 }, { id: 'b', stock: 9 }]);
  assert.equal(result.data[0], rows[0]);
  assert.notEqual(result.data[1], rows[1]);
  assert.equal(rows[1].stock, 1);
  assert.equal(result.change.row, result.data[1]);
  assert.equal(result.change.previousRow, rows[1]);
  assert.equal(result.change.rowId, 'b');
});

test('嵌套字段和数组字段不可变更新，不覆盖同级内容', () => {
  const rows = [{ profile: { name: '旧名称', flag: true }, tags: [{ name: '原标签' }] }];
  const result = updateCellData(rows, 0, 'a', 'profile_name', '旧名称', '新名称', { type: 'Input' }, 'profile.name');
  assert.deepEqual(result.data[0].profile, { name: '新名称', flag: true });
  assert.equal(rows[0].profile.name, '旧名称');
  assert.equal(result.data[0].tags, rows[0].tags);
  const nested = updateCellData(rows, 0, 'a', 'tags', '原标签', '新标签', { type: 'Input', field: ['tags', '0', 'name'] });
  assert.equal(nested.data[0].tags[0].name, '新标签');
  assert.equal(rows[0].tags[0].name, '原标签');
});

test('零、false、空字符串与 null 都是合法修改值', () => {
  for (const value of [0, false, '', null]) {
    const result = updateCellData([{ field: 'old' }], 0, 'a', 'field', 'old', value, { type: 'Input' }, 'field');
    assert.equal(result.data[0].field, value);
    assert.equal(result.change.value, value);
  }
});

test('显式 field 可独立读取和更新，不要求配置 accessorKey', () => {
  const rows = [{ profile: { name: '旧名称' } }];
  const value = readEditorField(rows[0], 'profile.name');
  const result = updateCellData(rows, 0, 'a', 'display', value, '新名称', { type: 'Input', field: 'profile.name' });
  assert.equal(readEditorField(result.data[0], 'profile.name'), '新名称');
  assert.equal(result.change.previousValue, '旧名称');
  assert.equal(readEditorField(null, 'profile.name'), undefined);
  assert.equal(readEditorField(rows[0], 'profile.missing.name'), undefined);
});

test('计算列显式使用写入函数，并支持多个字段共同更新', () => {
  const rows = [{ first: '王', last: '明' }];
  const result = updateCellData(rows, 0, 'a', 'fullName', '王明', '李华', { type: 'Input', setValue: (row, value) => ({ ...row, first: value[0], last: value[1] }) });
  assert.deepEqual(result.data[0], { first: '李', last: '华' });
  assert.deepEqual(rows[0], { first: '王', last: '明' });
});

test('缺失写入目标、无变化和越界行不会提交修改', () => {
  const rows = [{ name: '原名称' }];
  assert.equal(updateCellData(rows, 0, 'a', 'name', '原名称', '原名称', { type: 'Input' }, 'name'), undefined);
  assert.equal(updateCellData(rows, 2, 'a', 'name', '原名称', '新名称', { type: 'Input' }, 'name'), undefined);
  assert.equal(updateCellData(rows, 0, 'a', 'computed', '原名称', '新名称', { type: 'Input' }), undefined);
});

test('拒绝危险路径，同时支持包含点号的显式字段名', () => {
  for (const field of ['__proto__.polluted', 'constructor.prototype.polluted', 'a..b', '', ['prototype']]) {
    assert.equal(editorPath(field), undefined);
  }
  const result = updateCellData([{ 'a.b': 1 }], 0, 'a', 'a.b', 1, 2, { type: 'InputNumber', field: ['a.b'] });
  assert.deepEqual(result.data, [{ 'a.b': 2 }]);
  assert.equal({}.polluted, undefined);
});

test('日期时间按配置格式往返，拒绝非法值并保留空值', () => {
  for (const [value, format] of [['2026-09-15', 'YYYY-MM-DD'], ['09:30:00', 'HH:mm:ss'], ['2026/09/15 08:00', 'YYYY/MM/DD HH:mm']]) {
    assert.equal(parseEditorDate(value, format).format(format), value);
  }
  for (const value of [null, undefined, '', '2026-02-31', 'invalid']) assert.equal(parseEditorDate(value, 'YYYY-MM-DD'), null);
  assert.equal(parseEditorDate('25:00:00', 'HH:mm:ss'), null);
});
