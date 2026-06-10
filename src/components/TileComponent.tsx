import React from 'react';
import type { Tile } from '../game/types';
import { getTileInnerHtml, getCachedBackSvg } from '../game/tileAssets';
import { TileBackContext } from './TileBackContext';

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
  isDora?: boolean;
  isCalled?: boolean;
  className?: string;
}

function getTileClass(tile: Tile): string {
  if (tile.suit === 'z') {
    const names = ['east', 'south', 'west', 'north', 'white', 'green', 'red'];
    return `tile honor honor-${names[tile.value - 1]}`;
  }
  const suitNames: Record<string, string> = { m: 'man', p: 'pin', s: 'sou' };
  return `tile suit-${suitNames[tile.suit] || 'man'}`;
}

// ── Tile Back (reads season from game-level context, with stable fallback) ──
const TileBack: React.FC<{ small?: boolean }> = ({ small }) => {
  const ctx = React.useContext(TileBackContext);
  const svg = ctx || getCachedBackSvg();
  if (!svg) return null;
  return (
    <div className={`tile tile-back ${small ? 'tile-small' : ''}`}>
      <div className="tile-svg" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
};

// ── Main Component ──
const TileComponent: React.FC<TileProps> = ({
  tile, selected, onClick, onDoubleClick, onContextMenu, small, faceDown,
  isRiichi, highlighted, dimmed, isNewlyDrawn, isDora, isCalled, className,
}) => {
  if (faceDown) return <TileBack small={small} />;

  const tileClassNames = [
    getTileClass(tile),
    small ? 'tile-small' : '',
    tile.isAkadora ? 'tile-akadora' : '',
    selected ? 'tile-selected' : '',
    highlighted ? 'tile-highlighted' : '',
    dimmed ? 'tile-dimmed' : '',
    isRiichi ? 'tile-riichi' : '',
    isNewlyDrawn ? 'tile-newly-drawn' : '',
    isDora ? 'tile-dora-indicator' : '',
    isCalled ? 'tile-called' : '',
    className || '',
  ].filter(Boolean).join(' ');

  // Stable SVG reference — same tile always gets the same {__html} object
  const innerHtml = getTileInnerHtml(tile.suit, tile.value, tile.isAkadora);

  return (
    <div
      className={tileClassNames}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div className="tile-svg" dangerouslySetInnerHTML={innerHtml} />
    </div>
  );
};

export { TileBack };
export default TileComponent;
