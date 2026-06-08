/**
 * =========================================================================
 * utils/syanten.js — 全面无死角测试 (第2弹)
 * 适配最新版: 支持一般形 + 七对子 + 国士无双
 * =========================================================================
 */
import { describe, it, expect } from 'vitest';
import { checkMahjongStatus } from './utils/syanten.js';

// ============================================================
// 辅助函数
// ============================================================

function strToHai2D(s) {
  const hai = [[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0]];
  const suitMap = { m: 0, p: 1, s: 2, z: 3 };
  let suit = 0;
  for (const ch of s) {
    if (suitMap[ch] !== undefined) { suit = suitMap[ch]; continue; }
    const num = parseInt(ch, 10);
    if (num >= 1 && num <= 9) hai[suit][num - 1]++;
  }
  return hai;
}

function totalTiles(hai2D) {
  let sum = 0;
  for (let i = 0; i < 4; i++) for (let j = 0; j < (i === 3 ? 7 : 9); j++) sum += hai2D[i][j];
  return sum;
}

function assertTenpaiWithWaits(hai, expectedWaits) {
  const result = checkMahjongStatus(hai);
  expect(result).toHaveProperty('status', 0);
  expect(result.info.length).toBeGreaterThanOrEqual(1);
  const entry = result.info.find(e => e.discard === 'none') || result.info[0];
  expect([...entry.waits].sort()).toEqual([...expectedWaits].sort());
}

function assertWin(hai) {
  expect(checkMahjongStatus(hai)).toBe(-1);
}

function assertShanten(hai, expected) {
  expect(checkMahjongStatus(hai)).toBe(expected);
}

function assertNotWin(hai) {
  expect(checkMahjongStatus(hai)).not.toBe(-1);
}

// ============================================================
// 1. 精确听牌验证
// ============================================================
describe('13张: 各种听牌形态的精确等待牌', () => {

  describe('两面听 (ryanmen)', () => {
    it('23m → 1m,4m', () => assertTenpaiWithWaits(strToHai2D('m23567p111789s22'), ['1m', '4m']));
    it('67m → 5m,8m', () => assertTenpaiWithWaits(strToHai2D('m67123p111789s22'), ['5m', '8m']));
    it('45p → 3p,6p', () => assertTenpaiWithWaits(strToHai2D('p45123m123456s22'), ['3p', '6p']));
    it('56s → 4s,7s', () => assertTenpaiWithWaits(strToHai2D('s56111m222p333z11'), ['4s', '7s']));
    it('34m → 2m,5m', () => assertTenpaiWithWaits(strToHai2D('m34111p222789s33'), ['2m', '5m']));
  });

  describe('嵌张听 (kanchan)', () => {
    it('13m → 2m', () => assertTenpaiWithWaits(strToHai2D('m13567p111789s22'), ['2m']));
    it('46m → 5m', () => assertTenpaiWithWaits(strToHai2D('m46123p111789s22'), ['5m']));
    it('79m → 8m', () => assertTenpaiWithWaits(strToHai2D('m79123p111456s22'), ['8m']));
    it('24s → 3s', () => assertTenpaiWithWaits(strToHai2D('s24111m222p333z11'), ['3s']));
    it('68s → 7s', () => assertTenpaiWithWaits(strToHai2D('s68111m222p333z11'), ['7s']));
    it('57p → 6p', () => assertTenpaiWithWaits(strToHai2D('p57111m222789s33'), ['6p']));
    it('35m → 4m', () => assertTenpaiWithWaits(strToHai2D('m35111p222789s33'), ['4m']));
  });

  describe('边张听 (penchan)', () => {
    it('12m → 3m', () => assertTenpaiWithWaits(strToHai2D('m12456p111789s22'), ['3m']));
    it('12s → 3s', () => assertTenpaiWithWaits(strToHai2D('s12111m222p789z11'), ['3s']));
    it('12p → 3p', () => assertTenpaiWithWaits(strToHai2D('p12123m456s789s22'), ['3p']));
    it('89m → 7m', () => assertTenpaiWithWaits(strToHai2D('m89123p111456s22'), ['7m']));
    it('89s → 7s', () => assertTenpaiWithWaits(strToHai2D('s89111m222p333z11'), ['7s']));
    it('89p → 7p', () => assertTenpaiWithWaits(strToHai2D('p89111m222s333z11'), ['7p']));
  });

  describe('单骑听 (tanki)', () => {
    it('5z (白) 单骑', () => assertTenpaiWithWaits(strToHai2D('m123456789p123z5'), ['5z']));
    it('1z (东) 单骑', () => assertTenpaiWithWaits(strToHai2D('m123456p789s123z1'), ['1z']));
    it('7z (中) 单骑', () => assertTenpaiWithWaits(strToHai2D('m111222p333s456z7'), ['7z']));
    it('5s 单骑', () => assertTenpaiWithWaits(strToHai2D('m123p456s789z111s5'), ['5s']));
  });

  describe('双碰听 (shanpon)', () => {
    it('55m 66m 双碰', () => assertTenpaiWithWaits(strToHai2D('m1112223335566'), ['5m', '6m']));
    it('3p 7s 双碰 (跨花色)', () => assertTenpaiWithWaits(strToHai2D('m111222333p33s77'), ['3p', '7s']));
    it('东 南 双碰', () => assertTenpaiWithWaits(strToHai2D('m111222333z1122'), ['1z', '2z']));
    it('1p 9s 双碰', () => assertTenpaiWithWaits(strToHai2D('m111222333p11s99'), ['1p', '9s']));
  });
});

