import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tile, GameState } from '../game/types';
import { MeldType, GamePhase, TileSuit, Wind, WINDS } from '../game/types';
import { createInitialState, drawTile, discardTile, executeMeld, executeWin, nextTurn, createNextHand } from '../game/gameEngine';
import { aiChooseDiscard, aiChooseAction, aiDecideRiichi } from '../game/ai';
import { sameTile, sortHand } from '../game/tiles';
import { findTenpaiDiscards, tilesToHai } from '../game/hand';
import { checkMahjongStatus } from '../../utils/syanten.js';
import { isWinningHand } from '../game/hand';
import type { TenpaiInfo } from '../game/hand';

export interface GameController {
  state: GameState;
  humanDiscard: (tileId: number) => void;
  humanAction: (action: string, tiles?: Tile[]) => void;
  newGame: () => void;
  nextHand: () => void;
  selectedTileId: number | null;
  setSelectedTileId: (id: number | null) => void;
  messages: string[];
  isAiThinking: boolean;
  debugInfo: string;
  swapMode: boolean;
  swapSourceTileId: number | null;
  enterSwapMode: (tileId: number) => void;
  executeSwap: (wallTileKey: string) => void;
  cancelSwap: () => void;
  riichiMode: boolean;
  riichiValidTileIds: Map<number, TenpaiInfo>;
  cancelRiichi: () => void;
}

// 空动作（用于清除）
const EMPTY_ACTIONS = {
  canChi: false, chiOptions: [], canPon: false, canKan: false,
  canRon: false, canTsumo: false, canRiichi: false, canAnkan: false,
  canKakan: false, canNineOrphans: false,
};

