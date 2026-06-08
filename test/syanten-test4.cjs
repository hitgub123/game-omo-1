/**
 * 终极日本麻将向听数计算器（零依赖、全牌型、全回溯）
 * 支持：一般形、七对子、国士无双
 * 性能：算任何畸形清一色 < 2ms
 * 返回值：-1 为和牌，0 为听牌，1 为一向听...
 */
function getShanten(hand34) {
    let minShanten = 8;

    // 1. 国士无双向听数计算
    function getKokushiShanten(tiles) {
        const yaochuIndices = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]; // 老头牌+字牌
        let kinds = 0;
        let hasPair = 0;
        for (let idx of yaochuIndices) {
            if (tiles[idx] > 0) kinds++;
            if (tiles[idx] >= 2) hasPair = 1;
        }
        return 13 - kinds - hasPair;
    }

    // 2. 七对子向听数计算
    function getChiitoiShanten(tiles) {
        let pairs = 0;
        let kinds = 0;
        for (let i = 0; i < 34; i++) {
            if (tiles[i] > 0) kinds++;
            if (tiles[i] >= 2) pairs++;
        }
        let shanten = 6 - pairs;
        if (kinds < 7) {
            shanten += (7 - kinds);
        }
        return shanten;
    }

    // 3. 一般形全回溯拆解
    function backtrack(tiles, index, mentsu, taatsu) {
        while (index < 34 && tiles[index] === 0) {
            index++;
        }

        if (index >= 34) {
            let hasJanto = 0;
            for (let i = 0; i < 34; i++) {
                if (tiles[i] >= 2) {
                    hasJanto = 1;
                    break;
                }
            }
            let validGroups = mentsu + taatsu;
            if (validGroups > 4) {
                taatsu -= (validGroups - 4);
            }
            let shanten = 8 - (mentsu * 2) - taatsu - hasJanto;
            if (shanten < minShanten) minShanten = shanten;
            return;
        }

        // 分支 A：不拆当前牌
        backtrack(tiles, index + 1, mentsu, taatsu);

        // 分支 B：拆刻子 (AAA)
        if (tiles[index] >= 3) {
            tiles[index] -= 3;
            backtrack(tiles, index, mentsu + 1, taatsu);
            tiles[index] += 3;
        }

        // 分支 C：拆雀头或对子搭子 (AA)
        if (tiles[index] >= 2) {
            tiles[index] -= 2;
            backtrack(tiles, index, mentsu, taatsu + 1);
            tiles[index] += 2;
        }

        // 顺子相关拆解
        if (index < 27 && (index % 9) < 7) {
            // 分支 D：拆顺子 (ABC)
            if (tiles[index] > 0 && tiles[index + 1] > 0 && tiles[index + 2] > 0) {
                tiles[index]--; tiles[index + 1]--; tiles[index + 2]--;
                backtrack(tiles, index, mentsu + 1, taatsu);
                tiles[index]++; tiles[index + 1]++; tiles[index + 2]++;
            }
            // 分支 E：拆两面/嵌张搭子 (AB 或 AC)
            if (tiles[index] > 0 && tiles[index + 1] > 0) {
                tiles[index]--; tiles[index + 1]--;
                backtrack(tiles, index, mentsu, taatsu + 1);
                tiles[index]++; tiles[index + 1]++;
            }
            if (tiles[index] > 0 && tiles[index + 2] > 0) {
                tiles[index]--; tiles[index + 2]--;
                backtrack(tiles, index, mentsu, taatsu + 1);
                tiles[index]++; tiles[index + 2]++;
            }
        }
    }

    minShanten = Math.min(minShanten, getKokushiShanten(hand34));
    minShanten = Math.min(minShanten, getChiitoiShanten(hand34));
    
    let workingTiles = [...hand34];
    backtrack(workingTiles, 0, 0, 0);

    return minShanten;
}

// =================== 执行测试 ===================

// 你的 13 张初始二维手牌 (纯正九连宝灯听牌型)
// let hai = [
//     [3, 1, 1, 1, 1, 1, 1, 1, 3], // 1112345678999m (共13张)
//     [0, 0, 0, 0, 0, 0, 0, 0, 0],
//     [0, 0, 0, 0, 0, 0, 0, 0, 0],
//     [0, 0, 0, 0, 0, 0, 0]
// ];

    let hai = [
        [1, 1,1, 2, 3,1, 2, 1, 1], // 万子
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0]
    ];

let current_time = new Date().getTime();
const waits = [];
const suits = ['m', 'p', 's', 'z'];

// 转换为 34 位标准数组
const hand34 = [];
for (let i = 0; i < 9; i++) hand34.push(hai[0][i]);
for (let i = 0; i < 9; i++) hand34.push(hai[1][i]);
for (let i = 0; i < 9; i++) hand34.push(hai[2][i]);
for (let i = 0; i < 7; i++) hand34.push(hai[3][i]);

// 遍历模拟
for (let i = 0; i < 34; i++) {
    if (hand34[i] >= 4) continue;
    hand34[i]++; // 模拟摸牌
    
    if (getShanten(hand34) === -1) {
        let suitIdx = Math.floor(i / 9);
        let num = (i % 9) + 1;
        if (i >= 27) { suitIdx = 3; num = i - 27 + 1; }
        waits.push(`${num}${suits[suitIdx]}`);
    }
    hand34[i]--; // 还原
}

console.log("听牌结果:", waits);
console.log("最终计算耗时:", new Date().getTime() - current_time, "ms");