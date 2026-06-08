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
let hand1 = [
    [3,3, 3, 2, 1, 0, 0, 1, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0]
];
let hand2 = [
    [3,3, 3, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0]
];
let hand3 = [
    [1,0, 0, 0, 0, 0, 0, 0,1],
    [1,0, 0, 0, 0, 0, 0, 0,1],
    [1,0, 0, 0, 0, 0, 0, 0,1],
    [1, 1, 1, 1, 1, 1, 1]
];

    let hai = [
        [1, 1, 2, 2, 2,2, 2, 1, 0], // 万子
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0]
    ];
    //     let hai = [
    //     [1, 1, 1, 2, 2,2, 1,0, 0], // 万子
    //     [0, 0, 0, 0, 0,0, 0, 0, 0],
    //     [0, 0, 0, 0, 0, 0, 2, 0, 0],
    //     [0, 0, 0, 0, 0, 0, 0]
    // ];

    // let result = syanten.hairi(hai);
    // console.log(result);
    current_time=new Date().getTime();

    console.log("计算耗时:", new Date().getTime() - current_time, "ms");
for(i=0;i<hai.length;i++){
    for(j=0;j<hai[i].length;j++){
        hai[i][j] = hai[i][j] +1;
        // console.log(hai)
        // console.log("\n手牌: " + countTiles(hai) + "枚)");
        console.log("  一般形:", syanten.syanten(hai));
        hai[i][j] = hai[i][j] -1;
    }
}
    console.log("计算耗时:", new Date().getTime() - current_time, "ms");
    
// console.log("=================================================================");
// // console.log(hand1);
// console.log("\n手牌: " + countTiles(hand1) + "枚)");
// console.log("  一般形:", syanten.syanten(hand1));
// console.log("  七対子形:", syanten.syanten7(hand1));
// console.log("  最少:", syanten(hand1));
// console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
// console.log("\n=== 牌理计算===");
// let r3 = syanten.hairi(hand1);
// console.log("  当前向聴:", r3.now);
// for (let [k, v] of Object.entries(r3)) {
//     if (k === 'now') continue;
//     let waits = Object.entries(v).map(([tile, cnt]) => `${tile}${cnt}枚`).join(', ');
//     console.log(`  打${k.padEnd(2,' ')} → 待: ${waits}`);
// }
// console.log("\n手牌: " + countTiles(hand2) + "枚)");
// console.log("  一般形:", syanten.syanten(hand2));
// console.log("  七対子形:", syanten.syanten7(hand2));
// console.log(syanten.syanten13(hand2))   //国士形


// console.log("=================================================================");
// // console.log(hand2);
// console.log("\n手牌: " + countTiles(hand2) + "枚)");
// console.log("  一般形:", syanten.syanten(hand2));
// console.log("  七対子形:", syanten.syanten7(hand2));
// console.log("  最少:", syanten(hand2));
// console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
// console.log("\n=== 牌理计算===");
// let r4 = syanten.hairi(hand2);
// console.log("  当前向聴:", r4.now);
// for (let [k, v] of Object.entries(r4)) {
//     if (k === 'now') continue;
//     let waits = Object.entries(v).map(([tile, cnt]) => `${tile}${cnt}枚`).join(', ');
//     console.log(`  打${k.padEnd(2,' ')} → 待: ${waits}`);
// }

// let r42 = syanten.hairi(hand2,true);
// console.log("  当前向聴-七対&国士牌理計算:", r42.now);
// for (let [k, v] of Object.entries(r42)) {
//     if (k === 'now') continue;
//     let waits = Object.entries(v).map(([tile, cnt]) => `${tile}${cnt}枚`).join(', ');
//     console.log(`  打${k.padEnd(2,' ')} → 待: ${waits}`);
// }




// // ========== 七对子牌理 ==========
// console.log("\n=== 七对子/国士牌理 ===");
// let hand5 = [
//     [2, 2, 2, 0, 0, 0, 0, 0, 0], // 1m2 2m2 3m2 = 6枚
//     [1, 0, 0, 0, 0, 0, 0, 0, 0], // 1p = 1枚
//     [0, 0, 0, 0, 0, 0, 0, 0, 0],
//     [2, 2, 1, 1, 1, 0, 0]         // 東2 南2 西1 北1 白1 = 7枚
// ];                                // 总计 14枚
// console.log("手牌: 11m22m33m1p東東南南西北白 (" + countTiles(hand5) + "枚)");
// let r5 = syanten.hairi(hand5, true);  // true = 包含七对子+国士
// console.log("  当前向聴:", r5.now);
// for (let [k, v] of Object.entries(r5)) {
//     if (k === 'now') continue;
//     let waits = Object.entries(v).map(([t, c]) => `${t}${c}枚`).join(', ');
//     console.log(`  打${k.padEnd(2,' ')} → 待: ${waits}`);
// }

console.log("\n=== 总结 ===");
console.log("返回值的含义: -1=和了 0=听牌 1+=向聴数 -2=牌数不正确");