export function useGame(): GameController {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [messages, setMessages] = useState<string[]>([
    '🎴 东方幻想麻雀 - 新游戏开始！',
    '摸牌中...',
  ]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [swapMode, setSwapMode] = useState(false);
  const [swapSourceTileId, setSwapSourceTileId] = useState<number | null>(null);
  const [riichiMode, setRiichiMode] = useState(false);
  const [riichiValidTileIds, setRiichiValidTileIds] = useState<Map<number, TenpaiInfo>>(new Map());
  const stateRef = useRef(state);
  const aiTimerRef = useRef<number | null>(null);
  stateRef.current = state;

  const addMessage = useCallback((msg: string) => {
    setMessages(prev => [...prev.slice(-99), msg]);
  }, []);

  const updateDebug = useCallback((s: GameState, label: string) => {
    const cp = s.players[s.currentPlayer];
    const info = `[${label}] 阶段:${s.phase} 玩家:${cp?.name}[${s.currentPlayer}] 牌山:${s.wall.length} 摸牌:${!!s.drawnTile} 弃牌:${!!s.lastDiscard}`;
    setDebugInfo(info);
    console.log(`%c${info}`, 'color:#42a5f5');
  }, []);

  // Process AI responses
  const processAiResponses = useCallback((s: GameState): GameState | null => {
    console.log(`[AI-RESP] 开始检查响应 lastDiscard:${!!s.lastDiscard} discPlayer:${s.lastDiscardPlayer} currentPlayer:${s.currentPlayer}`);
    for (const wind of WINDS) {
      if (wind === s.currentPlayer) continue;
      const actions = s.actionsAvailable[wind];
      if (!actions) continue;
      const player = s.players[wind];
      if (player.isHuman) continue;

      const choice = aiChooseAction(s, wind);
      console.log(`[AI-RESP] ${player.name} wind=${wind} choice=${choice}`, 
        `ron:${actions.canRon} pon:${actions.canPon} chi:${actions.canChi} kan:${actions.canKan}`);

      if (choice === 'ron' && actions.canRon) {
        return executeWin(s, wind, false);
      }
      if (choice === 'pon' && actions.canPon && s.lastDiscard) {
        const matching = player.hand.filter(t => sameTile(t, s.lastDiscard!));
        if (matching.length >= 2) {
          addMessage(`🔴 ${player.name} 碰！`);
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
          addMessage(`🟢 ${player.name} 吃！`);
          return executeMeld(s, wind, MeldType.CHI, valid.slice(0, 2));
        }
      }
      // 如果AI过牌，继续检查下一个玩家
    }
    return null;
  }, [addMessage]);

  // Game loop
  const processGameState = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.phase === GamePhase.HAND_OVER || s.phase === GamePhase.GAME_OVER) {
      updateDebug(s || stateRef.current, 'END');
      return;
    }
    updateDebug(s, 'LOOP');
    if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current);

    const delay = s.lastDiscard ? 400 : (s.players[s.currentPlayer]?.isHuman ? 10 : 600);
    aiTimerRef.current = window.setTimeout(() => {
      const current = stateRef.current;
      if (!current || current.phase === GamePhase.HAND_OVER || current.phase === GamePhase.GAME_OVER) {
        setIsAiThinking(false); return;
      }
      setIsAiThinking(true);

      try {
        // ---- DRAWING: 任意玩家摸牌 ----
        if (current.phase === GamePhase.DRAWING) {
          setState(prev => drawTile(prev));
          setIsAiThinking(false); return;
        }

        // ---- DISCARDING ----
        if (current.phase === GamePhase.DISCARDING) {
          const cp = current.players[current.currentPlayer];
          if (!cp.isHuman) {
            const tile = aiChooseDiscard(cp.hand, undefined, current, current.currentPlayer);
            if (tile) {
              const riichiOk = current.actionsAvailable[current.currentPlayer]?.canRiichi;
              if (riichiOk && aiDecideRiichi(cp.hand, current, current.currentPlayer)) {
                addMessage(`⚡ ${cp.name} 立直！`);
                const marked = {
                  ...current,
                  riichiSticks: current.riichiSticks + 1,
                  players: current.players.map((p, i) =>
                    i === current.currentPlayer
                      ? { ...p, isRiichi: true, score: p.score - 1000 }
                      : p
                  ),
                };
                setState(() => discardTile(marked, tile.id));
              } else {
                setState(prev2 => discardTile(prev2, tile.id));
              }
            }
          } else if (cp.isRiichi && current.drawnTile) {
            console.log('[TSUMOGIRI]', cp.name, '自摸切', current.drawnTile.suit + current.drawnTile.value);
            setState(prev2 => discardTile(prev2, current.drawnTile!.id));
          } else if (cp.isRiichi) {
            console.log('[TSUMOGIRI-FAIL]', cp.name, '无 drawnTile', 'phase:', current.phase);
          }
          // 非立直人类等待双击出牌
          setIsAiThinking(false); return;
        }

        // ---- ACTION_PROMPT ----
        if (current.phase === GamePhase.ACTION_PROMPT) {
          const cp = current.players[current.currentPlayer];
          const actions = current.actionsAvailable[current.currentPlayer];
          const humanWind = WINDS.find(w => current.players[w].isHuman) ?? 0;
          const humanActions = current.actionsAvailable[humanWind];

          // 情况1: 人类有摸牌后动作（自摸/立直/暗杠）
          if (cp.isHuman && actions && !current.lastDiscard &&
              (actions.canTsumo || actions.canRiichi || actions.canAnkan || actions.canKakan)) {
            setIsAiThinking(false); return;
          }

          // 情况2: 人类的响应阶段（有人弃牌）
          if (current.lastDiscard) {
            const humanHasAction = humanActions && (
              humanActions.canRon || humanActions.canPon ||
              humanActions.canChi || humanActions.canKan
            );

            if (humanHasAction && current.players[humanWind].isHuman) {
              // 人类有响应选项，等待UI
              updateDebug(current, 'WAIT_HUMAN_RESPONSE');
              setIsAiThinking(false); return;
            }

            // 处理AI响应
            const result = processAiResponses(current);
            if (result) {
              setState(result);
              setIsAiThinking(false); return;
            }

            // 无人响应 → AI 能荣和但选择过 → 振听
            let nextState = current;
            for (const w of WINDS) {
              if (w !== current.currentPlayer && !current.players[w].isHuman) {
                if (current.actionsAvailable[w]?.canRon) {
                  if (!nextState.furitenPlayers.includes(w)) {
                    nextState = { ...nextState, furitenPlayers: [...nextState.furitenPlayers, w] };
                    console.log(`[FURITEN] ${current.players[w].name} 见逃，振听`);
                  }
                }
              }
            }
            setState(() => nextTurn(nextState));
          } else if (!cp.isHuman) {
            // AI回合有动作（非响应阶段）
            if (actions?.canTsumo) {
              setState(prev => executeWin(prev, prev.currentPlayer, true));
            } else {
              // 强制切换到打牌阶段
              setState(prev2 => ({ ...prev2, phase: GamePhase.DISCARDING }));
            }
          } else {
            // 人类无特殊动作 → 强制进入打牌阶段
            setState(prev2 => ({ ...prev2, phase: GamePhase.DISCARDING }));
          }
        }
      } catch (e) {
        console.error('Game loop error:', e);
      }
      setIsAiThinking(false);
    }, delay);
  }, [addMessage, processAiResponses, updateDebug]);

  useEffect(() => {
    processGameState();
    return () => {
      if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current);
    };
  }, [state.phase, state.currentPlayer, state.turn, processGameState]);

  // Human discard
  const humanDiscard = useCallback((tileId: number) => {
    const s = stateRef.current;
    const cp = s.players[s.currentPlayer];
    if (!cp?.isHuman) {
      console.warn('[DISCARD] Not human turn', s.currentPlayer);
      return;
    }
    if (s.phase !== GamePhase.DISCARDING && s.phase !== GamePhase.ACTION_PROMPT) {
      console.warn('[DISCARD] Wrong phase', s.phase);
      return;
    }

    // 立直模式：检查预计算的有效牌
    if (riichiMode) {
      if (!riichiValidTileIds.has(tileId)) {
        addMessage('该牌打出后不能听牌，请选择高亮的牌');
        return;
      }
      // 设置立直状态并打出
      setState(prev => {
        const marked = {
          ...prev,
          phase: GamePhase.DISCARDING,
          riichiSticks: prev.riichiSticks + 1,
          players: prev.players.map((p, i) =>
            i === prev.currentPlayer
              ? { ...p, isRiichi: true, score: p.score - 1000 }
              : p
          ),
        };
        return discardTile(marked, tileId);
      });
      setRiichiMode(false);
      setRiichiValidTileIds(new Map());
      setSelectedTileId(null);
      return;
    }

    if (cp.isRiichi && s.drawnTile && tileId !== s.drawnTile.id) {
      addMessage('立直后只能打刚摸到的牌（自摸切）');
      return;
    }
    const newState = discardTile(s, tileId);
    if (newState !== s) {
      setState(newState);
      setSelectedTileId(null);
    }
  }, [riichiMode, riichiValidTileIds, addMessage]);

  // Human action
  const humanAction = useCallback((action: string, _tiles?: Tile[]) => {
    const s = stateRef.current;
    const humanWind = WINDS.find(w => s.players[w].isHuman) ?? 0;
    console.log('[ACTION]', action, 'humanWind=', humanWind, 'phase=', s.phase, 'lastDiscard=', !!s.lastDiscard);

    switch (action) {
      case 'tsumo':
        if (s.actionsAvailable[humanWind]?.canTsumo) {
          setState(prev => executeWin(prev, humanWind, true));
          addMessage('🎉 自摸和牌！');
        }
        break;

      case 'ron': {
        const hWind = humanWind;
        setState(prev => {
          const next = executeWin(prev, hWind, false);
          return next;
        });
        // Check result after state update via stateRef
        setTimeout(() => {
          if (stateRef.current?.phase === GamePhase.HAND_OVER) {
            addMessage('💥 荣和！');
          }
        }, 0);
        break;
      }

      case 'pon':
        if (s.lastDiscard) {
          const matching = s.players[humanWind].hand.filter(t => sameTile(t, s.lastDiscard!));
          if (matching.length >= 2) {
            setState(prev => executeMeld(prev, humanWind, MeldType.PON, matching.slice(0, 2)));
            addMessage('🔴 碰！');
          }
        }
        break;

      case 'chi':
        if (s.lastDiscard) {
          const valid = s.players[humanWind].hand.filter(t =>
            t.suit === s.lastDiscard!.suit &&
            Math.abs(t.value - s.lastDiscard!.value) <= 2 &&
            t.value !== s.lastDiscard!.value
          );
          if (valid.length >= 2) {
            setState(prev => executeMeld(prev, humanWind, MeldType.CHI, valid.slice(0, 2)));
            addMessage('🟢 吃！');
          }
        }
        break;

      case 'kan':
        if (s.lastDiscard) {
          const matching = s.players[humanWind].hand.filter(t => sameTile(t, s.lastDiscard!));
          if (matching.length >= 3) {
            setState(prev => executeMeld(prev, humanWind, MeldType.KAN, matching.slice(0, 3)));
            addMessage('🔵 杠！');
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
            setState(prev => executeMeld(prev, prev.currentPlayer, MeldType.ANKAN, gtiles.slice(0, 4)));
            addMessage('🔵 暗杠！');
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
              setState(prev => executeMeld(prev, prev.currentPlayer, MeldType.KAKAN, [extra]));
              addMessage('🔵 加杠！');
              break;
            }
          }
        }
        break;

      case 'riichi':
        if (s.actionsAvailable[humanWind]?.canRiichi) {
          const humanHand = s.players[humanWind].hand;
          const hai = tilesToHai(humanHand);
          const validMap = new Map<number, import('../game/hand').TenpaiInfo>();
          // checkMahjongStatus(14张) 直接返回所有可打牌和等待牌
          const engResult = checkMahjongStatus(hai);
          if (typeof engResult === 'object' && engResult.status === 0) {
            for (const sol of engResult.info || []) {
              if (sol.discard === 'none') continue;
              const tile = humanHand.find(t => `${t.value}${t.suit}` === sol.discard);
              if (!tile || validMap.has(tile.id)) continue;
              validMap.set(tile.id, {
                waitTiles: (sol.waits || []).map((k: string) => {
                  const s = k.slice(-1) as import('../game/types').TileSuit;
                  return { id: -1, suit: s, value: parseInt(k.slice(0,-1)) };
                }),
                divisions: [],
              });
            }
          }
          setRiichiMode(true);
          setRiichiValidTileIds(validMap);
          addMessage(`⚡ 双击高亮牌立直（共${validMap.size}张可打）`);
        }
        break;

      // ---- 过牌（关键修复：使用函数式更新，从最新状态计算humanWind）----
      case 'pass':
        if (s.lastDiscard) {
          const hWind = WINDS.find(w => s.players[w].isHuman) ?? 0;
          const humanActions = s.actionsAvailable[hWind];
          // 能荣和但选择过 → 振听
          if (humanActions?.canRon) {
            addMessage(s.players[hWind].isRiichi ? '立直后见逃，永久振听' : '见逃，临时振听');
          }
          // 清除人类动作，然后直接处理 AI 响应（不等 effect 重跑）
          const cleared = {
            ...s,
            furitenPlayers: humanActions?.canRon
              ? [...new Set([...s.furitenPlayers, hWind])]
              : s.furitenPlayers,
            actionsAvailable: s.actionsAvailable.map((a, i) =>
              i === hWind ? { ...EMPTY_ACTIONS } : a
            ),
          };
          const aiResult = processAiResponses(cleared);
          if (aiResult) {
            setState(aiResult);
          } else {
            setState(nextTurn(cleared));
          }
        } else {
          setState(prev => nextTurn(prev));
        }
        break;
    }
  }, [addMessage]);

  const newGame = useCallback(() => {
    if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current);
    setState(createInitialState());
    setSelectedTileId(null);
    setSwapMode(false);
    setSwapSourceTileId(null);
    setMessages(['🎴 东方幻想麻雀 - 新游戏开始！', '摸牌中...']);
  }, []);

  const nextHandFn = useCallback(() => {
    if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current);
    const s = stateRef.current;
    if (s.players.some(p => p.score < 0) || s.handCount >= 7) {
      setState(createInitialState());
      setSelectedTileId(null);
      setMessages(prev => [...prev.slice(-5), '🔄 有人负分，开始新游戏', '摸牌中...']);
    } else {
      setState(prev => createNextHand(prev));
      setSelectedTileId(null);
      setMessages(prev => [...prev.slice(-5), '🔄 下一局...', '摸牌中...']);
    }
    setSwapMode(false);
    setSwapSourceTileId(null);
  }, []);

  // ---- 换牌功能（右键菜单） ----
  const enterSwapMode = useCallback((tileId: number) => {
    setSwapMode(true);
    setSwapSourceTileId(tileId);
    addMessage('请从牌山选择一张牌来交换');
  }, [addMessage]);

  const cancelSwap = useCallback(() => {
    setSwapMode(false);
    setSwapSourceTileId(null);
  }, []);

  const executeSwap = useCallback((wallTileKey: string) => {
    const s = stateRef.current;
    if (swapSourceTileId === null) {
      addMessage('请先右键点击要交换的手牌');
      return;
    }
    if (s.phase !== GamePhase.DISCARDING && s.phase !== GamePhase.ACTION_PROMPT) {
      addMessage('现在不是你的回合，无法换牌');
      cancelSwap();
      return;
    }
    if (s.currentPlayer !== Wind.EAST) {
      addMessage('现在不是你的回合，无法换牌');
      cancelSwap();
      return;
    }
    const suit = wallTileKey[0] as TileSuit;
    const value = parseInt(wallTileKey[1]);
    const wallTile = s.wall.find(t => t.suit === suit && t.value === value);
    if (!wallTile) {
      addMessage('牌山中找不到该牌');
      cancelSwap();
      return;
    }
    const srcId = swapSourceTileId;
    setState(prev => {
      const oldTile = prev.players[Wind.EAST].hand.find(t => t.id === srcId);
      if (!oldTile) return prev;
      const newHand = prev.players[Wind.EAST].hand.filter(t => t.id !== srcId);

      const newWall = [...prev.wall];
      const wallIdx = newWall.findIndex(t => t.suit === suit && t.value === value);
      if (wallIdx === -1) return prev;
      const newTile = newWall.splice(wallIdx, 1)[0];
      newWall.push(oldTile); // 换出的手牌放回牌山
      const sortedHand = sortHand([...newHand, newTile]);

      const newPlayers = prev.players.map(p => ({ ...p, hand: [...p.hand] }));
      newPlayers[Wind.EAST].hand = sortedHand;

      const newActions = prev.actionsAvailable.map(a => ({ ...a }));
      const canWinNow = isWinningHand(sortedHand);
      newActions[Wind.EAST] = {
        ...newActions[Wind.EAST],
        canRiichi: canWinNow ? false : findTenpaiDiscards(sortedHand, []).size > 0,
        canTsumo: canWinNow,
        canAnkan: sortedHand.some((t, _, arr) => arr.filter(x => x.suit === t.suit && x.value === t.value).length >= 4),
      };

      addMessage(canWinNow ? '🔄 换牌完成 — 和牌！' : '🔄 换牌完成');
      return {
        ...prev,
        wall: newWall,
        players: newPlayers,
        actionsAvailable: newActions,
        drawnTile: newTile,
        phase: canWinNow ? GamePhase.ACTION_PROMPT : GamePhase.DISCARDING,
      };
    });
    setSwapMode(false);
    setSwapSourceTileId(null);
  }, [swapSourceTileId, addMessage, cancelSwap]);

  const cancelRiichi = useCallback(() => {
    setRiichiMode(false);
    setRiichiValidTileIds(new Map());
    addMessage('取消立直');
  }, [addMessage]);

  return {
    state,
    humanDiscard,
    humanAction,
    newGame,
    nextHand: nextHandFn,
    selectedTileId,
    setSelectedTileId,
    messages,
    isAiThinking,
    debugInfo,
    swapMode,
    swapSourceTileId,
    enterSwapMode,
    executeSwap,
    cancelSwap,
    riichiMode,
    riichiValidTileIds,
    cancelRiichi,
  };
}
