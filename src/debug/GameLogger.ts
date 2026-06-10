/**
 * GameLogger — 游戏全过程日志
 *
 * 订阅 GameController 状态变化，记录：
 *   - 每巡手牌（所有玩家）
 *   - 打牌、鸣牌
 *   - 立直/荣和/碰/吃等按钮出现与消失
 *   - 局开始/结束
 *
 * 日志通过 HTTP POST 发送到本地 log-server（scripts/log-server.mjs），
 * 由服务器写入轮换日志文件（logs/game-0.log / game-1.log），每个上限 10MB。
 * 也保留内存缓冲区，可通过 download() 手动导出。
 *
 * 启动 log-server： node scripts/log-server.mjs
 */
import type { GameState, Tile } from '../game/types';
import { Wind, GamePhase, WINDS } from '../game/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LogEntry {
  time: string;
  type: string;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------
const LOG_SERVER = 'http://localhost:12345/log';

export class GameLogger {
  private entries: LogEntry[] = [];
  private prevState: GameState | null = null;
  private turnLog = 0;
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private serverOk = true; // starts optimistic, disables on first failure
  private prevActionStrs: string[] = [];
  private humanWind: Wind = Wind.EAST;

  constructor() {
    this.startFlushTimer();
  }

  /** Periodically flush buffered entries to server */
  private startFlushTimer(): void {
    this.flushTimer = setTimeout(() => {
      this.flush();
      this.startFlushTimer();
    }, 1000); // flush every 1s
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    if (!this.serverOk) return; // server unavailable, keep in memory

    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      const res = await fetch(LOG_SERVER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      // Server unavailable — put entries back in buffer,
      // keep in memory, and stop trying
      this.buffer.unshift(...batch);
      this.serverOk = false;
      console.warn('[GameLogger] 日志服务器不可用，退回到内存');
    }
  }

  /** Send log entry (queued for batch) */
  private log(type: string, data: Record<string, unknown>): void {
    const entry: LogEntry = { time: this.ts(), type, data };
    this.entries.push(entry);
    if (this.serverOk) {
      this.buffer.push(entry);
    }
  }

  // ---- helpers ----

  private tileStr(t: Tile): string {
    const suitNames: Record<string, string> = { m: 'm', p: 'p', s: 's', z: 'z' };
    return `${t.value}${suitNames[t.suit] || '?'}`;
  }

  private handStr(tiles: Tile[]): string {
    // Sort by suit then value for readable display
    return tiles
      .map(t => ({ ...t }))
      .sort((a, b) => a.suit.localeCompare(b.suit) || a.value - b.value)
      .map(t => this.tileStr(t))
      .join(' ');
  }

  private meldsStr(melds: import('../game/types').Meld[]): string {
    if (melds.length === 0) return '—';
    return melds
      .map(m => {
        const tiles = m.tiles.map(t => this.tileStr(t)).join('');
        return tiles;
      })
      .join(' | ');
  }

  private discardsStr(tiles: Tile[]): string {
    return tiles.map(t => this.tileStr(t)).join(' ');
  }

  private actionStr(actions: import('../game/types').AvailableActions | undefined): string {
    if (!actions) return '—';
    const parts: string[] = [];
    if (actions.canRiichi) parts.push('立直');
    if (actions.canTsumo) parts.push('自摸');
    if (actions.canRon) parts.push('荣和');
    if (actions.canPon) parts.push('碰');
    if (actions.canChi) parts.push('吃');
    if (actions.canKan) parts.push('明杠');
    if (actions.canAnkan) parts.push('暗杠');
    if (actions.canKakan) parts.push('加杠');
    if (actions.canNineOrphans) parts.push('九种九牌');
    return parts.join('|') || '—';
  }

  private ts(): string {
    // 东京时区 (UTC+9)
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().slice(11, 23);
  }

  // ---- public API ----

  /** Reset for a new game */
  reset(): void {
    this.entries = [];
    this.prevState = null;
    this.turnLog = 0;
    this.prevActionStrs = [];
  }

