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

**状态**: ✅ 已修复 (commit `TBD`)
**发现**: 2025-06-07

### 现象
点击"立直"按钮后可以打出任意牌，即使打出后不听牌也能立直。

### 根因
立直时没有限制玩家只能打能听牌的牌。

### 修复
点击"立直"后进入"立直选牌模式"（riichiMode），只能点击高亮的（能听牌的）牌来打出。新增"取消立直"按钮。

---

## BUG-012: 新游戏后手里13张牌无法操作 (已修复)

**状态**: ✅ 已修复 (commit `TBD`)
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


### 现象
上家（北）和下家（东/自家）手牌区占用了过多垂直空间，挤压了左右家（西/南）手牌区的高度。

### 根因
对手手牌区（上）和自家手牌区（下）使用了固定的 padding 和高度，左右手牌区只能使用中间剩余的空间。

### 修复
减少上家和下家手牌区的padding和间距，让中间区域有更多垂直空间给左右家。
