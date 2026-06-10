import React from 'react';
import type { GameState } from '../game/types';
import { Wind, GamePhase, TOUHOU_CHARACTERS } from '../game/types';
import { tileDisplayName } from '../game/tiles';
import { getManganName } from '../game/scoring';
import TileComponent from './TileComponent';

interface GameOverModalProps {
  state: GameState;
  onNewGame: () => void;
  onNextHand: () => void;
}

const GameOverModal: React.FC<GameOverModalProps> = ({ state, onNewGame, onNextHand }) => {
  const result = state.result;
  if (!result || (state.phase !== GamePhase.HAND_OVER && state.phase !== GamePhase.GAME_OVER)) return null;

  const isGameOver = state.phase === GamePhase.GAME_OVER;
  const roundName = `${state.roundWind === Wind.EAST ? '东' : '南'}${(state.handCount % 4) + 1}局`;

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-content-wide">
        <div className="round-banner">
          {roundName} {state.honba > 0 ? `本场${state.honba} ` : ''}
          {state.riichiSticks > 0 ? `立直棒×${state.riichiSticks}` : ''}
        </div>

        <h2 className="modal-title">
          {isGameOver ? '🏁 游戏结束' :
           result.type === 'tsumo' ? '🎉 自摸和牌！' :
           result.type === 'ron' ? '💥 荣和！' :
           '🔄 流局'}
        </h2>

        <div className="modal-columns">
          {/* ── 左列：算分信息 ── */}
          <div className="modal-col-left">
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
                  {wr.totalHan >= 13 ? (
                    <span>役满</span>
                  ) : (
                    <span>{getManganName(wr.totalHan, wr.fu)} ({wr.totalHan}翻{wr.fu}符)</span>
                  )}
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
              <h3>分数变动</h3>
              {result.payments && result.payments.length > 0 ? (
                result.payments.map((p, i) => (
                  <div key={i} className="payment-row">
                    <span style={{ color: (p.from as number) === -1 ? '#888' : TOUHOU_CHARACTERS[p.from as Wind]?.color }}>
                      {(p.from as number) === -1 ? '供託' : TOUHOU_CHARACTERS[p.from as Wind]?.name || '?'}
                    </span>
                    <span className="payment-arrow">→</span>
                    <span style={{ color: TOUHOU_CHARACTERS[p.to as Wind].color }}>
                      {TOUHOU_CHARACTERS[p.to as Wind].name}
                    </span>
                    <span className="payment-amount">{p.amount.toLocaleString()}点</span>
                  </div>
                ))
              ) : (
                <div className="payment-row"><span>无分数变动</span></div>
              )}
            </div>

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
              {isGameOver ? (
                <button className="btn-primary" onClick={onNewGame}>重新开始</button>
              ) : (
                <button className="btn-primary" onClick={onNextHand}>下一局</button>
              )}
            </div>
          </div>

          {/* ── 右列：各家手牌 ── */}
          <div className="modal-col-right">
            <div className="hands-panel">
              <h3>各家手牌</h3>
              {state.players.map((p, pi) => (
                <div key={pi} className="hand-reveal-row" style={{ borderLeft: `3px solid ${TOUHOU_CHARACTERS[pi as Wind].color}` }}>
                  <div className="hand-reveal-header">
                    <span className="player-name" style={{ color: TOUHOU_CHARACTERS[pi as Wind].color }}>
                      {p.name}
                    </span>
                    <span className="player-score">{p.score.toLocaleString()}点</span>
                    {p.isRiichi && <span className="riichi-badge">{p.isDoubleRiichi ? '两立直' : '立直'}</span>}
                    {p.tenpai && <span className="tenpai-badge">听牌</span>}
                  </div>
                  {p.melds.length > 0 && (
                    <div className="meld-area">
                      {p.melds.map((meld, mi) => (
                        <div key={mi} className={`meld-group meld-${meld.type}`}>
                          {meld.tiles.map((tile, ti) => (
                            <TileComponent key={`${mi}-${ti}`} tile={tile} small
                              className={meld.type !== 'ankan' && meld.calledTile.id === tile.id ? 'meld-called-tile' : undefined} />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="hand-reveal-tiles">
                    {p.hand.map(tile => (
                      <TileComponent key={tile.id} tile={tile} small />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameOverModal;
