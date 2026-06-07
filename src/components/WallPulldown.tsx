import React, { useState } from 'react';
import type { GameState, Tile, TileSuit } from '../game/types';
import { tileKey, tileDisplayName } from '../game/tiles';

interface WallPulldownProps {
  state: GameState;
  swapMode?: boolean;
  onSelectTile?: (tileKey: string) => void;
}

/** 收集所有可见的牌（各人手牌、弃牌、副露） */
function collectVisibleTiles(state: GameState): Tile[] {
  const visible: Tile[] = [];
  for (const p of state.players) {
    visible.push(...p.hand);       // 手牌
    visible.push(...p.discards);   // 弃牌
    for (const m of p.melds) {
      visible.push(...m.tiles);    // 副露
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

const WallPulldown: React.FC<WallPulldownProps> = ({ state, swapMode, onSelectTile }) => {
  const [open, setOpen] = useState(false);

  const visible = collectVisibleTiles(state);
  const visibleCounts = countVisible(visible);
  const allKeys = allTileKeys();

  // swap模式自动打开
  React.useEffect(() => {
    if (swapMode) setOpen(true);
  }, [swapMode]);

  const handleRowClick = (key: string) => {
    if (swapMode && onSelectTile) {
      onSelectTile(key);
    }
  };

  const label = swapMode ? '选择交换的牌' : '牌山 ▾';

  return (
    <div className={`wall-pulldown ${open ? 'open' : ''}`}>
      <button className="btn-wall-pulldown" onClick={() => { if (!swapMode) setOpen(!open); }}>
        {label}
      </button>
      {open && (
        <div className="wall-pulldown-menu">
          <div className="wall-pulldown-header">
            <span>牌种</span>
            <span>已见</span>
            <span>剩余</span>
          </div>
          {allKeys.map(k => {
            const visible = visibleCounts[k] || 0;
            const remaining = 4 - visible;
            if (remaining === 4) return null; // 一张未见的折叠
            const name = tileDisplayName({ id: -1, suit: k[0] as TileSuit, value: parseInt(k[1]) });
            const suitClass = k[0] === 'z' ? 'row-honor' : `row-suit-${k[0]}`;
            const clickable = swapMode && remaining > 0;
            return (
              <div key={k} className={`wall-pulldown-row ${suitClass} ${clickable ? 'clickable' : ''}`}
                onClick={() => clickable && handleRowClick(k)}>
                <span className="wall-tile-name">{name}</span>
                <span className="wall-visible">{visible}</span>
                <span className="wall-remaining">{remaining}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WallPulldown;
