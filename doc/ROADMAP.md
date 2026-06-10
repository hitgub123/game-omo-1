# 东方幻想麻雀 - 开发路线图

> 基于当前游戏状态（全部 24 个已知 Bug 已修复）的后续优化方向，按优先级排列。

---

## 📋 目录

- [阶段一：规则完整性（高优先级）](#阶段一规则完整性高优先级)
- [阶段二：游戏体验（中优先级）](#阶段二游戏体验中优先级)
- [阶段三：视觉 & 交互（中优先级）](#阶段三视觉--交互中优先级)
- [阶段四：架构 & 性能（低优先级）](#阶段四架构--性能低优先级)
- [阶段五：技术栈维护（持续）](#阶段五技术栈维护持续)
- [长远展望](#长远展望)
- [如何贡献](#如何贡献)

---

## 阶段一：规则完整性（高优先级）

完善日本麻将的剩余规则，达到「完整规则」状态。

| # | 功能 | 说明 | 涉及文件 | 状态 |
|---|------|------|---------|:----:|
| 1 | **两立直 (Double Riichi)** | 第一巡未鸣牌立直，2翻 | `game/hand.ts`, `game/gameEngine.ts` | ✅ |
| 2 | **一发 (Ippatsu)** | 立直后第一巡和牌，1翻 | `game/gameEngine.ts`, `riichi-check.ts` | ✅ |
| 3 | **里宝牌 (Ura Dora)** | 立直和牌后揭开里宝牌 | `game/scoring.ts`, `riichi-check.ts` | ✅ |
| 4 | **红宝牌 (Akadora)** | 赤5万/筒/索，每张+1翻 | `game/tiles.ts`, `game/hand.ts` | ✅ |
| 5 | **特殊流局** | 九种九牌、四杠散了、四风连打、流局满贯 | `game/gameEngine.ts` | ✅ |
| 6 | **食替 (Kuitsuen)** | 鸣牌后不能打出同组牌 | `game/gameEngine.ts`, `GameController.ts` | ✅ |
| 7 | **抢杠 (Chan Kan)** | 加杠时其他玩家可抢杠和牌 | `game/gameEngine.ts` | ✅ |
| 8 | **开杠后的岭上牌** | 暗杠、加杠后摸岭上牌 | ✅ 已有 |

### 阶段一：已完成的改进

- **宝牌/赤宝牌计分修复**：以前宝牌指示牌和赤宝牌未传给 riichi 库，现在修复了
- **赤牌 UI**：赤5牌面显示为红色

---

### 🛜 架构解耦：GameController 独立（已做）

`useGame.ts`（~570行）拆分为：

```
src/game/GameController.ts  ← 纯 TS 控制器，零 React 依赖
src/hooks/useGame.ts        ← ~200行，只做 React ↔ Controller 对接
```

**效果：**

| 指标 | 之前 | 之后 |
|------|:---:|:---:|
| `useGame.ts` 行数 | ~570行 | ~230行 |
| 游戏逻辑与 React | 深度耦合 | 完全分离 |
| 可测试性 | 需 React 环境 | 直接 `new GameController()` |
| 切换 UI 框架 | 不可能 | 换 Vue/Svelte 只需换 hooks |
| 无头 AI 对战 | 难 | 直接在 Node.js 运行 |

### 参考

- `DOCUMENTATION.md` 的「已知限制」章节
- `BUGS.md` 已修复模式的注册模式（`executeWin` 已含立直棒处理）
- `riichi` npm 包的 eval 警告包含 dora/里dora 逻辑可借鉴

---

## 阶段二：游戏体验（中优先级）

让游戏更好玩、更有可玩性。

| # | 功能 | 说明 | 涉及文件 | 状态 |
|---|------|------|---------|:----:|
| 9 | **听牌提示** | 打某张牌后听什么牌，标记听牌数/待牌数 | `components/TileComponent.tsx`, `useGame.ts` | ❌ |
| 10 | **牌危险度分析** | 根据河牌、鸣牌提示某张牌的危险程度（AI 辅助 | `game/ai.ts` | ❌ |
| 11 | **向听数显示** | 当前手牌的向听数（syanten），已有 `syanten-fast.mjs` 但未集成 UI | `components/ActionPanel.tsx`, `game/ai.ts` | ❌ |
| 12 | **牌谱回放** | 保存对局记录 `.mjlog`，支持回放和分享 | `hooks/useGame.ts`, 新增 `hooks/useReplay.ts` | ❌ |
| 13 | **AI 策略升级** | 当前AI是评分制；升级为：向听数优先 → 牌危险度 → 攻守判断 | `game/ai.ts` | 📝 |
| 14 | **AI 难度等级** | 简单/普通/困难三档，通过策略参数控制 | `game/ai.ts`, `types.ts` | ❌ |
| 15 | **联网对战** | WebSocket / WebRTC 多人对局 | 后端架构 + `game/network.ts` | ❌ |
| 16 | **新游戏模式** | 三人麻将、点差竞技、四人东风 | `game/gameEngine.ts` | ❌ |
| 17 | **设置面板** | 游戏速度、音效、AI难度、背景音乐开关 | 新增 `components/SettingsPanel.tsx` | ❌ |

---

## 阶段三：视觉 & 交互（中优先级）

提升游戏的视觉冲击力和沉浸感。

| # | 功能 | 说明 | 涉及文件 | 状态 |
|---|------|------|---------|:----:|
| 18 | **角色立绘** | 四位东角色（灵梦/魔理沙/咲夜/帕秋莉）的立绘显示 | 新增 `components/CharacterPortrait.tsx` | ❌ |
| 19 | **BGM / 音效** | 东方原曲 BGM + 打牌SE（吃碰杠和牌） | 新增 `hooks/useAudio.ts`, `audio/` 目录 | ❌ |
| 20 | **动画效果** | 打牌飞牌、吃碰杠抖动、和牌展开的 CSS/GSAP 动画 | `components/`, `styles/global.css` | ❌ |
| 21 | **牌面图案** | 角色专属牌面（如灵梦牌面印有红白巫女图案） | `components/TileComponent.tsx` | ❌ |
| 22 | **移动端适配** | 触摸手势（点击/滑动/长按），响应式排版优化 | `styles/global.css`, `components/*.tsx` | 📝 |
| 23 | **暗色模式切换** | 当前为暗色和风，可切换亮色/暗色/自动 | `styles/global.css`, `App.tsx` | ❌ |
| 24 | **牌桌缩放** | 自定义牌桌大小比例 | `components/GameTable.tsx` | ❌ |
| 25 | **牌面缩小** | 手牌超过一定数量时自动缩小 | `components/TileComponent.tsx` | ❌ |
| 26 | **振听/立直标记** | 振听提示、立直旋转的视觉强化 | `styles/global.css` | 📝 |
| 27 | **Loading/转场** | 开局转场动画、AI思考的加载指示器 | `components/GameTable.tsx` | ❌ |

---

## 阶段四：架构 & 性能（低优先级）

代码可维护性和运行效率的改进。

| # | 功能 | 说明 | 涉及文件 | 状态 |
|---|------|------|---------|:----:|
| 28 | **状态管理升级** | `useState` 链 → Zustand / Jotai，简化跨组件状态传递 | `hooks/useGame.ts`, `App.tsx` | ❌ |
| 29 | **SideEffect 分离** | `useGame` 目前集状态管理+游戏循环+AI触发，可拆分为：`useGameLoop`、`useGameActions`、`useAI` | `hooks/useGame.ts` | ❌ |
| 30 | **GameEngine 纯函数测试** | 已有状态机测试，扩展到 engine 所有分支 | `__tests__/`, `game/gameEngine.ts` | 📝 |
| 31 | **AI 策略单元测试** | 对 AI 决策的各场景写测试（立直判断、弃牌选择等） | `__tests__/`, `game/ai.ts` | ❌ |
| 32 | **syanten 集成** | 将 `syanten-fast.mjs` 转换为 TypeScript 并集成到 `hand.ts` 中 | `game/syanten-engine.d.ts`, `hand.ts` | ❌ |
| 33 | **PWA 支持** | Service Worker + manifest.json，支持离线对局 | 新增 `sw.js`, `manifest.json` | ❌ |
| 34 | **i18n 多语言** | 日语/中文/英文 三语，用 react-i18next | 新增 `locales/` 目录 | ❌ |
| 35 | **构建分析** | 使用 `vite analyze` 或 `rollup-plugin-visualizer` 分析包体积 | 构建配置 | ❌ |

### 性能优化清单

- [ ] 虚拟列表渲染对手牌（大量对局历史时）
- [ ] React.memo / useMemo 优化牌面组件（TileComponent 频繁重渲染）
- [ ] 使用 Web Worker 运行手牌分析（`hand.ts`）避免阻塞 UI
- [ ] 图片资源懒加载
- [ ] 摇树优化（移除 `riichi` 包不使用的部分）

---

## 阶段五：技术栈维护（持续）

保持依赖更新和代码质量。

| # | 项目 | 说明 | 状态 |
|---|------|------|:----:|
| 36 | **`riichi` 包 eval 警告** | 构建时两个 `eval` 警告，考虑替换为自家 `hand.ts` | 📝 |
| 37 | **TypeScript 6 特性利用** | 全局使用 `const` type parameters、`using` 声明等 | ✅ 已启用 |
| 38 | **ESLint 9 配置清理** | `eslint.config.js` 已验证，无规则冲突 | ✅ |
| 39 | **依赖更新** | 定期 `npx taze` 检查依赖版本 | ❌ |
| 40 | **移除未使用代码** | 检查 `src/data/` 等空目录、废弃文件 | ❌ |

---

## 长远展望

| 愿景 | 说明 | 前提条件 |
|------|------|---------|
| 🏆 **天凤/雀魂级匹配** | 在线排行榜、段位系统 | 联网对战完成 |
| 🤖 **高级 AI Opponent** | 基于蒙特卡洛或模仿学习 | 攻守判断+牌危险度完成 |
| 📺 **观战模式** | 旁观他人对局 | 联网对战完成 |
| 🧩 **贴纸/装扮系统** | 牌面、牌桌、角色皮肤 | 基础视觉完成 |
| 📊 **牌局统计** | 和牌率、立直率、平均打点 | 牌谱回放完成 |
| 🔗 **对外 API** | 提供第三方客户端可用的游戏 API | 联网对战架构完成 |
| 💰 **捐款/打赏** | 通过 Buy Me a Coffee / AFDian 支持开发 | 用户量稳定后 |

---

## 如何贡献

1. 从阶段一的功能开始，越靠前优先级越高
2. 每个功能在 `src/__tests__/` 中至少含一个测试用例
3. 提交 PR 时标注 `affects: [文件路径]`
4. 开发会话记录见 `CONVERSATION.md`
5. Bug 跟踪见 `BUGS.md`

---

*最后更新: 2026-06-08*
