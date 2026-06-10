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

const BACKGROUNDS = [
  '/bg/Konachan.com - 398756 sample.jpg',
  '/bg/Konachan.com - 403419 sample.jpg',
  '/bg/Konachan.com - 403798 sample.jpg',
  '/bg/Konachan.com - 404789 sample.jpg',
];

const SLOT_LABELS = ['1P', '2P', '3P', '4P'];

const CharacterSelect: React.FC<CharacterSelectProps> = ({ onStart, onBack }) => {
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [activeTeamIdx, setActiveTeamIdx] = React.useState(0);
  const [selected, setSelected] = React.useState<(Character | null)[]>([null, null, null, null]);
  const bgImage = React.useMemo(
    () => BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)],
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
        <button className="btn-back" onClick={onBack}>← 返回</button>
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
    </div>
  );
};

export default CharacterSelect;
