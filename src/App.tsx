import React from 'react';
import { useGame } from './hooks/useGame';
import GameTable from './components/GameTable';
import './styles/global.css';

const App: React.FC = () => {
  const { state, humanDiscard, humanAction, newGame, nextHand, messages, isAiThinking } = useGame();

  return (
    <div className="app-container">
      <div className="app-header">
        <h1 className="app-title">东方幻想麻雀</h1>
        <div className="app-subtitle">Touhou Gensou Mahjong</div>
      </div>

      <GameTable
        state={state}
        selectedTileId={null}
        onTileClick={humanDiscard}
        onAction={humanAction}
        onNewGame={newGame}
        onNextHand={nextHand}
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