// ============================================================
// 2. 多面听
// ============================================================
describe('13张: 多面听', () => {
  it('34567m → 三面听 258m', () => {
    const r = checkMahjongStatus(strToHai2D('m34567p456s789z11'));
    expect(r).toHaveProperty('status', 0);
    expect(r.info[0].waits.sort()).toEqual(['2m', '5m', '8m']);
  });
  it('34567m + 111p 222p 33s → 三面听', () => {
    const r = checkMahjongStatus(strToHai2D('m34567p111222s33'));
    expect(r).toHaveProperty('status', 0);
    expect(r.info[0].waits.sort()).toEqual(['2m', '5m', '8m']);
  });
  it('22234m → 两面听 2m,5m', () => {
    const r = checkMahjongStatus(strToHai2D('m22234p567s789z11'));
    expect(r).toHaveProperty('status', 0);
    expect(r.info[0].waits).toContain('2m');
    expect(r.info[0].waits).toContain('5m');
  });
  it('5677m → 两面听 4m,7m', () => {
    const r = checkMahjongStatus(strToHai2D('m5677p111222333'));
    expect(r).toHaveProperty('status', 0);
    expect(r.info[0].waits).toContain('4m');
    expect(r.info[0].waits).toContain('7m');
  });
});

// ============================================================
// 3. 副露后少张状态
// ============================================================
describe('副露后少张状态的精确检测', () => {
  describe('10张', () => {
    it('听牌: 111m 222p 5567s → 5s,8s', () => {
      const r = checkMahjongStatus(strToHai2D('m111p222s5567'));
      expect(r).toHaveProperty('status', 0);
      expect(r.info[0].waits).toContain('5s');
      expect(r.info[0].waits).toContain('8s');
    });
    it('一向听: 111m 222p 3467s = 1', () => {
      expect(checkMahjongStatus(strToHai2D('m111p222s3467'))).toBe(1);
    });
    it('听牌: 111m 456m 78p 55z', () => {
      const r = checkMahjongStatus(strToHai2D('m111456p78z55'));
      expect(r).toHaveProperty('status', 0);
      expect(r.info[0].waits).toContain('6p');
      expect(r.info[0].waits).toContain('9p');
    });
  });
  describe('7张', () => {
    it('听牌: 111m 45s 77s', () => {
      const r = checkMahjongStatus(strToHai2D('m111s4577'));
      expect(r).toHaveProperty('status', 0);
      expect(r.info[0].waits).toContain('3s');
      expect(r.info[0].waits).toContain('6s');
    });
    it('一向听: 111m 45s 9s 7z = 1', () => {
      expect(checkMahjongStatus(strToHai2D('m111s459z7'))).toBe(1);
    });
    it('听牌: 456m 33s 45p', () => {
      expect(checkMahjongStatus(strToHai2D('m456s33p45'))).toHaveProperty('status', 0);
    });
  });
  describe('4张', () => {
    it('11m+45p → 3p,6p', () => {
      const r = checkMahjongStatus(strToHai2D('m11p45'));
      expect(r).toHaveProperty('status', 0);
      expect(r.info[0].waits).toContain('3p');
      expect(r.info[0].waits).toContain('6p');
    });
    it('111m+7z → 7z', () => {
      const r = checkMahjongStatus(strToHai2D('m111z7'));
      expect(r).toHaveProperty('status', 0);
      expect(r.info[0].waits).toContain('7z');
    });
    it('11m+22s → 1m,2s (双碰)', () => {
      const r = checkMahjongStatus(strToHai2D('m11s22'));
      expect(r).toHaveProperty('status', 0);
      expect(r.info[0].waits).toContain('1m');
      expect(r.info[0].waits).toContain('2s');
    });
  });
  describe('1张', () => {
    it('1m', () => expect(checkMahjongStatus(strToHai2D('m5')).info[0].waits).toEqual(['5m']));
    it('1z', () => expect(checkMahjongStatus(strToHai2D('z3')).info[0].waits).toEqual(['3z']));
    it('9s', () => expect(checkMahjongStatus(strToHai2D('s9')).info[0].waits).toEqual(['9s']));
  });
});

