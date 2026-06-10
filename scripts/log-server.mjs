#!/usr/bin/env node
/**
 * log-server.mjs — 游戏日志接收服务器（单文件循环版）
 *
 * 接收浏览器发来的日志条目，内存中缓冲，每 2 秒集中写一次磁盘。
 * 单文件 game.log，超过 10MB 时保留末尾 ~20%，清除前面 80%。
 *
 * 用法： node scripts/log-server.mjs [--port 12345]
 * 日志目录：项目根目录 logs/
 * 文件： game.log
 */
import { createServer } from 'node:http';
import { appendFile, readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const LOG_DIR = join(PROJECT_ROOT, 'logs');
const LOG_FILE = 'game.log';
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const KEEP_RATIO = 0.2; // 超过上限时保留末尾 20%
const FLUSH_INTERVAL = 2000; // ms
const MAX_BUFFER = 500; // 超此条数强制刷盘

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let lastWriteSize = 0; // 当前文件大小（最近一次刷盘后更新）
let writeBuffer = [];  // 待写入的行
let flushPending = null;
let serverStarted = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function logPath() {
  return join(LOG_DIR, LOG_FILE);
}

async function init() {
  await mkdir(LOG_DIR, { recursive: true });
  try {
    const s = await stat(logPath());
    lastWriteSize = s.size;
  } catch {
    lastWriteSize = 0;
  }
  console.log(`[log-server] 日志: ${logPath()}`);
  console.log(`[log-server] 当前大小: ${(lastWriteSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`[log-server] 上限: ${MAX_SIZE / 1024 / 1024} MB，超过后保留末尾 ${KEEP_RATIO * 100}%`);
  console.log(`[log-server] 刷盘间隔: ${FLUSH_INTERVAL}ms / 强制: ${MAX_BUFFER}条`);

  // 写启动标记
  const marker = `\n======= 服务器启动 ${new Date().toISOString()} =======\n`;
  await appendFile(logPath(), marker);
  lastWriteSize += Buffer.byteLength(marker);
  serverStarted = true;
}

function formatEntry(entry) {
  // 东京时区 (UTC+9)
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const ts = jst.toISOString().slice(11, 23);
  const dataStr = Object.entries(entry.data || {})
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('  ');
  return `[${ts}] [${(entry.type || '').toUpperCase()}] ${dataStr}\n`;
}

// ---------------------------------------------------------------------------
// 截断：文件超过 MAX_SIZE 时，保留末尾 KEEP_RATIO
// ---------------------------------------------------------------------------
async function truncateIfNeeded(extraBytes) {
  if (lastWriteSize + extraBytes <= MAX_SIZE) return;

  console.log(`[log-server] 日志超限 (${((lastWriteSize + extraBytes) / 1024 / 1024).toFixed(2)} MB)，截断...`);
  const content = await readFile(logPath(), 'utf-8');
  const lines = content.split('\n');
  // 去掉最后一个空行（文件末尾 \n 产生的）
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  const keepCount = Math.max(1, Math.floor(lines.length * KEEP_RATIO));
  const kept = lines.slice(-keepCount).join('\n') + '\n';
  await writeFile(logPath(), kept, 'utf-8');
  lastWriteSize = Buffer.byteLength(kept);
  console.log(`[log-server] 截断完成: ${lines.length}行 → ${keepCount}行, 文件 ${(lastWriteSize / 1024 / 1024).toFixed(2)} MB`);
}

// ---------------------------------------------------------------------------
// 刷盘
// ---------------------------------------------------------------------------
async function flushToDisk() {
  if (writeBuffer.length === 0) return;
  const batch = writeBuffer.splice(0, writeBuffer.length);

  const text = batch.map(formatEntry).join('');
  const bufLen = Buffer.byteLength(text);

  // 检查是否需要截断
  await truncateIfNeeded(bufLen);

  await appendFile(logPath(), text, 'utf-8');
  lastWriteSize += bufLen;
}

// 串行化刷盘
function scheduleFlush() {
  if (flushPending) return flushPending;
  flushPending = (async () => {
    try {
      await flushToDisk();
    } catch (e) {
      console.error('[log-server] 刷盘错误:', e.message);
    } finally {
      flushPending = null;
    }
  })();
  return flushPending;
}

setInterval(() => { scheduleFlush(); }, FLUSH_INTERVAL);

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const entries = JSON.parse(body);
        if (!Array.isArray(entries)) {
          res.writeHead(400);
          res.end('Expected array');
          return;
        }
        if (!serverStarted) {
          res.writeHead(503);
          res.end('Server not ready');
          return;
        }
        writeBuffer.push(...entries);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`OK (${entries.length} entries)`);

        if (writeBuffer.length >= MAX_BUFFER) scheduleFlush();
      } catch (e) {
        console.error('[log-server] parse error:', e.message);
        res.writeHead(400);
        res.end('Bad request');
      }
    });
    return;
  }

  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      file: LOG_FILE,
      size: lastWriteSize,
      bufferSize: writeBuffer.length,
      maxSize: MAX_SIZE,
      dir: LOG_DIR,
      keepRatio: KEEP_RATIO,
    }));
    return;
  }

  res.writeHead(404);
  res.end();
});

// ---------------------------------------------------------------------------
// Shutdown
// ---------------------------------------------------------------------------
async function shutdown() {
  console.log('\n[log-server] 正在关闭，刷盘剩余日志...');
  await scheduleFlush();
  console.log('[log-server] 已关闭');
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const PORT = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || '12345', 10);

init().then(() => {
  server.listen(PORT, () => {
    console.log(`[log-server] 监听 http://localhost:${PORT}`);
    console.log(`[log-server] 按 Ctrl+C 停止`);
  });
}).catch(err => {
  console.error('[log-server] 启动失败:', err);
  process.exit(1);
});
