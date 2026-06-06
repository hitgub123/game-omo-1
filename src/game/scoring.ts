import { Wind, WINDS } from './types';

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
  const isYakuman = han >= 13;
  if (isYakuman) return 8000;
  if (han >= 11) return 6000;
  if (han >= 8) return 4000;
  if (han >= 6) return 3000;
  if (han >= 4) return 2000;
  if (han === 3 && fu >= 70) return 2000;
  if (han === 2) {
    if (fu >= 130) return 2000;
    if (fu >= 70) return 1300;
    if (fu >= 60) return 1200;
  }
  const base = fu * Math.pow(2, han + 2);
  if (base > 2000) return 2000;
  return Math.ceil(base / 100) * 100;
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
    ronPayment: isTsumo ? 0 : ronPaymentAmount,
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
): { from: Wind; to: Wind; amount: number }[] {
  const payouts: { from: Wind; to: Wind; amount: number }[] = [];
  const score = calculateScore(fu, han, isDealerWin, loserWind === null, honba, riichiSticks);

  if (loserWind === null) {
    for (let i = 0; i < 4; i++) {
      const wind = WINDS[i];
      if (wind !== winnerWind) {
        const amount = wind === Wind.EAST ? score.payments[0] : score.payments[1];
        payouts.push({ from: wind, to: winnerWind, amount });
      }
    }
  } else {
    payouts.push({ from: loserWind, to: winnerWind, amount: score.ronPayment });
  }

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
