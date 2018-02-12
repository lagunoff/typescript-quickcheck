import * as gen from './generator';
import { Generator } from './generator';


/// Arbitrary
export class Arbitrary<A> {
  readonly _A: A;

  constructor(
    readonly generator: Generator<A>,
    readonly shrink?: (x: A) => A[],
    readonly show?: (x: A) => string,
  ) {}
}


export namespace smaller {

  export function nat(x: number): number[] {
    const output: number[] = [];
    let i = x | 0;
    do { i >>= 1; output.push(i); } while (i > 0);
    return output;
  }

  export function nestring(x: string): string[] {
    const output: string[] = [];
    let i = x.length;
    do { i >>= 1; output.push(x.substr(0, i)); } while (i > 1);
    return output;
  }

  export function string(x: string): string[] {
    const output: string[] = [];
    let i = x.length;
    do { i >>= 1; output.push(x.substr(0, i)); } while (i > 0);
    return output;
  }

  export function array<A>(xs: A[], shr: (x: A) => A[]): A[][] {
    const output: A[][] = [];
    let i = xs.length;
    do {
      i >>= 1;
      const xs2 = xs.slice();
      // const xs1 = xs2.splice(0, i);
      output.push(xs2);
    } while (i > 0);
    return output;
  }
  
}


/// primitives
export const nat = new Arbitrary<number>(gen.nat, smaller.nat);
export const ascii = new Arbitrary<string>(gen.ascii, smaller.string);
export const neascii = new Arbitrary<string>(gen.neascii, smaller.nestring);
