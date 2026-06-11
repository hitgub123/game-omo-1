# Riichi 库封装与游戏引擎修复记录

## 目录
1. [架构变更](#架构变更)
2. [riichi 库输入格式](#riichi-库输入格式)
3. [已修复的 Bug](#已修复的-bug)
4. [本地 riichi 库 (Fork)](#本地-riichi-库-fork)
5. [相关文件](#相关文件)

---

## 架构变更

### 和牌检测流程

```
亮按钮阶段 (getResponseActions / tsumo 检查):
  syanten(手牌 + 和牌) === -1?
    ↓ false          ↓ true
   不亮按钮          riichi 检查有役?
                      ↓ false    ↓ true
                     不亮按钮    亮按钮

玩家点按钮后 (executeWin):
  riichi 计算翻/符/役 → 无役则拒绝和了
```

**原则**：
- syanten 引擎做主判断（快、准确）
- riichi 库只算分（不参与和牌形状判断）
- 两者都通过才允许和牌

### 性能优化

- 不开 log-server 时，fetch 瞬间失败 → 不影响游戏速度
- `canWinBySyanten` 快速过滤明显不能和的牌型，避免不必要的 riichi 库调用

---

## riichi 库输入格式

### 副露格式（全部带 `+` 前缀）

| 类型 | 正确格式 | 错误格式（旧代码） | 说明 |
|------|---------|------------------|------|
| 暗杠 (ankan) | `+44p` | `+4p4p` | 数字重复2次+花色1次 |
| 明杠 (minkan) | `+7777z` | `+7z7z7z7z` | 数字重复4次+花色1次 |
| 加杠 (kakan) | `+4444m` | `+4m4m4m4m` | 数字重复4次+花色1次 |
| 碰 (pon) | `+444m` | `444m`(缺+) | 数字重复3次+花色1次 |
| 吃 (chi) | `+123m` | `123m`(缺+) | 连续数字+花色1次 |

**关键规则**：
- 所有副露前必须有 `+` 前缀
- 库通过数字重复次数区分类型：2=暗杠, 3=碰/顺子, 4=明杠
- 花色只在数字后出现 **一次**
- `tileStr(t).repeat(n)` 是错误的，`repeat` 会连花色一起重复

### 选项字符串

| 选项 | 含义 |
|------|------|
| `r` | 立直 (riichi) |
| `w` | 双立直 (double riichi / w-riichi) |
| `i` | 一发 (ippatsu) |
| `11` | 场风东+自风东（前=场风, 后=自风, 1=东 2=南 3=西 4=北） |

示例：`+w11` = 双立直 + 场风东/自风东

### 完整输入示例

```
# 暗杠 4p + 双立直 + 场风东/自风东
1m1m1m9m9m9m7s8s9s2z+44p+2z+w11

# 暗杠 4p + 碰 4m + 立直 + 场风东/自风东
6s7s8s9s1z1z1z+44p+444m+6s+r11

# 吃 123m + 一気通貫 + 立直
1m1m4m5m6m7m8m9m5s6s+123m+7s+r11
```

---

## 已修复的 Bug

### Bug 1: 暗杠格式错误 → 0翻0符
- **现象**: 暗杠后和牌显示 0翻0符
- **根因**: 暗杠格式用了 `+4p4p`（每张牌独立带花色），库无法识别，返回 yaku={}
- **修复**: 改为 `+44p`（数字重复+花色一次）
- **文件**: `src/game/riichi-check.ts` line 117-120

### Bug 2: 碰/吃缺 `+` 前缀 → 役种检测失败
- **现象**: 有副露时 riichi 库返回 yaku={}，按钮不亮
- **根因**: 碰 `444m` 和吃 `123m` 前缺 `+`，库把副露当成手牌解析
- **修复**: 所有副露前加 `+` 前缀
- **文件**: `src/game/riichi-check.ts` line 121-122

### Bug 3: riichi 库误判「不成搭子」手牌
- **现象**: `1p5p6p + 副露234p` 被当成和牌
- **根因**: riichi 库错误地把副露牌重复算入手牌
- **修复**: syanten 引擎做主判断，拒绝不合理的和牌
- **文件**: `src/game/riichi-check.ts` line 130-140

### Bug 4: executeWin 无役也执行和牌
- **现象**: 无役手牌显示 0翻0符 1000分
- **根因**: riichiCheckWin 返回 `{yaku:[], han:0, fu:0}`，executeWin 只检查 `!null`
- **修复**: riichiCheckWin 无役时返回 null，executeWin 拒绝
- **文件**: `src/game/riichi-check.ts` line 158-162

### Bug 5: 双立直 + 暗杠不生效
- **现象**: 暗杠后双立直(`w`)被忽略
- **根因**: riichi 库 `yaku.js` 中双立直检查有 `!o.furo.length`，排除了所有副露（包括暗杠）
- **修复**: 删除 `&& !o.furo.length`，`isMenzenOnly` 已通过 `isMenzen()` 正确区分暗杠
- **文件**: `utils/riichi-lib/yaku.js` line 251-253（本地 fork）

### Bug 6: 明杠/加杠格式错误
- **现象**: 明杠/加杠时 riichi 库解析错误
- **根因**: 同 Bug 1，`tileStr().repeat(4)` 连花色一起重复了
- **修复**: 改为数字重复4次+花色1次
- **文件**: `src/game/riichi-check.ts` line 119-120

---

### 本地 riichi 库 (Fork & ESM 转换)

### 位置
- `utils/riichi-lib/` — 从 npm `riichi@1.2.0` fork，**已转为 ESM**
- 入口：`utils/riichi-lib/index.js`
- import：`import Riichi from '../../utils/riichi-lib/index.js'`

### 修改内容

1. **CJS → ESM 转换**（适配 Vite 浏览器打包）：
   - `require('agari')` → `import agari from 'agari'`
   - `require('./yaku')` → `import YAKU from './yaku.js'`
   - `module.exports = Riichi` → `export default Riichi`
   - 同上转换 `yaku.js`，并移除 `assert` 依赖（用 JSON.stringify 替代）
   - `package.json` 增加 `"type": "module"`

2. **双立直 bug 修复**（`yaku.js`）：
```javascript
// 旧（bug）:
"ダブル立直":{"han":2, "isMenzenOnly":true, "check":(o)=>{
    return o.extra.includes('w') && !o.furo.length
}},
// 新（修复）:
"ダブル立直":{"han":2, "isMenzenOnly":true, "check":(o)=>{
    return o.extra.includes('w')
}},
```

### 测试命令
```bash
cd ~/ai-projects/game-omo-1
node -e "
const Riichi = require('./utils/riichi-lib');
let r = new Riichi('1m1m1m9m9m9m7s8s9s2z+44p+2z+w11').calc();
console.log(r.yaku);  // 应包含 三暗刻 和 ダブル立直
"
```

---

## 相关文件

| 文件 | 作用 |
|------|------|
| `src/game/riichi-check.ts` | riichi 库封装，syanten 验牌 + riichi 算分 |
| `src/game/gameEngine.ts` | 和牌/荣和/自摸检测逻辑 |
| `src/game/hand.ts` | 导出 checkWin / canWinBySyanten |
| `utils/riichi-lib/index.js` | 本地 fork 的 riichi 库入口 |
| `utils/riichi-lib/yaku.js` | 本地 fork 的役种定义（双立直已修复） |
| `scripts/log-server.mjs` | 日志服务器 |
| `src/debug/GameLogger.ts` | 游戏日志收集器 |
