/**
 * GameController — 纯 TS 游戏控制器，零 React 依赖
 *
 * 职责：
 *  - 持有 GameState
 *  - 运行游戏循环（AI 自动决策 + 延迟）
 *  - 暴露人类操作接口
 *  - 通过订阅通知状态变更
 */
import type { Tile, GameState } from './types';
import { MeldType, GamePhase, Wind, WINDS } from './types';
import {
  createInitialState, drawTile, discardTile, executeMeld, executeWin,
  nextTurn, createNextHand, executeNineOrphans, getDrawActions,
  emptyActions,
} from './gameEngine';
import { sortHand } from './tiles';
import { aiChooseDiscard, aiChooseAction, aiDecideRiichi } from './ai';
import { sameTile } from './tiles';
import type { DifficultyLevel, DifficultyConfig } from './difficulty';
import { getDifficulty, DIFFICULTY_NORMAL } from './difficulty';

export class GameController {
  private _state: GameState;
  private listeners: Set<(s: GameState) => void> = new Set();
  private msgListeners: Set<(msg: string) => void> = new Set();
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private _difficulty: DifficultyConfig = DIFFICULTY_NORMAL;
  private _characters?: { name: string }[];

  constructor(characters?: { name: string }[]) {
    this._characters = characters;
    this._state = createInitialState(characters);
  }

  /** 设置 AI 难度 */
  setDifficulty(level: DifficultyLevel): void {
    this._difficulty = getDifficulty(level);
  }

  /** 获取当前难度 */
  get difficulty(): DifficultyConfig {
    return this._difficulty;
  }

  // ── Lifecycle ──

  subscribe(fn: (s: GameState) => void): () => void {
    this.listeners.add(fn);
    fn(this._state);
    return () => this.listeners.delete(fn);
  }

  onMessage(fn: (msg: string) => void): () => void {
    this.msgListeners.add(fn);
    return () => this.msgListeners.delete(fn);
  }

  destroy() {
    this.clearTimer();
    this.listeners.clear();
    this.msgListeners.clear();
  }

  get state() { return this._state; }

  // ── Internal ──

  private emit() {
    const s = { ...this._state, players: this._state.players.map(p => ({ ...p, hand: [...p.hand], discards: [...p.discards], melds: [...p.melds] })) };
    for (const fn of this.listeners) fn(s);
  }

  private log(msg: string) {
    for (const fn of this.msgListeners) fn(msg);
  }

  private clearTimer() {
    if (this.timerId !== null) { clearTimeout(this.timerId); this.timerId = null; }
  }

  private schedule(ms: number) {
    this.clearTimer();
    this.timerId = setTimeout(() => this.tick(), ms);
  }

  // ── Game Loop ──

  private tick() {
    if (this._state.phase === GamePhase.HAND_OVER || this._state.phase === GamePhase.GAME_OVER) return;

    let s = this._state;

    // DRAWING: 自动摸牌
    if (s.phase === GamePhase.DRAWING) {
      s = drawTile(s);
      this._state = s;
      this.emit();
      this.schedule(s.phase === GamePhase.ACTION_PROMPT ? 600 : 50);
      return;
    }

    // DISCARDING
    if (s.phase === GamePhase.DISCARDING) {
      const cp = s.players[s.currentPlayer];
      if (!cp.isHuman) {
        s = this.aiDiscard(s);
        this._state = s;
        this.emit();
        this.schedule(s.phase === GamePhase.ACTION_PROMPT ? 400 : 50);
      }
      // 人类: 等待点击（自摸切由 App 层的 autoSelfDiscard 控制）
      return;
    }

    // ACTION_PROMPT
    if (s.phase === GamePhase.ACTION_PROMPT) {
      const humanWind = WINDS.find(w => s.players[w].isHuman) ?? 0;
      const humanAct = s.actionsAvailable[humanWind];

      // 人类有响应选项 → 等待
      if (s.lastDiscard && humanAct && (humanAct.canRon || humanAct.canPon || humanAct.canChi || humanAct.canKan)) return;
      // 人类有摸牌后动作 → 等待
      if (!s.lastDiscard && humanAct && (humanAct.canTsumo || humanAct.canRiichi || humanAct.canAnkan || humanAct.canKakan)) return;

      // 处理 AI 响应
      if (s.lastDiscard) {
        const next = this.processAiResponses(s);
        if (next) { this._state = next; this.emit(); this.schedule(400); return; }
        // 无人响应 → AI 选过 → 振听 + 下一家
        let furiten = s;
        for (const w of WINDS) {
          if (w !== s.currentPlayer && !s.players[w].isHuman && s.actionsAvailable[w]?.canRon) {
            if (!furiten.furitenPlayers.includes(w)) {
              furiten = { ...furiten, furitenPlayers: [...furiten.furitenPlayers, w] };
            }
          }
        }
        this._state = nextTurn(furiten);
        this.emit();
        this.schedule(50);
      } else {
        const cp = s.players[s.currentPlayer];
        const actions = s.actionsAvailable[s.currentPlayer];
        if (!cp.isHuman) {
          if (actions?.canTsumo) {
            this._state = executeWin(s, s.currentPlayer, true);
          } else {
            this._state = { ...s, phase: GamePhase.DISCARDING };
          }
          this.emit();
          this.schedule(400);
        }
      }
    }
  }

