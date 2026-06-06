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
}

export function useGame(): GameController {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [messages, setMessages] = useState<string[]>([
    '🎴 东方幻想麻雀 - 新游戏开始！',
    '摸牌中...',
  ]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const stateRef = useRef(state);
  const aiTimerRef = useRef<number | null>(null);
  stateRef.current = state;

  const addMessage = useCallback((msg: string) => {
    setMessages(prev => [...prev.slice(-99), msg]);
  }, []);

  // Process AI responses to a discard
  const processAiResponses = useCallback((s: GameState): GameState | null => {
    for (const wind of WINDS) {
      if (wind === s.currentPlayer) continue;
      const actions = s.actionsAvailable[wind];
      if (!actions) continue;
      const player = s.players[wind];
      if (player.isHuman) continue;

      const choice = aiChooseAction(s, wind);
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
        const validTiles = player.hand.filter(t =>
          t.suit === s.lastDiscard!.suit &&
          Math.abs(t.value - s.lastDiscard!.value) <= 2 &&
          t.value !== s.lastDiscard!.value
        );
        if (validTiles.length >= 2) {
          addMessage(`🟢 ${player.name} 吃！`);
          return executeMeld(s, wind, MeldType.CHI, validTiles.slice(0, 2));
        }
      }
    }
    return null;
  }, [addMessage]);

  // Game loop
  const processGameState = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.phase === GamePhase.HAND_OVER || s.phase === GamePhase.GAME_OVER) return;
    if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current);

    aiTimerRef.current = window.setTimeout(() => {
      const current = stateRef.current;
      if (!current || current.phase === GamePhase.HAND_OVER || current.phase === GamePhase.GAME_OVER) {
        setIsAiThinking(false); return;
      }
      setIsAiThinking(true);

      try {
        // DRAWING phase
        if (current.phase === GamePhase.DRAWING) {
          setState(prev => drawTile(prev));
          setIsAiThinking(false); return;
        }

        // DISCARDING phase
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

        // ACTION_PROMPT phase
        if (current.phase === GamePhase.ACTION_PROMPT) {
          const cp = current.players[current.currentPlayer];
          const actions = current.actionsAvailable[current.currentPlayer];

          // Post-draw actions for human (tsumo/riichi/ankan)
          if (cp.isHuman && actions && (actions.canTsumo || actions.canRiichi || actions.canAnkan || actions.canKakan) && !current.lastDiscard) {
            setIsAiThinking(false); return;
          }

          // Process discard responses
          if (current.lastDiscard) {
            // 检查人类玩家是否有任何响应动作（荣和/碰/吃/杠）
            const humanHasResponse = WINDS.some(w =>
              current.players[w].isHuman && (
                current.actionsAvailable[w]?.canRon ||
                current.actionsAvailable[w]?.canPon ||
                current.actionsAvailable[w]?.canChi ||
                current.actionsAvailable[w]?.canKan
              )
            );
            if (humanHasResponse) { setIsAiThinking(false); return; }

            const result = processAiResponses(current);
            if (result) { setState(result); setIsAiThinking(false); return; }

            setState(prev => nextTurn(prev));
          } else if (!cp.isHuman) {
            if (actions?.canTsumo) {
              setState(prev => executeWin(prev, prev.currentPlayer, true));
            } else if (actions?.canRiichi && aiDecideRiichi(cp.hand, current, current.currentPlayer)) {
              // Already handled in DISCARDING
            } else {
              // Need to discard
              setState(prev2 => ({ ...prev2, phase: GamePhase.DISCARDING }));
            }
          }
        }
      } catch (e) {
        console.error('Game loop:', e);
      }
      setIsAiThinking(false);
    }, s.lastDiscard ? 600 : 800);
  }, [addMessage, processAiResponses]);

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
    if (!cp?.isHuman) return;
    if (s.phase !== GamePhase.DISCARDING && s.phase !== GamePhase.ACTION_PROMPT) return;
    const newState = discardTile(s, tileId);
    if (newState !== s) { setState(newState); setSelectedTileId(null); }
  }, []);

  // Human action (tsumo/ron/pon/chi/kan/riichi/pass)
  const humanAction = useCallback((action: string, _tiles?: Tile[]) => {
    const s = stateRef.current;
    const humanWind = WINDS.find(w => s.players[w].isHuman) ?? 0;

    switch (action) {
      case 'tsumo':
        if (s.actionsAvailable[humanWind]?.canTsumo) {
          setState(prev => executeWin(prev, humanWind, true));
          addMessage('🎉 自摸和牌！');
        }
        break;

      // ---- 荣和（响应弃牌） ----
      case 'ron':
        // 荣和：用人类的风位，因为响应者可能不是当前玩家
        setState(prev => executeWin(prev, humanWind, false));
        addMessage('💥 荣和！');
        break;

      // ---- 碰 ----
      case 'pon':
        if (s.lastDiscard) {
          const matching = s.players[humanWind].hand.filter(t => sameTile(t, s.lastDiscard!));
          if (matching.length >= 2) {
            setState(prev => executeMeld(prev, humanWind, MeldType.PON, matching.slice(0, 2)));
            addMessage('🔴 碰！');
          }
        }
        break;

      // ---- 吃 ----
      case 'chi':
        if (s.lastDiscard) {
          // 简单吃：用相邻的牌
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

      // ---- 大明杠 ----
      case 'kan':
        if (s.lastDiscard) {
          const matching = s.players[humanWind].hand.filter(t => sameTile(t, s.lastDiscard!));
          if (matching.length >= 3) {
            setState(prev => executeMeld(prev, humanWind, MeldType.KAN, matching.slice(0, 3)));
            addMessage('🔵 杠！');
          }
        }
        break;

      // ---- 暗杠 ----
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

      // ---- 加杠 ----
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

      // ---- 立直 ----
      case 'riichi':
        if (s.actionsAvailable[s.currentPlayer]?.canRiichi) {
          setState(prev => ({
            ...prev,
            players: prev.players.map((p, i) =>
              i === prev.currentPlayer ? { ...p, isRiichi: true } : p
            ),
          }));
          addMessage('⚡ 立直！');
        }
        break;

      // ---- 过（不进行任何操作） ----
      case 'pass':
        if (s.lastDiscard) {
          // 响应阶段过牌：清除人类动作，让游戏循环处理AI的响应
          setState(prev => ({
            ...prev,
            actionsAvailable: prev.actionsAvailable.map((a, i) =>
              i === humanWind ? {
                canChi: false, chiOptions: [], canPon: false, canKan: false,
                canRon: false, canTsumo: false, canRiichi: false, canAnkan: false,
                canKakan: false, canNineOrphans: false,
              } : a
            ),
          }));
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
  };
}
