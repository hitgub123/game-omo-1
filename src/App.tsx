import React from 'react';
import { useGame } from './hooks/useGame';
import GameTable from './components/GameTable';
import { TileBackContext } from './components/TileBackContext';
import { pickGameBackSvg } from './game/tileAssets';
import { GamePhase } from './game/types';
import { WINDS } from './game/types';
import './styles/global.css';

const SKINS = [
  { id: 'default', label: '標準' },
  { id: 'warm', label: '和風' },
  { id: 'cool', label: '蒼' },
  { id: 'gold', label: '金' },
  { id: 'sakura', label: '桜' },
  { id: 'dark', label: '漆黒' },
] as const;

const App: React.FC = () => {
  const {
    state, humanDiscard, humanAction, newGame, nextHand,
    selectedTileId, setSelectedTileId, messages, isAiThinking,
    swapMode, enterSwapMode, executeSwap, cancelSwap,
    riichiMode, riichiValidTileIds, cancelRiichi,
    difficulty, setDifficulty,
  } = useGame();

  const [skinIdx, setSkinIdx] = React.useState(0);
  const [gameKey, setGameKey] = React.useState(0);
  const [autoSelfDiscard, setAutoSelfDiscard] = React.useState(false);
  const [noCall, setNoCall] = React.useState(false);
  const [autoWin, setAutoWin] = React.useState(false);
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

  const handleNewGame = React.useCallback(() => {
    setGameKey(k => k + 1);
    setAutoSelfDiscard(false);
    setNoCall(false);
    setAutoWin(false);
    newGame();
  }, [newGame]);

  const handleNextHand = React.useCallback(() => {
    setGameKey(k => k + 1);
    setAutoSelfDiscard(false);
    setNoCall(false);
    setAutoWin(false);
    nextHand();
  }, [nextHand]);

  // ── 不鸣牌：自动跳过吃碰杠 ──
  React.useEffect(() => {
    if (!noCall) return;
    // Only applies in response phase (someone else discarded)
    if (!state.lastDiscard) return;
    const hWind = WINDS.find(w => state.players[w].isHuman);
    if (hWind === undefined) return;
    const actions = state.actionsAvailable[hWind];
    if (!actions) return;
    // Auto-pass if only chi/pon/kan are available (no ron)
    const hasRon = actions.canRon;
    const hasCall = actions.canPon || actions.canChi || actions.canKan;
    if (!hasRon && hasCall) {
      humanAction('pass');
    }
  }, [noCall, state.lastDiscard?.id, state.actionsAvailable, humanAction]);

  // ── 自动和：荣和或自摸时立即和牌 ──
  React.useEffect(() => {
    if (!autoWin) return;
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

  const backSvg = React.useMemo(() => pickGameBackSvg(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameKey]);

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
    e.preventDefault();
    e.stopPropagation();
    const cp = state.players[state.currentPlayer];
    if (!cp?.isHuman) return;
    setSelectedTileId(tileId);
    enterSwapMode(tileId);
  }, [state, enterSwapMode, setSelectedTileId]);

  const handleContainerContextMenu = React.useCallback((e: React.MouseEvent) => {
    if (swapMode) {
      e.preventDefault();
      cancelSwap();
    }
  }, [swapMode, cancelSwap]);

  const handleContainerClick = React.useCallback(() => {
    if (swapMode) {
      cancelSwap();
    }
  }, [swapMode, cancelSwap]);

  return (
    <TileBackContext.Provider value={backSvg}>
    <div className={`app-container skin-${currentSkin.id}`} onContextMenu={handleContainerContextMenu} onClick={handleContainerClick}>
      <div className="app-header">
        <h1 className="app-title">东方幻想麻雀</h1>
        <div className="app-subtitle">Touhou Gensou Mahjong</div>
        <select className="skin-pulldown" value={skinIdx} onChange={handleSkinChange}>
          {SKINS.map((s, i) => (
            <option key={s.id} value={i}>{s.label}</option>
          ))}
        </select>
      </div>

      <GameTable
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
        autoSelfDiscard={autoSelfDiscard}
        noCall={noCall}
        autoWin={autoWin}
        onToggleSelfDiscard={() => setAutoSelfDiscard(v => !v)}
        onToggleNoCall={() => setNoCall(v => !v)}
        onToggleAutoWin={() => setAutoWin(v => !v)}
      />

      <div className="status-bar">
        <div className="status-messages">
          {messages.slice(-5).map((msg, i) => (
            <div key={i} className="status-message">{msg}</div>
          ))}
        </div>
        {isAiThinking && (
          <div className="thinking-indicator">
            <span className="thinking-dot">●</span>
            <span className="thinking-dot">●</span>
            <span className="thinking-dot">●</span>
          </div>
        )}
      </div>
    </div>
    </TileBackContext.Provider>
  );
};

export default App;
