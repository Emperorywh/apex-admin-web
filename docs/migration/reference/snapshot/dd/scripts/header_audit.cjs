/**
 * 文案瘦身建议表生成器（只读）
 * 扫描所有 title: t(key) 的列，结合列 width 估算英文是否超出，
 * 输出"英文表头过长"建议表。不改任何文件。
 *
 * 用法：
 *   node scripts/header_audit.cjs [扫描目录] [en-json]
 *   默认：src/pages  src/locales/en-US.json
 *   node scripts/header_audit.cjs --selftest   # 跑 fixtures 自测
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_DIR = 'src/pages';
const DEFAULT_EN = 'src/locales/en-US.json';
const CHAR_WIDTH = 8;   // 每英文字符约 8px
const DEFAULT_COL_WIDTH = 150;

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

/**
 * 定位某个字符索引所在的列对象块 { ... } 的文本。
 * 思路：先把 content 按行切，找到 title 所在行号 lineNo；
 * 向上找最近的含 { 的行 startLine 作为列对象起点；
 * 从 startLine 起用花括号深度向下找匹配的 } 作为终点 endLine。
 * 这样能正确包围含 render 回调等嵌套花括号的列对象。
 */
function findEnclosingBlock(content, index) {
  const lines = content.split('\n');
  // 算出 index 落在第几行
  let pos = 0;
  let lineNo = 0;
  while (lineNo < lines.length && pos + lines[lineNo].length < index) {
    pos += lines[lineNo].length + 1; // +1 为换行
    lineNo++;
  }
  // 向上找最近的含 { 的行作为列对象起点
  let startLine = lineNo;
  while (startLine >= 0 && !lines[startLine].includes('{')) startLine--;
  if (startLine < 0) return null;
  // 从 startLine 起按花括号深度向下找匹配的 }
  let depth = 0;
  let endLine = startLine;
  let closed = false;
  for (let j = startLine; j < lines.length; j++) {
    for (const ch of lines[j]) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    if (depth <= 0) { endLine = j; closed = true; break; }
  }
  if (!closed) return null;
  return lines.slice(startLine, endLine + 1).join('\n');
}

/**
 * 从单文件抽取 [key, width] 列表。
 * 两遍扫描：先用正则定位每个 title: t("key")，再用花括号深度向外定位
 * 包围它的列对象块，从块内提取 width。含 render 回调（嵌套花括号）的
 * 列不会被漏掉。
 */
function extractFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const results = [];
  const titleRe = /title:\s*t\(["']([^"']+)["']\)/g;
  let m;
  while ((m = titleRe.exec(content)) !== null) {
    const key = m[1];
    const block = findEnclosingBlock(content, m.index);
    if (!block) continue;
    const widthMatch = block.match(/width:\s*(\d+)/);
    const width = widthMatch ? parseInt(widthMatch[1], 10) : null;
    results.push({ key, width });
  }
  return results;
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  let acc = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      acc = acc.concat(walkDir(filePath));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      acc = acc.concat(extractFromFile(filePath).map(r => ({ ...r, file: filePath })));
    }
  }
  return acc;
}

function formatReport(rows, en) {
  const lines = ['=== 英文表头过长建议表 ==='];
  for (const r of rows) {
    const enText = en[r.key];
    if (!enText) continue; // 缺英文翻译的跳过（i18n 缺失是另一问题）
    const width = r.width || DEFAULT_COL_WIDTH;
    const capacity = Math.floor(width / CHAR_WIDTH);
    // 用 >= ：字符数等于容量即视为触发省略（边界一致）
    const overflow = enText.length >= capacity;
    const widthInfo = r.width
      ? `width: ${r.width} (约可容 ${capacity} 字符)`
      : `width: ${DEFAULT_COL_WIDTH} (默认, 约可容 ${capacity} 字符)`;
    const flag = overflow ? '  ⚠️ 触发省略 → 建议瘦身' : '  OK';
    lines.push(`[key] ${r.key}`);
    lines.push(`  EN: "${enText}" (${enText.length} chars)`);
    lines.push(`  ${widthInfo}${flag}`);
  }
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--selftest')) {
    const rows = extractFromFile(path.join(__dirname, '_fixtures/audit_in.txt'));
    const en = loadJson(path.join(__dirname, '_fixtures/audit_en.json'));
    const actual = formatReport(rows, en);
    const expected = fs.readFileSync(path.join(__dirname, '_fixtures/audit_expected.txt'), 'utf-8').trim();
    if (actual.trim() === expected) {
      console.log('selftest PASS');
      process.exit(0);
    } else {
      console.log('selftest FAIL\n--- actual ---\n' + actual + '\n--- expected ---\n' + expected);
      process.exit(1);
    }
  }

  // 按位置解析：[扫描目录] [en-json]，与文件头文档一致
  const positional = args.filter(a => !a.startsWith('--'));
  const dir = positional[0] || DEFAULT_DIR;
  const enPath = positional[1] || DEFAULT_EN;

  const en = loadJson(enPath);
  const rows = walkDir(dir);
  console.log(formatReport(rows, en));
}

main();