  /** AI 自动弃牌（支持立直） */
  private aiDiscard(s: GameState): GameState {
    const cp = s.players[s.currentPlayer];
    // 食替：从手牌中排除被限制的牌
    const validHand = cp.restrictedDiscardKeys.length > 0
      ? cp.hand.filter(t => !cp.restrictedDiscardKeys.includes(`${t.value}${t.suit}`))
      : cp.hand;
    if (validHand.length === 0) return s; // 全部被锁，不可能发生
    const tile = aiChooseDiscard(validHand, undefined, s, s.currentPlayer, this._difficulty);
    if (!tile) return s;
    const riichiOk = s.actionsAvailable[s.currentPlayer]?.canRiichi;
    if (riichiOk && aiDecideRiichi(cp.hand, s, s.currentPlayer, this._difficulty)) {
      this.log(`⚡ ${cp.name} 立直！`);
      const isFirstTurn = s.turn <= 2 && cp.discards.length === 0 && !cp.hasCalled;
      const marked = {
        ...s,
        riichiSticks: s.riichiSticks + 1,
        players: s.players.map((p, i) =>
          i === s.currentPlayer
            ? { ...p, isRiichi: true, isDoubleRiichi: isFirstTurn, riichiTurnStart: s.turn, score: p.score - 1000 }
            : p
        ),
      };
      return discardTile(marked, tile.id);
    }
    return discardTile(s, tile.id);
  }

  /** AI 响应（荣和 > 碰 > 吃） */
  private processAiResponses(s: GameState): GameState | null {
    for (const wind of WINDS) {
      if (wind === s.currentPlayer) continue;
      const actions = s.actionsAvailable[wind];
      if (!actions) continue;
      const player = s.players[wind];
      if (player.isHuman) continue;
      const choice = aiChooseAction(s, wind, this._difficulty);
      if (choice === 'ron' && actions.canRon) return executeWin(s, wind, false);
      if (choice === 'pon' && actions.canPon && s.lastDiscard) {
        const matching = player.hand.filter(t => sameTile(t, s.lastDiscard!));
        if (matching.length >= 2) {
          this.log(`🔴 ${player.name} 碰！`);
          return executeMeld(s, wind, MeldType.PON, matching.slice(0, 2));
        }
      }
      if (choice === 'chi' && actions.canChi && s.lastDiscard) {
        const valid = player.hand.filter(t =>
          t.suit === s.lastDiscard!.suit &&
          Math.abs(t.value - s.lastDiscard!.value) <= 2 &&
          t.value !== s.lastDiscard!.value
        );
        if (valid.length >= 2) {
          this.log(`🟢 ${player.name} 吃！`);
          return executeMeld(s, wind, MeldType.CHI, valid.slice(0, 2));
        }
      }
    }
    return null;
  }

  // ── Public API ──

  /** 启动/重启游戏循环 */
  start() {
    this.emit();
    this.schedule(50);
  }

  newGame() {
    this.clearTimer();
    this._state = createInitialState(this._characters);
    this.emit();
    this.schedule(50);
  }

  nextHand() {
    this.clearTimer();
    const s = this._state;
    if (s.players.some(p => p.score < 0) || s.handCount >= 7) {
      this._state = createInitialState(this._characters);
    } else {
      this._state = createNextHand(s);
    }
    this.emit();
    this.schedule(50);
  }

  humanDiscard(tileId: number): boolean {
    const s = this._state;
    const cp = s.players[s.currentPlayer];
    if (!cp?.isHuman) return false;
    if (s.phase !== GamePhase.DISCARDING && s.phase !== GamePhase.ACTION_PROMPT) return false;

    // 立直后只能弃摸牌（自摸切），自动模式走 useEffect，手动模式由用户点
    if (cp.isRiichi && s.drawnTile && tileId !== s.drawnTile.id) {
      this.log('立直后只能打刚摸到的牌（自摸切）');
      return false;
    }

    // 食替检查
    const tile = cp.hand.find(t => t.id === tileId);
    if (tile && cp.restrictedDiscardKeys.length > 0 &&
        cp.restrictedDiscardKeys.includes(`${tile.value}${tile.suit}`)) {
      this.log('⛔ 食替禁止：刚吃/碰的牌不能立即打出');
      return false;
    }

    const newState = discardTile(s, tileId);
    if (newState !== s) {
      this._state = newState;
      this.emit();
      this.schedule(50);
      return true;
    }
    return false;
  }

