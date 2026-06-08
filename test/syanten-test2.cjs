// syanten 使用演示 - 日麻向聴数计算（修正版）
const syanten = require('syanten');

// 牌型: [萬子1-9][筒子1-9][索子1-9][字牌(東南西北白發中)]
// 手牌总枚数: 14(自家) / 13(他家) / 11,10 / 8,7 / 5,4 / 2,1

function countTiles(hai) {
    let sum = 0;
    for (let g of hai) for (let n of g) sum += n;
    return sum;
}

// ========== 向聴数计算 ==========
console.log("=== 向聴数计算 ===");

// 手牌: 1112345678999m (14枚 - 九莲宝灯形)
let hand1 = [
    [3, 1, 1, 1, 1, 1, 1, 1, 3], // 萬子 1 1 1 2 3 4 5 6 7 8 9 9 9
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0]
];
console.log("手牌: 1112345678999m (" + countTiles(hand1) + "枚)");
console.log("  一般形:", syanten.syanten(hand1));
console.log("  七対子形:", syanten.syanten7(hand1));
console.log("  国士形:", syanten.syanten13(hand1));
console.log("  最小:", syanten(hand1));

// 手牌: 東東東南南南西西北北北+発発 (14枚 - 大四喜听牌)
let hand2 = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [3, 3, 3, 3, 0, 2, 0] // 東3 南3 西3 北3 発2
];
console.log("\n手牌: 東東東南南南西西北北北発発 (" + countTiles(hand2) + "枚)");
console.log("  一般形:", syanten.syanten(hand2));
console.log("  七対子形:", syanten.syanten7(hand2));
console.log("  最少:", syanten(hand2));

// ========== 牌理计算 ==========
console.log("\n=== 牌理计算(一般形, 14枚) ===");

// 手牌: 111m + 222m + 333m + 11p + 東南西 (14枚)
// 111 222 333 + 11p + 東南西 → 打哪张？
let hand3 = [
    [3, 3, 3, 0, 0, 0, 0, 0, 0], // 1m×3, 2m×3, 3m×3 = 9枚
    [2, 0, 0, 0, 0, 0, 0, 0, 0], // 1p×2 = 2枚
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 0, 0, 0, 0]         // 東南西 = 3枚
];                                // 总计 14枚
console.log("手牌: 111m222m333m11p東南西 (" + countTiles(hand3) + "枚)");
let r3 = syanten.hairi(hand3);
console.log("  当前向聴:", r3.now);
for (let [k, v] of Object.entries(r3)) {
    if (k === 'now') continue;
    let waits = Object.entries(v).map(([tile, cnt]) => `${tile}${cnt}枚`).join(', ');
    console.log(`  打${k.padEnd(2,' ')} → 待: ${waits}`);
}

// ========== 13枚(自摸前) ==========
console.log("\n=== 牌理计算(13枚, 自摸前) ===");
let hand4 = [
    [3, 3, 3, 0, 0, 0, 0, 0, 0], // 1m3 2m3 3m3 = 9枚
    [1, 0, 0, 0, 0, 0, 0, 0, 0], // 1p = 1枚
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 0, 0, 0, 0]         // 東南西 = 3枚
];                                // 总计 13枚
console.log("手牌: 111m222m333m1p東南西 (" + countTiles(hand4) + "枚)");
let r4 = syanten.hairi(hand4);
console.log("  当前向聴:", r4.now);
console.log("  进张:", JSON.stringify(r4.wait));

// ========== 七对子牌理 ==========
console.log("\n=== 七对子/国士牌理 ===");
let hand5 = [
    [2, 2, 2, 0, 0, 0, 0, 0, 0], // 1m2 2m2 3m2 = 6枚
    [1, 0, 0, 0, 0, 0, 0, 0, 0], // 1p = 1枚
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [2, 2, 1, 1, 1, 0, 0]         // 東2 南2 西1 北1 白1 = 7枚
];                                // 总计 14枚
console.log("手牌: 11m22m33m1p東東南南西北白 (" + countTiles(hand5) + "枚)");
let r5 = syanten.hairi(hand5, true);  // true = 包含七对子+国士
console.log("  当前向聴:", r5.now);
for (let [k, v] of Object.entries(r5)) {
    if (k === 'now') continue;
    let waits = Object.entries(v).map(([t, c]) => `${t}${c}枚`).join(', ');
    console.log(`  打${k.padEnd(2,' ')} → 待: ${waits}`);
}

console.log("\n=== 总结 ===");
console.log("返回值的含义: -1=和了 0=听牌 1+=向聴数 -2=牌数不正确");
