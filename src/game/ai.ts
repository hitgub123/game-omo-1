import type { Tile, GameState, Wind, MeldType } from './types';
import { sameTile, isTerminalHonor, isMiddleTile, isDragonTile } from './tiles';
import { getTileCounts, tilesToHai } from './hand';
import { checkMahjongStatus } from '../../utils/syanten.js';

// ---- Discard strategy ----
function scoreDiscardTile(tile: Tile, hand: Tile[]): number {
  let score = 0;

  if (tile.suit === 'z') {
    if (isDragonTile(tile)) score += 3;
    else score += 1;
    return score;
  }

  if (isTerminalHonor(tile)) score += 2;
  if (isMiddleTile(tile)) score += 5;

  // Lone tile penalty
  const neighborCount = getNeighborCount(hand, tile);
  if (neighborCount === 0) score -= 3;

  // Pair/triplet value
  const pairCount = hand.filter(t => sameTile(t, tile)).length;
  if (pairCount >= 3) score += 8;
  else if (pairCount === 2) score += 5;

  // Sequence potential
  const seqPotential = getSequencePotential(hand, tile);
  score += seqPotential * 2;

  // Same suit count
  const suitCount = hand.filter(t => t.suit === tile.suit).length;
  if (suitCount >= 5) score += 3;
  if (suitCount <= 2 && suitCount > 0) score -= 2;

  return score;
}

function getNeighborCount(hand: Tile[], tile: Tile): number {
  if (tile.suit === 'z') return 0;
  return hand.filter(t => t.suit === tile.suit && Math.abs(t.value - tile.value) <= 2 && t.value !== tile.value).length;
}

function getSequencePotential(hand: Tile[], tile: Tile): number {
  if (tile.suit === 'z') return 0;
  const suitHand = hand.filter(t => t.suit === tile.suit);
  const v = tile.value;
  let potential = 0;

  for (const seq of [[v-2, v-1, v], [v-1, v, v+1], [v, v+1, v+2]]) {
    if (seq[0] >= 1 && seq[2] <= 9) {
      const present = seq.filter(n => n !== v).filter(n => suitHand.some(t => t.value === n)).length;
      if (present === 2) potential += 3;
      else if (present === 1) potential += 1;
    }
  }
  return potential;
}

export function aiChooseDiscard(hand: Tile[], _melds: MeldType[] | undefined, _state: GameState, _playerWind: Wind): Tile {
  // Check for tenpai options (for riichi)
  // Score all tiles and pick lowest
  const scored = hand.map(t => ({ tile: t, score: scoreDiscardTile(t, hand) }));
  scored.sort((a, b) => a.score - b.score);
  return scored[0].tile;
}

// ---- Meld decisions ----
export function aiChooseAction(state: GameState, playerWind: Wind): string | null {
  const actions = state.actionsAvailable[playerWind];
  if (!actions) return null;

  if (actions.canTsumo) return 'tsumo';
  if (actions.canRon) return 'ron';

  if (actions.canRiichi && aiDecideRiichi(state.players[playerWind].hand, state, playerWind)) {
    return 'riichi';
  }

  if (actions.canAnkan && aiDecideAnkan(state.players[playerWind].hand)) {
    return 'ankan';
  }

  if (state.lastDiscard && state.lastDiscardPlayer !== playerWind) {
    if (actions.canPon) {
      const d = aiMeldDecision(state.players[playerWind].hand, state.lastDiscard, 'pon', state, playerWind);
      if (d) return 'pon';
    }
    if (actions.canKan) {
      const d = aiMeldDecision(state.players[playerWind].hand, state.lastDiscard, 'kan', state, playerWind);
      if (d) return 'kan';
    }
    if (actions.canChi) {
      const d = aiMeldDecision(state.players[playerWind].hand, state.lastDiscard, 'chi', state, playerWind);
      if (d) return 'chi';
    }
  }

  return 'pass';
}

function aiMeldDecision(
  _hand: Tile[], discarded: Tile, actionType: string, state: GameState, playerWind: Wind,
): boolean {
  if (actionType === 'pon') {
    if (isDragonTile(discarded)) return true;
    if (isMiddleTile(discarded)) return Math.random() < 0.3;
    return Math.random() < 0.5;
  }
  if (actionType === 'chi') {
    if (state.players[playerWind].hasCalled) return Math.random() < 0.4;
    return false;
  }
  return Math.random() < 0.3;
}

function aiDecideAnkan(hand: Tile[]): boolean {
  const counts = getTileCounts(hand);
  for (const c of Object.values(counts)) {
    if (c === 4) return Math.random() < 0.5;
  }
  return false;
}

function aiDecideRiichi(hand: Tile[], _state: GameState, _playerWind: Wind): boolean {
  const s = checkMahjongStatus(tilesToHai(hand));
  // s === -1 已和, typeof s === 'number' 向听数, typeof s === 'object' 可立直
  if (typeof s === 'object') return Math.random() < 0.6;
  if (typeof s === 'number') return s <= 1 && Math.random() < 0.6;
  return false;
}

export { aiDecideRiichi };
