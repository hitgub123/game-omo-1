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
  onStart: (selected: Character[], useAbilities: boolean) => void;
  onBack: () => void;
  teamMode: boolean;
}

// Auto-discover background images (same source as StartPage)
const bgModules = import.meta.glob<string>(
  '/assets/pic/desktop/*.{jpg,png,webp}',
  { eager: true, query: '?url', import: 'default' },
);
const BG_IMAGES = Object.values(bgModules);
const FALLBACK_BG = '/bg/Konachan.com - 404789 sample.jpg';

const SLOT_LABELS = ['1P', '2P', '3P', '4P'];

const CharacterSelect: React.FC<CharacterSelectProps> = ({ onStart, onBack, teamMode }) => {
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [activeTeamIdx, setActiveTeamIdx] = React.useState(0);
  const [selected, setSelected] = React.useState<(Character | null)[]>([null, null, null, null]);
  const [selectedTeams, setSelectedTeams] = React.useState<Team[]>([]);
  const [selectedTeamMembers, setSelectedTeamMembers] = React.useState<Map<string, Character[]>>(new Map());
  const [hoveredChar, setHoveredChar] = React.useState<Character | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });
  const [confirming, setConfirming] = React.useState(false);
  const [useAbilities, setUseAbilities] = React.useState(true);
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
      const existingIdx = prev.findIndex(c => c?.id === char.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = null;
        return next;
      }
      const emptyIdx = prev.findIndex(c => c === null);
      if (emptyIdx < 0) return prev;
      const next = [...prev];
      next[emptyIdx] = char;
      return next;
    });
  };

  const handleSlotClick = (idx: number) => {
    if (teamMode) return;
    setSelected(prev => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
  };

  const handleTeamClick = (team: Team, i: number) => {
    if (teamMode) {
      setSelectedTeams(prev => {
        const exists = prev.find(t => t.teamId === team.teamId);
        if (exists) {
          setSelectedTeamMembers(m => { const next = new Map(m); next.delete(team.teamId); return next; });
          return prev.filter(t => t.teamId !== team.teamId);
        }
        if (prev.length >= 4) return prev;
        setSelectedTeamMembers(m => { const next = new Map(m); next.set(team.teamId, []); return next; });
        return [...prev, team];
      });
      if (activeTeamIdx !== i) setActiveTeamIdx(i);
    } else {
      setActiveTeamIdx(i);
    }
  };

  const handleCharClickTeam = (char: Character) => {
    const activeTeam = teams[activeTeamIdx];
    if (!activeTeam) return;
    setSelectedTeamMembers(m => {
      const next = new Map(m);
      const current = next.get(activeTeam.teamId) || [];
      const idx = current.findIndex(c => c.id === char.id);
      if (idx >= 0) {
        next.set(activeTeam.teamId, current.filter(c => c.id !== char.id));
      } else if (current.length < 5) {
        next.set(activeTeam.teamId, [...current, char]);
      }
      return next;
    });
  };

  const teamMembersReady = teamMode && selectedTeams.length === 4 &&
    selectedTeams.every(t => (selectedTeamMembers.get(t.teamId) || []).length === 5);

  const allTeamMembersFlat = React.useMemo(() => {
    if (!teamMode) return [];
    const result: Character[] = [];
    for (const t of selectedTeams) {
      const members = selectedTeamMembers.get(t.teamId) || [];
      result.push(...members);
    }
    return result;
  }, [teamMode, selectedTeams, selectedTeamMembers]);

  const allFilled = teamMode ? teamMembersReady : selected.every(c => c !== null);
  const totalChars = teams.reduce((s, t) => s + t.members.length, 0);
  const activeTeam = teams[activeTeamIdx] ?? null;

  const handleMouseEnter = React.useCallback((char: Character, e: React.MouseEvent) => {
    setHoveredChar(char);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const TOOLTIP_W = 320;
    let left = rect.left;
    if (left + TOOLTIP_W > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - TOOLTIP_W - 8);
    }
    setTooltipPos({ x: left, y: rect.bottom + 8 });
  }, []);

  const handleMouseLeave = React.useCallback(() => {
    setHoveredChar(null);
  }, []);

  const quickStart = React.useCallback(() => {
    if (teamMode) {
      const shuffledTeams = [...teams].sort(() => Math.random() - 0.5).slice(0, 4);
      const membersMap = new Map<string, Character[]>();
      for (const team of shuffledTeams) {
        const shuffled = [...team.members].sort(() => Math.random() - 0.5).slice(0, 5);
        membersMap.set(team.teamId, shuffled);
      }
      setSelectedTeams(shuffledTeams);
      setSelectedTeamMembers(membersMap);
      setConfirming(true);
    } else {
      const allChars = teams.flatMap(t => t.members);
      const shuffled = [...allChars].sort(() => Math.random() - 0.5);
      setSelected(shuffled.slice(0, 4));
      setConfirming(true);
    }
  }, [teams, teamMode]);

  const handleStartClick = () => {
    if (teamMode && selectedTeams.length < 4) return;
    if (!teamMode && !allFilled) return;
    setConfirming(true);
  };

  const handleConfirm = () => {
    setConfirming(false);
    if (teamMode) {
      const allChars: Character[] = [];
      const teamInfo: { teamId: string; teamName: string; roundOrder: Character[] }[] = [];
      for (const team of selectedTeams) {
        const members = selectedTeamMembers.get(team.teamId) || [];
        allChars.push(...members);
        teamInfo.push({ teamId: team.teamId, teamName: team.teamName, roundOrder: [...members] });
      }
      (allChars as any).__teamInfo = teamInfo;
      onStart(allChars, useAbilities);
    } else {
      onStart(selected as Character[], useAbilities);
    }
  };

  const handleCancelConfirm = () => {
    setConfirming(false);
  };

  return (
    <div className="char-select-page">
      <div className="start-bg" style={{ backgroundImage: `url(${bgImage})` }} />
      <div className="start-overlay" />

      {/* Header */}
      <div className="char-select-header">
        <h2>{teamMode ? '选择队伍' : '选择角色'}</h2>
        <div className="slot-indicators">
            {teamMode ? (
              selectedTeams.map((team, i) => {
                const count = (selectedTeamMembers.get(team.teamId) || []).length;
                return (
                  <div
                    key={team.teamId}
                    className={`slot-dot ${count > 0 ? 'filled' : ''}`}
                    onClick={() => {
                      setSelectedTeams(prev => {
                        setSelectedTeamMembers(m => { const next = new Map(m); next.delete(team.teamId); return next; });
                        return prev.filter(t => t.teamId !== team.teamId);
                      });
                    }}
                    title={`点击取消 ${team.teamName} (${count}/5)`}
                  >
                    T{i + 1}
                    <span className="slot-count">{count}/5</span>
                  </div>
                );
              })
            ) : (
            SLOT_LABELS.map((label, i) => (
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
            ))
          )}
        </div>
      </div>

      {/* Body */}
      <div className="char-select-body">
        {/* Team sidebar */}
        <div className="char-team-list">
          {teams.map((team, i) => {
            const isSelected = teamMode && selectedTeams.some(t => t.teamId === team.teamId);
            const slotIdx = selectedTeams.findIndex(t => t.teamId === team.teamId);
            return (
              <div
                key={team.teamId}
                className={`team-tab ${!teamMode && i === activeTeamIdx ? 'active' : ''} ${isSelected ? 'team-selected' : ''}`}
                onClick={() => handleTeamClick(team, i)}
              >
                {teamMode && isSelected && <span className="team-badge">{slotIdx + 1}</span>}
                {team.teamName}
                <span className="team-count">({team.members.length})</span>
              </div>
            );
          })}
        </div>

        {/* Character grid */}
        <div className="char-grid-area">
          {activeTeam && (
            <>
              <div className="team-title">{activeTeam.teamName}</div>
              <div className="char-grid">
                {activeTeam.members.map((char, ci) => {
                  const isSelectedInTeam = teamMode && selectedTeams.some(t => t.teamId === activeTeam.teamId)
                    && (selectedTeamMembers.get(activeTeam.teamId) || []).some(c => c.id === char.id);
                  const slotIdx = selected.findIndex(c => c?.id === char.id);
                  const isSelected = teamMode ? isSelectedInTeam : slotIdx >= 0;
                  const memberIdx = isSelectedInTeam
                    ? (selectedTeamMembers.get(activeTeam.teamId) || []).findIndex(c => c.id === char.id)
                    : -1;
                  return (
                    <div
                      key={char.id}
                      className={`char-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => teamMode ? handleCharClickTeam(char) : handleSelect(char)}
                      onMouseEnter={e => handleMouseEnter(char, e)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <div className="char-avatar">
                        <img src={`/chars/${char.id}.svg`} alt={char.nameCN} width={60} height={60}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                      <div className="char-name">{char.nameCN}</div>
                      <div className="char-name-en">{char.nameEN}</div>
                      <div className="char-race">{char.race}</div>
                      {isSelected && !teamMode && (
                        <div className="selected-badge">{SLOT_LABELS[slotIdx]}</div>
                      )}
                      {isSelectedInTeam && (
                        <div className="selected-badge">R{memberIdx + 1}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div style={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 24, fontSize: 12 }}>
            {teamMode
              ? `点击队伍名称选择队伍，点击角色选择出场队员（每队限 5 人）`
              : `共 ${totalChars} 名角色 · 点击角色选择 · 点击已选角色取消`}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="char-select-footer">
        <div className="footer-status">
          {teamMode
            ? (allFilled
              ? `已选择 ${selectedTeams.map(t => `${t.teamName}(${(selectedTeamMembers.get(t.teamId)||[]).length})`).join(' · ')}`
              : `已选择 ${selectedTeams.length}/4 组队伍 · ${selectedTeams.reduce((s, t) => s + (selectedTeamMembers.get(t.teamId)||[]).length, 0)}/20 人`)
            : (allFilled
              ? `已选择 ${selected.map(c => c!.nameCN).join(' · ')}`
              : `已选择 ${selected.filter(Boolean).length}/4 位角色`)}
        </div>
        <div className="footer-buttons">
          <button className="btn-back" onClick={onBack}>← 返回</button>
          <button className="btn-back" onClick={quickStart} style={{ fontSize: 14, padding: '8px 24px' }}>
            快速开始
          </button>
          <button
            className="btn-start-game"
            disabled={!allFilled}
            onClick={handleStartClick}
          >
            开始游戏
          </button>
        </div>
      </div>
      {/* Confirm dialog overlay */}
      {confirming && (
        <div className="confirm-overlay" onClick={handleCancelConfirm}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h2>{teamMode ? '组队模式' : '单人模式'} — 确认阵容</h2>

            {!teamMode && (
              <div className="confirm-list">
                {(selected.filter(Boolean) as Character[]).map((char, i) => (
                  <div key={char.id} className="confirm-item"
                    onMouseEnter={(e) => { setHoveredChar(char); setTooltipPos({ x: e.clientX + 16, y: e.clientY + 8 }); }}
                    onMouseLeave={() => setHoveredChar(null)}
                  >
                    <span className="confirm-slot">{SLOT_LABELS[i]}</span>
                    <div className="confirm-char-info">
                      <span className="confirm-cn">{char.nameCN}</span>
                      <span className="confirm-jp">{char.nameJP}</span>
                      <span className="confirm-en">{char.nameEN}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {teamMode && (
              <div className="confirm-team-list">
                {selectedTeams.map((team, i) => {
                  const members = selectedTeamMembers.get(team.teamId) || [];
                  return (
                    <div key={team.teamId} className="confirm-team-block">
                      <div className="confirm-team-header">
                        <span className="confirm-slot">T{i + 1}</span>
                        <span className="confirm-cn">{team.teamName}</span>
                      </div>
                      <div className="confirm-team-members">
                        {members.map((m, j) => (
                          <span key={m.id} className="confirm-member-tag"
                            onMouseEnter={(e) => { setHoveredChar(m); setTooltipPos({ x: e.clientX + 16, y: e.clientY + 8 }); }}
                            onMouseLeave={() => setHoveredChar(null)}
                          >
                            {m.nameCN}
                            <span className="confirm-member-num">R{j + 1}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="confirm-actions">
              <button className="btn-back" onClick={handleCancelConfirm}>← 返回</button>
              <button className={`toggle-btn-sm ${useAbilities ? 'toggle-on' : ''}`}
                onClick={() => setUseAbilities(v => !v)}
                style={{ fontSize: 14, padding: '6px 16px' }}
                title="启用角色超能力（能量槽+技能）">
                {useAbilities ? '⚡ 能力 ON' : '能力 OFF'}
              </button>
              <button className="btn-start-game" onClick={handleConfirm}>确认开始</button>
            </div>
          </div>
        </div>
      )}

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
