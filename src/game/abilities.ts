/**
 * abilities.ts — 角色超能力系统
 *
 * 能力类型：
 *   dealing    — 配牌系：影响下局初始手牌
 *   instant    — 即时效果：改变游戏状态
 *   modifier   — 游戏规则修改：需协同 gameEngine
 *
 * 标记说明：
 *   ✅ = 代码已实现
 *   📝 = 设计已定，代码待写
 */

import type { Tile, GameState, Wind } from './types';
import { checkTenpai } from './hand';

// ═══════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════

export interface RequiredTile { suit: 'm' | 'p' | 's' | 'z'; value: number; }
export interface HandRequirement { wind: number; useCount: number; tiles: RequiredTile[]; groupSize?: number; tenpai?: boolean; }

export interface AbilityDef {
  cost: number;
  type: 'dealing' | 'instant' | 'modifier';
  description: string;
  implemented: boolean;  // ✅ 代码是否已写
}

export interface AbilityResult {
  ok: boolean;
  message: string;
  state?: GameState;
}

// ═══════════════════════════════════════════
// 全部角色注册表
// ═══════════════════════════════════════════

const REGISTRY: Record<string, AbilityDef> = {
  // ── th06 红魔乡 ──
  '露米娅':           { cost:100, type:'instant',  implemented:true,  description:'暗黒 — 对手能量-20' },
  '大妖精':           { cost:100, type:'dealing',  implemented:true,  description:'妖精の加護 — 下局其他玩家各有一张牌不得打出' },
  '琪露诺':           { cost:100, type:'modifier', implemented:true,  description:'氷結 — 所有对手下次摸牌必须自摸切' },
  '红美玲':           { cost:100, type:'instant',  implemented:true,  description:'気功 — 摸牌时可选择从牌山底摸' },
  '小恶魔':           { cost:100, type:'instant',  implemented:true,  description:'書庫検索 — 查看牌山顶3张' },
  '帕秋莉·诺蕾姬':    { cost:100, type:'instant',  implemented:true,  description:'七曜魔法 — 手牌一张与牌山交换' },
  '十六夜咲夜':        { cost:100, type:'modifier', implemented:true,  description:'时间操作 — 弃牌后再摸再弃（额外一巡）' },
  '蕾米莉亚·斯卡蕾特': { cost:100, type:'instant',  implemented:true,  description:'運命干渉 — 指定对手下张摸牌自摸切' },
  '芙兰朵露·斯卡蕾特': { cost:100, type:'instant',  implemented:true,  description:'破壊 — 指定对手弃牌区一张牌移回牌山' },

  // ── th07 妖妖梦 ──
  '蕾蒂·霍瓦特洛克':   { cost:100, type:'instant', implemented:true, description:'冬眠 — 跳过自己回合，回复1000点' },
  '橙':                { cost:100, type:'instant', implemented:true, description:'式神 — 模仿上一家使用的能力效果' },
  '爱丽丝·玛格特罗依德':{ cost:100, type:'instant', implemented:true, description:'人形操作 — 弃牌区一张牌与牌山交换' },
  '普莉兹姆利巴三姐妹': { cost:100, type:'instant', implemented:true, description:'合奏 — 手牌面子数×2=额外能量' },
  '魂魄妖梦':          { cost:100, type:'instant', implemented:true, description:'剣術 — 其他每人减60能量，不足变0' },
  '西行寺幽幽子':      { cost:100, type:'instant', implemented:true, description:'死誘 — 指定对手本巡不能荣和' },
  '八云蓝':            { cost:100, type:'instant', implemented:true, description:'九尾 — 摸牌后可再摸一张再弃一张' },
  '八云紫':            { cost:100, type:'instant', implemented:true, description:'境界 — 手牌一张与牌山交换' },

  // ── th08 永夜抄 ──
  '莉格露·奈特巴格':   { cost:100, type:'instant', implemented:true, description:'蟲群 — 对手本巡弃牌不显示' },
  '米斯蒂娅·萝蕾拉':   { cost:100, type:'instant', implemented:true, description:'夜雀 — 对手本巡摸牌不显示' },
  '上白泽慧音':        { cost:100, type:'instant', implemented:true, description:'歴史 — 弃牌可撤销，手牌恢复' },
  '博丽灵梦':          { cost:100, type:'modifier', implemented:true, description:'博丽护符 — 自己打出的牌无法被鸣牌' },
  '雾雨魔理沙':        { cost:100, type:'modifier', implemented:true, description:'八卦炉 — 立直和牌时多翻里宝牌' },
  '因幡帝':            { cost:100, type:'instant', implemented:true, description:'幸運 — 指定一张牌，摸到同花色+10能量' },
  '铃仙·优昙华院·因幡':{ cost:100, type:'instant', implemented:true, description:'狙击 — 听牌后指定玩家摸到和牌' },
  '八意永琳':          { cost:100, type:'instant', implemented:true, description:'薬学 — 弃牌后可再摸一张' },
  '蓬莱山辉夜':        { cost:100, type:'instant', implemented:true, description:'永遠 — 牌山增加10张' },
  '藤原妹红':          { cost:100, type:'instant', implemented:true, description:'不死 — 点炮后分数不扣至负数' },

  // ── th09 花映塚 ──
  '梅蒂欣·梅兰可莉':   { cost:100, type:'instant', implemented:true, description:'毒素 — 指定对手减30能量' },
  '风见幽香':          { cost:100, type:'instant', implemented:true, description:'花符 — 手牌万子本巡可当筒子' },
  '小野塚小町':        { cost:100, type:'instant', implemented:true, description:'距離 — 跳过下家一次摸牌' },
  '四季映姬':          { cost:100, type:'instant', implemented:true, description:'審判 — 流局罚符收支反转' },

  // ── th10 风神录 ──
  '秋静叶':            { cost:100, type:'instant', implemented:true, description:'紅葉 — 摸牌后可弃万子再摸一张' },
  '秋穰子':            { cost:100, type:'instant', implemented:true, description:'豊穣 — 自己摸牌时额外+5能量' },
  '键山雏':            { cost:100, type:'instant', implemented:true, description:'厄流し — 弃牌区一张放回牌山底，摸一张' },
  '河城荷取':          { cost:100, type:'instant', implemented:true, description:'光学迷彩 — 本巡弃牌对手不可见' },
  '犬走椛':            { cost:100, type:'instant', implemented:true, description:'千里眼 — 查看牌山顶3张' },
  '射命丸文':          { cost:100, type:'instant', implemented:true, description:'風速 — 用一张风牌与牌山交换' },
  '东风谷早苗':        { cost:100, type:'dealing',  implemented:true, description:'奇跡 — 奇数次字牌对子，偶数升暗刻' },
  '八坂神奈子':        { cost:100, type:'instant', implemented:true, description:'天流 — 本局和牌得分+30%' },
  '洩矢诹访子':        { cost:100, type:'instant', implemented:true, description:'大地 — 被荣和时支付减半' },

  // ── th11 地灵殿 ──
  '黑谷山女':          { cost:100, type:'instant', implemented:true, description:'疫病 — 指定对手下张摸牌自摸切' },
  '水桥帕露希':        { cost:100, type:'instant', implemented:true, description:'嫉妬 — 对手和牌得分-30%' },
  '星熊勇仪':          { cost:100, type:'instant', implemented:true, description:'怪力 — 本巡无视食替限制弃牌' },
  '古明地觉':          { cost:100, type:'instant', implemented:true, description:'読心 — 查看一名对手全部手牌' },
  '火焰猫燐':          { cost:100, type:'instant', implemented:true, description:'死体移送 — 弃牌区一张牌移回手牌' },
  '灵乌路空':          { cost:100, type:'instant', implemented:true, description:'核融合 — 手牌本巡视为同花色' },
  '古明地恋':          { cost:100, type:'instant', implemented:true, description:'無意識 — 自己弃牌对对手不可见' },

  // ── th12 星莲船 ──
  '娜兹玲':            { cost:100, type:'instant', implemented:true, description:'探宝 — 查看牌山顶3张' },
  '多多良小伞':        { cost:100, type:'instant', implemented:true, description:'驚かせ — 对手随机弃一张手牌' },
  '云居一轮&云山':     { cost:100, type:'instant', implemented:true, description:'入道 — 弃牌区一张牌回手牌' },
  '村纱水蜜':          { cost:100, type:'instant', implemented:true, description:'沈没 — 指定对手本巡不能和牌' },
  '寅丸星':            { cost:100, type:'instant', implemented:true, description:'宝塔 — 手牌宝牌每张+500和牌得分' },
  '圣白莲':            { cost:100, type:'instant', implemented:true, description:'魔法 — 手牌一张变同花色任意牌' },
  '封兽鵺':            { cost:100, type:'instant', implemented:true, description:'正体不明 — 对手看到手牌数±1' },

  // ── th13 神灵庙 ──
  '宫古芳香':          { cost:100, type:'instant', implemented:true, description:'屍人 — 点炮支付减半' },
  '幽谷响子':          { cost:100, type:'instant', implemented:true, description:'やまびこ — 弃牌后可再弃同花色牌' },
  '霍青娥':            { cost:100, type:'instant', implemented:true, description:'穿牆 — 查看牌山任意位置1张' },
  '苏我屠自古':        { cost:100, type:'instant', implemented:true, description:'雷鳴 — 本巡其他玩家不能立直' },
  '物部布都':          { cost:100, type:'instant', implemented:true, description:'風水 — 下张摸牌必定是万子' },
  '丰聪耳神子':        { cost:100, type:'instant', implemented:true, description:'聴聞 — 查看所有对手听牌状态' },
  '二岩狢子':          { cost:100, type:'instant', implemented:true, description:'化け — 弃牌伪装成幺九牌显示' },

  // ── th14 辉针城 ──
  '若鹭姬':            { cost:100, type:'instant', implemented:true, description:'水中の歌 — 摸牌若为筒子再摸一张' },
  '赤蛮奇':            { cost:100, type:'instant', implemented:true, description:'首飛び — 弃牌区一张牌飞回牌山顶' },
  '今泉影狼':          { cost:100, type:'instant', implemented:true, description:'月夜 — 手牌幺九牌每张+500和牌得分' },
  '九十九弁弁':        { cost:100, type:'instant', implemented:true, description:'琵琶の調べ — 查看牌山顶3张' },
  '九十九八桥':        { cost:100, type:'instant', implemented:true, description:'琴の音色 — 摸牌后弃同花色再摸一张' },
  '鬼人正邪':          { cost:100, type:'instant', implemented:true, description:'逆転 — 被荣和时对手多付1000' },
  '少名针妙丸':        { cost:100, type:'instant', implemented:true, description:'万宝槌 — 本巡和牌得分+30%' },
  '堀川雷鼓':          { cost:100, type:'instant', implemented:true, description:'鼓動 — 摸牌后可再弃一张再摸一张' },

  // ── th15 绀珠传 ──
  '清兰':              { cost:100, type:'instant', implemented:true, description:'幻惑 — 对手摸牌时不显示' },
  '铃瑚':              { cost:100, type:'instant', implemented:true, description:'団子 — 摸牌时回复500点' },
  '哆来咪':            { cost:100, type:'instant', implemented:true, description:'夢世界 — 所有对手本巡摸牌不显示' },
  '稀神探女':          { cost:100, type:'instant', implemented:true, description:'逆言 — 宣言一张牌，下巡必摸到' },
  '克劳恩皮丝':        { cost:100, type:'instant', implemented:true, description:'狂乱 — 随机对手弃一张手牌' },
  '纯狐':              { cost:100, type:'instant', implemented:true, description:'純粋 — 本巡和牌得分+50%' },
  '赫卡提亚':          { cost:100, type:'instant', implemented:true, description:'三身 — 借用一名对手手牌中一张' },

  // ── th16 天空璋 ──
  '爱塔妮缇拉尔瓦':    { cost:100, type:'instant', implemented:true, description:'鱗粉 — 对手下巡看到的牌面模糊' },
  '坂田合欢':          { cost:100, type:'instant', implemented:true, description:'山の恵み — 手牌幺九牌可当任意牌' },
  '高丽野阿吽':        { cost:100, type:'instant', implemented:true, description:'阿吽 — 摸牌若为字牌再摸一张' },
  '矢田寺成美':        { cost:100, type:'instant', implemented:true, description:'変身 — 手牌一张变同花色任意牌' },
  '尔子田里乃・丁礼田舞':{ cost:100, type:'instant', implemented:true, description:'神降ろし — 下张摸牌变为宝牌' },
  '摩多罗隐岐奈':      { cost:100, type:'instant', implemented:true, description:'後門 — 手牌与牌山底交换一张' },

  // ── th17 鬼形兽 ──
  '戎璎花':            { cost:100, type:'instant', implemented:true, description:'惠比寿 — 自摸和牌+500点' },
  '牛崎润美':          { cost:100, type:'instant', implemented:true, description:'重量変化 — 对手弃字牌则下巡跳过' },
  '庭渡久侘歌':        { cost:100, type:'instant', implemented:true, description:'治療 — 点炮损失减半' },
  '吉吊八千慧':        { cost:100, type:'instant', implemented:true, description:'調伏 — 指定对手本局不能发动能力' },
  '杖刀偶磨弓':        { cost:100, type:'instant', implemented:true, description:'埴輪軍 — 被荣和时支付减半' },
  '埴安神袿姬':        { cost:100, type:'instant', implemented:true, description:'造形 — 手牌面子数×500和牌加分' },
  '骊驹早鬼':          { cost:100, type:'dealing',  implemented:true, description:'早鬼 — 每发动一次，下局配牌多一个暗杠（最多3次）' },

  // ── th18 虹龙洞 ──
  '豪德寺三花':        { cost:100, type:'instant', implemented:true, description:'招福 — 摸牌时额外+10能量' },
  '山城高岭':          { cost:100, type:'instant', implemented:true, description:'竜脈 — 手牌5万视为红宝牌' },
  '驹草山如':          { cost:100, type:'instant', implemented:true, description:'煙幕 — 对手看不到本巡弃牌' },
  '玉造魅须丸':        { cost:100, type:'instant', implemented:true, description:'勾玉 — 手牌同花色3张视为面子' },
  '菅牧典':            { cost:100, type:'instant', implemented:true, description:'情報収集 — 查看所有对手弃牌区' },
  '饭纲丸龙':          { cost:100, type:'instant', implemented:true, description:'星雲 — 牌山重新洗牌' },
  '天弓千亦':          { cost:100, type:'instant', implemented:true, description:'市場 — 手牌中的中视为万能牌' },
  '姬虫百百世':        { cost:100, type:'instant', implemented:true, description:'鉄壁 — 被荣和时支付减半' },

  // ── th19 兽王园 ──
  '三头慧之子':        { cost:100, type:'instant', implemented:true, description:'開戦 — 本巡和牌对手多付1000' },
  '孙美天':            { cost:100, type:'instant', implemented:true, description:'如意棒 — 手牌一张变同花色任意牌' },
  '天火人血枪':        { cost:100, type:'instant', implemented:true, description:'火炎 — 对手宝牌本巡无效' },
  '豫母都日狭美':      { cost:100, type:'instant', implemented:true, description:'黄泉 — 流局时独赢不听罚符' },
  '日白残无':          { cost:100, type:'instant', implemented:true, description:'欲望 — 本局每和一次+20%得分' },

  // ── th20 锦上京 ──
  '尘塚姥芽':          { cost:100, type:'instant', implemented:true, description:'埃舞 — 对手摸牌不能组成顺子2巡' },
  '封兽魑魅':          { cost:100, type:'instant', implemented:true, description:'幻惑 — 对手手牌2张显示为假牌' },
  '道神驯子':          { cost:100, type:'instant', implemented:true, description:'道謎 — 对手答错则跳过摸牌' },
  '维缦·浅间':         { cost:100, type:'instant', implemented:true, description:'情報再構築 — 弃牌全洗入牌山' },
  '绵月丰姬':          { cost:100, type:'instant', implemented:true, description:'海山の絆 — 自风场风全视为役牌' },
  '磐永阿梨夜':        { cost:100, type:'instant', implemented:true, description:'不変 — 和牌得分固定8000点' },
  '渡里贝子':          { cost:100, type:'instant', implemented:true, description:'虚構都市 — 对手牌局信息虚构化' },

  // ── 其他 ──
  '斯塔·萨菲雅':      { cost:100, type:'dealing',  implemented:true, description:'星の輝き — 配牌即听牌' },
};

