declare module "pixelmatch" {
  import type { PNG } from "pngjs";
  type PixelmatchOptions = {
    threshold?: number;
    includeAA?: boolean;
    alpha?: number;
    aaColor?: [number, number, number];
    diffColor?: [number, number, number];
    diffColorAlt?: [number, number, number];
    diffMask?: boolean;
  };
  function pixelmatch(
    img1: Buffer | Uint8Array | PNG["data"],
    img2: Buffer | Uint8Array | PNG["data"],
    output: Buffer | Uint8Array | PNG["data"] | null,
    width: number,
    height: number,
    options?: PixelmatchOptions,
  ): number;
  export default pixelmatch;
}
