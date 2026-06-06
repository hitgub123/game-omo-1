# 东方幻想麻雀 - 状态机测试式样书

## 状态一览

| 状态 | 含义 | lastDiscard | 可做的动作 |
|------|------|-------------|-----------|
| DRAWING | 当前玩家摸牌前 | undefined | 自动drawTile |
| DISCARDING | 当前玩家选牌打出 | undefined | 选牌→discardTile |
| ACTION_PROMPT | 动作选择（子类型2种） | 有/无 | 见下方 |
| HAND_OVER | 一局结束 | - | 无 |

**ACTION_PROMPT 的两个子类型：**

| 子类型 | lastDiscard | 触发条件 | 可做的动作 |
|--------|-------------|---------|-----------|
| POST_DRAW | undefined | drawTile后玩家有tsumo/riichi等选项 | tsumo/riichi/ankan/kakan/discard |
| POST_DISCARD | 有值 | 有人弃牌后其他玩家可以响应 | ron/pon/chi/kan/pass |

---

## 测试用例全集

### TC1: DRAWING → 正常摸牌

**前提**: phase=DRAWING, wall.length > 0
**操作**: drawTile()
**期待结果**:
- wall.length -= 1
- 当前玩家手牌+1
- drawnTile = 摸到的牌
- turn += 1
- phase = DISCARDING（如果没有tsumo/riichi等选项）
- actionsAvailable[currentPlayer] 有正确的选项

**确认点**:
- [x] wall减少1枚
- [x] hand增加1枚（排序保持）
- [x] turn增加

### TC2: DRAWING → 牌山耗尽

**前提**: phase=DRAWING, wall.length = 0
**操作**: drawTile()
**期待结果**: phase → HAND_OVER（荒牌流局）

### TC3: DISCARDING → 人类打牌

**前提**: phase=DISCARDING, currentPlayer = 人类
**操作**: 点击手牌 → humanDiscard(tileId)
**期待结果**:
- 手牌移除选中牌
- discards增加
- lastDiscard = 打出的牌
- lastDiscardPlayer = currentPlayer
- phase → ACTION_PROMPT（如果其他玩家能响应）
- phase → DRAWING（下家，如果无人能响应）

**确认点**:
- [x] discardTile中其他玩家的actionsAvailable正确
- [x] ron/pon/chi/kan的检查逻辑正确
- [x] 无人响应时正确进入下一家

### TC4: DISCARDING → AI打牌

**前提**: phase=DISCARDING, currentPlayer = AI
**操作**: aiChooseDiscard() → discardTile()
**期待结果**: 同TC3

**追加确认**:
- [x] AI选择牌的逻辑不报错
- [x] AI可以立直
- [x] AI立直后标记isRiichi

### TC5: POST_DISCARD → 人类荣和

**前提**: phase=ACTION_PROMPT, lastDiscard有值, 人类有canRon
**操作**: 点击"荣和"按钮 → humanAction('ron')
**期待结果**:
- executeWin(humanWind, false) 被调用
- phase → HAND_OVER
- result.type = 'ron'

### TC6: POST_DISCARD → 人类碰

**前提**: phase=ACTION_PROMPT, lastDiscard有值, 人类有canPon
**操作**: 点击"碰"按钮 → humanAction('pon')
**期待结果**:
- executeMeld(humanWind, PON, matching2Cards) 被调用
- 手牌减少2张（匹配的牌）
- melds增加
- lastDiscard = undefined
- phase → DISCARDING
- currentPlayer = humanWind（碰的人继续）

### TC7: POST_DISCARD → 人类吃

**前提**: phase=ACTION_PROMPT, lastDiscard有值, 人类有canChi, 人类是弃牌者的下家
**操作**: 点击"吃"按钮 → humanAction('chi')
**期待结果**: 同TC6（用CHI）

### TC8: POST_DISCARD → 人类过

**前提**: phase=ACTION_PROMPT, lastDiscard有值, 人类有响应选项
**操作**: 点击"过"按钮 → humanAction('pass')
**期待结果**:
- actionsAvailable[humanWind] = 空（清除人类响应）
- phase不变（仍为ACTION_PROMPT）
- → 游戏循环检测到人类无响应 → processAiResponses
  - AI有响应 → executeMeld/executeWin
  - 无人响应 → nextTurn → DRAWING（下家）

**确认点**:
- [x] 人类自己的actions被清除
- [x] AI的actions仍然保留
- [x] pass不导致直接nextTurn（保留AI响应机会）
- [x] AI响应后状态正确迁移
- [x] 无人响应后进入下家 → DRAWING
- [x] **【已知bug: 修复前】** humanWind未从最新state获取

### TC9: POST_DISCARD → AI荣和

**前提**: phase=ACTION_PROMPT, lastDiscard有值, AI有canRon
**操作**: processAiResponses → aiChooseAction 返回 'ron'
**期待结果**:
- executeWin(wind, false)
- phase → HAND_OVER