// ═══════════════════════════════════════════
// 配牌系
// ═══════════════════════════════════════════

const HONORS_ALL: RequiredTile[] = [
  { suit:'z',value:1 },{ suit:'z',value:2 },{ suit:'z',value:3 },
  { suit:'z',value:4 },{ suit:'z',value:5 },{ suit:'z',value:6 },{ suit:'z',value:7 },
];

export function getHandRequirement(name: string, useCount: number): HandRequirement | null {
  const def = REGISTRY[name];
  if (!def || def.type !== 'dealing' || useCount <= 0) return null;

  if (name === '东风谷早苗') {
    const tiles: RequiredTile[] = [];
    let pairs = 0, triplets = 0;
    for (let i = 1; i <= useCount; i++) {
      if (i % 2 === 1) pairs++; else { pairs--; triplets++; }
    }
    let hi = 0;
    for (let i = 0; i < triplets; i++) {
      const h = HONORS_ALL[hi % 7];
      tiles.push(h, h, h); hi++;
    }
    for (let i = 0; i < pairs; i++) {
      const h = HONORS_ALL[hi % 7];
      tiles.push(h, h); hi++;
    }
    return tiles.length > 0 ? { wind: -1, useCount, tiles } : null;
  }

  if (name === '大妖精') {
    const tiles: RequiredTile[] = [];
    for (let p = 0; p < 3; p++)
      for (let i = 0; i < useCount; i++)
        tiles.push(HONORS_ALL[(p * useCount + i) % 7]);
    return tiles.length > 0 ? { wind: -2, useCount, tiles } : null;
  }

  // 骊驹早鬼：每发动一次多一个暗杠（从牌山实际找4张同牌），最多3次
  if (name === '骊驹早鬼') {
    const count = Math.min(useCount, 3);
    const tiles: RequiredTile[] = [];
    // 全牌型（万筒索字），用于暗杠搜索
    const allTypes: RequiredTile[] = [];
    for (const s of ['m','p','s'] as const) {
      for (let v = 1; v <= 9; v++) allTypes.push({ suit: s, value: v });
    }
    for (let v = 1; v <= 7; v++) allTypes.push({ suit: 'z', value: v });
    // 对每种牌型取4张
    const candidates = [...allTypes].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
      const t = candidates[i % candidates.length];
      tiles.push(t, t, t, t);
    }
    return tiles.length > 0 ? { wind: -1, useCount: count, tiles, groupSize: 4 } : null;
  }

  // 斯塔·萨菲雅：配牌即听牌
  if (name === '斯塔·萨菲雅' && useCount > 0) {
    return { wind: -1, useCount, tiles: [], tenpai: true };
  }

  return null;
}

