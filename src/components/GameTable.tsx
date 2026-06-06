import React from 'react';
import type { GameState } from '../game/types';
import { Wind, GamePhase, TOUHOU_CHARACTERS } from '../game/types';
import { getDoraFromIndicator, tileDisplayName } from '../game/tiles';
import { checkTenpai } from '../game/hand';
import TileComponent from './TileComponent';
import ActionPanel from './ActionPanel';
import GameOverModal from './GameOverModal';

interface GameTableProps {
  state: GameState;
  selectedTileId: number | null;
  onTileClick: (tileId: number) => void;
  onAction: (action: string) => void;
  onNewGame: () => void;
}

function fmtScore(score: number): string {
  return score < 0 ? `−${Math.abs(score).toLocaleString()}` : score.toLocaleString();
}

const GameTable: React.FC<GameTableProps> = ({ state, onTileClick, onAction, onNewGame }) => {
  return (
    <div className="game-table">
      <div className="table-header">
        <div className="game-info">
          <span className="round-info">{state.roundWind === Wind.EAST ? '东' : '南'}{state.honba + 1}局</span>
          <span className="honba-info">本场 {state.honba}</span>
          {state.riichiSticks > 0 && <span className="riichi-sticks">立直棒 x{state.riichiSticks}</span>}
        </div>
        <button className="btn-new-game" onClick={onNewGame}>新游戏</button>
      </div>

      <div className="table-area">
        <OpponentSection state={state} wind={Wind.NORTH} />
        <div className="table-middle">
          <div className="side-player left-player">
            <OpponentSection state={state} wind={Wind.WEST} vertical />
          </div>
          <DiscardArea state={state} />
          <div className="side-player right-player">
            <OpponentSection state={state} wind={Wind.SOUTH} vertical />
          </div>
        </div>
        <PlayerSection state={state} playerWind={Wind.EAST} onTileClick={onTileClick} />
      </div>

      <ActionPanel state={state} onAction={onAction} />

      {state.phase === GamePhase.HAND_OVER && state.result && (
        <GameOverModal state={state} onNewGame={onNewGame} />
      )}
    </div>
  );
};

// ---- Opponent ----
interface OpponentProps {
  state: GameState;
  wind: Wind;
  vertical?: boolean;
}

