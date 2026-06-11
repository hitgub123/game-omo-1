# 东方幻想麻雀 - Bug追踪

## BUG-001: 庄家配牌多一张 (已修复)

**状态**: ✅ 已修复 (commit `5c6c62d`)
**发现**: 2025-06-07

### 现象
庄家开局15张牌，其他玩家14张。

### 根因
`createInitialState()` 给庄家配了14张（其他人13张），但初始 phase 是 `DRAWING`，触发 `drawTile()` 又摸了一张。

### 修复
每人统一配13张，庄家通过第一次 `drawTile` 摸第14张（标准日本麻将规则）。

---

## BUG-002: 鸣牌按钮不显示 (已修复)

**状态**: ✅ 已修复 (commit `5c6c62d`)
**发现**: 2025-06-07

### 现象
其他玩家弃牌后，人类看不到荣和/碰/吃/杠按钮。

### 根因
`ActionPanel` 始终检查 `state.players[state.currentPlayer]`（弃牌者）的 `actionsAvailable`，弃牌者的动作永远为空。

### 修复
改为检查人类玩家风位 (`humanWind`) 的动作。

---

## BUG-003: 过牌吞AI响应 (已修复)

**状态**: ✅ 已修复 (commit `5c6c62d`)
**发现**: 2025-06-07

### 现象
人类过牌后，AI 的荣和/碰/吃被跳过。

### 根因
`humanAction('pass')` 直接调 `nextTurn`，跳过了 AI 响应机会。

### 修复
过牌时只清除人类自己的 `actionsAvailable`，保留AI响应，让游戏循环自动处理。

---

## BUG-004: 自摸和牌不触发 (已修复)

**状态**: ✅ 已修复 (commit `655dc9e`)
**发现**: 2025-06-07

### 现象
自摸后点击"自摸"按钮没有任何反应。

### 根因
`humanAction('tsumo')` 使用 `execWin(prev, prev.currentPlayer, true)`，但 `prev.currentPlayer` 在某些场景下不是人类玩家。

### 修复
改为 `executeWin(prev, humanWind, true)`，使用人类风位。

---

## BUG-005: AI卡死在ACTION_PROMPT (已修复)

**状态**: ✅ 已修复 (commit `3d320a6`)
**发现**: 2025-06-07

### 现象
AI摸牌后可以立直时，游戏卡死，AI永远不打牌。

### 根因
`processGameState` 的 `ACTION_PROMPT` AI分支中：
```
else if (actions?.canRiichi && aiDecideRiichi(...)) {
    // Already handled in DISCARDING  ← 什么都不做！
}
```
AI有立直选项时这个分支做了空操作，AI永远不进入DISCARDING。

### 修复
删除这个特殊分支，AI统一 `setState(prev2 => ({ ...prev2, phase: GamePhase.DISCARDING }))`。
立直检查在DISCARDING阶段统一处理。

---

## BUG-006: AI硬编码查灵梦 (已修复)

**状态**: ✅ 已修复 (commit `3d320a6`)
**发现**: 2025-06-07

### 现象
AI决策时始终检查博丽灵梦（玩家0）的状态，而不是AI自己的状态。

### 根因
`ai.ts` 两处使用 `state.players[0]` 硬编码：
```javascript
if (state.players[0].hasCalled) return ...  // 应该检查AI自己
const tenpaiOptions = findTenpaiDiscards(hand, state.players[0].melds);  // 应该传入AI的melds
```

### 修复
改为使用传入的 `playerWind` 参数：`state.players[playerWind]`。

---

## BUG-007: 南场立即结束 (已修复)

**状态**: ✅ 已修复 (commit `95e86de`)
**发现**: 2025-06-07

### 现象
进入南场后第一局游戏就结束了。

### 根因
`southEnded` 条件 `roundWind === SOUTH && newDealer === EAST && newHonba === 0` 在刚进入南场时（handCount=4, dealer=EAST, honba=0）立即触发。

### 修复
改为 `newHandCount >= 8`，当8轮非连庄轮庄完成后才结束游戏（4东+4南）。

---

## BUG-008: 立直后手牌全部横放 (已修复)

**状态**: ✅ 已修复 (commit `93a7efb`)
**发现**: 2025-06-07

### 现象
立直后手牌区所有牌旋转90度横放。

### 根因
`PlayerSection` 中每个 `TileComponent` 都传了 `isRiichi={player.isRiichi}`，导致整手牌都应用了旋转样式。

### 修复
`isRiichi` 只应在弃牌区的特定弃牌上使用，手牌区不再传 `isRiichi` 属性。

---

## BUG-009: 立直后游戏卡死 (已修复)

**状态**: ✅ 已修复 (commit `65a5bd6`)
**发现**: 2025-06-07

### 现象
点击"立直"按钮后游戏卡死，无法操作。

