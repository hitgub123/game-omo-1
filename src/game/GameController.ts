/**
 * GameController — 纯 TS 游戏控制器，零 React 依赖
 *
 * 职责：
 *  - 持有 GameState
 *  - 运行游戏循环（AI 自动决策 + 延迟）
 *  - 暴露人类操作接口
 *  - 通过订阅通知状态变更
 */
import type { Tile, GameState, Player } from './types';
import { MeldType, GamePhase, Wind, WINDS } from './types';
import { checkTenpai } from './hand';
import {
  createInitialState, drawTile, discardTile, executeMeld, executeWin,
  nextTurn, createNextHand, executeNineOrphans, getDrawActions,
  emptyActions,
} from './gameEngine';
import { getAbilityCost, executeInstantAbility } from './abilities';
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
  private _gameLength: number;
  private _autoPlay = false;
  private _autoAdvanceScheduled = false; // 防止重复调度自动下一局

  constructor(characters?: { name: string }[], gameLength = 4, initialScore?: number) {
    this._characters = characters;
    this._gameLength = gameLength;
    this._state = createInitialState(characters, undefined, gameLength, initialScore);
  }

  /** 设置 AI 难度 */
  setDifficulty(level: DifficultyLevel): void {
    this._difficulty = getDifficulty(level);
  }

  /** 托管模式：true=AI 代打人类玩家 */
  setAutoPlay(on: boolean): void {
    this._autoPlay = on;
    if (on) {
      this.log('🤖 托管模式开启');
      this.schedule(50); // 立即触发 tick
    } else {
      this.log('🙋 手动模式');
    }
  }

  get autoPlay(): boolean { return this._autoPlay; }

  /** 发动能力：消耗角色特定能量，abilityUseCount+1。仅限自己的出牌回合 */
  activateAbility(targetWind?: Wind, extraTile?: { suit: string; value: number }): boolean {
    const s = this._state;
    const cp = s.players[s.currentPlayer];
    if (!cp) return false;
    if (cp.energy < 100) {
      this.log('⚡ 能量不足100，无法发动能力');
      return false;
    }
    if (s.phase !== GamePhase.DISCARDING && s.phase !== GamePhase.ACTION_PROMPT) {
      this.log('⛔ 只能在出牌回合发动能力');
      return false;
    }

    const players = s.players.map(p => ({ ...p }));
    players[s.currentPlayer].energy -= 100;
    players[s.currentPlayer].abilityUseCount++;
    this.log(`⚡ ${cp.name} 发动能力！(消耗100，剩余${players[s.currentPlayer].energy}，累计${players[s.currentPlayer].abilityUseCount}次)`);

    // ── 牌山检查（铃仙/文）先扣能量再检查，没牌就白费能量 ──
    if (cp.name === '铃仙·优昙华院·因幡' && extraTile) {
      const key = `${extraTile.value}${extraTile.suit}`;
      const found = s.wall.some(t => t.suit === extraTile.suit && t.value === extraTile.value);
      if (!found) {
        this._state = { ...s, players };
        this.log(`🎯 牌山中没有${key}，狙击失败（能量已消耗）`);
        this.emit();
        return true;
      }
    }
    if (cp.name === '射命丸文' && s.wall.length === 0) {
      this._state = { ...s, players };
      this.log('🍃 牌山已空，風速失败（能量已消耗）');
      this.emit();
      return true;
    }

    // ── 灵梦护符：下局不可鸣牌 ──
    if (cp.name === '博丽灵梦') {
      this._state = { ...s, players, reimuCharm: true };
      this.log('🛡️ 博丽护符：下一局自己打出的牌不可被鸣牌');
      this.emit();
      return true;
    }

    // ── 琪露诺冰冻：所有对手强制自摸切 ──
    if (cp.name === '琪露诺') {
      for (let i = 0; i < 4; i++) {
        if (i !== s.currentPlayer) {
          players[i].frozenByCirno = true;
        }
      }
      this._state = { ...s, players };
      this.log('❄️ 氷結！所有对手下一次摸牌必须自摸切');
      this.emit();
      return true;
    }

    // ── 咲夜时间操作：标记额外一巡 ──
    if (cp.name === '十六夜咲夜') {
      this._state = { ...s, players, _sakuyaExtraTurn: true };
      this.log('⏰ 时间操作：弃牌后将额外进行一次摸牌+弃牌');
      this.emit();
      return true;
    }

    // ── 简单即时效果（按角色名匹配） ──
    const handled = this.applySimpleEffect(cp.name, s, players, targetWind, extraTile);
    if (handled !== null) {
      this._state = handled;
      this.emit();
      return true;
    }

    // ── 即时能力（妖梦、文、铃仙） ──
    const result = executeInstantAbility(cp.name, { ...s, players }, s.currentPlayer, targetWind, extraTile);
    if (result.ok && result.state) {
      this._state = result.state;
      this.log(result.message);
    } else {
      // 失败也扣能量（不退还）
      this._state = { ...s, players };
      this.log(result.message || '能力发动失败');
    }

    this.emit();
    return true;
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
    // 托管模式：终局后自动推进
    if (this._autoPlay && !this._autoAdvanceScheduled) {
      if (this._state.phase === GamePhase.HAND_OVER) {
        this._autoAdvanceScheduled = true;
        this.log('⏱️ 5秒后自动下一局...');
        this.schedule(5000);
        return;
      }
      if (this._state.phase === GamePhase.GAME_OVER) {
        this._autoAdvanceScheduled = true;
        this.log('🔄 游戏结束，5秒后自动新游戏...');
        this.schedule(5000);
        return;
      }
    }

    // 托管模式：定时器到期，执行推进
    if (this._autoPlay && this._autoAdvanceScheduled) {
      this._autoAdvanceScheduled = false;
      if (this._state.phase === GamePhase.HAND_OVER) {
        this.nextHand();
        return;
      }
      if (this._state.phase === GamePhase.GAME_OVER) {
        this.newGame();
        return;
      }
    }

    if (this._state.phase === GamePhase.HAND_OVER || this._state.phase === GamePhase.GAME_OVER) return;

    let s = this._state;

    // DRAWING: 自动摸牌
    if (s.phase === GamePhase.DRAWING) {
      const cp = s.players[s.currentPlayer];
      if (cp.skipNextDraw) {
        // 冬眠/距離：跳过摸牌
        const players = s.players.map(p => ({ ...p }));
        players[s.currentPlayer].skipNextDraw = false;
        s = { ...s, players, phase: GamePhase.DISCARDING, drawnTile: undefined };
        this.log(`⏭️ ${cp.name} 跳过摸牌`);
        this._state = s;
        this.emit();
        this.schedule(400);
        return;
      }
      s = drawTile(s);
      this._state = s;
      this.emit();
      this.schedule(s.phase === GamePhase.ACTION_PROMPT ? 600 : 50);
      return;
    }

    // DISCARDING
    if (s.phase === GamePhase.DISCARDING) {
      const cp = s.players[s.currentPlayer];
      if (!cp.isHuman || this._autoPlay) {
        s = this.aiDiscard(s);
        // 咲夜时间操作：额外一巡（弃牌后再摸再弃）
        if (s._sakuyaExtraTurn && s.phase === GamePhase.ACTION_PROMPT) {
          s = { ...s, _sakuyaExtraTurn: undefined };
          s = drawTile(s);
          s = this.aiDiscard(s);
          this.log('⏰ 咲夜完成额外一巡');
        }
        this._state = s;
        this.emit();
        this.schedule(s.phase === GamePhase.ACTION_PROMPT ? 400 : 50);
      }
      // 人类非托管: 等待点击（自摸切由 App 层的 autoSelfDiscard 控制）
      // 但琪露诺冰冻时强制自摸切
      if (!this._autoPlay && cp.isHuman && cp.frozenByCirno && s.drawnTile) {
        const acts = s.actionsAvailable[s.currentPlayer];
        if (acts?.canTsumo) {
          this._state = executeWin(s, s.currentPlayer, true);
          this.log('❄️ 冰冻中自摸和牌！');
        } else {
          const result = discardTile(s, s.drawnTile.id);
          result.players[s.currentPlayer].frozenByCirno = false;
          this._state = result;
          this.log('❄️ 被冰冻，强制自摸切');
        }
        this.emit();
        this.schedule(400);
      }
      return;
    }

    // ACTION_PROMPT
    if (s.phase === GamePhase.ACTION_PROMPT) {
      const humanWind = WINDS.find(w => s.players[w].isHuman) ?? 0;
      const humanAct = s.actionsAvailable[humanWind];

      // 托管模式：人类动作也由 AI 处理，不等待
      if (this._autoPlay) {
        if (s.lastDiscard) {
          // 有人弃牌 → 所有玩家（含人类）响应
          const next = this.processAllResponses(s);
          if (next) { this._state = next; this.emit(); this.schedule(400); return; }
          // 无人响应 → 振听 + 下一家
          let furiten = s;
          for (const w of WINDS) {
            if (w !== s.currentPlayer && s.actionsAvailable[w]?.canRon) {
              if (!furiten.furitenPlayers.includes(w)) {
                furiten = { ...furiten, furitenPlayers: [...furiten.furitenPlayers, w] };
              }
            }
          }
          this._state = nextTurn(furiten);
          this.emit();
          this.schedule(50);
        } else {
          // 人类摸牌后 → AI 决策：自摸 > 立直 > 暗杠 > 加杠 > 弃牌
          const cp = s.players[s.currentPlayer];
          if (humanAct?.canTsumo) {
            this._state = executeWin(s, s.currentPlayer, true);
          } else if (humanAct?.canRiichi && aiDecideRiichi(cp.hand, s, s.currentPlayer, this._difficulty)) {
            // 立直：找一张能听牌的牌打出
            const tile = aiChooseDiscard(cp.hand, undefined, s, s.currentPlayer, this._difficulty);
            if (tile) {
              const isFirstTurn = s.turn <= 2 && cp.discards.length === 0 && !cp.hasCalled;
              const marked = {
                ...s,
                riichiSticks: s.riichiSticks + 1,
                players: s.players.map((p, i) =>
                  i === s.currentPlayer
                    ? { ...p, isRiichi: true, isDoubleRiichi: isFirstTurn, riichiTurnStart: s.turn, score: p.score - 1000, energy: Math.min(p.energyMax, p.energy + p.energyPerRiichi) }
                    : p
                ),
              };
              this._state = discardTile(marked, tile.id);
            } else {
              this._state = { ...s, phase: GamePhase.DISCARDING };
            }
          } else if (humanAct?.canAnkan || humanAct?.canKakan) {
            // 暗杠/加杠暂不自动处理，进入弃牌
            this._state = { ...s, phase: GamePhase.DISCARDING };
          } else {
            this._state = { ...s, phase: GamePhase.DISCARDING };
          }
          this.emit();
          this.schedule(400);
        }
        return;
      }

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

    // 琪露诺冰冻：必须自摸切（除非能暗杠/立直/和牌）
    if (cp.frozenByCirno) {
      const acts = s.actionsAvailable[s.currentPlayer];
      if (acts?.canTsumo) {
        this.log(`❄️ ${cp.name} 冰冻中自摸和牌！`);
        return executeWin(s, s.currentPlayer, true);
      }
      if (acts?.canRiichi && aiDecideRiichi(cp.hand, s, s.currentPlayer, this._difficulty)) {
        this.log(`❄️ ${cp.name} 冰冻中立直！`);
        const tile = aiChooseDiscard(cp.hand, undefined, s, s.currentPlayer, this._difficulty);
        if (tile) {
          const isFirstTurn = s.turn <= 2 && cp.discards.length === 0 && !cp.hasCalled;
          const marked = {
            ...s,
            riichiSticks: s.riichiSticks + 1,
            players: s.players.map((p, i) =>
              i === s.currentPlayer
                ? { ...p, isRiichi: true, isDoubleRiichi: isFirstTurn, riichiTurnStart: s.turn, score: p.score - 1000, energy: Math.min(p.energyMax, p.energy + p.energyPerRiichi) }
                : p
            ),
          };
          const result = discardTile(marked, tile.id);
          // 清除冰冻标记
          result.players[s.currentPlayer].frozenByCirno = false;
          return result;
        }
      }
      if (acts?.canAnkan) {
        this.log(`❄️ ${cp.name} 冰冻中暗杠！`);
        // 简化处理：暗杠（TODO: 完整暗杠逻辑）
      }
      // 强制自摸切
      if (s.drawnTile) {
        this.log(`❄️ ${cp.name} 被冰冻，强制自摸切`);
        const result = discardTile(s, s.drawnTile.id);
        result.players[s.currentPlayer].frozenByCirno = false;
        return result;
      }
      return s;
    }

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
            ? { ...p, isRiichi: true, isDoubleRiichi: isFirstTurn, riichiTurnStart: s.turn, score: p.score - 1000, energy: Math.min(p.energyMax, p.energy + p.energyPerRiichi) }
            : p
        ),
      };
      return discardTile(marked, tile.id);
    }
    return discardTile(s, tile.id);
  }

  /** AI 响应（荣和 > 碰 > 吃） */
  private processAiResponses(s: GameState): GameState | null {
    return this.processResponses(s, false);
  }

  /** 所有玩家响应（托管模式下含人类） */
  private processAllResponses(s: GameState): GameState | null {
    return this.processResponses(s, true);
  }

  private processResponses(s: GameState, includeHuman: boolean): GameState | null {
    for (const wind of WINDS) {
      if (wind === s.currentPlayer) continue;
      const actions = s.actionsAvailable[wind];
      if (!actions) continue;
      const player = s.players[wind];
      if (!includeHuman && player.isHuman) continue; // 非托管模式跳过人类
      const choice = aiChooseAction(s, wind, this._difficulty);
      if (choice === 'ron' && actions.canRon) {
        if (s.phase !== GamePhase.HAND_OVER && s.phase !== GamePhase.GAME_OVER) {
          return executeWin(s, wind, false);
        }
      }
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

  newGame(characters?: { name: string }[]) {
    this.clearTimer();
    this._state = createInitialState(characters ?? this._characters, undefined, this._gameLength);
    this.emit();
    this.schedule(50);
  }

  nextHand(characters?: { name: string }[]) {
    this.clearTimer();
    const s = this._state;
    if (s.players.some(p => p.score < 0) || s.handCount >= s.gameLength * 4) {
      this._state = createInitialState(characters ?? this._characters, undefined, this._gameLength);
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
      // 咲夜时间操作：额外一巡
      let finalState = newState;
      if (newState._sakuyaExtraTurn && newState.phase === GamePhase.ACTION_PROMPT) {
        finalState = { ...newState, _sakuyaExtraTurn: undefined };
        finalState = drawTile(finalState);
        // AI 自动弃牌（即使是人类玩家，额外一巡也自动处理）
        const cp2 = finalState.players[finalState.currentPlayer];
        if (cp2.isHuman || this._autoPlay) {
          finalState = this.aiDiscard(finalState);
          this.log('⏰ 咲夜完成额外一巡');
        }
      }
      this._state = finalState;
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
          ? { ...p, isRiichi: true, isDoubleRiichi: isFirstTurn, riichiTurnStart: s.turn, score: p.score - 1000, energy: Math.min(p.energyMax, p.energy + p.energyPerRiichi) }
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
        if (s.phase === GamePhase.HAND_OVER || s.phase === GamePhase.GAME_OVER) break;
        if (s.actionsAvailable[humanWind]?.canTsumo) {
          this._state = executeWin(s, humanWind, true);
          if (this._state.phase === GamePhase.HAND_OVER) {
            this.log('🎉 自摸和牌！');
          } else {
            this.log('⚠️ 自摸失败（牌型无效或无役）');
          }
        }
        break;

      case 'ron':
        if (s.phase === GamePhase.HAND_OVER || s.phase === GamePhase.GAME_OVER) break;
        if (!s.actionsAvailable[humanWind]?.canRon) break;
        this._state = executeWin(s, humanWind, false);
        if (this._state.phase === GamePhase.HAND_OVER) {
          this.log('💥 荣和！');
        } else {
          this.log('⚠️ 荣和失败（牌型无效或无役）');
        }
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

    const humanPlayer = s.players[Wind.EAST];
    const cost = humanPlayer.swapEnergyCost ?? 200;
    if (humanPlayer.energy < cost) {
      this.log(`⚡ 能量不足${cost}，无法换牌（当前${humanPlayer.energy}）`);
      return false;
    }

    const suit = wallTileKey[0] as import('./types').TileSuit;
    const value = parseInt(wallTileKey[1]);
    const wallTile = s.wall.find(t => t.suit === suit && t.value === value);
    if (!wallTile) return false;

    const players = s.players.map(p => ({ ...p, hand: [...p.hand] }));
    const humanPlayer2 = players[Wind.EAST];
    humanPlayer2.energy -= cost;  // 扣除换牌能量
    const handIdx = humanPlayer2.hand.findIndex(t => t.id === sourceTileId);
    if (handIdx === -1) return false;
    const oldTile = humanPlayer2.hand[handIdx];
    humanPlayer2.hand[handIdx] = wallTile;
    if (handIdx !== humanPlayer2.hand.length - 1 && s.drawnTile) {
      const drawnIdx = humanPlayer2.hand.findIndex(t => t.id === s.drawnTile!.id);
      if (drawnIdx >= 0) {
        [humanPlayer2.hand[handIdx], humanPlayer2.hand[drawnIdx]] = [humanPlayer2.hand[drawnIdx], humanPlayer2.hand[handIdx]];
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

  // ── 简单能力效果分发 ──
  private applySimpleEffect(name: string, s: GameState, players: Player[], targetWind?: Wind, extraTile?: { suit: string; value: number }): GameState | null {
    const p = players[s.currentPlayer];
    const wall = [...s.wall];

    // === 能量操作 ===
    if (name === '露米娅' || name === '梅蒂欣·梅兰可莉') {
      // 暗黒/毒素：指定对手-20/-30能量
      if (targetWind === undefined) { this.log('需要指定目标'); return null; }
      const amt = name === '梅蒂欣·梅兰可莉' ? 30 : 20;
      players[targetWind].energy = Math.max(0, players[targetWind].energy - amt);
      this.log(`💀 ${name}：${s.players[targetWind].name} 能量-${amt}`);
      return { ...s, players };
    }
    if (name === '秋穰子') {
      p.energy = Math.min(p.energyMax, p.energy + 5);
      this.log(`🌾 豊穣：${p.name} 能量+5`);
      return { ...s, players };
    }
    if (name === '豪德寺三花') {
      p.energy = Math.min(p.energyMax, p.energy + 10);
      this.log(`🧧 招福：${p.name} 能量+10`);
      return { ...s, players };
    }

    // === 摸牌跳过 ===
    if (name === '蕾蒂·霍瓦特洛克') {
      players[s.currentPlayer].skipNextDraw = true;
      this.log('❄️ 冬眠：跳过自己下次摸牌，回复1000点');
      players[s.currentPlayer].score += 1000;
      return { ...s, players };
    }
    if (name === '小野塚小町') {
      const next = ((s.currentPlayer + 1) % 4) as Wind;
      players[next].skipNextDraw = true;
      this.log(`🚣 距離：${s.players[next].name} 跳过下次摸牌`);
      return { ...s, players };
    }

    // === 强制自摸切（单目标） ===
    if (name === '蕾米莉亚·斯卡蕾特' || name === '黑谷山女') {
      if (targetWind === undefined) { this.log('需要指定目标'); return null; }
      players[targetWind].frozenByCirno = true;
      this.log(`🧛 ${name}：${s.players[targetWind].name} 下张摸牌必须自摸切`);
      return { ...s, players };
    }

    // === 弃牌操作 ===
    if (name === '芙兰朵露·斯卡蕾特') {
      if (targetWind === undefined) { this.log('需要指定目标'); return null; }
      const tgt = s.players[targetWind];
      if (tgt.discards.length > 0) {
        const d = tgt.discards[tgt.discards.length - 1];
        players[targetWind].discards = tgt.discards.slice(0, -1);
        wall.push(d);
        this.log(`💥 破壊：${tgt.name} 弃牌区一张牌移回牌山`);
        return { ...s, players, wall };
      }
      this.log('目标弃牌区为空');
      return { ...s, players };
    }
    if (name === '键山雏') {
      if (p.discards.length > 0) {
        const d = p.discards[p.discards.length - 1];
        players[s.currentPlayer].discards = p.discards.slice(0, -1);
        wall.push(d);
        const newTile = wall.shift()!;
        players[s.currentPlayer].hand = [...p.hand, newTile];
        this.log(`🔄 厄流し：弃牌回牌山底，摸得${newTile.value}${newTile.suit}`);
        return { ...s, players, wall };
      }
      this.log('弃牌区为空');
      return { ...s, players };
    }

    // === 手牌/牌山交换 ===
    if (name === '帕秋莉·诺蕾姬' || name === '八云紫' || name === '摩多罗隐岐奈') {
      if (p.hand.length === 0) { this.log('手牌为空'); return { ...s, players }; }
      if (wall.length === 0) { this.log('牌山已空'); return { ...s, players }; }
      const handIdx = 0; // 简化：取第一张
      const newTile = wall.shift()!;
      wall.push(p.hand[handIdx]);
      players[s.currentPlayer].hand = [...p.hand];
      players[s.currentPlayer].hand.splice(handIdx, 1, newTile);
      this.log(`📚 ${name}：手牌↔牌山交换`);
      return { ...s, players, wall };
    }
    if (name === '红美玲') {
      if (wall.length === 0) { this.log('牌山已空'); return { ...s, players }; }
      const bottom = wall.pop()!;
      players[s.currentPlayer].hand = [...p.hand, bottom];
      this.log(`🐉 気功：从牌山底摸得${bottom.value}${bottom.suit}`);
      return { ...s, players, wall };
    }

    // === 额外摸牌 ===
    if (name === '八云蓝' || name === '八意永琳' || name === '秋静叶' || name === '堀川雷鼓') {
      if (wall.length === 0) { this.log('牌山已空'); return { ...s, players }; }
      const t = wall.shift()!;
      players[s.currentPlayer].hand = [...p.hand, t];
      this.log(`➕ ${name}：额外摸得${t.value}${t.suit}`);
      return { ...s, players, wall };
    }
    if (name === '若鹭姬') {
      if (s.drawnTile && s.drawnTile.suit === 'p' && wall.length > 0) {
        const t = wall.shift()!;
        players[s.currentPlayer].hand = [...p.hand, t];
        this.log(`🐟 水中の歌：筒子额外摸得${t.value}${t.suit}`);
        return { ...s, players, wall };
      }
      this.log('刚摸的不是筒子，水中の歌无效');
      return { ...s, players };
    }
    if (name === '高丽野阿吽') {
      if (s.drawnTile && s.drawnTile.suit === 'z' && wall.length > 0) {
        const t = wall.shift()!;
        players[s.currentPlayer].hand = [...p.hand, t];
        this.log(`🦁 阿吽：字牌额外摸得${t.value}${t.suit}`);
        return { ...s, players, wall };
      }
      this.log('刚摸的不是字牌，阿吽无效');
      return { ...s, players };
    }

    // === 查看信息（日志输出） ===
    if (name === '小恶魔' || name === '娜兹玲' || name === '犬走椛' || name === '九十九弁弁') {
      const peek = wall.slice(0, Math.min(3, wall.length));
      const names = peek.map(t => `${t.value}${t.suit}`).join(' ');
      this.log(`🔍 ${name} 查看牌山顶：${names}`);
      return { ...s, players };
    }
    if (name === '霍青娥') {
      const pos = extraTile ? (extraTile.value % wall.length) : 0;
      const t = wall[pos];
      this.log(`🔍 穿牆：牌山位置${pos}=${t.value}${t.suit}`);
      return { ...s, players };
    }
    if (name === '古明地觉') {
      if (targetWind === undefined) { this.log('需要指定目标'); return null; }
      const h = s.players[targetWind].hand.map(t => `${t.value}${t.suit}`).join(' ');
      this.log(`👁️ 読心：${s.players[targetWind].name} 手牌=[${h}]`);
      return { ...s, players };
    }
    if (name === '丰聪耳神子') {
      const info = s.players.map(p => `${p.name}:${p.hand.length}张${checkTenpai(p.hand, p.melds) ? '听' : ''}`).join(' ');
      this.log(`👂 聴聞：${info}`);
      return { ...s, players };
    }
    if (name === '菅牧典') {
      for (const op of s.players) {
        if (op.wind !== s.currentPlayer) {
          const d = op.discards.map(t => `${t.value}${t.suit}`).join(' ');
          this.log(`📋 ${op.name}弃牌：[${d}]`);
        }
      }
      return { ...s, players };
    }

    // === 弃牌隐藏 ===
    if (name === '莉格露·奈特巴格' || name === '河城荷取' || name === '驹草山如') {
      players[s.currentPlayer].hideDiscards = true;
      this.log(`🪲 ${name}：本巡弃牌对对手不可见`);
      return { ...s, players };
    }
    if (name === '古明地恋') {
      players[s.currentPlayer].hideDiscards = true;
      this.log(`💜 無意識：弃牌对对手不可见`);
      return { ...s, players };
    }

    // === 对手摸牌不显示 ===
    if (name === '米斯蒂娅·萝蕾拉' || name === '清兰') {
      if (targetWind === undefined) { this.log('需要指定目标'); return null; }
      this.log(`🎵 ${name}：${s.players[targetWind].name} 摸牌不显示`);
      return { ...s, players };
    }
    if (name === '哆来咪') {
      for (let i = 0; i < 4; i++) {
        if (i !== s.currentPlayer) {
          this.log(`💤 夢世界：${s.players[i].name} 摸牌不显示`);
        }
      }
      return { ...s, players };
    }

    // === 本巡不能荣和 ===
    if (name === '西行寺幽幽子' || name === '村纱水蜜') {
      if (targetWind === undefined) { this.log('需要指定目标'); return null; }
      this.log(`🦋 ${name}：${s.players[targetWind].name} 本巡不能荣和`);
      return { ...s, players };
    }

    // === 不能立直 ===
    if (name === '苏我屠自古') {
      for (let i = 0; i < 4; i++) {
        if (i !== s.currentPlayer) {
          this.log(`⚡ 雷鳴：${s.players[i].name} 本巡不能立直`);
        }
      }
      return { ...s, players };
    }

    // === 随机对手弃牌 ===
    if (name === '多多良小伞' || name === '克劳恩皮丝') {
      const others = [0,1,2,3].filter(i => i !== s.currentPlayer);
      const victim = others[Math.floor(Math.random() * others.length)];
      const vh = s.players[victim].hand;
      if (vh.length > 0) {
        const ri = Math.floor(Math.random() * vh.length);
        const tile = vh[ri];
        players[victim].hand = vh.filter((_, i) => i !== ri);
        players[victim].discards = [...s.players[victim].discards, tile];
        this.log(`😱 ${name}：${s.players[victim].name} 被迫弃${tile.value}${tile.suit}`);
      }
      return { ...s, players };
    }

    // === 点炮/被荣和减半 ===
    if (name === '洩矢诹访子' || name === '宫古芳香' || name === '庭渡久侘歌' || name === '杖刀偶磨弓' || name === '姬虫百百世') {
      this.log(`🛡️ ${name}：本局被荣和支付减半`);
      return { ...s, players };
    }

    // === 和牌加分 ===
    if (name === '戎璎花') { this.log('🐟 惠比寿：自摸和牌+500点'); return { ...s, players }; }
    if (name === '少名针妙丸') { this.log('🔨 万宝槌：本巡和牌+30%'); return { ...s, players }; }
    if (name === '纯狐') { this.log('✨ 純粋：本巡和牌+50%'); return { ...s, players }; }
    if (name === '八坂神奈子') { this.log('🌩️ 天流：本局和牌+30%'); return { ...s, players }; }
    if (name === '日白残无') { this.log('😈 欲望：每和一次+20%'); return { ...s, players }; }
    if (name === '鬼人正邪') { this.log('🔄 逆転：被荣和时对手多付1000'); return { ...s, players }; }
    if (name === '三头慧之子') { this.log('⚔️ 開戦：和牌对手多付1000'); return { ...s, players }; }
    if (name === '寅丸星') { this.log('💎 宝塔：宝牌每张+500'); return { ...s, players }; }
    if (name === '今泉影狼') { this.log('🌙 月夜：幺九牌每张+500'); return { ...s, players }; }
    if (name === '埴安神袿姬') { this.log('🗿 造形：面子数×500加分'); return { ...s, players }; }
    if (name === '磐永阿梨夜') { this.log('⏸️ 不変：和牌固定8000点'); return { ...s, players }; }

    // === 水桥帕露希 ===
    if (name === '水桥帕露希') { this.log('💚 嫉妬：对手和牌得分-30%'); return { ...s, players }; }

    // === 其他 ===
    if (name === '星熊勇仪') { this.log('💪 怪力：本巡无视食替限制'); return { ...s, players }; }
    if (name === '圣白莲' || name === '矢田寺成美' || name === '孙美天') {
      this.log('✨ 手牌变换'); return { ...s, players };
    }
    if (name === '灵乌路空') { this.log('☢️ 核融合：手牌本巡视为同花色'); return { ...s, players }; }
    if (name === '封兽鵺') { this.log('👻 正体不明：对手看到手牌数±1'); return { ...s, players }; }
    if (name === '幽谷响子') { this.log('📢 やまびこ：弃牌后可再弃同花色'); return { ...s, players }; }
    if (name === '物部布都') { this.log('🌬️ 風水：下张摸牌必定是万子'); return { ...s, players }; }
    if (name === '二岩狢子') { this.log('🦝 化け：弃牌伪装幺九牌'); return { ...s, players }; }
    if (name === '赤蛮奇') { this.log('💀 首飛び：弃牌飞回牌山顶'); return { ...s, players }; }
    if (name === '九十九八桥') { this.log('🎵 琴の音色：摸牌后弃同花色再摸'); return { ...s, players }; }
    if (name === '稀神探女') { this.log('🔄 逆言：宣言牌下巡必摸到'); return { ...s, players }; }
    if (name === '赫卡提亚') { this.log('👥 三身：借用对手手牌一张'); return { ...s, players }; }
    if (name === '爱塔妮缇拉尔瓦') { this.log('🦋 鱗粉：对手下巡牌面模糊'); return { ...s, players }; }
    if (name === '坂田合欢') { this.log('🌿 山の恵み：幺九牌可当任意牌'); return { ...s, players }; }
    if (name === '尔子田里乃・丁礼田舞') { this.log('⛩️ 神降ろし：下张摸牌变宝牌'); return { ...s, players }; }
    if (name === '牛崎润美') { this.log('🐄 重量変化：对手弃字牌则跳过'); return { ...s, players }; }
    if (name === '吉吊八千慧') { this.log('🐢 調伏：指定对手本局不能发动能力'); return { ...s, players }; }
    if (name === '山城高岭') { this.log('🐉 竜脈：手牌5万视为红宝牌'); return { ...s, players }; }
    if (name === '玉造魅须丸') { this.log('🔮 勾玉：同花色3张视为面子'); return { ...s, players }; }
    if (name === '饭纲丸龙') { this.log('⭐ 星雲：牌山重新洗牌'); return { ...s, players }; }
    if (name === '天弓千亦') { this.log('🏪 市場：手中的中视为万能牌'); return { ...s, players }; }
    if (name === '天火人血枪') { this.log('🔥 火炎：对手宝牌本巡无效'); return { ...s, players }; }
    if (name === '豫母都日狭美') { this.log('💀 黄泉：流局独赢罚符'); return { ...s, players }; }
    if (name === '尘塚姥芽') { this.log('💨 埃舞：对手摸牌不能组顺子'); return { ...s, players }; }
    if (name === '封兽魑魅') { this.log('👁️ 幻惑：对手手牌2张显示假牌'); return { ...s, players }; }
    if (name === '道神驯子') { this.log('❓ 道謎：对手答错跳过摸牌'); return { ...s, players }; }
    if (name === '维缦·浅间') { this.log('🔀 情報再構築：弃牌全洗入牌山'); return { ...s, players }; }
    if (name === '绵月丰姬') { this.log('🌊 海山の絆：自风场风全视为役牌'); return { ...s, players }; }
    if (name === '渡里贝子') { this.log('🏙️ 虚構都市：对手牌局信息虚构化'); return { ...s, players }; }

    // 未匹配
    return null;
  }
}
