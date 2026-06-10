import React from 'react';
import type { GameState, Tile } from '../game/types';
import { Wind, GamePhase, TOUHOU_CHARACTERS, WINDS, MeldType } from '../game/types';
import { checkTenpai } from '../game/hand';
import type { TenpaiInfo } from '../game/hand';
import TileComponent from './TileComponent';
import ActionPanel from './ActionPanel';
import GameOverModal from './GameOverModal';
import WallPulldown from './WallPulldown';
import type { DifficultyLevel } from '../game/difficulty';

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
  difficulty: DifficultyLevel;
  onDifficultyChange: (level: DifficultyLevel) => void;
  autoSelfDiscard: boolean;
  noCall: boolean;
  autoWin: boolean;
  onToggleSelfDiscard: () => void;
  onToggleNoCall: () => void;
  onToggleAutoWin: () => void;
}

function fmtScore(score: number): string {
  return score < 0 ? `−${Math.abs(score).toLocaleString()}` : score.toLocaleString();
}

const GameTable: React.FC<GameTableProps> = ({ state, selectedTileId, onTileClick, onTileDoubleClick, onTileContextMenu, onAction, onNewGame, onNextHand, swapMode, onSwapTile, riichiMode, riichiValidTileIds, onCancelRiichi, difficulty, onDifficultyChange, autoSelfDiscard, noCall, autoWin, onToggleSelfDiscard, onToggleNoCall, onToggleAutoWin }) => {
  const riichiWaitFloat = React.useMemo(() => {
    if (!riichiMode || selectedTileId === null) return null;
    const info = riichiValidTileIds.get(selectedTileId);
    return info?.waitTiles || null;
  }, [riichiMode, selectedTileId, riichiValidTileIds]);
  return (
    <div className="game-table">
      <div className="table-header">
        <div className="game-info">
          <span className="round-info">{state.roundWind === Wind.EAST ? '东' : '南'}{(state.handCount % 4) + 1}局</span>
          <span className="honba-info">本场 {state.honba}</span>
          {state.riichiSticks > 0 && <span className="riichi-sticks">立直棒 x{state.riichiSticks}</span>}
        </div>
        <div className="header-actions">
          <WallPulldown state={state} swapMode={swapMode} onSelectTile={onSwapTile} />
          <div className="difficulty-selector">
            <select
              value={difficulty}
              onChange={e => onDifficultyChange(e.target.value as DifficultyLevel)}
              className="difficulty-pulldown"
              title="电脑AI难度"
            >
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard</option>
              <option value="lunatic">Lunatic</option>
            </select>
          </div>
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
          riichiMode={riichiMode} riichiValidTileIds={riichiValidTileIds}
          autoSelfDiscard={autoSelfDiscard} noCall={noCall} autoWin={autoWin}
          onToggleSelfDiscard={onToggleSelfDiscard} onToggleNoCall={onToggleNoCall} onToggleAutoWin={onToggleAutoWin} />
      </div>

      <ActionPanel state={state} onAction={onAction} riichiMode={riichiMode} onCancelRiichi={onCancelRiichi} />

      <TenpaiFloat state={state} riichiWaitTiles={riichiWaitFloat} />

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
    <div className={`opponent-area ${vertical ? 'opponent-vertical' : 'opponent-horizontal'} opponent-${['east','south','west','north'][wind]} ${isActive ? 'player-active' : ''}`}>`
      <div className="player-info" style={{ borderColor: ch.color }}>
        <span className="player-name" style={{ color: ch.color }}>{player.name}</span>
        <span className="player-score" style={{ color: ch.colorLight }}>{fmtScore(player.score)}</span>
        {player.isRiichi && <span className="riichi-badge">{player.isDoubleRiichi ? '两立直' : '立直'}</span>}
        {player.isDealer && <span className="dealer-badge">庄</span>}
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
                  highlighted={meld.calledTile.id === tile.id}
                  className={meld.calledTile.id === tile.id && meld.type !== MeldType.ANKAN ? 'meld-called-tile' : undefined} />
              ))}
              {meld.from !== undefined && meld.type !== MeldType.ANKAN && (
                <span className="meld-from-label" style={{ color: TOUHOU_CHARACTERS[meld.from].color }}>
                  {['', '下','对','上'][(meld.from - wind + 4) % 4]}
                </span>
              )}
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
  autoSelfDiscard: boolean;
  noCall: boolean;
  autoWin: boolean;
  onToggleSelfDiscard: () => void;
  onToggleNoCall: () => void;
  onToggleAutoWin: () => void;
}

const PlayerSection: React.FC<PlayerSectionProps> = ({ state, playerWind, selectedTileId, onTileClick, onTileDoubleClick, onTileContextMenu, riichiMode, riichiValidTileIds, autoSelfDiscard, noCall, autoWin, onToggleSelfDiscard, onToggleNoCall, onToggleAutoWin }) => {
  const player = state.players[playerWind];
  const ch = TOUHOU_CHARACTERS[playerWind];
  const isActive = state.currentPlayer === playerWind && state.phase !== GamePhase.HAND_OVER;
  const canAct = state.phase === GamePhase.DISCARDING || state.phase === GamePhase.ACTION_PROMPT;

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
      <div className="player-bar">
        <div className="player-info" style={{ borderColor: ch.color }}>
          <span className="player-name" style={{ color: ch.color }}>{player.name}</span>
          <span className="player-title">{ch.title}</span>
          <span className="player-score" style={{ color: ch.colorLight }}>{fmtScore(player.score)}</span>
          {player.isRiichi && <span className="riichi-badge">{player.isDoubleRiichi ? '两立直' : '立直'}</span>}
          {player.isDealer && <span className="dealer-badge">庄</span>}
          <div className="player-toggles">
            <button className={`toggle-btn-sm ${autoSelfDiscard ? 'toggle-on' : ''}`}
              onClick={onToggleSelfDiscard} title="自动打出摸到的牌（有动作时暂停）">自摸切</button>
            <button className={`toggle-btn-sm ${noCall ? 'toggle-on' : ''}`}
              onClick={onToggleNoCall} title="不提示吃碰杠，只提示和牌与暗杠">不鸣牌</button>
            <button className={`toggle-btn-sm ${autoWin ? 'toggle-on' : ''}`}
              onClick={onToggleAutoWin} title="可荣和或自摸时自动和牌">自动和</button>
          </div>
        </div>
        {player.melds.length > 0 && (
          <div className="meld-area">
            {player.melds.map((meld, mi) => (
              <div key={mi} className={`meld-group meld-${meld.type}`}>
                {meld.tiles.map((tile, ti) => (
                  <TileComponent key={`${mi}-${ti}`} tile={tile} small
                    faceDown={meld.type === MeldType.ANKAN && (ti === 1 || ti === 2)}
                    highlighted={meld.calledTile.id === tile.id}
                    className={meld.calledTile.id === tile.id && meld.type !== MeldType.ANKAN ? 'meld-called-tile' : undefined} />
                ))}
                {meld.from !== undefined && meld.type !== MeldType.ANKAN && (
                  <span className="meld-from-label" style={{ color: TOUHOU_CHARACTERS[meld.from].color }}>
                    {['', '下','对','上'][(meld.from - Wind.EAST + 4) % 4]}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="hand-tiles player-hand">
          {player.hand.map(tile => (
            <TileComponent key={tile.id} tile={tile}
              selected={selectedTileId === tile.id}
              className={drawnTileId === tile.id ? 'tile-drawn-gap' : undefined}
              highlighted={riichiMode && riichiValidTileIds.has(tile.id)}
              dimmed={riichiMode && !riichiValidTileIds.has(tile.id)}
              onClick={canAct ? () => onTileClick(tile.id) : undefined}
              onDoubleClick={canAct ? () => onTileDoubleClick(tile.id) : undefined}
              onContextMenu={canAct ? (e) => onTileContextMenu(tile.id, e) : undefined}
            />
          ))}
        </div>
      </div>

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

// 听牌悬浮提示
const TenpaiFloat: React.FC<{ state: GameState; riichiWaitTiles: Tile[] | null }> = ({ state, riichiWaitTiles }) => {
  const humanWind = WINDS.find(w => state.players[w].isHuman) ?? Wind.EAST;
  const player = state.players[humanWind];
  const tenpai = React.useMemo(() => {
    if (player.melds.length > 4) return null;
    // Remove the drawn tile to get the standing hand
    const h = state.drawnTile
      ? player.hand.filter(t => t.id !== state.drawnTile!.id)
      : player.hand;
    // Expected hand size = 13 - 3 * melds
    if (h.length !== 13 - player.melds.length * 3) return null;
    try { return checkTenpai(h, player.melds); } catch { return null; }
  }, [player.hand, player.melds, state.drawnTile]);

  const tiles = riichiWaitTiles && riichiWaitTiles.length > 0 ? riichiWaitTiles
    : (tenpai && tenpai.waitTiles.length > 0 ? tenpai.waitTiles : null);

  if (!tiles || tiles.length === 0) return null;
  return (
    <div className="riichi-wait-hint">
      {riichiWaitTiles && riichiWaitTiles.length > 0 ? '打出此牌可听：' : '听牌：'}
      {tiles.map((tile, i) => (
        <TileComponent key={i} tile={tile} small highlighted />
      ))}
      <span className="tenpai-count">共{tiles.length}种</span>
    </div>
  );
};

// ---- Discard Area (center, all players) ----
const DiscardArea: React.FC<{ state: GameState }> = ({ state }) => {
  const humanWind = WINDS.find(w => state.players[w].isHuman) ?? Wind.EAST;
  const humanActions = state.actionsAvailable[humanWind];
  const humanCanCall = humanActions && (humanActions.canRon || humanActions.canPon || humanActions.canChi || humanActions.canKan);

  // 里宝牌只在和牌者立直时才显示
  const showUra = state.phase === GamePhase.HAND_OVER && state.result?.winners?.some(w => state.players[w].isRiichi);
  return (
    <div className="discard-area">
      {state.players.map((player, i) => (
        <div key={i} className={`discard-column discard-${['east','south','north','west'][i]}`}>
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
        <span className="wall-count">残 {state.wall.length} 枚</span>
      </div>
      <div className="dora-section">
        {state.doraIndicators.map((tile, i) => {
          const ura = state.uraDoraIndicators[i];
          return (
            <div key={i} className="dora-pair">
              <TileComponent tile={tile} small isDora />
              {showUra && ura && (
                <span className="ura-indicator">
                  <TileComponent tile={ura} small isDora />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GameTable;
