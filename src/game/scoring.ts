import { Wind, WINDS } from './types';
import { debugLog } from '../debug/debugLog';

function tsumoPayment(basePoints: number, isDealerWinner: boolean): { payments: number[]; winnerGets: number } {
  if (isDealerWinner) {
    const eachPay = Math.ceil(basePoints * 2 / 100) * 100;
    return { payments: [eachPay, eachPay, eachPay], winnerGets: eachPay * 3 };
  } else {
    const parentPay = Math.ceil(basePoints * 2 / 100) * 100;
    const childPay = Math.ceil(basePoints / 100) * 100;
    return { payments: [parentPay, childPay, childPay], winnerGets: parentPay + childPay + childPay };
  }
}

function ronPayment(basePoints: number, isDealerWin: boolean): number {
  const multiplier = isDealerWin ? 6 : 4;
  return Math.ceil(basePoints * multiplier / 100) * 100;
}

export function calculateBasePoints(fu: number, han: number): number {
  const base = fu * Math.pow(2, han + 2);
  if (han >= 13) return 8000;
  if (han >= 11) return 6000;
  if (han >= 8) return 4000;
  if (han >= 6) return 3000;
  if (han >= 5) return 2000;
  if (han === 4 && fu >= 40) return 2000;
  if (han === 3 && fu >= 70) return 2000;
  if (han === 2) {
    if (fu >= 130) return 2000;
    if (fu >= 70) return 1300;
    if (fu >= 60) return 1200;
  }
  if (base > 2000) return 2000;
  return base;
}

export function calculateScore(
  fu: number,
  han: number,
  isDealer: boolean,
  isTsumo: boolean,
  honba: number,
  riichiSticks: number,
) {
  const basePoints = calculateBasePoints(fu, han);
  let payments: number[] = [];
  let winnerGets = 0;
  let ronPaymentAmount = 0;

  if (isTsumo) {
    const result = tsumoPayment(basePoints, isDealer);
    payments = result.payments;
    winnerGets = result.winnerGets;
  } else {
    ronPaymentAmount = ronPayment(basePoints, isDealer);
    winnerGets = ronPaymentAmount;
  }

  winnerGets += honba * 300;
  const riichiBonus = riichiSticks * 1000;

  return {
    basePoints,
    payments,
    ronPayment: isTsumo ? 0 : ronPaymentAmount + honba * 300,
    winnerGets: winnerGets + riichiBonus,
    honbaAddition: honba * 300,
    riichiBonus,
  };
}

export function calculatePayouts(
  winnerWind: Wind,
  loserWind: Wind | null,
  fu: number,
  han: number,
  honba: number,
  riichiSticks: number,
  isDealerWin: boolean,
  dealerWind: Wind,
): { from: Wind; to: Wind; amount: number }[] {
  const payouts: { from: Wind; to: Wind; amount: number }[] = [];
  const score = calculateScore(fu, han, isDealerWin, loserWind === null, honba, riichiSticks);

  // ── [DEBUG] payout 计算日志 → game.log ──
  const payDebugParts: string[] = [];
  debugLog('PAYOUT_DBG', {
    event: 'calc_start',
    isDealerWin,
    winnerWind,
    dealerWind,
    payments: `[${score.payments}]`,
    honba,
  });

  if (loserWind === null) {
    for (let i = 0; i < 4; i++) {
      const wind = WINDS[i];
      if (wind !== winnerWind) {
        // 自摸时 payments 数组: payments[0]=庄家支付额, payments[1]=子家支付额
        // 庄家赢→所有人都是子家(idx=1); 子家赢→庄家付idx=0, 子家付idx=1
        const isPayerDealer = !isDealerWin && wind === dealerWind;
        const useIdx = isPayerDealer ? 0 : 1;
        const amount = (isPayerDealer ? score.payments[0] : score.payments[1]) + honba * 100;
        payDebugParts.push(`wind${wind}:isDealer=${isPayerDealer}→idx${useIdx}=${score.payments[useIdx]}+${honba*100}=${amount}`);
        payouts.push({ from: wind, to: winnerWind, amount });
      }
    }
  } else {
    payouts.push({ from: loserWind, to: winnerWind, amount: score.ronPayment });
    payDebugParts.push(`ron:wind${loserWind}→wind${winnerWind}=${score.ronPayment}`);
  }

  debugLog('PAYOUT_DBG', {
    event: 'calc_end',
    details: payDebugParts.join('|'),
    result: payouts.map(p => `wind${p.from}→wind${p.to}:${p.amount}`).join(','),
  });
  return payouts;
}

export function getManganName(han: number, fu: number): string {
  if (han >= 13) return '役满';
  if (han >= 11) return '三倍满';
  if (han >= 8) return '倍满';
  if (han >= 6) return '跳满';
  if (han >= 4) return '满贯';
  if (han === 3 && fu >= 70) return '满贯';
  if (han === 2 && fu >= 130) return '满贯';
  return `${han}翻${fu}符`;
}
