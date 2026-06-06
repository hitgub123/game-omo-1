import React from 'react';
import type { GameState } from '../game/types';
import { GamePhase } from '../game/types';

interface ActionPanelProps {
  state: GameState;
  onAction: (action: string) => void;
}

const ActionPanel: React.FC<ActionPanelProps> = ({ state, onAction }) => {
  const cp = state.players[state.currentPlayer];
  if (!cp?.isHuman) return null;
  if (state.phase === GamePhase.HAND_OVER || state.phase === GamePhase.GAME_OVER) return null;
  if (cp.isRiichi) return null;

  const actions = state.actionsAvailable[state.currentPlayer];
  const isResponse = state.lastDiscard !== undefined;
  const hasActions = actions && (
    actions.canTsumo || actions.canRiichi || actions.canRon ||
    actions.canPon || actions.canChi || actions.canKan ||
    actions.canAnkan || actions.canKakan
  );

  if (!hasActions && state.phase === GamePhase.ACTION_PROMPT && !isResponse) {
    return <div className="action-panel"><span className="action-hint">请选择要打出的牌</span></div>;
  }

  return (
    <div className="action-panel">
      {isResponse && actions && (
        <>
          {actions.canRon && <button className="btn-action btn-ron" onClick={() => onAction('ron')}>荣和</button>}
          {actions.canPon && <button className="btn-action btn-pon" onClick={() => onAction('pon')}>碰</button>}
          {actions.canChi && <button className="btn-action btn-chi" onClick={() => onAction('chi')}>吃</button>}
          {actions.canKan && <button className="btn-action btn-kan" onClick={() => onAction('kan')}>杠</button>}
          {hasActions && <button className="btn-action btn-pass" onClick={() => onAction('pass')}>过</button>}
        </>
      )}

      {!isResponse && actions && (
        <>
          {actions.canTsumo && <button className="btn-action btn-tsumo" onClick={() => onAction('tsumo')}>自摸</button>}
          {actions.canRiichi && <button className="btn-action btn-riichi" onClick={() => onAction('riichi')}>立直</button>}
          {actions.canAnkan && <button className="btn-action btn-kan" onClick={() => onAction('ankan')}>暗杠</button>}
          {actions.canKakan && <button className="btn-action btn-kan" onClick={() => onAction('kakan')}>加杠</button>}
          {!actions.canTsumo && !actions.canRiichi && !actions.canAnkan && !actions.canKakan && (
            <span className="action-hint">请选择要打出的牌</span>
          )}
        </>
      )}
    </div>
  );
};

export default ActionPanel;
