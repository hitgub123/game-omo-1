# Bug 票

## BUG-001: 立直后不自摸切

**状态**: 已修复  
**发现日期**: 2026-06-08  
**修复日期**: 2026-06-08  

### 现象
玩家立直后，轮到摸牌时不会自动切掉摸到的牌，需要手动点击。

### 根因
`GameController.tick()` 的 DISCARDING 阶段只对 AI 做了自动弃牌，人类玩家直接 `return` 等待点击，没有判断是否已立直。

### 修复
`GameController.ts:94-98` — 在 DISCARDING 分支追加：

```typescript
} else if (cp.isRiichi && s.drawnTile) {
    this._state = discardTile(s, s.drawnTile.id);
    this.emit();
    this.schedule(50);
}
```

---

## BUG-002: 换牌后不整理牌序

**状态**: 已修复  
**发现日期**: 2026-06-08  
**修复日期**: 2026-06-08  

### 现象
换牌后手牌顺序混乱，没有按花色+数字排序。

### 根因
`executeSwap()` 只替换了手牌中的一张牌，没对手牌排序。

### 修复
`GameController.ts:441-448` — 换牌后对玩家的 hand 调用 `sortHand()`。

---

## BUG-003: 换牌后不能立直

**状态**: 已修复  
**发现日期**: 2026-06-08  
**修复日期**: 2026-06-08  

### 现象
换牌后明明门清听牌了，立直按钮不出来。

### 根因
`executeSwap()` 只更新了手牌和牌山，没有重算 `actionsAvailable`。正常摸牌时 `drawTile()` 调用 `getDrawActions()` 计算 `canRiichi/canTsumo`，但换牌流程缺了这步。

### 修复
- `gameEngine.ts`: 导出 `getDrawActions()` 和 `emptyActions()`
- `GameController.ts:451-457` — 换牌后调 `getDrawActions()` 重算可执行动作

---

## BUG-004: 初始 render 时 players 为空数组导致崩溃

**状态**: 已修复  
**发现日期**: 2026-06-08  
**修复日期**: 2026-06-08  

### 现象
打开游戏页面后控制台报错：`Cannot read properties of undefined (reading 'name')`

### 根因
`useGame.ts` 的 `createInitialState()` 返回 `players: []`，首帧渲染时 `OpponentSection` 取 `state.players[wind]` 拿到的 `undefined`，访问 `.name` 报错。`GameController` 在 `useEffect` 的 `setTimeout(100ms)` 后才替换真正的 state。

### 修复
`useGame.ts:223-246` — 初始 players 改为 4 个占位对象。

---

## BUG-005: 89m/89s 边张听不被识别 (syanten.js)

**状态**: 已修复  
**发现日期**: 2026-06-08  
**修复日期**: 2026-06-08  

### 现象
持有 89m 或 89s 作为唯一搭子时，向听数计算为 1（应为 0 听牌）。

### 根因
`getShantenNormal()` 中 AB（连张搭子）检测的条件 `(index%9)<7` 限制了起始索引≤6，导致索引 7 (8m/8s) 和 8 (9m/9s) 上的搭子被跳过。

### 修复
AB 检测边界改为 `(index%9)<8`，ABC 和 AC 保持 `<7`。

---

## BUG-006: 里宝牌数据缺失

**状态**: 已修复  
**发现日期**: 2026-06-08  
**修复日期**: 2026-06-08  

### 现象
`uraDoraIndicators` 始终为空数组，里宝牌从未被记录。

### 根因
`createInitialState()` 和 `drawAfterKan()` 都初始化 `uraDoraIndicators: []`，但没有往里填充数据。

### 修复
- 初始里宝牌 = `deadWall[5]`
- 每次杠后同时记录对应的里宝牌（`deadWall[newDoraIdx + 5]`）