### 根因
`humanAction('riichi')` 设置了 `isRiichi = true` 但没有切换 `phase`。立直后 phase 仍然在 `ACTION_PROMPT`，而游戏循环的 `ACTION_PROMT` 处理器对"已立直、无自摸选项"的人类玩家什么都不做。

### 修复
立直后增加 `phase: GamePhase.DISCARDING`，让游戏进入打牌阶段。

---

## BUG-010: 左右玩家弃牌区位置互换 (已修复)

**状态**: ✅ 已修复 (commit `93a7efb`)
**发现**: 2025-06-07

### 现象
玩家（东）的弃牌显示在右边，右家（南）的弃牌显示在下方。实际应该是：自家弃牌在下面，右家弃牌在右边。

### 根因
CSS Grid 中 `.discard-east`（自家）放在了 column 3（右边），`.discard-south`（右家）放在了 column 2 row 3（下方）。

### 修复
互换位置：`.discard-east` → column 2 row 3（下方），`.discard-south` → column 3 row 2（右边）。

---

## BUG-011: 立直宣言时可以选择任何牌 (已修复)

**状态**: ✅ 已修复 (commit `abb6a83`)
**发现**: 2025-06-07

### 现象
点击"立直"按钮后可以打出任意牌，即使打出后不听牌也能立直。

### 根因
立直时没有限制玩家只能打能听牌的牌。

### 修复
点击"立直"后进入"立直选牌模式"（riichiMode），只能点击高亮的（能听牌的）牌来打出。新增"取消立直"按钮。

---

## BUG-012: 新游戏后手里13张牌无法操作 (已修复)

**状态**: ✅ 已修复 (commit `57cc692`)
**发现**: 2025-06-07

### 现象
点击"新游戏"后，提示"你的回合"，但手里只有13张牌，点牌没反应，也不能换牌。

### 根因
`newGame()` 重置状态后，`stateRef.current` 可能因为 React Strict Mode 双渲染或闭包问题没有及时更新，导致游戏循环读取到旧状态。

### 修复
在新游戏时强制立即执行一次游戏循环，确保 DRAWING 阶段被处理。

---

## BUG-013: 上下家手牌区垂直空间不足 (已修复)

**状态**: ✅ 已修复
**发现**: 2025-06-07

### 现象
上家（北）和下家（东/自家）手牌区占用了过多垂直空间，挤压了左右家（西/南）手牌区的高度。

用户描述：牌桌=10宽×6高，当前上下家=宽10高1(各占1单位)，左右家=宽2高4。
期望：上下家宽度略减少(宽8高1)，左右家获得更多垂直空间(宽1高6)。

### 根因
对手手牌区（上）和自家手牌区（下）使用了较大的 padding、gap 和 tile 间距，占用了过多垂直空间，导致 `table-middle` (包含左右家) 可用的高度不足。

### 修复
压缩上下家手牌区的垂直空间：
- `.opponent-horizontal`: padding 4px8px→2px6px, gap 8→4
- `.player-section`: padding 6px8px→3px6px
- `.player-hand`: gap 2→1, padding 4px0→2px0
- `.player-bar`: gap 12→8, margin-bottom 4→1
- `.tenpai-hint`: 压缩 padding 和 margin

---

## BUG-014: executeWin 立直棒重复加算 (已修复)

**状态**: ✅ 已修复
**发现**: 2025-06-07

### 现象
和牌结算时，立直棒点数被加了两次到赢家身上。

### 根因
`gameEngine.ts` `executeWin()` 中两次添加立直棒：
```javascript
// 第一次 (line 358)
players[playerWind].score += state.riichiSticks * 1000;
// ...
// 第二次 (line 362) — 重复！
players[playerWind].score += state.riichiSticks * 1000;
```
且 `scoring.ts` `calculateScore()` 中 `winnerGets` 已经包含了 `riichiBonus`，`executeWin` 不应再手动加算。

### 修复
删除 `executeWin` 中重复的立直棒加算（line 362），保留 `calculateScore`/`calculatePayouts` 统一处理。

---

## BUG-015: 立直棒从未收集 (已修复)

**状态**: ✅ 已修复
**发现**: 2025-06-08

### 现象
立直宣言时 `riichiSticks` 没有 +1，玩家分数也没有 -1000。和牌时赢家收不到立直棒，总分漂移（非 100000）。

### 修复
- 人类立直 (`humanDiscard` riichiMode) 和 AI 立直 (game loop DISCARDING) 两处加 `riichiSticks++` 和 `score -= 1000`
- `executeWin` 不再对 riichi 玩家二次扣分（已扣过），只让赢家收回 `riichiSticks × 1000`

---

## BUG-016: 自摸按钮在立直后消失 (已修复)

**状态**: ✅ 已修复

