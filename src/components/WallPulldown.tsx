import React, { useState } from 'react';
import type { GameState, Tile, TileSuit } from '../game/types';
import { tileKey, tileDisplayName } from '../game/tiles';

interface WallPulldownProps {
  state: GameState;
  swapMode?: boolean;
  onSelectTile?: (tileKey: string) => void;
}

/** 收集所有可见的牌（各人手牌、弃牌、副露）——按id去重 */
function collectVisibleTiles(state: GameState): Tile[] {
  const seen = new Set<number>();
  const visible: Tile[] = [];
  for (const p of state.players) {
    if (p.isHuman) {
      for (const t of p.hand) { if (!seen.has(t.id)) { seen.add(t.id); visible.push(t); } }
    }
    for (const t of p.discards) { if (!seen.has(t.id)) { seen.add(t.id); visible.push(t); } }
    for (const m of p.melds) {
      for (const t of m.tiles) { if (!seen.has(t.id)) { seen.add(t.id); visible.push(t); } }
    }
  }
  return visible;
}

/** 统计每种牌已出现几张 */
function countVisible(visible: Tile[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of visible) {
    const k = tileKey(t);
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}

/** 所有34种牌的key列表 */
function allTileKeys(): string[] {
  const keys: string[] = [];
  for (const suit of ['m', 'p', 's'] as TileSuit[]) {
    for (let v = 1; v <= 9; v++) keys.push(`${suit}${v}`);
  }
  for (let v = 1; v <= 7; v++) keys.push(`z${v}`);
  return keys;
}

/** 统计牌山中每种牌的数量 */
function countWall(state: GameState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of state.wall) {
    const k = tileKey(t);
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}

const WallPulldown: React.FC<WallPulldownProps> = ({ state, swapMode, onSelectTile }) => {
  const [open, setOpen] = useState(false);

  const visible = collectVisibleTiles(state);
  const visibleCounts = countVisible(visible);
  const wallCounts = countWall(state);
  const allKeys = allTileKeys();
  React.useEffect(() => {
    for (const k of allKeys) {
      if ((visibleCounts[k] || 0) > 4) console.warn('[PULLDOWN] 牌超量:', k, '已见=', visibleCounts[k], '手牌数:', state.players.map(p => `${p.name}:hand${p.hand.length}d${p.discards.length}m${p.melds.length}`));
    }
  }, [visibleCounts, allKeys, state.players]);

  // swap模式自动打开
  React.useEffect(() => {
    if (swapMode) setOpen(true);
  }, [swapMode]);

  const handleRowClick = (key: string) => {
    if (swapMode && onSelectTile) {
      onSelectTile(key);
    }
  };

  const col1Keys = allKeys.filter(k => k[0] === 'm' || k[0] === 'p');
  const col2Keys = allKeys.filter(k => k[0] === 's' || k[0] === 'z');

  const renderColumn = (keys: string[]) => (
    <div className="wall-pulldown-col">
      {keys.map(k => {
        const seen = visibleCounts[k] || 0;
        const inWall = wallCounts[k] || 0;
        const name = tileDisplayName({ id: -1, suit: k[0] as TileSuit, value: parseInt(k[1]) });
        const suitClass = k[0] === 'z' ? 'row-honor' : `row-suit-${k[0]}`;
        const clickable = swapMode && inWall > 0;
        return (
          <div key={k} className={`wall-pulldown-row ${suitClass} ${clickable ? 'clickable' : ''}`}
            onClick={() => clickable && handleRowClick(k)}>
            <span className="wall-tile-name">{name}</span>
            <span className="wall-visible">{seen}</span>
            <span className="wall-remaining">{inWall}</span>
          </div>
        );
      })}
    </div>
  );

  const label = swapMode ? '选择交换的牌' : '牌山 ▾';

  return (
    <div className={`wall-pulldown ${open ? 'open' : ''}`}>
      <button className="btn-wall-pulldown" onClick={() => { if (!swapMode) setOpen(!open); }}>
        {label}
      </button>
      {open && (
        <div className="wall-pulldown-menu" onClick={e => e.stopPropagation()}>
          <div className="wall-pulldown-header">
            <span>牌种</span><span>已见</span><span>剩余</span>
            <span>牌种</span><span>已见</span><span>剩余</span>
          </div>
          <div className="wall-pulldown-body">
            {renderColumn(col1Keys)}
            {renderColumn(col2Keys)}
          </div>
        </div>
      )}
    </div>
  );
};

export default WallPulldown;
