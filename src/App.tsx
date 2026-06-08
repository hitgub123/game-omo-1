import React from 'react';
import { useGame } from './hooks/useGame';
import GameTable from './components/GameTable';
import './styles/global.css';

const App: React.FC = () => {
  const {
    state, humanDiscard, humanAction, newGame, nextHand,
    selectedTileId, setSelectedTileId, messages, isAiThinking,
    swapMode, enterSwapMode, executeSwap, cancelSwap,
    riichiMode, riichiValidTileIds, cancelRiichi,
  } = useGame();

  const handleTileClick = React.useCallback((tileId: number) => {
    const cp = state.players[state.currentPlayer];
    if (!cp?.isHuman) return;
    if (state.phase !== 'discarding' && state.phase !== 'action_prompt') return;
    if (swapMode) return; // 交换模式不处理点击选择
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
    setSelectedTileId(tileId); // 先选中
    enterSwapMode(tileId);
  }, [state, enterSwapMode, setSelectedTileId]);

  // 全局右键/点击取消换牌模式
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
    <div className="app-container" onContextMenu={handleContainerContextMenu} onClick={handleContainerClick}>
      <div className="app-header">
        <h1 className="app-title">东方幻想麻雀</h1>
        <div className="app-subtitle">Touhou Gensou Mahjong</div>
      </div>

      <GameTable
        state={state}
        selectedTileId={selectedTileId}
        onTileClick={handleTileClick}
        onTileDoubleClick={handleTileDoubleClick}
        onTileContextMenu={handleContextMenu}
        onAction={humanAction}
        onNewGame={newGame}
        onNextHand={nextHand}
        swapMode={swapMode}
        onSwapTile={executeSwap}
        riichiMode={riichiMode}
        riichiValidTileIds={riichiValidTileIds}
        onCancelRiichi={cancelRiichi}
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
  );
};

export default App;
