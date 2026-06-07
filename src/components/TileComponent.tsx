import React from 'react';
import type { Tile } from '../game/types';
import { tileDisplayName } from '../game/tiles';

interface TileProps {
  tile: Tile;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  small?: boolean;
  faceDown?: boolean;
  isRiichi?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  isNewlyDrawn?: boolean;
}

function getTileClass(tile: Tile): string {
  if (tile.suit === 'z') {
    const names = ['east', 'south', 'west', 'north', 'white', 'green', 'red'];
    return `tile honor honor-${names[tile.value - 1]}`;
  }
  const suitNames: Record<string, string> = { m: 'man', p: 'pin', s: 'sou' };
  return `tile suit-${suitNames[tile.suit] || 'man'}`;
}

function getTileNum(tile: Tile): string {
  if (tile.suit === 'z') return '';
  return ['一','二','三','四','五','六','七','八','九'][tile.value - 1] || '';
}

function getTileSuit(tile: Tile): string {
  return { m: '萬', p: '筒', s: '索', z: '' }[tile.suit] || '';
}

const TileBack: React.FC<{ small?: boolean }> = ({ small }) => (
  <div className={`tile tile-back ${small ? 'tile-small' : ''}`}>
    <div className="tile-back-inner"><span className="tile-back-pattern">◆</span></div>
  </div>
);

const TileComponent: React.FC<TileProps> = ({
  tile, selected, onClick, onDoubleClick, onContextMenu, small, faceDown, isRiichi, highlighted, dimmed, isNewlyDrawn,
}) => {
  if (faceDown) return <TileBack small={small} />;

  const displayName = tileDisplayName(tile);

  const className = [
    getTileClass(tile),
    small ? 'tile-small' : '',
    selected ? 'tile-selected' : '',
    highlighted ? 'tile-highlighted' : '',
    dimmed ? 'tile-dimmed' : '',
    isRiichi ? 'tile-riichi' : '',
    isNewlyDrawn ? 'tile-newly-drawn' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={className} onClick={onClick} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu} title={displayName}>
      <div className="tile-inner">
        {tile.suit === 'z' ? (
          <>
            <span className="tile-honor-char">{displayName}</span>
            <span className="tile-honor-sub">
              {['東風','南風','西風','北風','白','發','中'][tile.value - 1]}
            </span>
          </>
        ) : (
          <>
            <span className="tile-number">{getTileNum(tile)}</span>
            <span className="tile-suit">{getTileSuit(tile)}</span>
          </>
        )}
      </div>
    </div>
  );
};

export { TileBack };
export default TileComponent;