### 现象
立直玩家摸到和了牌，没有自摸按钮，直接自摸切。

### 根因
`drawTile` 把旧 `state.drawnTile`（上一巡的牌）传给 `getDrawActions` 做和了判定。`checkWin` 收到错误的 winningTile → 判定失败 → `canTsumo=false` → phase 进入 DISCARDING → 自动自摸切。

### 修复
`getDrawActions` 加 `drawnTile` 参数，`drawTile` 传入本地新摸的牌。

---

## BUG-017: 国士无双含中张牌误判听牌 (已修复)

**状态**: ✅ 已修复

### 现象
手牌 19m19p1679s 东南西北白发中，系统提示打 6s/7s 可听牌。但 6s 是中张，不是幺九。

### 根因
`checkTenpaiKokushi` 只数「有多少种幺九」，没验证「所有牌都是幺九」。

### 修复
加 `hand.every(t => isTerminalHonor(t))` 校验。

---

## BUG-018: 平和误判单骑听牌 (已修复)

**状态**: ✅ 已修复

### 现象
手牌 345m3459p345789s 别人打 9p 点炮，系统算平胡。但听牌形是单骑（等 9p 成雀头），不满足平和的两面听牌条件。

### 根因
`checkPinfuShape` 只检查「全顺子+非役牌雀头」，没检查听牌形是否为两面。

### 修复
加 `isRyanmenWait` 函数，坎张/边张/单骑均不算平和。

---

## BUG-019: 二杯口只算 2 翻 (已修复)

**状态**: ✅ 已修复

### 现象
手牌 112233m112233p55s，七对子 2 翻和二杯口+门清自摸 4 翻都成立，系统只取了七对子 2 翻。

### 根因
`checkWin` 检测到七对子就立即 `return`，不再检查标准形（可能翻数更高）。

### 修复
七对子结果与标准形结果比较，取高分。

---

## BUG-020: 七对子不叠加混一色/混老头 (已修复)

**状态**: ✅ 已修复

### 现象
七对子和牌时，即使手牌满足混一色/混老头/清一色/断幺，也只显示七对子 2 翻。

### 修复
七对子检测后追加混一色(3翻)、清一色(6翻)、混老头(2翻)、断幺(1翻)判定。

---

## BUG-021: 役满显示 13翻20符 + 低阶役 (已修复)

**状态**: ✅ 已修复

### 现象
役满和牌时显示「13翻20符」和所有低阶役（对对和、三暗刻等）。

### 修复
- `evaluateHand` 役满结果只保留役满役种（`yaku.filter(y => y.isYakuman)`），fu=0
- `GameOverModal` 役满时只显示「役满」不显示翻符数

---

## BUG-022: 换牌时手牌未放回牌山 (已修复)

**状态**: ✅ 已修复

### 现象
换 2s 换 2s，牌山 2s 剩余-1；换 2s 换 3s，3s 剩余-1 但 2s 剩余没 +1。

### 根因
`executeSwap` 从手牌取出旧牌后，没有 `newWall.push(oldTile)` 放回牌山。

### 修复
加 `newWall.push(oldTile)`。

---

## BUG-023: 流局罚符 1500→3000 (已修复)

**状态**: ✅ 已修复

### 根因
`executeDraw` 总罚符池用 1500 而非标准 3000。

### 修复
公式改为 `ceil(3000 / max(不聴人数, 聴牌人数) / 100) × 100`，按索引循环配对。

---

## BUG-024: 本场费未计入支付 (已修复)

**状态**: ✅ 已修复

### 根因
`calculatePayouts` 的 ron/tsumo 金额不含本场费.

### 修复
`ronPayment` = 基础分 + 本场×300，自摸每家 + 本场×100。



## BUG-025: 有副露时自摸和牌按钮不显示 (已修复)

**状态**: ❌ 未确认
<!-- **状态**: ✅ 已修复
**发现**: 2026-06-11

### 现象
鸣牌了 777m 456m 3333z，手牌 78m 11z，自摸 9m 后本可和牌（混一色），但游戏界面没有出现自摸按钮，只出现了加杠按钮。

### 根因
`GetDrawActions` 中 `checkWin` 检测正常（syanten/-1, riichi库/agari），但 `canTsumo` 被后续 `canKakan` 检查覆盖。实际原因为状态传递时序问题——`lastDiscard` 未及时清空导致 UI 进入了响应分支而非摸牌分支。添加 `claimedDiscardTileIds` 时顺带修复了状态一致性。

### 修复
- 添加 `claimedDiscardTileIds` 到 `GameState`，确保被鸣的牌保留在弃牌区（半透明）
- 修复 `executeMeld`/`executeWin` 中 `claimedDiscardTileIds` 的追踪
- 添加 `createNextHand` 中遗漏的 `claimedDiscardTileIds: []` -->

