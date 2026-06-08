/**
 * difficulty.ts — AI 难度配置
 *
 * 四个难度级别（东方Project 惯例）：
 *   Easy    = 初学者水平，经常犯错
 *   Normal  = 一般玩家，偶尔犯错
 *   Hard    = 强手，基本不犯错
 *   Lunatic = 顶级，最优决策
 *
 * 每个函数接收 DifficultyConfig 参数，根据配置动态调整行为。
 * 难度逻辑不写死在 AI 函数内部，而是通过配置参数控制。
 */

export type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'lunatic';

export interface DifficultyConfig {
  /** 难度级别名 */
  level: DifficultyLevel;

  // ── 弃牌 ──
  /** 是否使用防守计算 */
  defenseEnabled: boolean;
  /** 防守权重精度 (0~1) */
  defenseAccuracy: number;

  // ── 进攻 ──
  /** 是否考虑待ち質（両面 > 嵌張 > 辺張 > 単騎） */
  useWaitQuality: boolean;
  /** 是否估算手牌打点 */
  useHandValue: boolean;

  // ── 噪声 / 故意失误 ──
  /** 完全随机弃牌的概率（模拟低级失误） */
  randomDiscardChance: number;
  /** 次优弃牌的概率（不打最好的，打第二好的） */
  suboptimalDiscardChance: number;
  /** 故意放铳的概率（Lunatic 为 0） */
  intentionalDealInChance: number;

  // ── 鸣牌阈值 ──
  callThresholdPon: number;    // 0=永远不碰, 1=必碰
  callThresholdChi: number;
  callThresholdKan: number;

  // ── 立直 ──
  riichiProbability: number;   // 满足条件时立直的概率
  riichiMinWaits: number;      // 至少几张待牌才考虑立直
  /** 是否考虑打点后再立直（低打点不立直） */
  riichiRequireValue: boolean;

  // ── 推/缩 ──
  /** 超过此危险度开始弃和（防守时） */
  foldThreshold: number;
  /** 攻守判断灵敏度 (越大越保守) */
  defenseWeight: number;
}

// ── 四个预设 ──

export const DIFFICULTY_EASY: DifficultyConfig = {
  level: 'easy',
  defenseEnabled: false,
  defenseAccuracy: 0,
  useWaitQuality: false,
  useHandValue: false,
  randomDiscardChance: 0.25,
  suboptimalDiscardChance: 0.20,
  intentionalDealInChance: 0.05,
  callThresholdPon: 0.25,
  callThresholdChi: 0.15,
  callThresholdKan: 0.10,
  riichiProbability: 0.20,
  riichiMinWaits: 2,
  riichiRequireValue: false,
  foldThreshold: 999,  // 基本不缩
  defenseWeight: 0,
};

export const DIFFICULTY_NORMAL: DifficultyConfig = {
  level: 'normal',
  defenseEnabled: true,
  defenseAccuracy: 0.5,
  useWaitQuality: true,
  useHandValue: false,
  randomDiscardChance: 0.08,
  suboptimalDiscardChance: 0.10,
  intentionalDealInChance: 0.01,
  callThresholdPon: 0.50,
  callThresholdChi: 0.35,
  callThresholdKan: 0.25,
  riichiProbability: 0.45,
  riichiMinWaits: 1,
  riichiRequireValue: false,
  foldThreshold: 0.7,
  defenseWeight: 0.4,
};

export const DIFFICULTY_HARD: DifficultyConfig = {
  level: 'hard',
  defenseEnabled: true,
  defenseAccuracy: 0.85,
  useWaitQuality: true,
  useHandValue: true,
  randomDiscardChance: 0.02,
  suboptimalDiscardChance: 0.03,
  intentionalDealInChance: 0,
  callThresholdPon: 0.65,
  callThresholdChi: 0.45,
  callThresholdKan: 0.35,
  riichiProbability: 0.70,
  riichiMinWaits: 1,
  riichiRequireValue: true,
  foldThreshold: 0.5,
  defenseWeight: 0.7,
};

export const DIFFICULTY_LUNATIC: DifficultyConfig = {
  level: 'lunatic',
  defenseEnabled: true,
  defenseAccuracy: 1.0,
  useWaitQuality: true,
  useHandValue: true,
  randomDiscardChance: 0,
  suboptimalDiscardChance: 0,
  intentionalDealInChance: 0,
  callThresholdPon: 0.75,
  callThresholdChi: 0.55,
  callThresholdKan: 0.45,
  riichiProbability: 0.85,
  riichiMinWaits: 0,
  riichiRequireValue: true,
  foldThreshold: 0.35,
  defenseWeight: 1.0,
};

/** 根据难度名称获取配置 */
export function getDifficulty(level: DifficultyLevel): DifficultyConfig {
  switch (level) {
    case 'easy': return DIFFICULTY_EASY;
    case 'normal': return DIFFICULTY_NORMAL;
    case 'hard': return DIFFICULTY_HARD;
    case 'lunatic': return DIFFICULTY_LUNATIC;
  }
}
