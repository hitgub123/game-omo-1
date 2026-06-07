import React from 'react';
import type { GameState } from '../game/types';
import { GamePhase, WINDS } from '../game/types';

interface ActionPanelProps {
  state: GameState;
  onAction: (action: string) => void;
  riichiMode?: boolean;
  onCancelRiichi?: () => void;
}

const ActionPanel: React.FC<ActionPanelProps> = ({ state, onAction, riichiMode, onCancelRiichi }) => {
  if (state.phase === GamePhase.HAND_OVER || state.phase === GamePhase.GAME_OVER) return null;

  const humanWind = WINDS.find(w => state.players[w].isHuman);
  if (humanWind === undefined) return null;

  const humanPlayer = state.players[humanWind];
  const actions = state.actionsAvailable[humanWind];

  // 立直模式：显示取消立直按钮 + 提示
  if (riichiMode) {
    return (
      <div className="action-panel">
        <span className="action-hint">⚡ 请双击高亮的牌来立直</span>
        {onCancelRiichi && <button className="btn-action btn-pass" onClick={onCancelRiichi}>取消立直</button>}
      </div>
    );
  }

  if (humanPlayer.isRiichi) return null;

  const isResponsePhase = state.lastDiscard !== undefined;

  if (isResponsePhase && actions) {
    const hasResponse = actions.canRon || actions.canPon || actions.canChi || actions.canKan;
    if (!hasResponse) return null;
    return (
      <div className="action-panel">
        {actions.canRon && <button className="btn-action btn-ron" onClick={() => onAction('ron')}>荣和</button>}
        {actions.canPon && <button className="btn-action btn-pon" onClick={() => onAction('pon')}>碰</button>}
        {actions.canChi && <button className="btn-action btn-chi" onClick={() => onAction('chi')}>吃</button>}
        {actions.canKan && <button className="btn-action btn-kan" onClick={() => onAction('kan')}>杠</button>}
        <button className="btn-action btn-pass" onClick={() => onAction('pass')}>过</button>
      </div>
    );
  }

  if (!isResponsePhase && actions) {
    const hasDrawActions = actions.canTsumo || actions.canRiichi || actions.canAnkan || actions.canKakan;
    if (hasDrawActions) {
      return (
        <div className="action-panel">
          {actions.canTsumo && <button className="btn-action btn-tsumo" onClick={() => onAction('tsumo')}>自摸</button>}
          {actions.canRiichi && <button className="btn-action btn-riichi" onClick={() => onAction('riichi')}>立直</button>}
          {actions.canAnkan && <button className="btn-action btn-kan" onClick={() => onAction('ankan')}>暗杠</button>}
          {actions.canKakan && <button className="btn-action btn-kan" onClick={() => onAction('kakan')}>加杠</button>}
        </div>
      );
    }
  }

  if (state.currentPlayer === humanWind && state.phase === GamePhase.DISCARDING) {
    return (
      <div className="action-panel">
        <span className="action-hint">请选择要打出的牌</span>
      </div>
    );
  }

  return null;
};

export default ActionPanel;