  /** 立直模式弃牌（带立直标记） */
  humanRiichiDiscard(tileId: number): boolean {
    const s = this._state;
    const isFirstTurn = s.turn <= 2 && s.players[s.currentPlayer].discards.length === 0 && !s.players[s.currentPlayer].hasCalled;
    const marked = {
      ...s,
      phase: ('discarding' as GamePhase),
      riichiSticks: s.riichiSticks + 1,
      players: s.players.map((p, i) =>
        i === s.currentPlayer
          ? { ...p, isRiichi: true, isDoubleRiichi: isFirstTurn, riichiTurnStart: s.turn, score: p.score - 1000 }
          : p
      ),
    };
    this._state = discardTile(marked, tileId);
    this.emit();
    this.schedule(50);
    return true;
  }

  humanAction(action: string, tiles?: Tile[]) {
    const s = this._state;
    const humanWind = WINDS.find(w => s.players[w].isHuman) ?? 0;

    switch (action) {
      case 'tsumo':
        if (s.actionsAvailable[humanWind]?.canTsumo) {
          this._state = executeWin(s, humanWind, true);
          this.log('🎉 自摸和牌！');
        }
        break;

      case 'ron':
        if (!s.actionsAvailable[humanWind]?.canRon) {
          console.warn('[AUTO-RON] blocked: canRon is false', {
            phase: s.phase, humanWind, lastDiscard: s.lastDiscard?.suit + s.lastDiscard?.value,
            actions: s.actionsAvailable[humanWind],
          });
          break;
        }
        this._state = executeWin(s, humanWind, false);
        setTimeout(() => {
          if (this._state.phase === GamePhase.HAND_OVER) this.log('💥 荣和！');
        }, 0);
        break;

      case 'pon':
        if (s.lastDiscard) {
          const matching = s.players[humanWind].hand.filter(t => sameTile(t, s.lastDiscard!));
          if (matching.length >= 2) {
            this._state = executeMeld(s, humanWind, MeldType.PON, matching.slice(0, 2));
            this.log('🔴 碰！');
          }
        }
        break;

      case 'chi':
        if (tiles && tiles.length >= 2) {
          // 用户手动选择了吃牌组合
          console.log(`[CHI] human selected tiles: ${tiles.map(t=>`${t.value}${t.suit}(id=${t.id})`).join(', ')}`);
          this._state = executeMeld(s, humanWind, MeldType.CHI, tiles.slice(0, 2));
          this.log('🟢 吃！');
        } else if (s.lastDiscard) {
          // 自动选择：用 chiOptions 取第一个
          const actions = s.actionsAvailable[humanWind];
          if (actions?.chiOptions?.[0]?.length) {
            const best = actions.chiOptions[0][0];
            this._state = executeMeld(s, humanWind, MeldType.CHI, best.tiles);
            this.log('🟢 吃！');
          } else {
            // 降级：旧逻辑
            const valid = s.players[humanWind].hand.filter(t =>
              t.suit === s.lastDiscard!.suit &&
              Math.abs(t.value - s.lastDiscard!.value) <= 2 &&
              t.value !== s.lastDiscard!.value
            );
            if (valid.length >= 2) {
              this._state = executeMeld(s, humanWind, MeldType.CHI, valid.slice(0, 2));
              this.log('🟢 吃！');
            }
          }
        }
        break;

      case 'kan':
        if (s.lastDiscard) {
          const matching = s.players[humanWind].hand.filter(t => sameTile(t, s.lastDiscard!));
          if (matching.length >= 3) {
            this._state = executeMeld(s, humanWind, MeldType.KAN, matching.slice(0, 3));
            this.log('🔵 杠！');
          }
        }
        break;

      case 'ankan': {
        const groups = new Map<string, Tile[]>();
        for (const t of s.players[s.currentPlayer].hand) {
          const k = `${t.suit}${t.value}`;
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k)!.push(t);
        }
        for (const [, gtiles] of groups) {
          if (gtiles.length >= 4) {
            this._state = executeMeld(s, s.currentPlayer, MeldType.ANKAN, gtiles.slice(0, 4));
            this.log('🔵 暗杠！');
            break;
          }
        }
        break;
      }

      case 'kakan':
        for (const meld of s.players[s.currentPlayer].melds) {
          if (meld.type === 'pon') {
            const extra = s.players[s.currentPlayer].hand.find(t => sameTile(t, meld.tiles[0]));
            if (extra) {
              this._state = executeMeld(s, s.currentPlayer, MeldType.KAKAN, [extra]);
              this.log('🔵 加杠！');
              break;
            }
          }
        }
        break;

      case 'nine_orphans':
        if (s.actionsAvailable[humanWind]?.canNineOrphans) {
          this._state = executeNineOrphans(s, humanWind);
          this.log('🕊️ 流局：九种九牌');
        }
        break;

      case 'pass':
        if (s.lastDiscard) {
          const hWind = WINDS.find(w => s.players[w].isHuman) ?? 0;
          const humanActions = s.actionsAvailable[hWind];
          if (humanActions?.canRon) {
            this.log(s.players[hWind].isRiichi ? '立直后见逃，永久振听' : '见逃，临时振听');
          }
          const cleared = {
            ...s,
            furitenPlayers: humanActions?.canRon
              ? [...new Set([...s.furitenPlayers, hWind])]
              : s.furitenPlayers,
            actionsAvailable: s.actionsAvailable.map((a, i) =>
              i === hWind ? {
                canChi: false, chiOptions: [], canPon: false, canKan: false,
                canRon: false, canTsumo: false, canRiichi: false, canAnkan: false,
                canKakan: false, canNineOrphans: false,
              } : a
            ),
          };
          const aiResult = this.processAiResponses(cleared);
          if (aiResult) {
            this._state = aiResult;
          } else {
            this._state = nextTurn(cleared);
          }
          this.emit();
        } else {
          this._state = nextTurn(s);
        }
        break;
    }

