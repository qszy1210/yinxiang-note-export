#!/usr/bin/env node

/**
 * ENEX 本地转 Markdown 脚本（零 API 调用）
 *
 * 将 Evernote 导出的 .enex 文件转换为 Markdown + 资源文件。
 * 使用流式解析，支持任意大小的 ENEX 文件（含 700MB+ 文件）。
 *
 * 用法:
 *   node scripts/export-enex.js <enex目录或文件> [options]
 *
 * 选项:
 *   --output <dir>     导出目录 (默认: ./exports)
 *   --format <fmt>     图片格式: obsidian | standard (默认: obsidian)
 *   --force            强制重新导出已存在的文件
 */

const path = require('path');
const fs = require('fs').promises;
const { createReadStream } = require('fs');
const { createInterface } = require('readline');
const crypto = require('crypto');
const { XMLParser } = require('fast-xml-parser');
const Converter = require('../lib/converter');
const sanitize = require('sanitize-filename');

// ─── 参数解析 ────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  const opts = {
    input: null,
    output: path.join(__dirname, '..', 'exports'),
    format: 'obsidian',
    force: false,
  };

  let i = 0;
  if (!args[0].startsWith('--')) {
    opts.input = path.resolve(args[0]);
    i = 1;
  }

  for (; i < args.length; i++) {
    switch (args[i]) {
      case '--output':
        opts.output = path.resolve(args[++i]);
        break;
      case '--format':
        opts.format = args[++i];
        break;
      case '--force':
        opts.force = true;
        break;
      default:
        if (!opts.input && !args[i].startsWith('--')) {
          opts.input = path.resolve(args[i]);
        } else {
          console.error(`未知参数: ${args[i]}`);
          process.exit(1);
        }
    }
  }

  if (!opts.input) {
    console.error('错误: 请指定 ENEX 文件或目录路径');
    printHelp();
    process.exit(1);
  }

  return opts;
}

function printHelp() {
  console.log(`
印象笔记 ENEX 转 Markdown 工具（本地离线转换，零 API 调用）

用法:
  node scripts/export-enex.js <enex目录或文件> [选项]

选项:
  --output <dir>   导出目录 (默认: ./exports)
  --format <fmt>   图片链接格式: obsidian | standard (默认: obsidian)
  --force          强制覆盖已存在的文件

示例:
  node scripts/export-enex.js ./enex-backup/
  node scripts/export-enex.js ./我的笔记.enex --output ./markdown-notes
  node scripts/export-enex.js ./enex-backup/ --format standard --force

ENEX 文件获取方式:
  方式 1: evernote-backup 工具（推荐，自动导出全部笔记本）
    brew install evernote-backup
    evernote-backup init-db --backend china --force
    evernote-backup sync
    evernote-backup export ./enex-backup/

  方式 2: 印象笔记桌面客户端手动导出
    打开客户端 -> 选择笔记本 -> 右键 -> 导出为 ENEX
`);
}

// ─── 工具函数 ────────────────────────────────────────────

function timestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function log(msg) {
  console.log(`[${timestamp()}] ${msg}`);
}

function logError(msg) {
  console.error(`[${timestamp()}] [ERROR] ${msg}`);
}

function md5hex(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

const MIME_EXT = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
  'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/bmp': '.bmp',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt', 'text/html': '.html',
  'audio/mpeg': '.mp3', 'audio/wav': '.wav',
  'video/mp4': '.mp4', 'video/quicktime': '.mov',
  'application/zip': '.zip',
};

function getExt(mime) {
  return MIME_EXT[mime] || '.bin';
}

