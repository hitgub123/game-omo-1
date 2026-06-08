# 东方幻想麻雀 — 项目需求定义书

## 概要

东方Project 主题的日本麻将（立直麻将）游戏。单人游戏，玩家 vs 3 AI。

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | React + TypeScript + Vite |
| 测试 | Vitest |
| 游戏逻辑 | 纯 TypeScript，零框架依赖 |
| 和了判定 | `riichi` npm 包（外部库） |
| 向听计算 | 自研 `syanten.js`（一般形 + 七对子 + 国士无双） |
| CSS | 手写 global.css |

## 目录结构

```
src/
├── game/                    # 游戏逻辑（纯 TS，零 React）
│   ├── types.ts             # 类型定义、常量
│   ├── gameEngine.ts        # 核心引擎（配牌/摸牌/弃牌/鸣牌/和了）
│   ├── GameController.ts    # 游戏循环控制器（AI 决策 + 时序）
│   ├── tiles.ts             # 牌相关工具（生成/排序/比较）
│   ├── ai.ts                # AI 决策（弃牌/鸣牌/立直选择）
│   ├── hand.ts              # 手牌分析（向听/听牌/拆分）
│   ├── scoring.ts           # 点数计算
│   ├── riichi-check.ts      # riichi 库封装
│   └── riichi.d.ts          # 类型声明
├── hooks/
│   └── useGame.ts           # React ↔ GameController 桥梁
├── components/              # React UI 组件
│   ├── GameTable.tsx         # 主游戏界面
│   ├── TileComponent.tsx     # 牌渲染
│   ├── ActionPanel.tsx       # 操作面板
│   ├── GameOverModal.tsx     # 游戏结束弹窗
│   ├── WallPulldown.tsx      # 牌山（换牌用）
│   └── SwapSelector.tsx      # 换牌选择器
└── styles/
    └── global.css            # 全局样式
utils/
└── syanten.js               # 向听数计算引擎（自研）
doc/
├── bugs.md                  # Bug 票
└── requirements.md          # 本文件
```

## 功能清单

### ✅ 已实现

| 功能 | 说明 |
|------|------|
| 配牌 | 4 家各 13 张 |
| 摸牌/弃牌 | 回合制 |
| 鸣牌（吃/碰/杠/加杠/暗杠） | 含食替限制 |
| 立直 | 含双立直、一发 |
| 和了（荣和/自摸） | 使用 riichi 库判定 |
| 点数计算 | 符×翻，含庄家± |
| 本场/连庄 | |
| 流局 | 九种九牌、四杠散了、四风连打、流局满贯 |
| 听牌提示 | 悬浮显示待牌 |
| 换牌模式 | 右键进入，点击牌山交换 |
| 里宝牌 | 杠后翻里宝牌，和牌后显示 |
| 向听计算 | 自研引擎（一般形+七对子+国士无双） |
| AI 对手 | 简单 AI（弃牌/鸣牌/立直决策） |

### ⏳ 未实现/待改进

| 功能 | 说明 |
|------|------|
| 赤宝牌 | 牌有 akadora 标记，但未加入宝牌计数 |
| 多倍役满 | 点数计算未处理累计役满 |
| 符数计算 | 未验证与标准一致 |
| 枪杠 | 加杠时荣和 |
| 包牌 | 未实现 |
| 三人麻将 | 仅支持四人 |
| 网络对战 | 仅单人 |
| BGM/SE | 无音频 |
| 动画 | 无过渡动画 |

## 牌规则

- 标准的 34 种 × 4 枚 = 136 枚
- 万(m) 1-9 / 筒(p) 1-9 / 索(s) 1-9 / 字(z) 东南西北白发中
- 每个花色有一张赤 5（红宝牌标记）

## 游戏流程

1. `createInitialState()` → 配牌
2. 庄家（东家）先摸牌 → `discarding` / `action_prompt`
3. 弃牌 → 其他玩家响应（荣/碰/杠/吃）→ 下家摸牌
4. 循环直到和了或流局
5. GameController 的 `tick()` 驱动 AI 自动决策

## 配置说明

- 游戏配置在 `src/game/types.ts` 常量区