const OpponentSection: React.FC<OpponentProps> = ({ state, wind, vertical }) => {
  const player = state.players[wind];
  const ch = TOUHOU_CHARACTERS[wind];
  const isActive = state.currentPlayer === wind && state.phase !== GamePhase.HAND_OVER;

  return (
    <div className={`opponent-area ${vertical ? 'opponent-vertical' : 'opponent-horizontal'} ${isActive ? 'player-active' : ''}`}>
      <div className="player-info" style={{ borderColor: ch.color }}>
        <span className="player-name" style={{ color: ch.color }}>{player.name}</span>
        <span className="player-score" style={{ color: ch.colorLight }}>{fmtScore(player.score)}</span>
        {player.isRiichi && <span className="riichi-badge">立直</span>}
        {player.isDealer && <span className="dealer-badge">庄</span>}
        {isActive && <span className="turn-arrow">◀</span>}
      </div>

      <div className={`hand-tiles ${vertical ? 'hand-vertical' : ''}`}>
        {player.hand.map(t => (
          <TileComponent key={t.id} tile={t} faceDown small={vertical} />
        ))}
      </div>

      {player.melds.length > 0 && (
        <div className="meld-area">
          {player.melds.map((meld, mi) => (
            <div key={mi} className={`meld-group meld-${meld.type}`}>
              {meld.tiles.map((tile, ti) => (
                <TileComponent key={`${mi}-${ti}`} tile={tile} small
                  highlighted={meld.calledTile.id === tile.id} />
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="discard-river">
        {player.discards.map((tile, i) => (
          <TileComponent key={`d${i}`} tile={tile} small dimmed
            isRiichi={player.isRiichi && player.riichiDiscardIndex === i} />
        ))}
      </div>
    </div>
  );
};

// ---- Human Player ----
interface PlayerSectionProps {
  state: GameState;
  playerWind: Wind;
  onTileClick: (tileId: number) => void;
}

const PlayerSection: React.FC<PlayerSectionProps> = ({ state, playerWind, onTileClick }) => {
  const player = state.players[playerWind];
  const ch = TOUHOU_CHARACTERS[playerWind];
  const canAct = state.phase === GamePhase.DISCARDING || state.phase === GamePhase.ACTION_PROMPT;
  const isActive = state.currentPlayer === playerWind && state.phase !== GamePhase.HAND_OVER;

  // 计算听牌提示
  const tenpai = React.useMemo(() => {
    if (player.hand.length === 14) {
      // 刚摸牌，检查14张牌是否为和牌
      return null;
    }
    // 13张时检查听牌
    if (player.hand.length === 13 && player.melds.length <= 4 && !player.isRiichi) {
      try {
        return checkTenpai(player.hand, player.melds);
      } catch { return null; }
    }
    return null;
  }, [player.hand, player.melds, player.isRiichi]);

  return (
    <div className={`player-section ${isActive ? 'player-active' : ''}`}>
      {isActive && <div className="turn-indicator">▼ 你的回合 ▼</div>}
      <div className="player-bar">
        <div className="player-info" style={{ borderColor: ch.color }}>
          <span className="player-name" style={{ color: ch.color }}>{player.name}</span>
          <span className="player-title">{ch.title}</span>
          <span className="player-score" style={{ color: ch.colorLight }}>{fmtScore(player.score)}</span>
          {player.isRiichi && <span className="riichi-badge">立直</span>}
          {player.isDealer && <span className="dealer-badge">庄</span>}
        </div>
        {player.melds.length > 0 && (
          <div className="meld-area">
            {player.melds.map((meld, mi) => (
              <div key={mi} className={`meld-group meld-${meld.type}`}>
                {meld.tiles.map((tile, ti) => (
                  <TileComponent key={`${mi}-${ti}`} tile={tile} small
                    highlighted={meld.calledTile.id === tile.id} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hand-tiles player-hand">
        {player.hand.map(tile => (
          <TileComponent key={tile.id} tile={tile}
            onClick={canAct ? () => onTileClick(tile.id) : undefined}
            isRiichi={player.isRiichi} />
        ))}
      </div>

      {/* 听牌提示 */}
      {tenpai && tenpai.waitTiles.length > 0 && !player.isRiichi && (
        <div className="tenpai-hint">
          <span className="tenpai-label">听牌：</span>
          {tenpai.waitTiles.map((tile, i) => (
            <TileComponent key={i} tile={tile} small highlighted />
          ))}
          <span className="tenpai-count">共{tenpai.waitTiles.length}种</span>
        </div>
      )}

      <div className="discard-river player-river">
        {player.discards.map((tile, i) => (
          <TileComponent key={`d${i}`} tile={tile} small dimmed
            isRiichi={player.isRiichi && player.riichiDiscardIndex === i} />
        ))}
      </div>
    </div>
  );
};

// ---- Discard Area ----
const DiscardArea: React.FC<{ state: GameState }> = ({ state }) => {
  return (
    <div className="discard-area">
      {state.players.map((player, i) => (
        <div key={i} className={`discard-column discard-${['east','south','west','north'][i]}`}>
          <div className="discard-label" style={{ color: TOUHOU_CHARACTERS[i as Wind].color }}>
            {player.name}
          </div>
          <div className="discard-tiles">
            {player.discards.length === 0 ? (
              <span className="discard-empty">-</span>
            ) : (
              player.discards.map((tile, j) => (
                <TileComponent key={`d${i}-${j}`} tile={tile} small dimmed
                  isRiichi={player.isRiichi && player.riichiDiscardIndex === j} />
              ))
            )}
          </div>
        </div>
      ))}
      <div className="wall-info">
        <div className="dora-section">
          {state.doraIndicators.length > 0 && (
            <>
              <span className="dora-label">宝牌指示牌</span>
              {state.doraIndicators.map((tile, i) => {
                const dora = getDoraFromIndicator(tile);
                return (
                  <div key={i} className="dora-pair">
                    <TileComponent tile={tile} small />
                    <span className="dora-arrow">→</span>
                    <span className="dora-tile-name">{tileDisplayName({...tile, id: -1, suit: dora.suit, value: dora.value})}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
        <span className="wall-count">残 {state.wall.length} 枚</span>
      </div>
    </div>
  );
};

export default GameTable;
