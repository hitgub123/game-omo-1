# 东方幻想麻雀 - 项目文档

## 项目概述

基于 **React + Vite + TypeScript** 的日本麻将网页游戏，东方Project主题。纯静态页面，可直接部署到 Cloudflare Pages。

## 文件结构

```
src/
├── main.tsx                      # 入口文件，挂载 React 应用
├── App.tsx                       # 根组件：页面路由 + GamePage 封装
│
├── game/                         # 纯游戏逻辑层（不依赖 React）
│   ├── types.ts                  # 核心类型定义
│   ├── tiles.ts                  # 牌的工具函数
│   ├── hand.ts                   # 手牌分析引擎
│   ├── scoring.ts                # 点数计算
│   ├── gameEngine.ts             # 游戏状态机
│   ├── GameController.ts         # 游戏循环控制器（AI 决策 + 时序）
│   └── ai.ts                     # AI 策略
│
├── hooks/
│   └── useGame.ts                # React Hook，管理游戏状态 + AI 循环
│
├── components/                   # UI 组件层
│   ├── StartPage.tsx              # 标题画面（背景轮播 + 模式选择）
│   ├── CharacterSelect.tsx        # 角色选择画面（108角色 + 15队伍）
│   ├── GameTable.tsx              # 牌桌主布局
│   ├── TileComponent.tsx          # 单张麻将牌渲染
│   ├── ActionPanel.tsx            # 操作按钮面板
│   ├── GameOverModal.tsx          # 牌局结果弹窗
│   └── WallPulldown.tsx           # 牌山下拉面板（牌数确认/换牌）
│
├── styles/
│   ├── global.css                # 全局样式 + 东方Project主题
│   └── title-screen.css          # 标题画面 + 角色选择画面样式
│
├── data/                         # 静态数据（预留）
└── __tests__/                    # 测试文件
    ├── run-test.mjs
    ├── state-machine-test.mjs
    └── stateMachine.test.ts
```

## 页面路由

应用包含三个页面，通过 `App.tsx` 中的 `page` 状态切换：

| 页面 | state 值 | 组件 | 说明 |
|------|---------|------|------|
| 标题 | `'title'` | `StartPage.tsx` | 背景图片轮播，选择游戏模式 |
| 选人 | `'select'` | `CharacterSelect.tsx` | 从 108 角色中选择 4 位 |
| 游戏 | `'game'` | `GameTable.tsx` (封装在 `GamePage`) | 牌局主界面 |

**流程**: `title` → (选择单人/组队) → `select` → (选齐4人) → `game` → (退出游戏) → `title`

## 角色数据与 Anchor 跳转

角色数据在 `public/characters.json` 中，来源于 `doc/abilities.md`。

`abilities.md` 中每个角色以 **Anchor（锚点）** 标记，格式为：
```html
<a name="th06-01"></a>
```
跳转方式：在页面 URL 后加 `#th06-01` 即可定位到该角色。

### Anchor 命名规则

| 前缀 | 含义 | 示例 |
|------|------|------|
| `th06-` ~ `th20-` | 各正作游戏角色（按面数编号） | `th08-05` = 永夜抄5面Boss 铃仙 |
| `play-` | 主角群（自机角色） | `play-01` = 博丽灵梦 |
| `ftg-` | 格斗作/外传角色 | `ftg-05` = 茨木华扇 |
| `pc98-` | PC-98 旧作角色 | `pc98-01` = 魅魔 |
| `qita-` | 其他角色 | `qita-01` = 稗田阿求 |

### 使用场景

- **选人画面**: 读取 `characters.json`，通过 `id` 字段（如 `"th06-01"`）关联角色数据
- **角色资料页**: 可通过 `window.location.hash` 跳转到指定角色的详细能力设定
- **扩展新角色**: 在 `abilities.md` 中添加条目并赋予唯一 anchor ID，更新 `characters.json` 即可

## 各文件详细说明

### src/game/types.ts - 核心类型

定义了整个游戏的数据模型：

- **TileSuit / Tile**: 牌的花色枚举和牌面接口。花色用 `'m'|'p'|'s'|'z'` 字符串表示（萬筒索字）
- **Wind**: 风位常量，`0=东/1=南/2=西/3=北`
- **MeldType**: 副露类型（吃碰杠）
- **Player / Meld / GameState**: 玩家状态、副露结构、完整牌局状态
- **AvailableActions**: 玩家可做的操作集合（吃碰杠立直荣和自摸等）
- **YakuInfo / WinResult / HandResult**: 役种、和牌结果、一局结果
- **TOUHOU_CHARACTERS**: 四位东方角色配置（灵梦、魔理沙、咲夜、帕秋莉），含主题色

