import React from 'react';
import '../styles/title-screen.css';

interface Character {
  id: string;
  nameCN: string;
  nameJP: string;
  nameEN: string;
  icon: string;
  race: string;
  ability: string;
  [key: string]: unknown;
}

interface Team {
  teamId: string;
  teamName: string;
  members: Character[];
}

interface CharacterSelectProps {
  onStart: (selected: Character[]) => void;
  onBack: () => void;
}

// Auto-discover background images (same source as StartPage)
const bgModules = import.meta.glob<string>(
  '/assets/pic/desktop/*.{jpg,png,webp}',
  { eager: true, query: '?url', import: 'default' },
);
const BG_IMAGES = Object.values(bgModules);
const FALLBACK_BG = '/bg/Konachan.com - 404789 sample.jpg';

const SLOT_LABELS = ['1P', '2P', '3P', '4P'];

const CharacterSelect: React.FC<CharacterSelectProps> = ({ onStart, onBack }) => {
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [activeTeamIdx, setActiveTeamIdx] = React.useState(0);
  const [selected, setSelected] = React.useState<(Character | null)[]>([null, null, null, null]);
  const [hoveredChar, setHoveredChar] = React.useState<Character | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });
  const bgImage = React.useMemo(
    () => BG_IMAGES.length > 0
      ? BG_IMAGES[Math.floor(Math.random() * BG_IMAGES.length)]
      : FALLBACK_BG,
    []
  );

  // Load character data
  React.useEffect(() => {
    fetch('/characters.json')
      .then(r => r.json())
      .then((data: Team[]) => setTeams(data))
      .catch(() => {});
  }, []);

  const handleSelect = (char: Character) => {
    setSelected(prev => {
      // If already selected, deselect
      const existingIdx = prev.findIndex(c => c?.id === char.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = null;
        return next;
      }
      // Find first empty slot
      const emptyIdx = prev.findIndex(c => c === null);
      if (emptyIdx < 0) return prev; // all full
      const next = [...prev];
      next[emptyIdx] = char;
      return next;
    });
  };

  const handleSlotClick = (idx: number) => {
    setSelected(prev => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
  };

  const allFilled = selected.every(c => c !== null);
  const totalChars = teams.reduce((s, t) => s + t.members.length, 0);
  const activeTeam = teams[activeTeamIdx];

  const handleMouseEnter = React.useCallback((char: Character, e: React.MouseEvent) => {
    setHoveredChar(char);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const TOOLTIP_W = 320;
    let left = rect.left;
    // 防右侧溢出：如果悬浮窗超出右边界，则右侧对齐
    if (left + TOOLTIP_W > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - TOOLTIP_W - 8);
    }
    setTooltipPos({ x: left, y: rect.bottom + 8 });
  }, []);

  const handleMouseLeave = React.useCallback(() => {
    setHoveredChar(null);
  }, []);

  const quickStart = React.useCallback(() => {
    const allChars = teams.flatMap(t => t.members);
    const shuffled = [...allChars].sort(() => Math.random() - 0.5);
    onStart(shuffled.slice(0, 4));
  }, [teams, onStart]);

  return (
    <div className="char-select-page">
      <div className="start-bg" style={{ backgroundImage: `url(${bgImage})` }} />
      <div className="start-overlay" />

      {/* Header */}
      <div className="char-select-header">
        <h2>选择角色</h2>
        <div className="slot-indicators">
          {SLOT_LABELS.map((label, i) => (
            <div
              key={i}
              className={`slot-dot ${selected[i] ? 'filled' : ''}`}
              onClick={() => handleSlotClick(i)}
              title={selected[i] ? `点击取消 ${selected[i]!.nameCN}` : `${label}: 未选择`}
            >
              {selected[i] ? (
                <span>{selected[i]!.nameCN.slice(0, 1)}</span>
              ) : (
                label
              )}
            </div>
          ))}
        </div>
        <button className="btn-back" onClick={onBack}>← 返回</button>
      </div>

      {/* Body */}
      <div className="char-select-body">
        {/* Team sidebar */}
        <div className="char-team-list">
          {teams.map((team, i) => (
            <div
              key={team.teamId}
              className={`team-tab ${i === activeTeamIdx ? 'active' : ''}`}
              onClick={() => setActiveTeamIdx(i)}
            >
              {team.teamName}
              <span className="team-count">({team.members.length})</span>
            </div>
          ))}
        </div>

        {/* Character grid */}
        <div className="char-grid-area">
          {activeTeam && (
            <>
              <div className="team-title">{activeTeam.teamName}</div>
              <div className="char-grid">
                {activeTeam.members.map(char => {
                  const slotIdx = selected.findIndex(c => c?.id === char.id);
                  const isSelected = slotIdx >= 0;
                  return (
                    <div
                      key={char.id}
                      className={`char-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelect(char)}
                      onMouseEnter={e => handleMouseEnter(char, e)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <div className="char-avatar">
                        {char.nameCN.slice(0, 1)}
                      </div>
                      <div className="char-name">{char.nameCN}</div>
                      <div className="char-name-en">{char.nameEN}</div>
                      <div className="char-race">{char.race}</div>
                      {isSelected && (
                        <div className="selected-badge">{SLOT_LABELS[slotIdx]}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div style={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 24, fontSize: 12 }}>
            共 {totalChars} 名角色 · 点击角色选择 · 点击已选角色取消
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="char-select-footer">
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
          {allFilled
            ? `已选择 ${selected.map(c => c!.nameCN).join(' · ')}`
            : `已选择 ${selected.filter(Boolean).length}/4 位角色`}
        </div>
        <button className="btn-back" onClick={quickStart} style={{ fontSize: 14, padding: '8px 24px' }}>
          快速开始
        </button>
        <button
          className="btn-start-game"
          disabled={!allFilled}
          onClick={() => onStart(selected as Character[])}
        >
          开始游戏
        </button>
      </div>
      {/* Character tooltip */}
      {hoveredChar && (
        <div
          className="char-tooltip"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
          onMouseEnter={() => setHoveredChar(hoveredChar)}
          onMouseLeave={() => setHoveredChar(null)}
        >
          <div className="tooltip-header">
            <span className="tooltip-name">{hoveredChar.nameCN}</span>
            <span className="tooltip-name-jp">{hoveredChar.nameJP}</span>
            <span className="tooltip-name-en">{hoveredChar.nameEN}</span>
          </div>
          {hoveredChar.ref && (
            <div className="tooltip-ref">参考：{hoveredChar.id}</div>
          )}
          <div className="tooltip-body">
            <div className="tooltip-row">
              <span className="tooltip-label">种族</span>
              <span className="tooltip-value">{hoveredChar.race || '—'}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">能力</span>
              <span className="tooltip-value">{hoveredChar.ability || '—'}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">性格</span>
              <span className="tooltip-value">{hoveredChar.personality || '—'}</span>
            </div>
            <div className="tooltip-divider" />
            <div className="tooltip-row">
              <span className="tooltip-label">麻将能力</span>
              <span className="tooltip-value mahjong">{hoveredChar.mahjong_skill || '—'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterSelect;
