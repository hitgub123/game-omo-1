// ============================================================
// 东方Project 日本麻将 - 核心类型定义
// ============================================================

/** 牌的花色 */
export enum TileSuit {
  MAN = 'm',   // 萬子 (1-9)
  PIN = 'p',   // 筒子 (1-9)
  SOU = 's',   // 索子 (1-9)
  HONOR = 'z', // 字牌 (1=东 2=南 3=西 4=北 5=白 6=发 7=中)
}

/** 一张牌 */
export interface Tile {
  id: number;       // 唯一 ID 0-135
  suit: TileSuit;
  value: number;    // 1-9 (数牌) / 1-7 (字牌)
}

/** 风圈/风位 */
export enum Wind {
  EAST = 0,
  SOUTH = 1,
  WEST = 2,
  NORTH = 3,
}

/** 副露（鸣牌）类型 */
export enum MeldType {
  CHI = 'chi',       // 吃
  PON = 'pon',       // 碰
  KAN = 'kan',       // 明杠（大明杠）
  KAKAN = 'kakan',   // 加杠
  ANKAN = 'ankan',   // 暗杠
}

/** 一个副露（面子） */
export interface Meld {
  type: MeldType;
  tiles: Tile[];
  from?: Wind;       // 从谁那里拿的牌
  calledTile: Tile;  // 被鸣的那张牌
}

/** 四个玩家的座位 */
export const SEAT_ORDER: Wind[] = [Wind.EAST, Wind.SOUTH, Wind.WEST, Wind.NORTH];

/** 玩家状态 */
export interface Player {
  name: string;
  wind: Wind;
  hand: Tile[];          // 手牌（门前清）
  melds: Meld[];         // 副露面子
  discards: Tile[];      // 河牌
  discardsSize: number;  // 河中牌张数（包括拔北等）
  isRiichi: boolean;     // 是否立直
  riichiDiscardIndex: number; // 立直时打出的牌在河中的位置
  score: number;
  isDealer: boolean;
  isHuman: boolean;
  tenpai: boolean;       // 是否听牌（用于流局）
  hasCalled: boolean;    // 是否鸣牌过（影响一发、门前清等）
}

/** 牌局阶段 */
export enum GamePhase {
  WAITING = 'waiting',
  DEALING = 'dealing',
  DRAWING = 'drawing',
  DISCARDING = 'discarding',
  ACTION_PROMPT = 'action_prompt',
  HAND_OVER = 'hand_over',
  GAME_OVER = 'game_over',
}

/** 吃牌的选项：用哪两张牌 + 组成顺子的牌 */
export interface ChiOption {
  tiles: [Tile, Tile];   // 手牌中用来吃的两张牌
  tile1: Tile;            // 吃后要打出的牌（如果手牌多于一张）
}

/** 玩家当前可做的动作 */
export interface AvailableActions {
  canChi: boolean;
  chiOptions: ChiOption[][]; // 按花色分组的吃牌选项
  canPon: boolean;
  canKan: boolean;        // 大明杠
  canRon: boolean;
  canTsumo: boolean;      // 自摸和
  canRiichi: boolean;     // 立直
  canAnkan: boolean;      // 暗杠
  canKakan: boolean;      // 加杠
  canNineOrphans: boolean; // 九种九牌（流局）
}

/** 役种信息 */
export interface YakuInfo {
  id: string;
  name: string;
  han: number;
  hanOpen?: number;      // 副露减一飜（部分役）
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
  basePoints: number;    // 基本点
  payments: { player: Wind; amount: number }[];
  winnerGets: number;
  isDealerWin: boolean;
  handTiles: Tile[];     // 和牌时的手牌（用于显示）
}

/** 一局的结果 */
export interface HandResult {
  type: 'tsumo' | 'ron' | 'draw' | 'chombo' | 'nagashi';
  winners?: Wind[];
  winResults?: WinResult[];
  drawReason?: string;
  tenpaiPlayers?: Wind[]; // 流局听牌者
  payments?: { from: Wind; to: Wind; amount: number }[];
}

/** 历史动作记录 */
export interface TurnAction {
  type: 'draw' | 'discard' | 'chi' | 'pon' | 'kan' | 'ankan' | 'kakan'
       | 'riichi' | 'ron' | 'tsumo' | 'pass' | 'nine_orphans';
  player: Wind;
  tile?: Tile;
  tiles?: Tile[];
}

/** 完整的牌局状态 */
export interface GameState {
  /** 牌山 */
  wall: Tile[];
  /** 王牌（杠宝牌指示牌区域） */
  deadWall: Tile[];
  /** 表宝牌指示牌 */
  doraIndicators: Tile[];
  /** 里宝牌指示牌（立直后揭晓） */
  uraDoraIndicators: Tile[];
  /** 四家 */
  players: Player[];
  /** 当前行动玩家 */
  currentPlayer: Wind;
  /** 回合数 */
  turn: number;
  /** 牌局阶段 */
  phase: GamePhase;
  /** 场风 */
  roundWind: Wind;
  /** 本场数 */
  honba: number;
  /** 立直棒累积 */
  riichiSticks: number;
  /** 上一次打出的牌 */
  lastDiscard?: Tile;
  /** 打出这张牌的玩家 */
  lastDiscardPlayer?: Wind;
  /** 杠的次数 */
  kanCount: number;
  /** 各玩家可做的动作 */
  actionsAvailable: AvailableActions[];
  /** 历史记录 */
  turnHistory: TurnAction[];
  /** 本局结果 */
  result?: HandResult;
  /** 庄家 */
  dealerIndex: Wind;
  /** 自摸摸到的牌（未加入手牌前暂存） */
  drawnTile?: Tile;
}

/** 角色定义 */
export interface TouhouCharacter {
  name: string;
  title: string;        // 称号
  color: string;        // 主题色
  colorLight: string;
  colorDark: string;
  description: string;
}

// ============================================================
// 常量
// ============================================================

export const TOTAL_TILES = 136;
export const HAND_SIZE = 13;
export const WALL_BREAK = 14;       // 王牌数量
export const DORA_AFTER_KAN = 1;    // 每杠增加一张宝牌指示牌

export const INITIAL_SCORE = 25000;
export const RIICHI_AMOUNT = 1000;

export const WIND_NAMES: Record<Wind, string> = {
  [Wind.EAST]: '东',
  [Wind.SOUTH]: '南',
  [Wind.WEST]: '西',
  [Wind.NORTH]: '北',
};

export const WINDS: Wind[] = [Wind.EAST, Wind.SOUTH, Wind.WEST, Wind.NORTH];

/** 数牌名称 */
export const TILE_NAMES: Record<string, string[]> = {
  m: ['一萬','二萬','三萬','四萬','五萬','六萬','七萬','八萬','九萬'],
  p: ['一筒','二筒','三筒','四筒','五筒','六筒','七筒','八筒','九筒'],
  s: ['一索','二索','三索','四索','五索','六索','七索','八索','九索'],
  z: ['東','南','西','北','白','發','中'],
};

/** 数牌简称（用于显示） */
export const TILE_SHORT_NAMES: Record<string, string[]> = {
  m: ['1m','2m','3m','4m','5m','6m','7m','8m','9m'],
  p: ['1p','2p','3p','4p','5p','6p','7p','8p','9p'],
  s: ['1s','2s','3s','4s','5s','6s','7s','8s','9s'],
  z: ['東','南','西','北','白','發','中'],
};

/** 东方角色配置 */
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