function generateMarkdown(note, content, options = {}) {
  const esc = (s) => String(s).replace(/"/g, '\\"');
  const lines = [
    '---',
    `title: "${esc(note.title)}"`,
    `created: ${note.created}`,
    `updated: ${note.updated}`,
    `source: yinxiang`,
  ];

  if (options.notebookName) {
    lines.push(`notebook: "${esc(options.notebookName)}"`);
  }

  if (options.tags && options.tags.length > 0) {
    lines.push('tags:');
    options.tags.forEach(t => lines.push(`  - "${esc(t)}"`));
  }

  lines.push('---', '');
  return lines.join('\n') + content;
}

function parseEnexDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  const s = String(dateStr).trim();
  if (s.length >= 15) {
    return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)}:${s.slice(11,13)}:${s.slice(13,15)}Z`;
  }
  return s;
}

// ─── 流式 ENEX 解析（逐 note 提取，低内存占用）────────────

/**
 * 逐个读取 ENEX 文件中的 <note>...</note> 块。
 * 不把整个文件加载到内存 — 用 readline 逐行扫描，
 * 遇到 <note> 开始累积，遇到 </note> 时 yield 整个 note XML 字符串。
 */
async function* streamNoteChunks(filePath) {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let insideNote = false;
  let chunks = [];

  for await (const line of rl) {
    if (!insideNote) {
      // 检测 <note> 或 <note ...> 开始（可能与其他内容在同一行）
      const noteStart = line.indexOf('<note');
      if (noteStart !== -1) {
        insideNote = true;
        chunks = [line.substring(noteStart)];

        // 单行 note（极少见但安全检查）
        if (line.includes('</note>')) {
          insideNote = false;
          yield chunks.join('\n');
          chunks = [];
        }
      }
    } else {
      chunks.push(line);
      if (line.includes('</note>')) {
        insideNote = false;
        yield chunks.join('\n');
        chunks = [];
      }
    }
  }
}

/**
 * 将单个 <note>...</note> XML 字符串解析为结构化对象。
 */
function parseNoteXml(noteXml) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    cdataPropName: '__cdata',
    isArray: (name) => ['tag', 'resource'].includes(name),
    trimValues: false,
    // Prevent base64 data from being parsed as numbers
    numberParseOptions: { hex: false, leadingZeros: false, skipLike: /.*/ },
  });

  const parsed = parser.parse(noteXml);
  const raw = parsed.note || parsed;

  let content = '';
  if (raw.content) {
    content = raw.content.__cdata || raw.content['#text'] || raw.content || '';
  }
  if (typeof content !== 'string') content = String(content);

  const tags = raw.tag || [];

  const resources = (raw.resource || []).map(r => {
    let dataStr = '';
    if (r.data) {
      dataStr = r.data.__cdata || r.data['#text'] || r.data || '';
      if (typeof dataStr !== 'string') dataStr = String(dataStr);
    }
    const mime = r.mime || 'application/octet-stream';
    const attrs = r['resource-attributes'] || {};
    const fileName = attrs['file-name'] || '';
    return { dataBase64: dataStr.replace(/\s+/g, ''), mime, fileName };
  });

  return {
    title: raw.title || 'Untitled',
    content,
    created: parseEnexDate(raw.created),
    updated: parseEnexDate(raw.updated),
    tags,
    resources,
  };
}

// ─── 资源处理 ────────────────────────────────────────────

async function saveResources(resources, exportPath) {
  const resourceMap = new Map();
  const usedNames = new Set();

  const imagesDir = path.join(exportPath, 'images');
  const attachDir = path.join(exportPath, 'attachments');
  await fs.mkdir(imagesDir, { recursive: true });
  await fs.mkdir(attachDir, { recursive: true });

  for (const res of resources) {
    try {
      if (!res.dataBase64) continue;

      let b64 = res.dataBase64;
      if (typeof b64 !== 'string') b64 = String(b64);
      if (!b64 || b64 === 'undefined' || b64 === '[object Object]') continue;

      const buf = Buffer.from(b64, 'base64');
      const hash = md5hex(buf);
      const isImage = res.mime.startsWith('image/');

      let filename = res.fileName ? sanitize(res.fileName) : `${hash.substring(0, 8)}${getExt(res.mime)}`;
      if (usedNames.has(filename.toLowerCase())) {
        const ext = path.extname(filename);
        const base = path.basename(filename, ext);
        let c = 1;
        while (usedNames.has(`${base}_${c}${ext}`.toLowerCase())) c++;
        filename = `${base}_${c}${ext}`;
      }
      usedNames.add(filename.toLowerCase());

      const targetDir = isImage ? imagesDir : attachDir;
      await fs.writeFile(path.join(targetDir, filename), buf);

      resourceMap.set(hash, {
        filename,
        type: isImage ? 'image' : 'attachment',
        originalName: res.fileName || filename,
        mimeType: res.mime,
      });
    } catch (err) {
      logError(`资源保存失败: ${err.message}`);
    }
  }

  return resourceMap;
}

// ─── 主流程 ──────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  log('═══════════════════════════════════════════');
  log('  ENEX 转 Markdown（本地离线·流式解析）');
  log('═══════════════════════════════════════════');
  log(`输入路径: ${opts.input}`);
  log(`导出目录: ${opts.output}`);
  log(`图片格式: ${opts.format}`);

  const stat = await fs.stat(opts.input);
  let enexFiles = [];

  if (stat.isDirectory()) {
    const entries = await fs.readdir(opts.input);
    enexFiles = entries
      .filter(f => f.toLowerCase().endsWith('.enex'))
      .map(f => path.join(opts.input, f));
  } else if (opts.input.toLowerCase().endsWith('.enex')) {
    enexFiles = [opts.input];
  } else {
    console.error('错误: 输入必须是 .enex 文件或包含 .enex 文件的目录');
    process.exit(1);
  }

  if (enexFiles.length === 0) {
    console.error('错误: 未找到 .enex 文件');
    process.exit(1);
  }

  // 按文件大小排序（小文件先处理）
  const fileSizes = await Promise.all(
    enexFiles.map(async f => ({ path: f, size: (await fs.stat(f)).size }))
  );
  fileSizes.sort((a, b) => a.size - b.size);
  enexFiles = fileSizes.map(f => f.path);

  log(`找到 ${enexFiles.length} 个 ENEX 文件`);
  for (const f of fileSizes) {
    const sizeMB = (f.size / 1024 / 1024).toFixed(1);
    log(`  ${path.basename(f.path)} (${sizeMB} MB)`);
  }

  const converter = new Converter({ imageFormat: opts.format });
  await fs.mkdir(opts.output, { recursive: true });

  const stats = {
    totalFiles: enexFiles.length,
    totalNotes: 0,
    exported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const enexFile of enexFiles) {
    const notebookName = path.basename(enexFile, '.enex');
    const notebookDir = path.join(opts.output, sanitize(notebookName));
    const sizeMB = ((await fs.stat(enexFile)).size / 1024 / 1024).toFixed(1);

    log(`\n📓 处理: ${notebookName} (${sizeMB} MB)`);
    await fs.mkdir(notebookDir, { recursive: true });

    let noteIndex = 0;

    try {
      for await (const noteXml of streamNoteChunks(enexFile)) {
        noteIndex++;
        let note;
        try {
          note = parseNoteXml(noteXml);
        } catch (err) {
          stats.failed++;
          stats.errors.push({ notebook: notebookName, note: `#${noteIndex}`, error: `XML解析: ${err.message}` });
          logError(`  [${notebookName}] #${noteIndex} XML 解析失败: ${err.message}`);
          continue;
        }

        const safeTitle = sanitize(note.title || `untitled-${noteIndex}`);
        const noteExportPath = path.join(notebookDir, safeTitle);
        const mdPath = path.join(noteExportPath, `${safeTitle}.md`);
        const progress = `[${notebookName}] #${noteIndex}`;

        // 断点续传
        if (!opts.force) {
          try {
            await fs.access(mdPath);
            stats.skipped++;
            stats.totalNotes++;
            continue;
          } catch {
            // 不存在，继续
          }
        }

        try {
          await fs.mkdir(noteExportPath, { recursive: true });

          const resourceMap = await saveResources(note.resources, noteExportPath);
          const result = converter.convert(note.content, resourceMap, note.title);
          const markdown = generateMarkdown(note, result.markdown, {
            notebookName,
            tags: note.tags,
          });

          await fs.writeFile(mdPath, markdown, 'utf-8');
          stats.exported++;
          stats.totalNotes++;

          if (noteIndex % 50 === 0) {
            log(`  ${progress} - ${note.title} ✅ (累计 ${stats.exported})`);
          }
        } catch (err) {
          stats.failed++;
          stats.totalNotes++;
          stats.errors.push({
            notebook: notebookName,
            note: note.title,
            error: err.message,
          });
          logError(`  ${progress} - ${note.title}: ${err.message}`);
        }
      }
    } catch (err) {
      logError(`处理文件失败 ${enexFile}: ${err.message}`);
      stats.errors.push({ file: enexFile, error: err.message });
    }

    log(`  ✅ ${notebookName} 完成: ${noteIndex} 条笔记`);
  }

  // 导出报告
  const reportPath = path.join(opts.output, '_export-report.json');
  await fs.writeFile(reportPath, JSON.stringify({
    exportedAt: new Date().toISOString(),
    source: 'enex',
    options: { input: opts.input, output: opts.output, format: opts.format },
    stats,
  }, null, 2), 'utf-8');

  log('\n═══════════════════════════════════════════');
  log('  转换完成');
  log('═══════════════════════════════════════════');
  log(`ENEX 文件:  ${stats.totalFiles} 个`);
  log(`总笔记数:   ${stats.totalNotes} 条`);
  log(`已导出:     ${stats.exported} 条`);
  log(`已跳过:     ${stats.skipped} 条`);
  log(`失败:       ${stats.failed} 条`);
  log(`报告:       ${reportPath}`);

  if (stats.errors.length > 0) {
    log(`\n失败详情 (${stats.errors.length} 条):`);
    stats.errors.forEach((e, idx) => {
      log(`  ${idx + 1}. [${e.notebook || e.file}] ${e.note || ''}: ${e.error}`);
    });
  }

  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('致命错误:', err);
  process.exit(2);
});
