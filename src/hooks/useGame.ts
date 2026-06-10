/**
 * useGame — React ↔ GameController 桥梁
 *
 * 职责：
 *  - 订阅 GameController 状态变更 → setState
 *  - 管理纯 UI 状态（选牌、消息、立直模式、换牌模式）
 *  - 委托游戏逻辑给 GameController
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tile, GameState } from '../game/types';
import { GamePhase, Wind, WINDS } from '../game/types';
import { tilesToHai } from '../game/hand';
import { checkMahjongStatus } from '../../utils/syanten.js';
import { GameController } from '../game/GameController';
import type { TenpaiInfo } from '../game/hand';
import type { DifficultyLevel } from '../game/difficulty';
import { GameLogger } from '../debug/GameLogger';

export interface GameControllerAPI {
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
  /** 当前难度 */
  difficulty: DifficultyLevel;
  /** 设置难度 */
  setDifficulty: (level: DifficultyLevel) => void;
  /** 下载游戏日志 (Ctrl+L) */
  downloadLog: () => void;
}

export function useGame(characters?: { name: string }[]): GameControllerAPI {
  const [state, setState] = useState<GameState>(() => createInitialState(characters));
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
  const [difficulty, setDifficultyState] = useState<DifficultyLevel>('easy');
  const ctrlRef = useRef<GameController | null>(null);
  const charsRef = useRef(characters);
  const loggerRef = useRef<GameLogger | null>(null);
  const lastStateRef = useRef(state);
  lastStateRef.current = state;

  // 首次挂载：创建控制器并订阅
  useEffect(() => {
    const ctrl = new GameController(charsRef.current);
    ctrlRef.current = ctrl;
    const logger = new GameLogger();
    loggerRef.current = logger;

    const unsubState = ctrl.subscribe((s) => {
      setState(s);
      logger.onStateChange(s);
    });
    const unsubMsg = ctrl.onMessage((msg) => {
      setMessages(prev => [...prev.slice(-99), msg]);
    });

    setIsAiThinking(true);
    const aiStateRef = { current: (() => {}) as () => void };
    const t = setTimeout(() => {
      ctrl.start();
      aiStateRef.current = ctrl.subscribe((s) => {
        setIsAiThinking(
          s.phase !== GamePhase.HAND_OVER &&
          s.phase !== GamePhase.GAME_OVER &&
          s.players[s.currentPlayer]?.isHuman === false
        );
      });
    }, 100);

    return () => {
      clearTimeout(t);
      ctrl.destroy();
      unsubState();
      unsubMsg();
    };
  }, []);

  // 更新 debug 信息
  useEffect(() => {
    const cp = state.players[state.currentPlayer];
    setDebugInfo(
      `[阶段:${state.phase}] 玩家:${cp?.name}[${state.currentPlayer}] 牌山:${state.wall.length} 摸牌:${!!state.drawnTile} 弃牌:${!!state.lastDiscard}`
    );
  }, [state.phase, state.currentPlayer, state.turn, state.wall.length, state.drawnTile, state.lastDiscard, state.players]);

  const humanDiscard = useCallback((tileId: number) => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return;

    // 立直模式
    if (riichiMode) {
      if (!riichiValidTileIds.has(tileId)) {
        setMessages(prev => [...prev.slice(-99), '该牌打出后不能听牌，请选择高亮的牌']);
        return;
      }
      ctrl.humanRiichiDiscard(tileId);
      setRiichiMode(false);
      setRiichiValidTileIds(new Map());
      setSelectedTileId(null);
      return;
    }

    ctrl.humanDiscard(tileId);
    setSelectedTileId(null);
  }, [riichiMode, riichiValidTileIds]);

  const humanAction = useCallback((action: string, _tiles?: Tile[]) => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return;

    if (action === 'riichi') {
      const s = ctrl.state;
      const humanWind = WINDS.find(w => s.players[w].isHuman) ?? 0;
      const actions = s.actionsAvailable[humanWind];
      if (!actions) return;
      // 允许和牌形下立直（打一张牌放弃自摸）
      if (actions.canRiichi || actions.canTsumo) {
        const humanHand = s.players[humanWind].hand;
        const validMap = new Map<number, TenpaiInfo>();

        if (actions.canRiichi) {
          const hai = tilesToHai(humanHand);
          const engResult = checkMahjongStatus(hai);
          if (typeof engResult === 'object' && engResult.status === 0) {
            for (const sol of engResult.info || []) {
              if (sol.discard === 'none') continue;
              const tile = humanHand.find(t => `${t.value}${t.suit}` === sol.discard);
              if (!tile || validMap.has(tile.id)) continue;
              validMap.set(tile.id, {
                waitTiles: (sol.waits || []).map((k: string) => {
                  const s = k.slice(-1) as import('../game/types').TileSuit;
                  return { id: -1, suit: s, value: parseInt(k.slice(0, -1)) };
                }),
                divisions: [],
              });
            }
          }
          // 和牌形（エンジン返回-1）：任意打一张都听牌
          if (engResult === -1) {
            for (const tile of humanHand) {
              // 去掉这张牌后计算听什么
              const remaining = humanHand.filter(t => t.id !== tile.id);
              const remHai = tilesToHai(remaining);
              const remResult = checkMahjongStatus(remHai);
              const waits: Tile[] = [];
              if (typeof remResult === 'object' && remResult.status === 0) {
                for (const sol of remResult.info || []) {
                  if (sol.discard === 'none') continue; // tenpai
                  for (const w of (sol.waits || [])) {
                    const s = w.slice(-1) as import('../game/types').TileSuit;
                    waits.push({ id: -1, suit: s, value: parseInt(w.slice(0, -1)) });
                  }
                }
              }
              if (!validMap.has(tile.id)) {
                validMap.set(tile.id, { waitTiles: waits, divisions: [] });
              }
            }
            setMessages(prev => [...prev.slice(-99), `⚡ 和牌形立直，共${validMap.size}张可打`]);
          }
        } else {
          // 和牌形立直：任意打一张都是听牌
          for (const tile of humanHand) {
            validMap.set(tile.id, {
              waitTiles: [],
              divisions: [],
            });
          }
          setMessages(prev => [...prev.slice(-99), '⚡ 和牌形立直，打一张牌弃和']);
        }

        if (validMap.size > 0) {
          setRiichiMode(true);
          setRiichiValidTileIds(validMap);
        }
      }
      return;
    }

    ctrl.humanAction(action, _tiles);
  }, []);

  const newGame = useCallback(() => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    ctrl.newGame();
    loggerRef.current?.reset();
    setSelectedTileId(null);
    setSwapMode(false);
    setSwapSourceTileId(null);
    setRiichiMode(false);
    setRiichiValidTileIds(new Map());
    setMessages(['🎴 东方幻想麻雀 - 新游戏开始！', '摸牌中...']);
  }, []);

  const nextHandFn = useCallback(() => {
    ctrlRef.current?.nextHand();
    setSelectedTileId(null);
    setSwapMode(false);
    setSwapSourceTileId(null);
    setRiichiMode(false);
    setRiichiValidTileIds(new Map());
  }, []);

  const enterSwapMode = useCallback((tileId: number) => {
    setSwapMode(true);
    setSwapSourceTileId(tileId);
    setMessages(prev => [...prev.slice(-99), '请从牌山选择一张牌来交换']);
  }, []);

  const cancelSwap = useCallback(() => {
    setSwapMode(false);
    setSwapSourceTileId(null);
  }, []);

  const executeSwap = useCallback((wallTileKey: string) => {
    const ctrl = ctrlRef.current;
    if (!ctrl || swapSourceTileId === null) return;
    if (ctrl.state.phase !== GamePhase.DISCARDING && ctrl.state.phase !== GamePhase.ACTION_PROMPT) {
      setMessages(prev => [...prev.slice(-99), '现在不是你的回合，无法换牌']);
      cancelSwap();
      return;
    }
    if (ctrl.state.currentPlayer !== Wind.EAST) {
      setMessages(prev => [...prev.slice(-99), '现在不是你的回合，无法换牌']);
      cancelSwap();
      return;
    }
    if (ctrl.executeSwap(swapSourceTileId, wallTileKey)) {
      setMessages(prev => [...prev.slice(-99), '🔄 换牌成功']);
    } else {
      setMessages(prev => [...prev.slice(-99), '牌山中找不到该牌']);
    }
    cancelSwap();
  }, [swapSourceTileId, cancelSwap]);

  const cancelRiichi = useCallback(() => {
    setRiichiMode(false);
    setRiichiValidTileIds(new Map());
    setSelectedTileId(null);
  }, []);

  const setDifficulty = useCallback((level: DifficultyLevel) => {
    const ctrl = ctrlRef.current;
    if (ctrl) ctrl.setDifficulty(level);
    setDifficultyState(level);
  }, []);

  const downloadLog = useCallback(() => {
    loggerRef.current?.download();
  }, []);

  return {
    state, humanDiscard, humanAction, newGame,
    nextHand: nextHandFn,
    selectedTileId, setSelectedTileId,
    messages, isAiThinking, debugInfo,
    swapMode, swapSourceTileId, enterSwapMode, executeSwap, cancelSwap,
    riichiMode, riichiValidTileIds, cancelRiichi,
    difficulty, setDifficulty,
    downloadLog,
  };
}

