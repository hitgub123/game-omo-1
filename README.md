# 东方幻想麻雀 (Touhou Gensou Mahjong)

东方 Project 主题的日本麻将（立直麻将）网页游戏。单人玩家 vs 3 AI，支持组队模式。

![Tech Stack](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Tech Stack](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript)
![Tech Stack](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)

## 游戏截图

| 标题画面 | 选人界面 | 牌局 |
|---------|---------|------|
| 背景轮播 + 模式选择 | 108 角色选择 | 四人麻将桌 |

## 功能特性

### 🀄 麻将规则
- **完整日本立直麻将**：配牌/摸牌/弃牌/鸣牌（吃碰杠暗杠加杠）/立直/和牌/流局
- **全役种**：1翻～役满共 30+ 种役（含立直、一发、平和、断幺九、混一色、清一色、国士无双、四暗刻、九莲宝灯等）
- **宝牌系统**：表宝牌、里宝牌、赤宝牌、杠宝牌
- **特殊流局**：九种九牌、四杠散了、四风连打、流局满贯
- **振听规则**：一般振听、临时振听、立直后振听
- **食替限制**：鸣牌后不能打出同组牌
- **抢杠**：加杠时可被抢杠和牌

### 🎮 游戏模式
- **单人模式**：选择 4 名角色进行对局
- **组队模式**：选择 4 支队伍，每队 5 人，5 轮接力赛，分数跨轮累积
- **游戏长度选择**：东风战 / 东南战 / 东西战 / 东北战

### 🎨 东方 Project 主题
- **108 角色**：th06 红魔乡 ～ th20 锦上京，含格斗作、PC-98 旧作、其他角色
- **角色能力**：每位角色拥有独特的麻将能力设计（Lv1～Lv3 消耗能力槽）
- **角色台词**：7 种场景 ×2 句（出场/胡牌/点炮/被自摸/听牌/败北/获胜）
- **悬浮信息窗**：选人界面悬停显示角色详细信息

### 🖥️ 视觉
- 暗色和风主题，渐变紫色基调
- 麻将桌绿色绒面质感
- 角色主题色（灵梦红/魔理沙黄/咲夜蓝/帕秋莉紫）
- 牌面按花色着色
- 牌面皮肤切换（6种配色方案）
- 主题切换（4种背景风格）
- 背景图片轮播
- 响应式设计（手机/平板/桌面）
- 禁用右键菜单（防止误触）

### 🤖 AI
- 评分制弃牌策略
- 鸣牌/立直决策
- 难度等级选择

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

### 技术栈

| 层 | 技术 |
|----|------|
| 框架 | React 19 + TypeScript 6 |
| 构建 | Vite 6 |
| 游戏逻辑 | 纯 TypeScript（零框架依赖） |
| 和牌判定 | `riichi` npm 库（本地 fork + ESM 转换） |
| 向听计算 | 自研 `syanten.js`（一般形 + 七对子 + 国士无双） |
| 样式 | 手写 CSS（global.css + title-screen.css） |
| 部署 | Cloudflare Pages（纯静态） |

## 项目结构

