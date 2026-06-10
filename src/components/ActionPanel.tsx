import React from 'react';
import type { GameState, Tile } from '../game/types';
import { GamePhase, WINDS } from '../game/types';

interface ActionPanelProps {
  state: GameState;
  onAction: (action: string, tiles?: Tile[]) => void;
  riichiMode?: boolean;
  onCancelRiichi?: () => void;
  autoSelfDiscard: boolean;
  noCall: boolean;
  autoWin: boolean;
  onToggleSelfDiscard: () => void;
  onToggleNoCall: () => void;
  onToggleAutoWin: () => void;
}

const ActionPanel: React.FC<ActionPanelProps> = ({
  state, onAction, riichiMode, onCancelRiichi,
  autoSelfDiscard, noCall, autoWin,
  onToggleSelfDiscard, onToggleNoCall, onToggleAutoWin,
}) => {
  const humanWind = WINDS.find(w => state.players[w].isHuman);
  if (humanWind === undefined) return null;

  const actions = state.actionsAvailable[humanWind];
  const humanPlayer = state.players[humanWind];
  const isResponsePhase = state.lastDiscard !== undefined;

  // ── Toggle 组（始终显示在左侧） ──
  const toggles = (
    <div className="panel-toggles">
      <button className={`toggle-btn ${autoSelfDiscard ? 'toggle-on' : ''}`}
        onClick={onToggleSelfDiscard} title="自动打出摸到的牌（有动作时暂停）">自摸切</button>
      <button className={`toggle-btn ${noCall ? 'toggle-on' : ''}`}
        onClick={onToggleNoCall} title="不提示吃碰杠，只提示和牌与暗杠">不鸣牌</button>
      <button className={`toggle-btn ${autoWin ? 'toggle-on' : ''}`}
        onClick={onToggleAutoWin} title="可荣和或自摸时自动和牌">自动和</button>
    </div>
  );

  // ── 操作按钮组 ──
  let actionButtons: React.ReactNode = null;

  if (riichiMode) {
    actionButtons = (
      <div className="panel-actions">
        {actions?.canAnkan && <button className="btn-action btn-kan" onClick={() => onAction('ankan')}>暗杠</button>}
        {actions?.canKakan && <button className="btn-action btn-kan" onClick={() => onAction('kakan')}>加杠</button>}
        {actions?.canTsumo && <button className="btn-action btn-tsumo" onClick={() => onAction('tsumo')}>自摸</button>}
        {onCancelRiichi && <button className="btn-action btn-pass" onClick={onCancelRiichi}>取消立直</button>}
      </div>
    );
  } else if (isResponsePhase && actions) {
    const canRon = actions.canRon;
    const anyAction = canRon || actions.canPon || actions.canChi || actions.canKan;
    if (anyAction) {
      actionButtons = (
        <div className="panel-actions">
          {canRon && <button className="btn-action btn-ron" onClick={() => onAction('ron')}>荣和</button>}
          {actions.canPon && <button className="btn-action btn-pon" onClick={() => onAction('pon')}>碰</button>}
          {actions.canChi && renderChiOptions(actions, onAction)}
          {actions.canKan && <button className="btn-action btn-kan" onClick={() => onAction('kan')}>杠</button>}
          <button className="btn-action btn-pass" onClick={() => onAction('pass')}>过</button>
        </div>
      );
    }
  } else if (!isResponsePhase && actions) {
    const hasDrawActions = actions.canTsumo || actions.canRiichi || actions.canAnkan || actions.canKakan;
    // 兜底：门清摸牌后如果没显示立直按钮，也强制显示
    const riichiOverride = !isResponsePhase && humanPlayer && !riichiMode
      && !humanPlayer.hasCalled && !humanPlayer.isRiichi
      && humanPlayer.score >= 1000 && state.wall.length >= 4
      && (state.phase === GamePhase.ACTION_PROMPT || state.phase === GamePhase.DISCARDING);
    if (hasDrawActions || riichiOverride) {
      actionButtons = (
        <div className="panel-actions">
          {actions.canTsumo && <button className="btn-action btn-tsumo" onClick={() => onAction('tsumo')}>自摸</button>}
          {actions.canRiichi && <button className="btn-action btn-riichi" onClick={() => onAction('riichi')}>立直</button>}
          {actions.canNineOrphans && <button className="btn-action btn-nine-orphans" onClick={() => onAction('nine_orphans')}>九种九牌</button>}
          {actions.canAnkan && <button className="btn-action btn-kan" onClick={() => onAction('ankan')}>暗杠</button>}
          {actions.canKakan && <button className="btn-action btn-kan" onClick={() => onAction('kakan')}>加杠</button>}
        </div>
      );
    }
  }

  return (
    <div className="action-panel">
      {toggles}
      {actionButtons}
    </div>
  );
};

function renderChiOptions(
  actions: { chiOptions?: import('../game/types').ChiOption[][]; },
  onAction: (action: string, tiles?: Tile[]) => void,
): React.ReactNode {
  const chiOpts = actions.chiOptions?.[0];
  if (!chiOpts || chiOpts.length <= 1) {
    return <button className="btn-action btn-chi" onClick={() => onAction('chi')}>吃</button>;
  }
  return (
    <span className="chi-submenu">
      {chiOpts.map((opt, i) => {
        const tileNames = opt.tiles.map(t => `${t.value}${t.suit}`).join('');
        return (
          <button key={i} className="btn-action btn-chi-sub" onClick={() => onAction('chi', opt.tiles)}>
            吃{tileNames}
          </button>
        );
      })}
    </span>
  );
}

export default ActionPanel;
