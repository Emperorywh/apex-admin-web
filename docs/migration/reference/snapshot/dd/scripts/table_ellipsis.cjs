/**
 * 批量给 antd Table 列补 ellipsis: { showTitle: true }
 * 表头单行省略 + hover 显示完整标题（antd 原生 title 属性）。
 *
 * 跳过规则（不改、报人工）：
 *   1. 列内已含 ellipsis（任何形式：true / { ... }）→ 跳过
 *   2. title 是 JSX（title: ( 或 title: <）→ 跳过，列入 Review 清单
 *   3. 列内已含 <Tooltip（自定义表头提示）→ 跳过，列入 Review 清单
 *
 * 用法：
 *   node scripts/table_ellipsis.cjs [目录或文件...] [--dry-run] [--selftest]
 *   默认目录：src/pages src/components
 *   --dry-run   不写盘，只打印影响面
 *   --selftest  跑 fixtures 自测
 */
const fs = require('fs');
const path = require('path');

const ELLIPSIS_LINE = 'ellipsis: { showTitle: true }';

/**
 * 定位某个字符索引所在的列对象块 { ... } 的 [startLine, endLine]。
 * 与 header_audit.cjs 同款花括号深度边界：从 title 行向上找最近的 {，
 * 再用花括号深度向下找匹配的 }。能正确处理含 render 回调等嵌套花括号的列。
 */
function findEnclosingBlockRange(lines, index) {
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
  return [startLine, endLine];
}

/**
 * 处理单个文件内容，返回 { content, patched, skipped }
 * patched: [{ key }]            已补的列
 * skipped: [{ key, reason }]    需人工 review 的列
 */
function processContent(content) {
  const lines = content.split('\n');
  const patched = [];
  const skipped = [];
  // 收集要插入的位置（行号 + 缩进），倒序插入避免索引位移
  const insertions = [];

  // 逐行扫描定位 title: t("...") 行（字符串 title）
  // 注意：title: ( 或 title: < 是 JSX title，单独识别并跳过
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    const stripped = line.trimStart();

    // JSX title：title: ( 或 title: < 开头 → 跳过报人工。
    // 跳过规则 3 也在此合并实现：自定义 Tooltip 表头必然是 JSX title
    // （字符串 title 无法内嵌 Tooltip），故在 JSX 分支内统一识别并给出更具体原因。
    if (/^title:\s*[<(]/.test(stripped)) {
      // 向下找第一个 t("...") 作为可读标识（JSX title 内的文案通常在随后几行）
      let jsxKey = `JSX@line${i + 1}`;
      let hasTooltip = false;
      for (let k = i; k < Math.min(i + 12, lines.length); k++) {
        const km = lines[k].match(/t\(["']([^"']+)["']\)/);
        if (km && jsxKey.startsWith('JSX@')) jsxKey = km[1];
        if (/<Tooltip/.test(lines[k])) hasTooltip = true;
      }
      const reason = hasTooltip ? 'JSX title（含自定义 Tooltip），已跳过' : 'JSX title，已跳过';
      skipped.push({ key: jsxKey, reason });
      continue;
    }

    // 字符串 title：title: t("...") 或 title: t('...')
    const m = stripped.match(/^title:\s*t\(["']([^"']+)["']\)/);
    if (!m) continue;
    const key = m[1];

    // 用字符索引定位列对象边界（findEnclosingBlockRange 基于 lines + 字符索引）
    const charIndex = lines.slice(0, i).reduce((s, l) => s + l.length + 1, 0);
    const range = findEnclosingBlockRange(lines, charIndex);
    if (!range) continue;
    const [startLine, endLine] = range;
    const block = lines.slice(startLine, endLine + 1).join('\n');

    // 跳过规则 1：已有 ellipsis（任何形式）
    if (/ellipsis\s*:/.test(block)) continue;
    // 跳过规则 3（自定义 Tooltip 表头）已在上面 JSX title 分支合并处理：
    // 字符串 title 无法内嵌 Tooltip，故此处无需再判。

    insertions.push({ endLine, indent, key });
  }

  // 倒序插入，避免行号位移
  insertions.sort((a, b) => b.endLine - a.endLine);
  const out = lines.slice();
  for (const ins of insertions) {
    // endLine 是列对象 } 所在行；字段缩进 = } 的缩进 + 4
    const closingIndentMatch = out[ins.endLine].match(/^(\s*)\}/);
    const closingIndent = closingIndentMatch ? closingIndentMatch[1] : ins.indent;
    const fieldIndent = closingIndent + '    ';
    // 先给最后一个字段行（endLine-1）补逗号（若无）
    const lastFieldLine = out[ins.endLine - 1];
    if (lastFieldLine && !lastFieldLine.trimEnd().endsWith(',')) {
      out[ins.endLine - 1] = lastFieldLine.replace(/(\s*)$/, ',');
    }
    // 在 } 之前插入 ellipsis 行
    out.splice(ins.endLine, 0, `${fieldIndent}${ELLIPSIS_LINE}`);
    patched.push({ key: ins.key });
  }

  return { content: out.join('\n'), patched, skipped };
}

function processFile(filePath, dryRun) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { content: newContent, patched, skipped } = processContent(content);
  if (patched.length === 0 && skipped.length === 0) return { patched, skipped };
  if (!dryRun && newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
  }
  return { patched, skipped };
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  let acc = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) acc = acc.concat(walkDir(filePath));
    else if (file.endsWith('.tsx') || file.endsWith('.ts')) acc.push(filePath);
  }
  return acc;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (args.includes('--selftest')) {
    const inFile = path.join(__dirname, '_fixtures/ellipsis_in.txt');
    const content = fs.readFileSync(inFile, 'utf-8');
    const { content: actual, patched, skipped } = processContent(content);
    const expected = fs.readFileSync(path.join(__dirname, '_fixtures/ellipsis_expected.txt'), 'utf-8').trim();
    const reviewExpected = 'scripts/_fixtures/ellipsis_in.txt: 自定义 (JSX title，已跳过)';
    const reviewActual = skipped.map(s => `scripts/_fixtures/ellipsis_in.txt: ${s.key} (${s.reason})`).join('\n');
    if (actual.trim() !== expected) {
      console.log('selftest FAIL (content)\n--- actual ---\n' + actual + '\n--- expected ---\n' + expected);
      process.exit(1);
    }
    if (reviewActual !== reviewExpected) {
      console.log('selftest FAIL (review)\n--- actual ---\n' + reviewActual + '\n--- expected ---\n' + reviewExpected);
      process.exit(1);
    }
    console.log('selftest PASS');
    process.exit(0);
  }

  const targets = args.filter(a => !a.startsWith('--'));
  const dirs = targets.length ? targets : ['src/pages', 'src/components'];

  let totalPatched = 0;
  const reviewList = [];
  for (const d of dirs) {
    const files = fs.statSync(d).isFile() ? [d] : walkDir(d);
    for (const f of files) {
      const { patched, skipped } = processFile(f, dryRun);
      totalPatched += patched.length;
      for (const s of skipped) reviewList.push(`${f}: ${s.key} (${s.reason})`);
      if (patched.length) console.log(`${dryRun ? '[dry-run] ' : ''}patched ${patched.length} cols in ${f}`);
    }
  }
  console.log(`\n总计补 ellipsis: ${totalPatched} 列`);
  if (reviewList.length) {
    console.log('\n=== Review 清单（需人工确认）===');
    reviewList.forEach(l => console.log(l));
  }
}

main();
