import React from 'react';
import type { GameState } from '../game/types';
import { Wind, GamePhase, TOUHOU_CHARACTERS } from '../game/types';
import { tileDisplayName } from '../game/tiles';
import { getManganName } from '../game/scoring';

interface GameOverModalProps {
  state: GameState;
  onNewGame: () => void;
}

const GameOverModal: React.FC<GameOverModalProps> = ({ state, onNewGame }) => {
  const result = state.result;
  if (!result || state.phase !== GamePhase.HAND_OVER) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">
          {result.type === 'tsumo' ? '🎉 自摸和牌！' :
           result.type === 'ron' ? '💥 荣和！' :
           result.type === 'draw' ? '🔄 流局' : '🏁 游戏结束'}
        </h2>

        {result.type === 'draw' && (
          <div className="draw-result">
            <p>流局：{result.drawReason || '牌山耗尽'}</p>
            {result.tenpaiPlayers && result.tenpaiPlayers.length > 0 && (
              <p className="tenpai-info">
                听牌：{result.tenpaiPlayers.map(w => TOUHOU_CHARACTERS[w as Wind].name).join('、')}
              </p>
            )}
          </div>
        )}

        {result.winResults?.map((wr, idx) => (
          <div key={idx} className="win-result">
            <div className="win-header">
              <span className="winner-name" style={{ color: TOUHOU_CHARACTERS[wr.player as Wind].color }}>
                {TOUHOU_CHARACTERS[wr.player as Wind].name}
              </span>
              <span className="win-type">{wr.isTsumo ? '自摸' : '荣和'}</span>
            </div>
            <div className="win-details">
              <span>和牌：{tileDisplayName(wr.winningTile)}</span>
              <span>{getManganName(wr.totalHan, wr.fu)} ({wr.totalHan}翻{wr.fu}符)</span>
              <span className="win-points">{wr.winnerGets.toLocaleString()}点</span>
            </div>
            <div className="yaku-list">
              {wr.yaku.map((y, yi) => (
                <span key={yi} className={`yaku-badge ${y.isYakuman ? 'yakuman' : ''}`}>
                  {y.name}{y.isYakuman ? '' : ` ${y.han}翻`}
                </span>
              ))}
            </div>
          </div>
        ))}

        <div className="score-summary">
          <h3>当前分数</h3>
          {state.players.map((p, i) => (
            <div key={i} className="score-row" style={{ color: TOUHOU_CHARACTERS[i as Wind].color }}>
              <span>{p.name}</span>
              <span className={p.score < 0 ? 'negative' : ''}>{p.score.toLocaleString()}点</span>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn-primary" onClick={onNewGame}>下一局</button>
        </div>
      </div>
    </div>
  );
};

export default GameOverModal;