  /** Subscribe handler — call this on every GameController state change */
  onStateChange(state: GameState): void {
    const prev = this.prevState;
    this.prevState = state;

    // Find human wind
    for (const w of WINDS) {
      if (state.players[w].isHuman) {
        this.humanWind = w;
        break;
      }
    }

    // ── Initial state ──
    if (!prev) {
      this.log('INIT', {
        players: state.players.map(p => p.name).join(', '),
        dealer: state.players[state.dealerIndex].name,
        round: `${state.roundWind === Wind.EAST ? '东' : '南'}${(state.handCount % 4) + 1}局`,
        honba: state.honba,
        riichiSticks: state.riichiSticks,
      });
      this.logHands(state, '配牌');
      this.logActions(state);
      return;
    }

    // ── Turn change (new round within the hand) ──
    if (state.phase === GamePhase.DRAWING && state.currentPlayer !== prev.currentPlayer) {
      this.turnLog++;
      const cp = state.players[state.currentPlayer];
      this.log('TURN', {
        no: state.turn,
        player: cp.name,
        wall: state.wall.length,
      });
      this.logHands(state, `巡${state.turn}`);
    }

    // ── Draw (only log for AI, human draw is obvious from hand change) ──
    if (
      state.drawnTile &&
      (!prev.drawnTile || state.drawnTile.id !== prev.drawnTile?.id)
    ) {
      const drawer = state.players[state.currentPlayer];
      if (!drawer.isHuman) {
        this.log('DRAW', { player: drawer.name });
      }
    }

    // ── Discard ──
    if (
      state.lastDiscard &&
      state.lastDiscardPlayer !== undefined &&
      (!prev.lastDiscard || state.lastDiscard.id !== prev.lastDiscard?.id)
    ) {
      const discarder = state.players[state.lastDiscardPlayer];
      this.log('DISCARD', {
        player: discarder.name,
        tile: this.tileStr(state.lastDiscard),
      });
    }

    // ── Meld ──
    for (const w of WINDS) {
      if (state.players[w].melds.length > prev.players[w].melds.length) {
        const player = state.players[w];
        const meld = player.melds[player.melds.length - 1];
        const meldNames: Record<string, string> = {
          chi: '吃', pon: '碰', kan: '明杠', ankan: '暗杠', kakan: '加杠',
        };
        this.log('MELD', {
          player: player.name,
          type: meldNames[meld.type] || meld.type,
          tiles: meld.tiles.map(t => this.tileStr(t)).join(' '),
          from: meld.from !== undefined ? state.players[meld.from]?.name : '自摸',
        });
        // After meld, re-log the player's hand
        this.log('HAND', {
          player: player.name,
          hand: this.handStr(player.hand),
          melds: this.meldsStr(player.melds),
        });
      }
    }

    // ── Riichi declaration ──
    for (const w of WINDS) {
      if (state.players[w].isRiichi && !prev.players[w].isRiichi) {
        this.log('RIICHI', {
          player: state.players[w].name,
          type: state.players[w].isDoubleRiichi ? '两立直' : '通常立直',
        });
      }
    }

    // ── Action buttons (appear / disappear) ──
    this.logActions(state, prev);

    // ── Hand over ──
    if (state.phase === GamePhase.HAND_OVER && prev.phase !== GamePhase.HAND_OVER) {
      this.log('RESULT', {
        type: state.result?.type || '?',
        winners: state.result?.winners?.map(w => state.players[w].name).join(', ') || '—',
      });
      // Log scoring details for each winning player
      if (state.result?.winResults) {
        for (const wr of state.result.winResults) {
          const yakuStr = wr.yaku.map(y => `${y.name}(${y.han}翻)`).join(', ');
          this.log('WIN', {
            player: state.players[wr.player].name,
            han: wr.totalHan,
            fu: wr.fu,
            basePoints: wr.basePoints,
            points: wr.winnerGets,
            yaku: yakuStr || '—',
            isTsumo: wr.isTsumo ? 'Y' : 'N',
          });
        }
      }
      this.logHands(state, '终局');
    }

    // ── Game over ──
    if (state.phase === GamePhase.GAME_OVER && prev.phase !== GamePhase.GAME_OVER) {
      this.log('GAMEOVER', { msg: '游戏结束' });
    }
  }

  // ---- internal loggers ----

  private logHands(state: GameState, label: string): void {
    const p = state.players[this.humanWind];
    this.log('HAND', {
      player: p.name,
      label,
      hand: this.handStr(p.hand),
      melds: this.meldsStr(p.melds),
      discards: this.discardsStr(p.discards),
      riichi: p.isRiichi ? 'Y' : 'N',
      furiten: state.furitenPlayers.includes(p.wind) ? 'Y' : 'N',
    });
  }

  private logActions(state: GameState, prev?: GameState): void {
    for (const w of WINDS) {
      const curStr = this.actionStr(state.actionsAvailable[w]);
      const prevStr = prev ? this.actionStr(prev.actionsAvailable[w]) : '';
      if (!prev || curStr !== prevStr) {
        this.log('ACTIONS', {
          player: state.players[w].name,
          available: curStr,
        });
      }
    }
  }

  // ---- output ----

  /** Get full log as plain text */
  getLogText(): string {
    return this.entries
      .map(e => {
        const dataStr = Object.entries(e.data)
          .map(([k, v]) => `${k}=${v}`)
          .join('  ');
        return `[${e.time}] [${e.type}] ${dataStr}`;
      })
      .join('\n');
  }

  /** Trigger browser download of the log file */
  download(filename = `mahjong-${Date.now()}.log`): void {
    const blob = new Blob([this.getLogText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