### TC10: POST_DISCARD → AI碰

**前提**: phase=ACTION_PROMPT, lastDiscard有值, AI有canPon
**操作**: processAiResponses → aiChooseAction 返回 'pon'
**期待结果**:
- executeMeld(wind, PON)
- phase → DISCARDING
- currentPlayer = 碰的AI

### TC11: POST_DISCARD → AI过

**前提**: phase=ACTION_PROMPT, lastDiscard有值, AI没有响应的选项或者选择过
**操作**: processAiResponses 检查下一个AI 或 返回null
**期待结果**:
- 继续检查下一个AI
- 所有AI检查完 → nextTurn → DRAWING

### TC12: POST_DRAW → 人类自摸和牌

**前提**: phase=ACTION_PROMPT, lastDiscard=undefined, 人类有canTsumo
**操作**: 点击"自摸" → humanAction('tsumo')
**期待结果**:
- executeWin(humanWind, true)
- phase → HAND_OVER

### TC13: POST_DRAW → 人类立直

**前提**: phase=ACTION_PROMPT, lastDiscard=undefined, 人类有canRiichi, 人类未鸣牌
**操作**: 点击"立直" → humanAction('riichi')
**期待结果**:
- isRiichi = true
- phase不变（立直后仍需打牌）

### TC14: POST_DRAW → 人类暗杠

**前提**: phase=ACTION_PROMPT, lastDiscard=undefined, 人类有canAnkan
**操作**: 点击"暗杠" → humanAction('ankan')
**期待结果**:
- executeMeld(currentPlayer, ANKAN)
- 岭上摸牌
- phase → DISCARDING

### TC15: POST_DRAW → 人类不打特殊动作直接打牌

**前提**: phase=ACTION_PROMPT, lastDiscard=undefined, 人类有tsumo/riichi选项
**操作**: 点击手牌 → humanDiscard(tileId)
**期待结果**: 同TC3（正常打牌）
**确认点**:
- [x] humanDiscard允许在ACTION_PROMPT打牌
- [x] 即使有自摸/立直选项，人类也可以选择打牌（日本麻将规则允许）

### TC16: POST_DRAW → AI自摸和牌

**前提**: phase=ACTION_PROMPT, lastDiscard=undefined, AI有canTsumo, currentPlayer=AI
**操作**: 游戏循环 → actions?.canTsumo → executeWin
**期待结果**: phase → HAND_OVER

### TC17: POST_DRAW → AI有立直选项

**前提**: phase=ACTION_PROMPT, lastDiscard=undefined, AI有canRiichi, currentPlayer=AI
**操作**: 游戏循环 → actions?.canRiichi check
**期待结果**:
- **【已知bug: 修复前】** 该分支什么都不做 → AI卡住
- 【修正后】 phase → DISCARDING → AI选择牌打出（可能立直）

### TC18: POST_DRAW → AI无特殊动作

**前提**: phase=ACTION_PROMPT, lastDiscard=undefined, AI无tsumo/riichi
**操作**: 游戏循环 → phase → DISCARDING
**期待结果**: 同TC4（AI正常打牌）

### TC19: 完整一局流程（正常终局）

**前提**: 游戏进行中
**流程**: DRAWING→DISCARDING→(响应)→DRAWING→... 循环
**期待结果**: 最终有人和牌或流局

### TC20: 吃碰后连锁响应

**前提**: AI碰牌后变成当前玩家，打牌
**流程**: AI碰→DISCARD→人类有响应选项
**期待结果**: 碰牌后打出的牌，其他玩家仍然可以响应

### TC21: 多家同时想碰/杠

**前提**: A弃牌，B和C都想碰
**流程**: processAiResponses按WINDS顺序检查
**期待结果**: 先检查到的AI优先（简化处理）

---

## 边界条件

### B1: 弃牌后无人能响应
check: discardTile中hasActions=false → 直接nextTurn而不是等待

### B2: AI响应时的人类动作
check: 人类已过牌（actions清除）→ processAiResponses不应检查人类

### B3: 立直后的一发状态
check: 立直后第一巡，有人副露则一发取消（目前未实现，不影响基本流程）

### B4: 九种九牌
check: 第一巡摸牌后，人类有canNineOrphans选项

---

## 当前发现的BUG

| ID | 位置 | 现象 | 原因 | 严重度 |
|----|------|------|------|--------|
| BUG-001 | useGame.ts ACTION_PROMPT AI分支 | AI有立直选项时卡住 | `else if (actions?.canRiichi && ...)` 分支什么都不做，AI永远不进入DISCARDING | **CRITICAL** |
| BUG-002 | useGame.ts pass分支 | 人类过牌后可能不调用nextTurn | pass只清除了actions，依赖游戏循环的响应处理 | **MEDIUM** |
| BUG-003 | gameEngine.ts getChiOptions | 吃牌的选项选择不正确 | ChiOption[][]类型混乱，实际从手牌选牌逻辑可能出错 | **LOW** |
