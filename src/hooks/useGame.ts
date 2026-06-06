import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tile, GameState } from '../game/types';
import { MeldType, GamePhase, WINDS } from '../game/types';
import { createInitialState, drawTile, discardTile, executeMeld, executeWin, nextTurn } from '../game/gameEngine';
import { aiChooseDiscard, aiChooseAction, aiDecideRiichi } from '../game/ai';
import { sameTile } from '../game/tiles';

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
  const stateRef = useRef(state);
  const aiTimerRef = useRef<number | null>(null);
  stateRef.current = state;

  const addMessage = useCallback((msg: string) => {
    setMessages(prev => [...prev.slice(-99), msg]);
  }, []);

  const updateDebug = useCallback((s: GameState, label: string) => {
    const cp = s.players[s.currentPlayer];
    setDebugInfo(
      `[${label}] 阶段:${s.phase} 玩家:${cp?.name}[${s.currentPlayer}] 牌山:${s.wall.length} 弃牌:${!!s.lastDiscard}`
    );
  }, []);

  // Process AI responses
  const processAiResponses = useCallback((s: GameState): GameState | null => {
    for (const wind of WINDS) {
      if (wind === s.currentPlayer) continue;
      const actions = s.actionsAvailable[wind];
      if (!actions) continue;
      const player = s.players[wind];
      if (player.isHuman) continue;

      const choice = aiChooseAction(s, wind);
      console.log(`[AI] ${player.name} wind=${wind} choice=${choice}`, 
        `ron:${actions.canRon} pon:${actions.canPon} chi:${actions.canChi}`);

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

    const delay = s.lastDiscard ? 400 : 600;
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
                  players: current.players.map((p, i) =>
                    i === current.currentPlayer ? { ...p, isRiichi: true } : p
                  ),
                };
                setState(() => discardTile(marked, tile.id));
              } else {
                setState(prev2 => discardTile(prev2, tile.id));
              }
            }
          }
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

            // 无人响应 → 下家摸牌
            setState(prev => nextTurn(prev));
          } else if (!cp.isHuman) {
            // AI回合有动作（非响应阶段）
            if (actions?.canTsumo) {
              setState(prev => executeWin(prev, prev.currentPlayer, true));
            } else {
              // 强制切换到打牌阶段
              setState(prev2 => ({ ...prev2, phase: GamePhase.DISCARDING }));
            }
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
    const newState = discardTile(s, tileId);
    if (newState !== s) {
      setState(newState);
      setSelectedTileId(null);
    }
  }, []);

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

      case 'ron':
        setState(prev => executeWin(prev, humanWind, false));
        addMessage('💥 荣和！');
        break;

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
          setState(prev => ({
            ...prev,
            players: prev.players.map((p, i) =>
              i === prev.currentPlayer ? { ...p, isRiichi: true } : p
            ),
          }));
          addMessage('⚡ 立直！');
        }
        break;

      // ---- 过牌（关键修复：使用函数式更新，从最新状态计算humanWind）----
      case 'pass':
        if (s.lastDiscard) {
          // 清除人类的所有响应动作，让游戏循环处理AI响应
          setState(prev => {
            const hWind = WINDS.find(w => prev.players[w].isHuman) ?? 0;
            return {
              ...prev,
              actionsAvailable: prev.actionsAvailable.map((a, i) =>
                i === hWind ? { ...EMPTY_ACTIONS } : a
              ),
            };
          });
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
    setMessages(['🎴 东方幻想麻雀 - 新游戏开始！', '摸牌中...']);
  }, []);

  return {
    state,
    humanDiscard,
    humanAction,
    newGame,
    nextHand: newGame,
    selectedTileId,
    setSelectedTileId,
    messages,
    isAiThinking,
    debugInfo,
  };
}