---

## BUG-026: 组队模式第一局结束后无法进入第二局 (已修复)

**状态**: ✅ 已修复
**发现**: 2026-06-11

### 现象
组队模式第一局游戏结束后，点击"下一局"按钮无反应，不能进入第二个人的对局。

### 根因
`createNextHand` 在 gameEngine.ts 中硬编码 `TOUHOU_CHARACTERS[wind].name`，覆盖了自定义玩家名字。同时 `useGame` 中没有组队模式的段（segment）切换逻辑。

### 修复
1. `gameEngine.ts` — `createNextHand` 改用 `prevState.players[wind].name` 继承上一局玩家名
2. `hooks/useGame.ts` — 添加 `teamRosterRef`（4队×5人）、`currentRoundRef`
3. `GameController.ts` — `newGame(characters?)` 和 `nextHand(characters?)` 接受可选参数
4. 添加 `useEffect` 监听 `GAME_OVER`：组队模式下自动保存分数 → 创建下一段游戏 → 恢复分数
5. 修复 `charsRef = useRef(initialChars)` 传递错误（之前传20人数组的前4个，全是第一队）

---

## BUG-027: 组队模式确认阵容顺序不一致 (已修复)

**状态**: ✅ 已修复
**发现**: 2026-06-11

### 现象
组队模式选完5人后，确认弹窗显示的顺序与选人时的顺序不一致；进入游戏后玩家的顺序又与前面两者不同。

### 根因
`handleConfirm` 和确认弹窗渲染中两次调用了 `[...members].sort(() => Math.random() - 0.5)` 重新随机排序。

### 修复
移除两处随机排序。选人时的点击顺序即最终游戏顺序。快速开始已在选队/选人时随机过一次，不再重复随机。

---

## BUG-028: 33p碰4p (未修复)

**状态**: ❌ 未修复
**发现**: 2026-06-11

### 现象
有时候会出现 33p 碰 4p 的情况（本应只能碰相同牌，却碰了不同数字的牌）。

### 根因
待调查。

---

## BUG-029: 下一局白屏 — claimedDiscardTileIds is undefined (已修复)

**状态**: ✅ 已修复
**发现**: 2026-06-11

### 现象
打完一把后点击"下一局"白屏，控制台报错 `Cannot read properties of undefined (reading 'includes')`。

### 根因
`createNextHand` 返回的新 `GameState` 缺少 `claimedDiscardTileIds` 字段。

### 修复
`createNextHand` 返回值中添加 `claimedDiscardTileIds: []`。

---

## BUG-030: 立直选牌只能选第一张重复牌 (已修复)

**状态**: ✅ 已修复
**发现**: 2026-06-11

### 现象
手牌有两张相同的牌（如两张 5p，其中一张是赤宝牌），点击立直后只能选中第一张，第二张无法选中。

### 根因
`useGame.ts` 中立直选牌使用 `Array.find()` 匹配牌，`find` 只返回第一张匹配的牌，第二张被忽略。

### 修复
改用 `Array.filter()` + 循环，将所有匹配牌都加入 `validMap`。

---

## BUG-031: 组队模式第一段四人都来自同一队 (已修复)

**状态**: ✅ 已修复
**发现**: 2026-06-11

### 现象
组队模式第一段（第一场东风/东南战）的 4 个玩家全部来自第一队，而不是每队各 1 人。

### 根因
`charsRef = useRef(characters)` 存的是全部 20 人数组。`GameController` 构造时调用 `createInitialState(this._characters)` 只取前 4 人（全是第一队）。然后控制器的 `emit()` 通过 subscriber 覆盖了 React state。

### 修复
`charsRef = useRef(initialChars)` 改为只存当前段的 4 人。`initialChars` 从 roster 中取 `[队1人1, 队2人1, 队3人1, 队4人1]`。

---

## BUG-032: Saki 附录污染角色数据 (已修复)

**状态**: ✅ 已修复
**发现**: 2026-06-11

### 现象
`characters.json` 中 players 组的射命丸文显示 `race=海底捞月`、`mahjong_skill=隐形`，数据来自 Saki 附录。

### 根因
`flush_char()` 在最后一个角色（play-08）后未被触发，`current_char` 保留旧引用。Saki 附录的表格被读入最后一个角色。

### 修复
1. 解析器添加 `## 非角色标题 → flush_char()` 逻辑
2. 引用补全改为强制覆盖所有字段

---

## BUG-033: 组队模式选人确认弹窗背景变灰 (已修复)

**状态**: ✅ 已修复
**发现**: 2026-06-11

### 现象
确认弹窗背景为纯灰色，遮盖了选人界面的背景图。

### 修复
`confirm-overlay` 改为 `background: rgba(0,0,0,0.3)` + `backdrop-filter: blur(4px)`，选人界面背景透出。