declare class Riichi {
  constructor(data: string);
  calc(): {
    isAgari: boolean;
    error: boolean;
    yaku: Record<string, string>;
    han: number;
    fu: number;
    yakuman: number;
  };
  extra: string;
  furo: string[][];
  isMenzen(): boolean;
  hai: string[];
}
export default Riichi;
