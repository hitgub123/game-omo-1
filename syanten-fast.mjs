// syanten 快速牌理 - 精简版（修了 var 闭包问题）
import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { fileURLToPath } from 'url';
import path from 'path';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var WORKER_PATH = path.join(__dirname, 'syanten-worker.mjs');

var ALL_LABELS = [];
for (var s = 0; s < 3; s++)
    for (var n = 0; n < 9; n++)
        ALL_LABELS.push({ s: s, n: n, label: (n+1) + 'mps'[s] });
for (var n = 0; n < 7; n++)
    ALL_LABELS.push({ s: 3, n: n, label: (n+1) + 'z' });

function cloneHai(hai) {
    return [hai[0].slice(), hai[1].slice(), hai[2].slice(), hai[3].slice()];
}

// 并发执行一批 syanten 任务，指定最大 worker 数
function batchSyanten(tasks, maxWorkers) {
    return new Promise(function(resolve) {
        if (tasks.length === 0) { resolve([]); return; }
        var nw = Math.min(maxWorkers, tasks.length);
        var chunkSize = Math.ceil(tasks.length / nw);
        var allResults = [];
        var completed = 0;

        for (var wi = 0; wi < nw; wi++) {
            var start = wi * chunkSize;
            var chunk = tasks.slice(start, start + chunkSize);
            if (chunk.length === 0) { completed++; tryResolve(); continue; }

            // 用 IIFE 捕获当前 chunk 和 wi
            (function(chunkTasks) {
                var w = new Worker(WORKER_PATH);
                var localResults = [];

                w.on('message', function(msg) {
                    localResults.push(msg);
                    if (localResults.length === chunkTasks.length) {
                        w.terminate();
                        allResults.push.apply(allResults, localResults);
                        completed++;
                        tryResolve();
                    }
                });

                w.on('error', function() {
                    completed++;
                    tryResolve();
                });

                for (var ti = 0; ti < chunkTasks.length; ti++) {
                    w.postMessage({ id: chunkTasks[ti].id, hai: chunkTasks[ti].hai });
                }
            })(chunk);
        }

        function tryResolve() {
            if (completed === nw) resolve(allResults);
        }
    });
}

/**
 * Phase 1: 快速找出所有听牌弃牌
 * 返回: { shanten, tenpaiDiscards: string[], time }
 */
export async function findTenpaiDiscards(hai) {
    var t0 = performance.now();
    var tasks = [];
    for (var t of ALL_LABELS) {
        if (hai[t.s][t.n] === 0) continue;
        var c = cloneHai(hai);
        c[t.s][t.n]--;
        tasks.push({ id: t.label, hai: c });
    }
    var results = await batchSyanten(tasks, Math.min(cpus().length, 8));
    var tenpai = [];
    var minShanten = 9;
    for (var r of results) {
        if (r.result < minShanten) minShanten = r.result;
        if (r.result === 0) tenpai.push(r.id);
    }
    return { shanten: minShanten, tenpaiDiscards: tenpai, time: performance.now() - t0 };
}

/**
 * Phase 2: 算指定弃牌的进张
 * 返回: { waits: {[tile]: remaining}, time }
 */
export async function calcWaits(hai, discardLabel) {
    var t0 = performance.now();
    var tile = ALL_LABELS.find(function(t) { return t.label === discardLabel; });
    if (!tile) return { waits: {}, time: 0 };

    var afterDiscard = cloneHai(hai);
    afterDiscard[tile.s][tile.n]--;

    var tasks = [];
    for (var a of ALL_LABELS) {
        var test = cloneHai(afterDiscard);
        if (test[a.s][a.n] >= 4) continue;
        test[a.s][a.n]++;
        tasks.push({ id: a.label, hai: test });
    }
    var results = await batchSyanten(tasks, Math.min(cpus().length, 8));

    var waits = {};
    for (var r of results) {
        if (r.result < 0) {
            var addTile = ALL_LABELS.find(function(t) { return t.label === r.id; });
            if (addTile) waits[r.id] = 4 - hai[addTile.s][addTile.n];
        }
    }
    return { waits: waits, time: performance.now() - t0 };
}