    this.emit();
    this.schedule(50);
  }

  /** 换牌 */
  executeSwap(sourceTileId: number, wallTileKey: string): boolean {
    const s = this._state;
    if (s.phase !== GamePhase.DISCARDING && s.phase !== GamePhase.ACTION_PROMPT) return false;
    if (s.currentPlayer !== Wind.EAST) return false;

    const suit = wallTileKey[0] as import('./types').TileSuit;
    const value = parseInt(wallTileKey[1]);
    const wallTile = s.wall.find(t => t.suit === suit && t.value === value);
    if (!wallTile) return false;

    const players = s.players.map(p => ({ ...p, hand: [...p.hand] }));
    const humanPlayer = players[Wind.EAST];
    const handIdx = humanPlayer.hand.findIndex(t => t.id === sourceTileId);
    if (handIdx === -1) return false;
    const oldTile = humanPlayer.hand[handIdx];
    humanPlayer.hand[handIdx] = wallTile;
    if (handIdx !== humanPlayer.hand.length - 1 && s.drawnTile) {
      const drawnIdx = humanPlayer.hand.findIndex(t => t.id === s.drawnTile!.id);
      if (drawnIdx >= 0) {
        [humanPlayer.hand[handIdx], humanPlayer.hand[drawnIdx]] = [humanPlayer.hand[drawnIdx], humanPlayer.hand[handIdx]];
      }
    }

    const newWall = [...s.wall];
    const wallIdx = newWall.findIndex(t => t.id === wallTile.id);
    if (wallIdx >= 0) newWall.splice(wallIdx, 1);
    newWall.push(oldTile);

    this._state = { ...s, players, wall: newWall, drawnTile: wallTile };
    this.emit();
    // 换牌后整理手牌顺序
    this._state = {
      ...this._state,
      players: this._state.players.map((p, i) =>
        i === Wind.EAST ? { ...p, hand: sortHand(p.hand) } : p
      ),
    };
    // 换牌后重算可执行动作（立直、自摸、暗杠等），如同刚摸牌一样
    const afterSwap = this._state;
    const human = afterSwap.players[Wind.EAST];
    const hpActions = getDrawActions(human, afterSwap, Wind.EAST, afterSwap.drawnTile!);
    const hasActions = hpActions.canRiichi || hpActions.canTsumo || hpActions.canAnkan || hpActions.canKakan || hpActions.canNineOrphans;
    this._state = {
      ...afterSwap,
      phase: hasActions ? GamePhase.ACTION_PROMPT : GamePhase.DISCARDING,
      actionsAvailable: WINDS.map((_, i) => i === Wind.EAST ? hpActions : emptyActions()),
    };
    this.emit();
    // 如果没有动作（非听牌），自动触发 tick 继续流程
    if (!hasActions) this.schedule(50);
    return true;
  }
}
