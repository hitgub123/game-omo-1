import React from 'react';
import { useGame } from './hooks/useGame';
import GameTable from './components/GameTable';
import StartPage from './components/StartPage';
import CharacterSelect from './components/CharacterSelect';
import { TileBackContext } from './components/TileBackContext';
import { pickGameBackSvg } from './game/tileAssets';
import { GamePhase, WINDS } from './game/types';
import './styles/global.css';
import './styles/title-screen.css';

interface Character {
  id: string; nameCN: string; nameJP: string; nameEN: string;
}

type Page = 'title' | 'select' | 'game';

// ── In-game wrapper (mounts useGame + GameTable) ──
interface GamePageProps {
  characters: Character[];
  onExit: () => void;
}

const SKINS = [
  { id: 'default', label: '標準' },
  { id: 'warm', label: '和風' },
  { id: 'cool', label: '蒼' },
  { id: 'gold', label: '金' },
  { id: 'sakura', label: '桜' },
  { id: 'dark', label: '漆黒' },
] as const;

const THEMES = [
  { id: 'default', label: '标准' },
  { id: 'green', label: '雀卓' },
  { id: 'warm', label: '和风' },
  { id: 'light', label: '淡色' },
] as const;

const GamePage: React.FC<GamePageProps> = ({ characters, onExit }) => {
  const charNames = characters.map(c => ({ name: c.nameCN }));
  const [gameLength, setGameLength] = React.useState(2);
  const [noCall, setNoCall] = React.useState(true);
  const [autoWin, setAutoWin] = React.useState(true);
  const {
    state, humanDiscard, humanAction, newGame, nextHand,
    selectedTileId, setSelectedTileId, messages, isAiThinking,
    swapMode, enterSwapMode, executeSwap, cancelSwap,
    riichiMode, riichiValidTileIds, cancelRiichi,
    difficulty, setDifficulty,
    autoPlay, setAutoPlay,
    downloadLog,
  } = useGame(charNames, gameLength);

  const [skinIdx, setSkinIdx] = React.useState(0);
  const [themeIdx, setThemeIdx] = React.useState(0);
  const [gameKey, setGameKey] = React.useState(0);
  const [autoSelfDiscard, setAutoSelfDiscard] = React.useState(false);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const currentSkin = SKINS[skinIdx % SKINS.length];

  const handleSkinChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSkinIdx(Number(e.target.value));
  }, []);

  // ── 自摸切：自动弃刚摸的牌（除非有动作提示） ──
  React.useEffect(() => {
    if (!autoSelfDiscard) return;
    const cp = state.players[state.currentPlayer];
    if (!cp?.isHuman) return;
    if (state.phase !== GamePhase.DISCARDING) return;
    if (!state.drawnTile) return;
    humanDiscard(state.drawnTile.id);
  }, [state.phase, state.currentPlayer, state.drawnTile?.id, autoSelfDiscard, humanDiscard]);

  // ── 立直后默认开启自摸切，可手动取消勾选 ──
  const humanWind = React.useMemo(() => WINDS.find(w => state.players[w].isHuman), [state.players]);
  const prevRiichiRef = React.useRef(false);
  React.useEffect(() => {
    if (humanWind === undefined) return;
    const isRiichi = state.players[humanWind].isRiichi;
    if (isRiichi && !prevRiichiRef.current) {
      setAutoSelfDiscard(true);
    }
    prevRiichiRef.current = isRiichi;
  }, [state.players[humanWind ?? 0]?.isRiichi]);

  const handleNewGame = React.useCallback(() => {
    setGameKey(k => k + 1);
    setAutoSelfDiscard(false);
    setNoCall(true);
    setAutoWin(true);
    newGame();
  }, [newGame]);

  const handleNextHand = React.useCallback(() => {
    setGameKey(k => k + 1);
    setAutoSelfDiscard(false);
    setNoCall(true);
    setAutoWin(true);
    nextHand();
  }, [nextHand]);

  // ── 不鸣牌：自动跳过吃碰杠 ──
  React.useEffect(() => {
    if (!noCall) return;
    if (!state.lastDiscard) return;
    const hWind = WINDS.find(w => state.players[w].isHuman);
    if (hWind === undefined) return;
    const actions = state.actionsAvailable[hWind];
    if (!actions) return;
    const hasRon = actions.canRon;
    const hasCall = actions.canPon || actions.canChi || actions.canKan;
    if (!hasRon && hasCall) {
      humanAction('pass');
    }
  }, [noCall, state.lastDiscard?.id, state.actionsAvailable, humanAction]);

  // ── 自动和：荣和或自摸时立即和牌 ──
  React.useEffect(() => {
    if (!autoWin) return;
    if (state.phase === GamePhase.HAND_OVER || state.phase === GamePhase.GAME_OVER) return;
    const hWind = WINDS.find(w => state.players[w].isHuman);
    if (hWind === undefined) return;
    const actions = state.actionsAvailable[hWind];
    if (!actions) return;
    if (state.lastDiscard && actions.canRon) {
      humanAction('ron');
    } else if (!state.lastDiscard && actions.canTsumo) {
      humanAction('tsumo');
    }
  }, [autoWin, state.phase, state.lastDiscard?.id, state.drawnTile?.id, state.actionsAvailable, humanAction]);

  const backSvg = React.useMemo(() => pickGameBackSvg(), [gameKey]);

  // ── Ctrl+L 下载游戏日志 ──
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'l') { e.preventDefault(); downloadLog(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [downloadLog]);

  const handleTileClick = React.useCallback((tileId: number) => {
    const cp = state.players[state.currentPlayer];
    if (!cp?.isHuman) return;
    if (state.phase !== 'discarding' && state.phase !== 'action_prompt') return;
    if (swapMode) return;
    setSelectedTileId(selectedTileId === tileId ? null : tileId);
  }, [state, setSelectedTileId, swapMode, selectedTileId]);

  const handleTileDoubleClick = React.useCallback((tileId: number) => {
    const cp = state.players[state.currentPlayer];
    if (!cp?.isHuman) return;
    if (state.phase !== 'discarding' && state.phase !== 'action_prompt') return;
    if (swapMode) return;
    humanDiscard(tileId);
    setSelectedTileId(null);
  }, [state, humanDiscard, setSelectedTileId, swapMode]);

  const handleContextMenu = React.useCallback((tileId: number, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const cp = state.players[state.currentPlayer];
    if (!cp?.isHuman) return;
    setSelectedTileId(tileId);
    enterSwapMode(tileId);
  }, [state, enterSwapMode, setSelectedTileId]);

  const handleContainerContextMenu = React.useCallback((e: React.MouseEvent) => {
    if (swapMode) { e.preventDefault(); cancelSwap(); }
  }, [swapMode, cancelSwap]);

  const handleContainerClick = React.useCallback(() => {
    if (swapMode) cancelSwap();
  }, [swapMode, cancelSwap]);

  return (
    <TileBackContext.Provider value={backSvg}>
    <div className={`app-container skin-${currentSkin.id} theme-${THEMES[themeIdx % THEMES.length].id}`}
      onContextMenu={handleContainerContextMenu} onClick={handleContainerClick}>
      <div className="app-header">
        <h1 className="app-title">东方幻想麻雀</h1>
        <div className="app-subtitle">Touhou Gensou Mahjong</div>
        <div className="header-spacer" />
        <select className="skin-pulldown" value={skinIdx} onChange={handleSkinChange}>
          {SKINS.map((s, i) => (<option key={s.id} value={i}>{s.label}</option>))}
        </select>
        <select className="theme-pulldown" value={themeIdx} onChange={e => setThemeIdx(Number(e.target.value))}>
          {THEMES.map((t, i) => (<option key={t.id} value={i}>{t.label}</option>))}
        </select>
        <button className="btn-back" onClick={() => setShowExitConfirm(true)} style={{ fontSize: 12, padding: '4px 12px' }}>← 返回</button>
      </div>
      <GameTable key={gameKey}
        state={state}
        selectedTileId={selectedTileId}
        onTileClick={handleTileClick}
        onTileDoubleClick={handleTileDoubleClick}
        onTileContextMenu={handleContextMenu}
        onAction={humanAction}
        onNewGame={handleNewGame}
        onNextHand={handleNextHand}
        swapMode={swapMode}
        onSwapTile={executeSwap}
        riichiMode={riichiMode}
        riichiValidTileIds={riichiValidTileIds}
        onCancelRiichi={cancelRiichi}
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        autoSelfDiscard={autoSelfDiscard} noCall={noCall} autoWin={autoWin}
        onToggleSelfDiscard={() => setAutoSelfDiscard(v => !v)}
        onToggleNoCall={() => setNoCall(v => !v)}
        onToggleAutoWin={() => setAutoWin(v => !v)}
        gameLength={gameLength} onGameLengthChange={setGameLength}
        autoPlay={autoPlay} onToggleAutoPlay={() => setAutoPlay(!autoPlay)}
      />
      <div className="status-bar">
        <div className="status-messages">
          {messages.slice(-5).map((msg, i) => (<div key={i} className="status-message">{msg}</div>))}
        </div>
        {isAiThinking && (
          <div className="thinking-indicator">
            <span className="thinking-dot">●</span>
            <span className="thinking-dot">●</span>
            <span className="thinking-dot">●</span>
          </div>
        )}
      </div>

      {/* Exit confirmation dialog */}
      {showExitConfirm && (
        <div className="confirm-overlay" onClick={() => setShowExitConfirm(false)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h2>退出游戏</h2>
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', margin: '0 0 24px 0', lineHeight: 1.6 }}>
              确定要返回主页吗？<br />当前游戏进度将丢失。
            </p>
            <div className="confirm-actions">
              <button className="btn-back" onClick={() => setShowExitConfirm(false)}>← 继续游戏</button>
              <button className="btn-start-game" onClick={onExit} style={{ borderColor: 'rgba(255,80,80,0.6)', color: '#ff6666' }}>确认退出</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </TileBackContext.Provider>
  );
};

// ── App Root ──
const App: React.FC = () => {
  const [page, setPage] = React.useState<Page>('title');
  const [selectedChars, setSelectedChars] = React.useState<Character[] | null>(null);
  const [teamMode, setTeamMode] = React.useState(false);

  // 禁用鼠标右键菜单
  React.useEffect(() => {
    const handler = (e: MouseEvent) => { e.preventDefault(); };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);

  const handleStartSolo = () => { setTeamMode(false); setPage('select'); };
  const handleStartTeam = () => { setTeamMode(true); setPage('select'); };
  const handleBack = () => setPage('title');
  const handleSelectDone = (chars: Character[]) => {
    setSelectedChars(chars);
    setPage('game');
  };
  const handleExitGame = () => {
    setSelectedChars(null);
    setPage('title');
  };

  if (page === 'game' && selectedChars) {
    return <GamePage key={selectedChars.map(c => c.id).join(',')} characters={selectedChars} onExit={handleExitGame} />;
  }

  if (page === 'select') {
    return <CharacterSelect onStart={handleSelectDone} onBack={handleBack} teamMode={teamMode} />;
  }

  return <StartPage onStartSolo={handleStartSolo} onStartTeam={handleStartTeam} />;
};

export default App;