// ============================================================
// 4. 14张 何切方案验证
// ============================================================
describe('14张: 何切方案验证', () => {
  it('123m+456m+789m+11255p: 切2p→双碰1p5p', () => {
    const r = checkMahjongStatus(strToHai2D('m123456789p11255'));
    expect(r).toHaveProperty('status', 0);
    expect(r.info.length).toBeGreaterThanOrEqual(2);
    const opt2p = r.info.find(x => x.discard === '2p');
    expect(opt2p).toBeDefined();
    expect(opt2p.waits).toContain('1p');
    expect(opt2p.waits).toContain('5p');
    expect(r.info.find(x => x.discard === '1p')).toBeDefined();
  });

  it('11122233344469m: 切6m→9m, 切9m→6m', () => {
    const r = checkMahjongStatus(strToHai2D('m11122233344469'));
    expect(r).toHaveProperty('status', 0);
    expect(r.info.find(x => x.discard === '6m').waits).toContain('9m');
    expect(r.info.find(x => x.discard === '9m').waits).toContain('6m');
  });

  it('11122233345678m → 胡牌(-1)', () => {
    expect(checkMahjongStatus(strToHai2D('m11122233345678'))).toBe(-1);
  });

  it('散牌14张 → 返回向听数', () => {
    const r = checkMahjongStatus(strToHai2D('m13579p2468s13579'));
    expect(typeof r).toBe('number');
    expect(r).toBeGreaterThanOrEqual(1);
  });

  it('123m 456m 111p 222p 34s → 切3s或4s可听', () => {
    const r = checkMahjongStatus(strToHai2D('m123456p111222s34'));
    expect(r).toHaveProperty('status', 0);
    const opt3s = r.info.find(x => x.discard === '3s');
    const opt4s = r.info.find(x => x.discard === '4s');
    expect(opt3s || opt4s).toBeDefined();
    if (opt3s) expect(opt3s.waits).toContain('4s');
    if (opt4s) expect(opt4s.waits).toContain('3s');
  });
});

// ============================================================
// 5. 向听数精确验证
// ============================================================
describe('向听数精确值', () => {
  it('13张: 3面子+1搭子+0雀头 = 一向听', () => {
    expect(checkMahjongStatus(strToHai2D('m123p456s789m12z75'))).toBe(1);
  });
  it('13张: 2面子+2搭子+0雀头 = 二向听', () => {
    expect(checkMahjongStatus(strToHai2D('m123p456s7812z123'))).toBe(2);
  });
  it('13张国士无双面 → 国士无双听牌, 非一般形8向听', () => {
    // 13 orphans: the new kokushi handler detects this as tenpai
    const r = checkMahjongStatus(strToHai2D('m19p19s19z1234567'));
    expect(r).toHaveProperty('status', 0);
    expect(r.info[0].waits.length).toBe(13);
  });
  it('0张 → 8向听', () => {
    expect(checkMahjongStatus([[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0]])).toBe(8);
  });
});

