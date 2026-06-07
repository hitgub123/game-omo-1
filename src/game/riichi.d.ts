declare module "riichi" {
  interface RiichiResult {
    isAgari: boolean;
    yakuman: number;
    yaku: Record<string, string>;
    han: number;
    fu: number;
    ten: number;
    text: string;
    oya: number[];
    ko: number[];
    error: boolean;
  }
  class Riichi {
    constructor(handStr: string);
    calc(): RiichiResult;
    disableWyakuman(): void;
    disableKuitan(): void;
    disableAka(): void;
    disableYaku(name: string): void;
  }
  export = Riichi;
}
