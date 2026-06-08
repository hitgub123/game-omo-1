import React from 'react';
import type { GameState, Tile } from '../game/types';
import { GamePhase, WINDS } from '../game/types';

interface ActionPanelProps {
  state: GameState;
  onAction: (action: string, tiles?: Tile[]) => void;
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
        {actions?.canAnkan && <button className="btn-action btn-kan" onClick={() => onAction('ankan')}>暗杠</button>}
        {actions?.canKakan && <button className="btn-action btn-kan" onClick={() => onAction('kakan')}>加杠</button>}
        {actions?.canTsumo && <button className="btn-action btn-tsumo" onClick={() => onAction('tsumo')}>自摸</button>}
        {onCancelRiichi && <button className="btn-action btn-pass" onClick={onCancelRiichi}>取消立直</button>}
      </div>
    );
  }

  const isResponsePhase = state.lastDiscard !== undefined;

  if (humanPlayer.isRiichi) {
    if (isResponsePhase && actions?.canRon) {
      return (
        <div className="action-panel">
          <button className="btn-action btn-ron" onClick={() => onAction('ron')}>荣和</button>
          <button className="btn-action btn-pass" onClick={() => onAction('pass')}>过</button>
        </div>
      );
    }
    if (!isResponsePhase && (actions?.canTsumo || actions?.canAnkan || actions?.canKakan)) {
      console.log('[ActionPanel] 立直自摸/暗杠', actions);
      return (
        <div className="action-panel">
          {actions?.canTsumo && <button className="btn-action btn-tsumo" onClick={() => onAction('tsumo')}>自摸</button>}
          {actions?.canAnkan && <button className="btn-action btn-kan" onClick={() => onAction('ankan')}>暗杠</button>}
          {actions?.canKakan && <button className="btn-action btn-kan" onClick={() => onAction('kakan')}>加杠</button>}
        </div>
      );
    }
    return null;
  }

  if (isResponsePhase && actions) {
    const hasResponse = actions.canRon || actions.canPon || actions.canChi || actions.canKan;
    if (!hasResponse && !actions.canTsumo && !actions.canRiichi) return null;
    const discarder = state.lastDiscardPlayer !== undefined ? state.players[state.lastDiscardPlayer]?.name : '?';
    const tileName = state.lastDiscard ? state.lastDiscard.suit + state.lastDiscard.value : '?';
    console.log('[ActionPanel]', discarder, '打出', tileName, 'ron:', actions.canRon, 'pon:', actions.canPon);
    return (
      <div className="action-panel">
        <div className="action-buttons">
          {actions.canRon && <button className="btn-action btn-ron" onClick={() => onAction('ron')}>荣和</button>}
          {actions.canPon && <button className="btn-action btn-pon" onClick={() => onAction('pon')}>碰</button>}
          {actions.canChi && renderChiOptions(actions, onAction)}
          {actions.canKan && <button className="btn-action btn-kan" onClick={() => onAction('kan')}>杠</button>}
        </div>
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
          {actions.canNineOrphans && <button className="btn-action btn-nine-orphans" onClick={() => onAction('nine_orphans')}>九种九牌</button>}
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

/** 渲染吃牌选项（支持多选） */
function renderChiOptions(
  actions: { chiOptions?: import('../game/types').ChiOption[][]; },
  onAction: (action: string, tiles?: Tile[]) => void,
): React.ReactNode {
  const chiOpts = actions.chiOptions?.[0];
  if (!chiOpts || chiOpts.length <= 1) {
    // 只有一种或零种吃法 → 普通按钮
    return <button className="btn-action btn-chi" onClick={() => onAction('chi')}>吃</button>;
  }
  // 多种吃法 → 显示子选项
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

/** 获取人类玩家的可用动作（辅助函数） */
function getActions(state: GameState, humanWind: number) {
  return state.actionsAvailable[humanWind];
}

export default ActionPanel;
