/**
 * 批量国际化改造脚本
 * 自动为 src/pages/MapThrough/ 下的文件添加 useI18n 并替换中文字符串
 */
const fs = require('fs');
const path = require('path');

const USE_I18N_IMPORT = 'import { useI18n } from "@/hooks/useI18n";';
const I18N_HOOK = '/* 国际化翻译方法 */ const { t } = useI18n();';

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Skip if already has useI18n
  if (content.includes('useI18n')) return false;

  // Check if has Chinese text (excluding comments and console.log)
  const lines = content.split('\n');
  let hasChinese = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    if (trimmed.includes('console.')) continue;
    if (/[一-鿿]/.test(line)) {
      hasChinese = true;
      break;
    }
  }
  if (!hasChinese) return false;

  // Add import
  const lastImportIndex = content.lastIndexOf('import ');
  if (lastImportIndex === -1) return false;

  // Find end of last import line
  let insertPos = content.indexOf('\n', lastImportIndex);
  if (insertPos === -1) return false;

  content = content.slice(0, insertPos + 1) + USE_I18N_IMPORT + '\n' + content.slice(insertPos + 1);

  // Add hook after component function opening
  // Look for export default patterns
  const patterns = [
    /export default memo\(\(props[^)]*\)\s*=>\s*\{/,
    /export default memo\(\(props: [^)]+\)\s*=>\s*\{/,
    /export default \(\)\s*=>\s*\{/,
    /export default \(props[^)]*\)\s*=>\s*\{/,
    /export default \(props: [^)]+\)\s*=>\s*\{/,
    /export default memo\(\(props: [^)]+\) ?: ?\([^)]+\)\s*=>\s*\{/,
  ];

  let hookInserted = false;
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const idx = content.indexOf(match[0]);
      const braceIdx = content.indexOf('{', idx + match[0].length - 1);
      if (braceIdx !== -1) {
        // Find next line after opening brace
        const nextLineIdx = content.indexOf('\n', braceIdx);
        if (nextLineIdx !== -1) {
          // Find indentation of next line
          let lineStart = nextLineIdx + 1;
          let indent = '';
          let i = lineStart;
          while (i < content.length && (content[i] === ' ' || content[i] === '\t')) {
            indent += content[i];
            i++;
          }
          content = content.slice(0, lineStart) + indent + I18N_HOOK + '\n' + content.slice(lineStart);
          hookInserted = true;
          break;
        }
      }
    }
  }

  if (!hookInserted) {
    // Revert import addition
    content = content.replace(USE_I18N_IMPORT + '\n', '');
    return false;
  }

  // Replace Chinese strings with t() calls
  // Pattern: "中文字符串" -> t("中文字符串")  (in JSX props and JS expressions)
  // But skip strings in comments, import statements, and console.log

  const lines2 = content.split('\n');
  const result = [];

  for (let line of lines2) {
    const trimmed = line.trim();

    // Skip comments and import lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      result.push(line);
      continue;
    }
    if (trimmed.startsWith('import ')) {
      result.push(line);
      continue;
    }

    // Replace patterns
    // label="中文" -> label={t("中文")}
    line = line.replace(/label="([^"]*[一-鿿][^"]*)"/g, 'label={t("$1")}');

    // title="中文" -> title={t("中文")}  (but not HTML title attr in tags)
    line = line.replace(/title="([^"]*[一-鿿][^"]*)"/g, 'title={t("$1")}');

    // placeholder="中文" -> placeholder={t("中文")}
    line = line.replace(/placeholder="([^"]*[一-鿿][^"]*)"/g, 'placeholder={t("$1")}');

    // description="中文" -> description={t("中文")}
    line = line.replace(/description="([^"]*[一-鿿][^"]*)"/g, 'description={t("$1")}');

    // message: "中文" or message: "中文" in rules -> message: t("中文")
    line = line.replace(/message:\s*"([^"]*[一-鿿][^"]*)"/g, 'message: t("$1")');

    // tooltip="中文" -> tooltip={t("中文")}
    line = line.replace(/tooltip="([^"]*[一-鿿][^"]*)"/g, 'tooltip={t("$1")}');

    // okText="中文" -> okText={t("中文")}
    line = line.replace(/okText="([^"]*[一-鿿][^"]*)"/g, 'okText={t("$1")}');

    // cancelText="中文" -> cancelText={t("中文")}
    line = line.replace(/cancelText="([^"]*[一-鿿][^"]*)"/g, 'cancelText={t("$1")}');

    // >中文</Button> or >中文</span> etc -> {t("中文")}
    line = line.replace(/>([一-鿿][一-鿿\w\s（）：、，。！？·\/%-]*)<\/(Button|span|div|a|Text|Typography\.Text|Option|Tag)>/g,
      '>{t("$1")}</$2>');

    // message.success("中文") -> message.success(t("中文"))
    line = line.replace(/message\.(success|warning|error|info)\("([^"]*[一-鿿][^"]*)"/g,
      'message.$1(t("$2")');

    // title: "中文" in objects -> title: t("中文")
    line = line.replace(/title:\s*"([^"]*[一-鿿][^"]*)"/g, 'title: t("$1")');

    result.push(line);
  }

  content = result.join('\n');

  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  let count = 0;
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      count += walkDir(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      if (processFile(filePath)) {
        console.log('Processed:', filePath);
        count++;
      }
    }
  }
  return count;
}

const targetDir = process.argv[2] || 'src/pages/MapThrough';
const count = walkDir(targetDir);
console.log(`\nTotal files processed: ${count}`);