**设计选择**: 使用 `const` 对象 + `type` 的模式替代 `enum`，兼容 Vite 模板的 `erasableSyntaxOnly` 设置。

### src/game/tiles.ts - 牌的工具函数

麻将牌的底层操作：

- `createTileDeck()`: 生成 136 张标准牌
- `shuffleArray()`: Fisher-Yates 洗牌
- `tileKey()`: 牌的字符串键值（如 `"m1"`、`"z5"`）
- `sameTile()` / `tileCompare()`: 比较和排序
- `sortHand()`: 手牌按萬筒索字顺序排序
- `isTerminalHonor()` / `isMiddleTile()` / `isDragonTile()`: 牌的分类判断
- `removeTile()` / `removeTiles()`: 从手牌中移除牌
- `tileDisplayName()`: 牌的显示名称（如一萬、东）

### src/game/hand.ts - 手牌分析引擎（核心算法）

**最重要、最复杂的模块**，实现：

- **和牌判定** (`findMahjongDivisions`): 递归回溯算法，将 14 张牌拆分为 4 组面子 + 1 对雀头。对每种可能的雀头尝试，然后递归查找刻子和顺子的组合
- **听牌判定** (`checkTenpai` / `findTenpaiDiscards`): 遍历 34 种牌，检查加入后是否能和牌
- **符数计算** (`fuCalc`): 根据面子的组成计算符数（副底20符 + 门清加符 + 刻子加符 + 雀头加符）
- **役种检测**: 实现了全部主流役种：
  - 役满：国士无双、四暗刻、大三元、字一色、绿一色、清老头、九莲宝灯
  - 1翻：立直、一发、门前清自摸、平和、断幺九、役牌、海底、河底、岭上、枪杠
  - 2翻：三色同顺、一气通贯、混全带幺九、对对和、三暗刻、小三元、混老头、混一色、七对子
  - 3翻：纯全带幺九、二杯口
  - 6翻：清一色
- `checkWin()`: 对外主入口，检测自摸/荣和是否成立并返回役种信息

**算法说明**: 手牌拆分使用标准的递归回溯策略——先固定雀头，再递归剥离刻子和顺子。时间复杂度虽然较高（最坏情况指数级），但麻将手牌只有14张，实际运行速度很快。

### src/game/scoring.ts - 点数计算

- `calculateBasePoints()`: 计算基本点（符 × 2^(翻+2)），含满贯以上跳迁
- `calculateScore()`: 自摸/荣和的点数分配，含本场和立直棒
- `calculatePayouts()`: 计算四位玩家的收支
- `getManganName()`: 满贯类型名称（满贯/跳满/倍满/三倍满/役满）

### src/game/gameEngine.ts - 游戏状态机

管理牌局的完整流程：

- `createInitialState()`: 创建初始牌局（洗牌、配牌、设庄）
- `drawTile()`: 摸牌，检查是否可自摸/立直/暗杠
- `discardTile()`: 打牌，检查其他玩家是否能荣和/碰/杠/吃
- `executeMeld()`: 执行副露（吃碰杠暗杠加杠）
- `executeWin()`: 和牌结算（更新分数、记录结果）
- `nextTurn()`: 切换到下一家

**设计选择**: 所有函数都是纯函数——输入 GameState 返回新的 GameState，不修改原对象。这样便于状态管理和调试。

### src/game/ai.ts - AI 策略

三位电脑玩家的决策逻辑：

- `scoreDiscardTile()`: 对每张牌评分（字牌优先打、孤张减分、刻子加分、顺子潜力加分）
- `aiChooseDiscard()`: 选择评分最低的牌打出
- `aiChooseAction()`: 选择响应动作（荣和 > 自摸 > 立直 > 暗杠 > 碰 > 杠 > 吃）
- `aiMeldDecision()`: 副露策略（役牌高概率碰、中张低概率、门前清不吃）

**设计选择**: AI 策略以评分制为主，复杂度低但效果合理，后续可扩展为更复杂的策略（如向听数计算、牌危险度分析）。

