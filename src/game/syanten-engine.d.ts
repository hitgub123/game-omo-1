declare module "*/utils/syanten.js" {
  export function checkMahjongStatus(hai: number[][]): number | { status: number; info: Array<{ discard: string; waits: string[] }> };
  export function getShanten(hand34: number[]): number;
}