```
game-omo-1/
├── src/
│   ├── main.tsx                    # 入口文件
│   ├── App.tsx                     # 根组件：页面路由 + GamePage 封装
│   │
│   ├── game/                       # 纯游戏逻辑层（不依赖 React）
│   │   ├── types.ts                # 核心类型定义
│   │   ├── tiles.ts                # 牌的工具函数
│   │   ├── hand.ts                 # 手牌分析引擎
│   │   ├── scoring.ts              # 点数计算
│   │   ├── gameEngine.ts           # 游戏状态机
│   │   ├── GameController.ts       # 游戏循环控制器
│   │   ├── ai.ts                   # AI 策略
│   │   └── riichi-check.ts         # riichi 库封装
│   │
│   ├── hooks/
│   │   └── useGame.ts              # React ↔ GameController 桥梁
│   │
│   ├── components/
│   │   ├── StartPage.tsx           # 标题画面（背景轮播 + 模式选择）
│   │   ├── CharacterSelect.tsx     # 角色选择画面
│   │   ├── GameTable.tsx           # 牌桌主布局
│   │   ├── TileComponent.tsx       # 单张麻将牌渲染
│   │   ├── ActionPanel.tsx         # 操作按钮面板
│   │   ├── GameOverModal.tsx       # 牌局结果弹窗
│   │   └── WallPulldown.tsx        # 牌山下拉面板
│   │
│   └── styles/
│       ├── global.css              # 全局样式 + 东方Project主题
│       └── title-screen.css        # 标题画面 + 选人画面样式
│
├── utils/
│   ├── syanten.js                  # 向听数计算引擎（自研）
│   └── riichi-lib/                 # riichi 库（本地 fork）
│
├── scripts/
│   └── parse-characters.py         # abilities.md → characters.json 解析器
│
├── doc/
│   ├── DOCUMENTATION.md            # 项目文档
│   ├── BUGS.md                     # Bug 追踪
│   ├── ROADMAP.md                  # 开发路线图
│   ├── TEST_SPEC.md                # 状态机测试式样书
│   ├── CONVERSATION.md             # 开发会话记录
│   └── abilities.md                # 角色能力设计大全
│
├── public/
│   ├── bg/                         # 背景图片
│   └── characters.json             # 角色数据（由 parse-characters.py 生成）
│
├── assets/pic/desktop/             # 背景图片源文件
└── README.md                       # 本文件
```

## 角色数据管理

角色数据来源于 `doc/abilities.md`，通过解析器自动生成 `public/characters.json`。

```bash
# 改完 abilities.md 后运行：
python3 scripts/parse-characters.py
```

### 角色分组

| 组前缀 | 含义 | 数量 |
|--------|------|------|
| `th06`～`th20` | 各正作游戏（按面数编号） | 约 135 人 |
| `ftg` | 格斗作/外传 | 8 人 |
| `pc98` | PC-98 旧作 | 4 人 |
| `qita` | 其他角色（阿求、莲子、梅莉等） | 9 人 |
| `players` | 主角群（灵梦、魔理沙等） | 8 人（引用） |

### 跨组引用

支持角色在多个作品中引用。例如射命丸文在 th10 中有完整条目，在 th09 和 players 组中以 `## 参考：th10-04b 射命丸文` 形式引用，解析器自动从原始条目补全能力数据。

## 游戏页面路由

```
title ──→ select ──→ (confirm) ──→ game
  │                                 │
  └──────── ← 返回 ← ───────────────┘
```

| 页面 | 说明 |
|------|------|
| Title | 标题画面，背景轮播，选择模式 |
| Select | 单人选4角色 / 组队选4队×5人，悬停显示详情 |
| Confirm | 确认阵容弹窗（单人显示4人，组队显示4队×5人） |
| Game | 麻将牌局 |

## 已知限制

- 赤宝牌（akadora）未加入宝牌计数
- 多倍役满未处理
- 符数计算未验证与标准一致
- 包牌未实现
- 三人麻将未支持
- BGM/SE 无音频
- 无过渡动画
- 网络对战未实现

## 开发路线图

详见 `doc/ROADMAP.md`。

阶段一（已完成）：规则完整性（两立直、一发、里宝牌、红宝牌、特殊流局、食替、抢杠）
阶段二（进行中）：游戏体验（听牌提示、牌谱回放、AI 升级）
阶段三（待开始）：视觉增强（角色立绘、BGM、动画）

## 构建与部署

### Cloudflare Pages

1. 连接 GitHub 仓库
2. 构建命令：`npm run build`
3. 输出目录：`dist`
4. Node.js 版本 >= 18

## 许可

本项目为东方 Project 二次创作同人游戏，遵守上海爱丽丝幻乐团的二次创作指南。
