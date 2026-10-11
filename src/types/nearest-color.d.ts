// nearest-color has no typings. Only the part used by this adapter is declared.
declare module 'nearest-color' {
    export interface NearestColorMatch {
        name: string;
        value: string;
        rgb: { r: number; g: number; b: number };
        distance: number;
    }

    export type NearestColorFunction = (color: string) => NearestColorMatch | null;

    /** Returns a function that finds the nearest color out of the given ones (name -> hex value) */
    export function from(colors: Record<string, string> | string[]): NearestColorFunction;
}
