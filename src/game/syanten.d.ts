declare module "syanten" {
  interface SyantenLib {
    (hai: number[][]): number;
    syanten(hai: number[][]): number;
    syanten7(hai: number[][]): number;
    syanten13(hai: number[][]): number;
    syantenAll(hai: number[][]): number;
    hairi(hai: number[][]): Record<string, Record<string, number>> & { now: number };
  }
  const lib: SyantenLib;
  export = lib;
}