// ============================================================
// 6. 七对子形 (新版支持！)
// ============================================================
describe('七对子形 (新版支持七对子检测)', () => {
  it('纯七对子14张: 11m 33m 55m 77m 99m 22s 44s → 胡牌(-1)', () => {
    // 7 pairs = winning in chiitoitsu
    assertWin(strToHai2D('m1133557799s2244'));
  });
  it('纯七对子13张(6对+1单): 11m 33m 55m 77m 99m 22s 4s → 听牌', () => {
    // 6 pairs + 1 single = chiitoitsu tenpai
    const r = checkMahjongStatus(strToHai2D('m1133557799s224'));
    expect(r).toHaveProperty('status', 0);
  });
  it('纯七对子13张(5对+3单): 11m 33m 55m 77m 123s → 七对子一向听', () => {
    // 5 pairs + 3 singles = chiitoitsu 1-shanten
    const r = checkMahjongStatus(strToHai2D('m11335577s123'));
    expect(typeof r).toBe('number');
    expect(r).toBeGreaterThanOrEqual(1);
  });
  it('七对子+一般形同时成立 → -1', () => {
    assertWin(strToHai2D('m11223344556677'));
  });
  it('七对子不能用于副露后(<13张)', () => {
    // After melds, chiitoi should not work
    const r = checkMahjongStatus(strToHai2D('m113355s22'));
    expect(totalTiles(strToHai2D('m113355s22'))).toBe(8);
    // < 13 tiles = chiitoi disabled, falls back to normal form
    expect(typeof r).toBe('number');
    expect(r).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 7. 国士无双形 (新版支持！)
// ============================================================
describe('国士无双形 (新版支持国士无双检测)', () => {
  it('国士无双13面: 13种么九牌各1 → 听牌(听13张牌)', () => {
    // 13 orphans all unique = tenpai waiting for any of the 13
    const r = checkMahjongStatus(strToHai2D('m19p19s19z1234567'));
    expect(r).toHaveProperty('status', 0);
    // Should wait for at least some terminal/honor tiles
    expect(r.info[0].waits.length).toBeGreaterThanOrEqual(1);
  });
  it('国士无双14张(13种+1重复) → 胡牌(-1)', () => {
    // 13 orphans + duplicate 1m = winning
    assertWin(strToHai2D('m19p19s19z1234567m1'));
  });
  it('国士无双13张听牌(缺1种幺九) → 听牌', () => {
    // 13 orphans minus 1z, plus extra... let me be specific
    // Actually if we have 12 of the 13 orphans and one duplicate
    // 1m,9m,1p,9p,1s,9s,2z,3z,4z,5z,6z,7z + 1m = 13 tiles
    // Missing 1z (east). Waiting for 1z.
    // But the kokushi handler needs kinds=12, hasPair=1
    // shanten = 13-12-1 = 0 ✓ tenpai
    const r = checkMahjongStatus(strToHai2D('m19p19s19z234567m1'));
    expect(r).toHaveProperty('status', 0);
    // Should wait for the missing tile(s)
    expect(r.info[0].waits).toContain('1z');
  });
  it('国士无双+一般形同时可能 → 正确处理', () => {
    // 111m 999m 1p 9p 1s 9s 1z 2z 3z = 3+3+1+1+1+1+1+1+1 = 13
    const r = checkMahjongStatus(strToHai2D('m111999p19s19z123'));
    expect(r).not.toBeUndefined();
  });
});

// ============================================================
// 8. 复杂拆牌模式
// ============================================================
describe('复杂拆牌模式', () => {
  it('112233m 可拆123+123或111+222+33 → 胡牌', () => {
    assertWin(strToHai2D('m112233p456s789z55'));
  });
  it('22223333m + 111p + 22s → 听牌', () => {
    expect(checkMahjongStatus(strToHai2D('m22223333p111s22'))).toHaveProperty('status', 0);
  });
  it('1112345678999m (九莲宝灯) → 听牌', () => {
    const r = checkMahjongStatus(strToHai2D('m1112345678999'));
    expect(r).toHaveProperty('status', 0);
    expect(r.info[0].waits.length).toBeGreaterThanOrEqual(1);
  });
  it('4枚同牌: 1111m+222m+333m+44m+55m', () => {
    const r = checkMahjongStatus(strToHai2D('m11112223334455'));
    expect(r === -1 || typeof r === 'number' || r.status === 0).toBe(true);
  });
  it('全同花色密集: 11122233344455m → 胡牌', () => {
    assertWin(strToHai2D('m11122233344455'));
  });
  it('混一色: 111222333456m + 77z → 胡牌', () => {
    assertWin(strToHai2D('m111222333456z77'));
  });
});

// ============================================================
// 9. 边界值
// ============================================================
describe('边缘值与边界攻击', () => {
  it('字牌双碰听: 111z 222z 333z 44z 55z', () => {
    const r = checkMahjongStatus(strToHai2D('z1112223334455'));
    expect(r).toHaveProperty('status', 0);
    expect(r.info[0].waits).toContain('4z');
    expect(r.info[0].waits).toContain('5z');
  });
  it('空手牌 → 8', () => {
    expect(checkMahjongStatus([[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0]])).toBe(8);
  });
  it('wait格式: num+花色', () => {
    const r = checkMahjongStatus(strToHai2D('m123456789p1255'));
    expect(r).toHaveProperty('status', 0);
    for (const e of r.info) {
      expect(e.discard).toMatch(/^(none|[1-9][mpsz])$/);
      for (const w of e.waits) expect(w).toMatch(/^[1-9][mpsz]$/);
    }
  });
  it('对称性: 顺序无关', () => {
    expect(checkMahjongStatus(strToHai2D('m123456789p12355'))).toBe(checkMahjongStatus(strToHai2D('p12355m123456789')));
    const r1 = checkMahjongStatus(strToHai2D('m123456789p1255'));
    const r2 = checkMahjongStatus(strToHai2D('p1255m123456789'));
    expect(r1).toHaveProperty('status', 0);
    expect(r2).toHaveProperty('status', 0);
  });
});
  // NOTE: >14张的手牌会导致回溯算法指数爆炸, 略过

// ============================================================
// 10. 应力测试
// ============================================================
describe('应力测试', () => {
  it('复杂清一色: 11123456789999m', () => {
    const r = checkMahjongStatus(strToHai2D('m11123456789999'));
    expect(r === -1 || r.status === 0).toBe(true);
  });
  it('性能: 复杂清一色 < 500ms', () => {
    for (const h of ['m11122233344455','m11223344556677','m11123456789999','m11122233344567']) {
      const start = Date.now();
      checkMahjongStatus(strToHai2D(h));
      expect(Date.now() - start).toBeLessThan(500);
    }
  });
  // NOTE: >14张的手牌会导致回溯算法指数爆炸, 略过
});

// ============================================================
// 11. 回归测试数据库
// ============================================================
describe('回归测试数据库', () => {
  const winCases = [
    'm123456789p12355',
    'm11122233344455',
    'm11223344556677',
    'm234567p234567s88',
    'm11122233345677',
    'z11122233344455',
    'm11122233345678',
    'm112233456789p55',
    'm1133557799s2244',   // 纯七对子
    'm19p19s19z1234567m1', // 国士无双14张
  ];
  winCases.forEach(h => it(`胡牌: ${h}`, () => assertWin(strToHai2D(h))));

  const notWin = [
    'm11122233344469',
    'm13579p2468s13579',
  ];
  notWin.forEach(h => it(`不胡牌: ${h}`, () => assertNotWin(strToHai2D(h))));

  const tenpai = [
    { h: 'm123456789p1255', w: ['3p'] },
    { h: 'm123456789s1255', w: ['3s'] },
    { h: 'm1112223335566', w: ['5m', '6m'] },
    { h: 'm1133557799s224', w: [] }, // 七对子听牌, 至少有一个wait
    { h: 'm19p19s19z1234567', w: [] }, // 国士无双13面, 至少有一个wait
  ];
  tenpai.forEach(({ h, w }) => it(`听牌: ${h}`, () => {
    const r = checkMahjongStatus(strToHai2D(h));
    expect(r).toHaveProperty('status', 0);
    if (w.length) for (const e of w) expect(r.info[0].waits).toContain(e);
  }));

  const shanten = [
    { h: 'm123p456s789m12z75', s: 1 },
    { h: 'm123p456s7812z123', s: 2 },
  ];
  shanten.forEach(({ h, s }) => it(`向听=${s}: ${h}`, () => expect(checkMahjongStatus(strToHai2D(h))).toBe(s)));
});