### src/hooks/useGame.ts - React Hook

连接游戏引擎和 UI 的关键桥梁：

- 管理游戏状态（`useState<GameState>`）
- 自动游戏循环：监听状态变化，自动触发 AI 回合或人类摸牌
- 响应处理：人类弃牌后自动检查并执行 AI 响应（荣和 > 碰 > 吃）
- 提供 `humanDiscard()` 和 `humanAction()` 接口供 UI 调用
- 维护消息队列和 AI 思考状态

**流程**:
1. DRAWING → 自动摸牌（任何玩家）
2. DISCARDING → AI 自动选牌 / 人类点击打牌
3. ACTION_PROMPT → 显示可操作按钮或自动处理 AI 响应
4. HAND_OVER → 显示结果弹窗

### src/components/ - UI 组件

- **TileComponent.tsx**: 单张牌的渲染，支持选中、高亮、背面、立直横摆等状态，按花色着色
- **GameTable.tsx**: 麻将桌主布局，上家/左家/右家/自家四位，中央弃牌区
- **ActionPanel.tsx**: 操作按钮（荣和/碰/吃/杠/立直/自摸/过），根据当前可用动作动态显示
- **GameOverModal.tsx**: 牌局结果，显示和牌牌型、役种、得分

### src/styles/global.css - 主题样式

东方Project主题的视觉设计：

- **暗色和风背景**，渐变紫色基调
- **麻将桌绿色绒面**质感
- **四角色主题色**: 灵梦红、魔理沙黄、咲夜蓝、帕秋莉紫
- **牌面按花色着色**: 萬子红、筒子绿、索子蓝、字牌彩色
- **响应式设计**: 支持手机/平板/桌面
- **动画效果**: 选中弹起、操作按钮悬停、立直闪烁、AI思考指示器

## 构建与部署

### 本地运行
```bash
npm install
npm run dev
```

### Cloudflare Pages 部署
1. `npm run build` → 生成 `dist/` 目录
2. 在 Cloudflare Pages 中连接 GitHub 仓库
3. 构建命令: `npm run build`
4. 输出目录: `dist`

### 技术要求
- Node.js >= 18
- 无需后端服务器，纯静态

## 已知限制

- **两立直**: YakuContext 有 `isDoubleRiichi` 字段但 `checkWin()` 始终传 `false`，未实际生效
- **一发**: 尚未精确追踪立直后第一巡
- **里宝牌**: 立直和牌后未揭开里宝牌
- **完全流局**: 四杠散了、九种九牌等特殊流局未实现（九种九牌的 `canNineOrphans` flag 已定义但未连接 UI）
- **食替**: 鸣牌后不能打出关联牌，未实现
- **抢杠**: 加杠时被抢杠和牌，未实现

## 役种列表（已实现）

### 1 翻
- 立直 / 一发 / 门前清自摸和 / 平和 / 断幺九 / 一盃口
- 役牌（三元牌/场风/自风）
- 海底摸月 / 河底捞鱼 / 岭上开花 / 枪杠

### 2 翻
- 七对子 / 三色同顺 / 三色同刻 / 一气通贯
- 混全带幺九 / 对对和 / 三暗刻 / 三杠子
- 小三元 / 混老头 / 混一色(副露)

### 3 翻
- 混一色(门清) / 纯全带幺九 / 二杯口

### 6 翻
- 清一色(门清) / 5翻(副露)

### 役满
- 国士无双 / 四暗刻 / 大三元 / 字一色 / 绿一色
- 清老头 / 九莲宝灯 / 天和 / 地和

## 振听规则（已实现）

| 类型 | 触发 | 解除 |
|------|------|------|
| 一般振听 | 弃牌堆中有等待牌 | 永久 |
| 临时振听 | 非立直时能荣和选了过 | 自己摸牌时 / 任何人鸣牌时 |
| 立直後振听 | 立直后能荣和选了过 | 永久 |

## 相关文档

- **BUGS.md**: Bug 追踪表，共 14 条（13 条已修复 + 1 条未修复）
- **TEST_SPEC.md**: 状态机测试式样书，21 个测试用例
- **CONVERSATION.md**: 开发会话记录

## 后续可扩展

1. 添加牌局音效和背景音乐（东方原曲）
2. 添加角色立绘和牌面图案
3. 联网对战功能
4. 牌谱回放
5. 更多游戏模式（三人麻将、点差竞技）
