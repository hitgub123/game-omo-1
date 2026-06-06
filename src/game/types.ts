// ============================================================
// 东方Project 日本麻将 - 核心类型定义
// ============================================================

/** 牌的花色 */
export const TileSuit = {
  MAN: 'm',
  PIN: 'p',
  SOU: 's',
  HONOR: 'z',
} as const;
export type TileSuit = (typeof TileSuit)[keyof typeof TileSuit];

/** 一张牌 */
export interface Tile {
  id: number;
  suit: TileSuit;
  value: number; // 1-9 (数牌) / 1-7 (字牌)
}

/** 风圈/风位 */
export const Wind = {
  EAST: 0,
  SOUTH: 1,
  WEST: 2,
  NORTH: 3,
} as const;
export type Wind = (typeof Wind)[keyof typeof Wind];

/** 副露类型 */
export const MeldType = {
  CHI: 'chi',
  PON: 'pon',
  KAN: 'kan',
  KAKAN: 'kakan',
  ANKAN: 'ankan',
} as const;
export type MeldType = (typeof MeldType)[keyof typeof MeldType];

/** 一个副露 */
export interface Meld {
  type: MeldType;
  tiles: Tile[];
  from?: Wind;
  calledTile: Tile;
}

/** 玩家状态 */
export interface Player {
  name: string;
  wind: Wind;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  discardsSize: number;
  isRiichi: boolean;
  riichiDiscardIndex: number;
  score: number;
  isDealer: boolean;
  isHuman: boolean;
  tenpai: boolean;
  hasCalled: boolean;
}

/** 牌局阶段 */
export const GamePhase = {
  WAITING: 'waiting',
  DEALING: 'dealing',
  DRAWING: 'drawing',
  DISCARDING: 'discarding',
  ACTION_PROMPT: 'action_prompt',
  HAND_OVER: 'hand_over',
  GAME_OVER: 'game_over',
} as const;
export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

/** 吃牌选项 */
export interface ChiOption {
  tiles: [Tile, Tile];
  tile1: Tile;
}

/** 玩家可做的动作 */
export interface AvailableActions {
  canChi: boolean;
  chiOptions: ChiOption[][];
  canPon: boolean;
  canKan: boolean;
  canRon: boolean;
  canTsumo: boolean;
  canRiichi: boolean;
  canAnkan: boolean;
  canKakan: boolean;
  canNineOrphans: boolean;
}

/** 役种信息 */
export interface YakuInfo {
  id: string;
  name: string;
  han: number;
  hanOpen?: number;
  isYakuman: boolean;
  isDoubleYakuman: boolean;
}

/** 和牌结果 */
export interface WinResult {
  player: Wind;
  winningTile: Tile;
  isTsumo: boolean;
  isRon: boolean;
  yaku: YakuInfo[];
  totalHan: number;
  fu: number;
  basePoints: number;
  payments: { player: Wind; amount: number }[];
  winnerGets: number;
  isDealerWin: boolean;
  handTiles: Tile[];
}

/** 一局结果 */
export interface HandResult {
  type: 'tsumo' | 'ron' | 'draw' | 'chombo' | 'nagashi';
  winners?: Wind[];
  winResults?: WinResult[];
  drawReason?: string;
  tenpaiPlayers?: Wind[];
  payments?: { from: Wind; to: Wind; amount: number }[];
}

/** 历史动作 */
export interface TurnAction {
  type: 'draw' | 'discard' | 'chi' | 'pon' | 'kan' | 'ankan' | 'kakan'
       | 'riichi' | 'ron' | 'tsumo' | 'pass' | 'nine_orphans';
  player: Wind;
  tile?: Tile;
  tiles?: Tile[];
}

/** 完整牌局状态 */
export interface GameState {
  wall: Tile[];
  deadWall: Tile[];
  doraIndicators: Tile[];
  uraDoraIndicators: Tile[];
  players: Player[];
  currentPlayer: Wind;
  turn: number;
  phase: GamePhase;
  roundWind: Wind;
  honba: number;
  riichiSticks: number;
  lastDiscard?: Tile;
  lastDiscardPlayer?: Wind;
  kanCount: number;
  actionsAvailable: AvailableActions[];
  turnHistory: TurnAction[];
  result?: HandResult;
  dealerIndex: Wind;
  drawnTile?: Tile;
}

/** 角色定义 */
export interface TouhouCharacter {
  name: string;
  title: string;
  color: string;
  colorLight: string;
  colorDark: string;
  description: string;
}

// ============================================================
// 常量
// ============================================================

export const INITIAL_SCORE = 25000;
export const RIICHI_AMOUNT = 1000;

export const WIND_NAMES: Record<Wind, string> = {
  [Wind.EAST]: '东',
  [Wind.SOUTH]: '南',
  [Wind.WEST]: '西',
  [Wind.NORTH]: '北',
};

export const WINDS: Wind[] = [Wind.EAST, Wind.SOUTH, Wind.WEST, Wind.NORTH];

export const TILE_DISPLAY: Record<string, string[]> = {
  m: ['一萬','二萬','三萬','四萬','五萬','六萬','七萬','八萬','九萬'],
  p: ['一筒','二筒','三筒','四筒','五筒','六筒','七筒','八筒','九筒'],
  s: ['一索','二索','三索','四索','五索','六索','七索','八索','九索'],
  z: ['東','南','西','北','白','發','中'],
};

export const TOUHOU_CHARACTERS: Record<Wind, TouhouCharacter> = {
  [Wind.EAST]: {
    name: '博丽灵梦',
    title: '巫女',
    color: '#E84057',
    colorLight: '#FF6B7A',
    colorDark: '#C62828',
    description: '博丽神社的巫女',
  },
  [Wind.SOUTH]: {
    name: '雾雨魔理沙',
    title: '魔法使',
    color: '#F5D442',
    colorLight: '#FFF176',
    colorDark: '#F9A825',
    description: '普通的魔法使',
  },
  [Wind.WEST]: {
    name: '十六夜咲夜',
    title: '女仆长',
    color: '#4A90D9',
    colorLight: '#7EB8F0',
    colorDark: '#1565C0',
    description: '红魔馆的女仆长',
  },
  [Wind.NORTH]: {
    name: '帕秋莉·诺蕾姬',
    title: '图书馆',
    color: '#9B59B6',
    colorLight: '#CE93D8',
    colorDark: '#6A1B9A',
    description: '知识与避世的少女',
  },
};