/** useGame 内使用了导入的 createInitialState；此处声明供初始状态使用 */
function createInitialState(): GameState {
  // 占位状态，GameController 启动后会覆盖
  return {
    wall: [], deadWall: [], doraIndicators: [], uraDoraIndicators: [],
    players: [
      { name: '—', wind: 0 as Wind, hand: [], melds: [], discards: [], discardsSize: 0,
        isRiichi: false, isDoubleRiichi: false, riichiDiscardIndex: -1, riichiTurnStart: -1,
        score: 0, isDealer: true, isHuman: true, tenpai: false, hasCalled: false, restrictedDiscardKeys: [] },
      { name: '—', wind: 1 as Wind, hand: [], melds: [], discards: [], discardsSize: 0,
        isRiichi: false, isDoubleRiichi: false, riichiDiscardIndex: -1, riichiTurnStart: -1,
        score: 0, isDealer: false, isHuman: false, tenpai: false, hasCalled: false, restrictedDiscardKeys: [] },
      { name: '—', wind: 2 as Wind, hand: [], melds: [], discards: [], discardsSize: 0,
        isRiichi: false, isDoubleRiichi: false, riichiDiscardIndex: -1, riichiTurnStart: -1,
        score: 0, isDealer: false, isHuman: false, tenpai: false, hasCalled: false, restrictedDiscardKeys: [] },
      { name: '—', wind: 3 as Wind, hand: [], melds: [], discards: [], discardsSize: 0,
        isRiichi: false, isDoubleRiichi: false, riichiDiscardIndex: -1, riichiTurnStart: -1,
        score: 0, isDealer: false, isHuman: false, tenpai: false, hasCalled: false, restrictedDiscardKeys: [] },
    ],
    currentPlayer: 0 as Wind, turn: 0,
    phase: 'waiting' as GamePhase, roundWind: 0 as Wind,
    honba: 0, riichiSticks: 0, kanCount: 0,
    actionsAvailable: [], turnHistory: [], dealerIndex: 0 as Wind,
    handCount: 0, furitenPlayers: [],
  };
}