// 特殊：配牌即听牌（斯塔·萨菲雅）— 从完整牌山构造听牌手牌
export function tryMakeTenpai(_hand: Tile[], wallPool: Tile[]): { hand: Tile[]; used: number } {
  const pool = [...wallPool];

  // 收集牌山中所有可用的顺子
  function findAllSequences(): RequiredTile[][] {
    const result: RequiredTile[][] = [];
    const suits = ['m', 'p', 's'] as const;
    for (const s of suits) {
      for (let v = 1; v <= 7; v++) {
        if (pool.some(t => t.suit === s && t.value === v) &&
            pool.some(t => t.suit === s && t.value === v + 1) &&
            pool.some(t => t.suit === s && t.value === v + 2)) {
          result.push([{ suit: s, value: v }, { suit: s, value: v + 1 }, { suit: s, value: v + 2 }]);
        }
      }
    }
    return result.sort(() => Math.random() - 0.5);
  }

  // 收集牌山中所有可用的暗刻
  function findAllTriplets(): RequiredTile[][] {
    const result: RequiredTile[][] = [];
    const seen = new Set<string>();
    for (const t of pool) {
      const k = `${t.suit}${t.value}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (pool.filter(x => x.suit === t.suit && x.value === t.value).length >= 3) {
        result.push([{ suit: t.suit as any, value: t.value }]);
      }
    }
    return result.sort(() => Math.random() - 0.5);
  }

  function collect(rt: RequiredTile[]): Tile[] {
    const r: Tile[] = [];
    for (const t of rt) {
      const i = pool.findIndex(x => x.suit === t.suit && x.value === t.value);
      if (i >= 0) { r.push(pool[i]); pool.splice(i, 1); }
    }
    return r;
  }

  // 从所有可用候选中随机选
  const triplets = findAllTriplets();
  if (triplets.length === 0) return { hand: [], used: 0 };
  const seqs = findAllSequences();
  if (seqs.length < 3) return { hand: [], used: 0 };

  // 随机选1暗刻 + 3顺子（互不冲突）
  const result: Tile[] = [];
  // 先试随机组合，最多尝试50次
  for (let attempt = 0; attempt < 50; attempt++) {
    const poolCopy = [...pool];
    const chosen: Tile[] = [];
    let ok = true;

    const tri = triplets[Math.floor(Math.random() * triplets.length)];
    for (let i = 0; i < 3; i++) {
      const idx = poolCopy.findIndex(x => x.suit === tri[0].suit && x.value === tri[0].value);
      if (idx >= 0) { chosen.push(poolCopy[idx]); poolCopy.splice(idx, 1); }
      else { ok = false; break; }
    }
    if (!ok) continue;

    const pickedSeqs: RequiredTile[][] = [];
    for (let i = 0; i < 3; i++) {
      const si = Math.floor(Math.random() * seqs.length);
      const s = seqs[si];
      let seqOk = true;
      const seqTiles: Tile[] = [];
      for (const rt of s) {
        const idx = poolCopy.findIndex(x => x.suit === rt.suit && x.value === rt.value);
        if (idx >= 0) { seqTiles.push(poolCopy[idx]); poolCopy.splice(idx, 1); }
        else { seqOk = false; break; }
      }
      if (seqOk) {
        chosen.push(...seqTiles);
        pickedSeqs.push(s);
      } else {
        ok = false; break;
      }
    }
    if (!ok || pickedSeqs.length < 3) continue;

    // 补1张牌山顶
    if (poolCopy.length > 0) chosen.push(poolCopy.shift()!);

    return { hand: chosen, used: wallPool.length - poolCopy.length };
  }

  return { hand: [], used: 0 };
}

export function getAllRequirements(
  playerNames: string[], useCounts: number[],
): HandRequirement[] {
  const reqs: HandRequirement[] = [];
  for (let i = 0; i < playerNames.length; i++) {
    const req = getHandRequirement(playerNames[i], useCounts[i]);
    if (req) { req.wind = i; reqs.push(req); }
  }
  reqs.sort((a, b) => b.useCount - a.useCount);
  return reqs;
}

// ═══════════════════════════════════════════
// 即时能力（妖梦、文、铃仙 等）
// ═══════════════════════════════════════════

export function executeInstantAbility(
  name: string, state: GameState, playerWind: Wind,
  targetWind?: Wind, extraTile?: { suit: string; value: number },
): AbilityResult {
  const def = REGISTRY[name];
  if (!def || def.type !== 'instant') return { ok: false, message: '该角色无即时能力' };

  const player = state.players[playerWind];
  const players = state.players.map(p => ({ ...p }));

  // ── 妖梦：其他每人 -60 能量 ──
  if (name === '魂魄妖梦') {
    for (let i = 0; i < 4; i++) {
      if (i !== playerWind) players[i].energy = Math.max(0, players[i].energy - 60);
    }
    return { ok: true, message: `⚔️ ${player.name} 发动剣術！其他玩家能量-60`, state: { ...state, players } };
  }

  // ── 文：风牌换牌山 ──
  if (name === '射命丸文') {
    if (!extraTile || extraTile.suit !== 'z' || extraTile.value < 1 || extraTile.value > 4)
      return { ok: false, message: '需要选择一张风牌' };
    const idx = player.hand.findIndex(t => t.suit === extraTile.suit && t.value === extraTile.value && !t.isAkadora);
    if (idx === -1) return { ok: false, message: '手牌中没有这张风牌' };
    const wall = [...state.wall];
    if (wall.length === 0) return { ok: false, message: '牌山已空' };
    const newTile = wall.shift()!;
    wall.push(players[playerWind].hand[idx]);
    players[playerWind].hand = [...player.hand];
    players[playerWind].hand.splice(idx, 1, newTile);
    return { ok: true, message: `🍃 ${player.name} 風速！换得${newTile.value}${newTile.suit}`, state: { ...state, players, wall } };
  }

  // ── 铃仙：狙击 ──
  if (name === '铃仙·优昙华院·因幡') {
    if (!extraTile) return { ok: false, message: '需要指定和牌' };
    if (targetWind === undefined) return { ok: false, message: '需要指定目标玩家' };
    const tenpai = checkTenpai(player.hand, player.melds);
    if (!tenpai) return { ok: false, message: '未听牌，无法发动狙击' };
    const tileKey = `${extraTile.value}${extraTile.suit}`;
    if (!tenpai.waitTiles.some((t: Tile) => `${t.value}${t.suit}` === tileKey))
      return { ok: false, message: `${tileKey} 不是你等着的牌` };
    return {
      ok: true, message: `🎯 ${player.name} 狙击！${state.players[targetWind].name}→${tileKey}`,
      state: { ...state, players, sniperReserve: { tileKey, suit: extraTile.suit, value: extraTile.value, targetWind } },
    };
  }

  return { ok: true, message: `${name} 发动能力`, state: { ...state, players } };
}

// ═══════════════════════════════════════════
// 工具
// ═══════════════════════════════════════════

export function getAbilityDef(name: string): AbilityDef | null { return REGISTRY[name] ?? null; }
export function getAbilityCost(_name: string): number { return 100; }
export function isImplemented(name: string): boolean { return REGISTRY[name]?.implemented ?? false; }

export function getWindTiles(hand: Tile[]): Tile[] {
  return hand.filter(t => t.suit === 'z' && t.value >= 1 && t.value <= 4 && !t.isAkadora);
}
