/**
 * debugLog — 全局调试日志桥接模块
 *
 * gameEngine / scoring 等纯函数通过此模块输出调试日志。
 * GameLogger 在初始化时注册回调，日志最终写入 logs/game.log。
 * 不依赖 console.log，避免污染浏览器控制台。
 */

type DebugLogFn = (type: string, data: Record<string, unknown>) => void;

let _logger: DebugLogFn | null = null;

/** GameLogger 调用此函数注册自身 */
export function registerDebugLogger(fn: DebugLogFn): void {
  _logger = fn;
}

/** 纯函数模块调用此函数输出调试日志 */
export function debugLog(type: string, data: Record<string, unknown>): void {
  if (_logger) {
    _logger(type, data);
  }
}
