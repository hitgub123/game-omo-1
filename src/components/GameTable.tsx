import React from 'react';
import type { GameState } from '../game/types';
import { Wind, GamePhase, TOUHOU_CHARACTERS, WINDS } from '../game/types';
import { getDoraFromIndicator, tileDisplayName } from '../game/tiles';
import { checkTenpai } from '../game/hand';
import type { TenpaiInfo } from '../game/hand';
import TileComponent from './TileComponent';
import ActionPanel from './ActionPanel';
import GameOverModal from './GameOverModal';
import WallPulldown from './WallPulldown';

interface GameTableProps {
  state: GameState;
  selectedTileId: number | null;
  onTileClick: (tileId: number) => void;
  onTileDoubleClick: (tileId: number) => void;
  onTileContextMenu: (tileId: number, e: React.MouseEvent) => void;
  onAction: (action: string) => void;
  onNewGame: () => void;
  onNextHand: () => void;
  swapMode: boolean;
  onSwapTile: (tileKey: string) => void;
  riichiMode: boolean;
  riichiValidTileIds: Map<number, TenpaiInfo>;
  onCancelRiichi: () => void;
}

function fmtScore(score: number): string {
  return score < 0 ? `−${Math.abs(score).toLocaleString()}` : score.toLocaleString();
}

const GameTable: React.FC<GameTableProps> = ({ state, selectedTileId, onTileClick, onTileDoubleClick, onTileContextMenu, onAction, onNewGame, onNextHand, swapMode, onSwapTile, riichiMode, riichiValidTileIds, onCancelRiichi }) => {
  return (
    <div className="game-table">
      <div className="table-header">
        <div className="game-info">
          <span className="round-info">{state.roundWind === Wind.EAST ? '东' : '南'}{state.honba + 1}局</span>
          <span className="honba-info">本场 {state.honba}</span>
          {state.riichiSticks > 0 && <span className="riichi-sticks">立直棒 x{state.riichiSticks}</span>}
        </div>
        <div className="header-actions">
          <WallPulldown state={state} swapMode={swapMode} onSelectTile={onSwapTile} />
          <button className="btn-new-game" onClick={onNewGame}>新游戏</button>
        </div>
      </div>

      {swapMode && <div className="swap-banner">🔄 点击牌山中要交换的牌，或右键取消</div>}

      <div className="table-area">
        <OpponentSection state={state} wind={Wind.WEST} />
        <OpponentSection state={state} wind={Wind.NORTH} vertical />
        <DiscardArea state={state} />
        <OpponentSection state={state} wind={Wind.SOUTH} vertical />
        <PlayerSection state={state} playerWind={Wind.EAST} selectedTileId={selectedTileId}
          onTileClick={onTileClick} onTileDoubleClick={onTileDoubleClick}
          onTileContextMenu={onTileContextMenu}
          riichiMode={riichiMode} riichiValidTileIds={riichiValidTileIds} />
      </div>

      <ActionPanel state={state} onAction={onAction} riichiMode={riichiMode} onCancelRiichi={onCancelRiichi} />

      {state.phase === GamePhase.HAND_OVER && state.result && (
        <GameOverModal state={state} onNewGame={onNewGame} onNextHand={onNextHand} />
      )}
    </div>
  );
};

// ---- Opponent (no discard river) ----
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
    </div>
  );
};

// ---- Human Player (click=select, double-click=discard) ----
interface PlayerSectionProps {
  state: GameState;
  playerWind: Wind;
  selectedTileId: number | null;
  onTileClick: (tileId: number) => void;
  onTileDoubleClick: (tileId: number) => void;
  onTileContextMenu: (tileId: number, e: React.MouseEvent) => void;
  riichiMode: boolean;
  riichiValidTileIds: Map<number, TenpaiInfo>;
}

const PlayerSection: React.FC<PlayerSectionProps> = ({ state, playerWind, selectedTileId, onTileClick, onTileDoubleClick, onTileContextMenu, riichiMode, riichiValidTileIds }) => {
  const player = state.players[playerWind];
  const ch = TOUHOU_CHARACTERS[playerWind];
  const isActive = state.currentPlayer === playerWind && state.phase !== GamePhase.HAND_OVER;
  const canAct = state.phase === GamePhase.DISCARDING || state.phase === GamePhase.ACTION_PROMPT;

  const tenpai = React.useMemo(() => {
    if (player.hand.length === 13 && player.melds.length <= 4 && !player.isRiichi) {
      try { return checkTenpai(player.hand, player.melds); } catch { return null; }
    }
    return null;
  }, [player.hand, player.melds, player.isRiichi]);

  const riichiWaitInfo = React.useMemo(() => {
    if (!riichiMode || selectedTileId === null) return null;
    const info = riichiValidTileIds.get(selectedTileId);
    if (!info) return null;
    return info.waitTiles;
  }, [riichiMode, selectedTileId, riichiValidTileIds]);

  // 新摸的牌ID
  const drawnTileId = state.drawnTile?.id;

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
            selected={selectedTileId === tile.id}
            isNewlyDrawn={drawnTileId === tile.id}
            highlighted={riichiMode && riichiValidTileIds.has(tile.id)}
            dimmed={riichiMode && !riichiValidTileIds.has(tile.id)}
            onClick={canAct && !riichiMode ? () => onTileClick(tile.id) : undefined}
            onDoubleClick={canAct ? () => onTileDoubleClick(tile.id) : undefined}
            onContextMenu={canAct ? (e) => onTileContextMenu(tile.id, e) : undefined}
          />
        ))}
      </div>

      {tenpai && tenpai.waitTiles.length > 0 && !player.isRiichi && (
        <div className="tenpai-hint">
          <span className="tenpai-label">听牌：</span>
          {tenpai.waitTiles.map((tile, i) => (
            <TileComponent key={i} tile={tile} small highlighted />
          ))}
          <span className="tenpai-count">共{tenpai.waitTiles.length}种</span>
        </div>
      )}

      {riichiWaitInfo && riichiWaitInfo.length > 0 && (
        <div className="riichi-wait-hint">
          打出此牌可听：
          {riichiWaitInfo.map((tile, i) => (
            <TileComponent key={i} tile={tile} small highlighted />
          ))}
          <span className="tenpai-count">共{riichiWaitInfo.length}种</span>
        </div>
      )}
    </div>
  );
};

// ---- Discard Area (center, all players) ----
const DiscardArea: React.FC<{ state: GameState }> = ({ state }) => {
  const humanWind = WINDS.find(w => state.players[w].isHuman) ?? Wind.EAST;
  const humanActions = state.actionsAvailable[humanWind];
  const humanCanCall = humanActions && (humanActions.canRon || humanActions.canPon || humanActions.canChi || humanActions.canKan);
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
                  isRiichi={player.isRiichi && player.riichiDiscardIndex === j}
                  isCalled={humanCanCall && state.lastDiscard?.id === tile.id} />
              ))
            )}
          </div>
        </div>
      ))}
      <div className="wall-info">
        <div className="dora-section">
          {state.doraIndicators.length > 0 && (
            <>
              <span className="dora-label">宝牌</span>
              {state.doraIndicators.map((tile, i) => {
                const dora = getDoraFromIndicator(tile);
                return (
                  <div key={i} className="dora-pair">
                    <TileComponent tile={tile} small isDora />
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
