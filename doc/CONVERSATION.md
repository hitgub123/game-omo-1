# 东方幻想麻雀 - 开发会话记录

## 会话概览

本文件记录了从项目初始化到最新状态的完整开发对话。

---

## 第一阶段：项目初始化 (2025-06-06 ~ 17:23)

### 需求
用东方Project人物玩日本麻将，模仿东方幻想麻将。先做好界面和主要逻辑。

### 技术选型
- React + Vite + TypeScript
- 纯静态页面，部署到 Cloudflare Pages
- 完整版日本麻将（含所有役种）

### 架构设计
```
src/
├── game/         纯逻辑层
│   ├── types.ts      类型定义
│   ├── tiles.ts      牌工具函数
│   ├── hand.ts       和牌/听牌/役种检测
│   ├── scoring.ts    点数计算
│   ├── gameEngine.ts 游戏状态机
│   └── ai.ts         AI策略
├── hooks/         React状态管理
│   └── useGame.ts    游戏循环+AI
├── components/    UI组件
│   ├── TileComponent.tsx
│   ├── GameTable.tsx
│   ├── ActionPanel.tsx
│   └── GameOverModal.tsx
└── styles/
    └── global.css    东方主题样式
```

### 初始实现
- 136张牌（萬筒索字×4）
- 递归回溯算法的和牌判定
- 20种役种检测（含役满）
- 吃碰杠暗杠加杠
- 立直/荣和/自摸
- 符数计算和点数分配
- 三位AI对手
- 东方Project主题UI

---

## 第二阶段：Bug修复 #1 (17:42 ~ 18:01)

### 修复的Bug

| Bug | 修复 |
|-----|------|
| 庄家多一张牌 | 每人13张，庄家通过第一次摸牌得第14张 |
| 鸣牌按钮不显示 | ActionPanel改查humanWind |
| 过牌吞AI响应 | 清除actions后让游戏循环处理 |
| 自摸不触发 | humanWind修正 |

---

## 第三阶段：功能增强 (18:35 ~ 18:40)

### 新增功能
- 赤5红宝牌（5m/5p/5s各一枚）
- 宝牌计算+显示
- 听牌提示（粉红条显示待牌）
- 回合指示（高亮+箭头）
- 调试信息

---

## 第四阶段：Bug修复 #2 + 测试 (18:48 ~ 20:10)

### 发现的Bug
- BUG-001: AI有立直选项时else-if分支空操作→卡死
- BUG-003: AI硬编码state.players[0]（永远是灵梦）

### 测试
- TEST_SPEC.md: 21个测试用例
- 16/17 测试通过 (Node.js --experimental-strip-types)

---

## 第五阶段：局间推进 (20:11 ~ 21:00)

### 实现
- createNextHand: 连庄/轮庄/本场/东南场
- executeDraw: 流局处理（ノーテン罰符）
- 游戏结束判定（handCount≥8或负分）
- GameOverModal显示局名

---

## 第六阶段：UI大改 (00:20 ~ 02:00+)

### 弃牌区布局
- 从2×2网格改为座位布局（北=上中, 西=左, 东=下中, 南=右）
- 各区弃牌集中到中央

### 交互改进
- 单击选中(蓝框)，双击打出
- 新摸牌高亮(金色)
- 右键→选中→换牌菜单
- 牌山Pulldown

### 立直系统
- 立直选牌模式（只能打出听牌的牌）
- 取消立直按钮
- 自摸切（tsumogiri）
- 立直后game loop不再卡死

### 文档
- BUGS.md (13个bug记录)
- DOCUMENTATION.md

---

## 第七阶段：后续改进（进行中）

### 待处理
- [已修] 左右家手牌区垂直空间
- [已修] 新游戏后不摸牌(DRAWING延迟10ms)
- [已修] 立直选牌+取消按钮
- [已修] 换牌后立即检测立直

---

*本文件由 opencode session 自动导出*
