import { Expr } from './internal/expr';

/// PRNG generator state
export type RngState = Int32Array;


/// result
export interface Result {
  numTests: Number;
  succeeded: Number;
  failed: Number;
  seed: Number;
}


/// random generator
export class Generator<A> {
  readonly _A: A;

  constructor(
    readonly _generate: (rng: RngState, size?: number) => A, // tslint:disable-line:variable-name
  ) {}

  /// generate
  generate(rng?: RngState, size?: number): A {
    return this._generate(rng || makeRng((Math.random() * (2 ** 32 - 1)) | 0), size);
  }

  /// map
  map<B>(f: (a: A) => B): Generator<B> {
    return new Generator((rng, size) => f(this.generate(rng, size)));
  }

  /// chain
  chain<B>(f: (a: A) => Generator<B>): Generator<B> {
    return new Generator((rng, size) => f(this.generate(rng, size)).generate(rng, size));
  }

  /// alternatve generator
  or<B>(that: Generator<B>): Generator<A|B> {
    return boolean.chain<A|B>(chance => chance ? this : that);
  }

  /// supply generator with specified size parameter
  sized(size: number): Generator<A> {
    return new Generator((rng) => this.generate(rng, size));
  }

  /// filter results with given predicate
  suchThat(pred: (a: A) => boolean): Generator<A> {
    return new Generator((rng, size) => {
      while (true) {
        const output = this.generate(rng, size);
        if (pred(output)) return output;
      }
    });
  }

  /// generate n values
  ntimes<N extends 1>(n: 1): Generator<[A]>;
  ntimes<N extends 2>(n: 2): Generator<[A, A]>;
  ntimes<N extends 3>(n: 3): Generator<[A, A, A]>;
  ntimes<N extends 4>(n: 4): Generator<[A, A, A, A]>;
  ntimes<N extends 5>(n: 5): Generator<[A, A, A, A, A]>;
  ntimes<N extends 6>(n: 6): Generator<[A, A, A, A, A, A]>;
  ntimes<N extends 7>(n: 7): Generator<[A, A, A, A, A, A, A]>;
  ntimes<N extends 8>(n: 8): Generator<[A, A, A, A, A, A, A, A]>;
  ntimes<N extends 9>(n: 9): Generator<[A, A, A, A, A, A, A, A, A]>;
  ntimes<N extends 10>(n: 10): Generator<[A, A, A, A, A, A, A, A, A, A]>;
  ntimes(n: Number): Generator<Array<A>>;
  ntimes(n: Number): Generator<Array<A>> {
    return new Generator((rng, size) => {
      const output: Array<A> = [];
      for (let i = 0; i < n; i++) output.push(this.generate(rng, size));
      return output;
    });
  }
}


/// construct trivial `Generator`
export function of<A extends string|number|boolean|null|undefined|Function|Object>(a: A): Generator<A> {
  return new Generator(() => a);
}


/// primitives
export const int = new Generator<number>(rng => randomInt32(rng));
export const nat = new Generator<number>(rng => randomInt32(rng) + 2147483648);
export const float = new Generator<number>(rng => (randomInt32(rng) + 2147483648) / 4294967296);
export const ascii: Generator<string> = array(interval(32, 127)).map(chars => String.fromCharCode.apply(undefined, chars));
export const neascii: Generator<string> = nearray(interval(32, 127)).map(chars => String.fromCharCode.apply(undefined, chars));
export const boolean: Generator<boolean> = interval(0, 2).map(x => x !== 0);


/// left-inclusive interval of integers
export function interval(min: number, max: number): Generator<number> {
  const magnitude = max - min;
  return new Generator(rng => {
    if (magnitude < 2 ** 32) return ((randomInt32(rng) + 2147483648) % magnitude) + min;
    return Math.floor((float.generate(rng) * magnitude)) + min;
  });
}


/// frequency
export function frequency<A>(...args: Array<[number, Generator<A>]>): Generator<A> {
  const sum = args.reduce((acc, x) => acc + x[0], 0);
  const choiceGen = interval(0, sum);
  return new Generator((rng, size=100) => {
    const choice = choiceGen.generate(rng);
    let acc = 0;
    for (const [freq, gen] of args) {
      acc += freq;
      if (acc > choice) return gen.generate(rng, size);
    }
    throw new Error('Unreachable code (should never happen)');
  });
}


/// array
export function array<A>(gen: Generator<A>): Generator<Array<A>> {
  return new Generator((rng, size=100) => {
    const length = interval(0, logsize(size)).generate(rng);
    const output = new Array(length);
    for (let i = 0; i < length; i++) output[i] = gen.generate(rng, size);
    return output;
  });
}


/// non-empty array
export function nearray<A>(gen: Generator<A>): Generator<Array<A>> {
  return new Generator((rng, size=100) => {
    const length = interval(1, logsize(size) + 1).generate(rng);
    const output = new Array(length);
    for (let i = 0; i < length; i++) output[i] = gen.generate(rng, size);
    return output;
  });
}


/// record
export function record<R extends Record<string, Generator<any>>>(fields: R): Generator<{ [K in keyof R]: R[K]['_A'] }> {
  return new Generator((rng, size) => {
    const output: any = {};
    for (const key in fields) {
      if (!fields.hasOwnProperty(key)) continue;
      output[key] = fields[key].generate(rng, size);
    }
    return output;
  });
}


/// choose an element of array
export function elements<A>(elems: Array<A>): Generator<A> {
  const indexGen = interval(0, elems.length);
  return new Generator(rng => elems[indexGen.generate(rng)]);
}


/// another form of `or` combinator for convinience
export function oneOf<A>(a: Generator<A>): Generator<A>;
export function oneOf<A, B>(a: Generator<A>, b: Generator<B>): Generator<A|B>;
export function oneOf<A, B, C>(a: Generator<A>, b: Generator<B>, c: Generator<C>): Generator<A|B|C>;
export function oneOf<A, B, C, D>(a: Generator<A>, b: Generator<B>, c: Generator<C>, d: Generator<D>): Generator<A|B|C|D>;
export function oneOf<A, B, C, D, E>(a: Generator<A>, b: Generator<B>, c: Generator<C>, d: Generator<D>, e: Generator<E>): Generator<A|B|C|D|E>;
export function oneOf<A, B, C, D, E, F>(a: Generator<A>, b: Generator<B>, c: Generator<C>, d: Generator<D>, e: Generator<E>, f: Generator<F>): Generator<A|B|C|D|E|F>;
export function oneOf<A, B, C, D, E, F, G>(a: Generator<A>, b: Generator<B>, c: Generator<C>, d: Generator<D>, e: Generator<E>, f: Generator<F>, g: Generator<G>): Generator<A|B|C|D|E|F|G>;
export function oneOf<A, B, C, D, E, F, G, H>(a: Generator<A>, b: Generator<B>, c: Generator<C>, d: Generator<D>, e: Generator<E>, f: Generator<F>, g: Generator<G>, h: Generator<H>): Generator<A|B|C|D|E|F|G|H>;
export function oneOf<A, B, C, D, E, F, G, H, I>(a: Generator<A>, b: Generator<B>, c: Generator<C>, d: Generator<D>, e: Generator<E>, f: Generator<F>, g: Generator<G>, h: Generator<H>, i: Generator<I>): Generator<A|B|C|D|E|F|G|H|I>;
export function oneOf<A extends Generator<any>[]>(array: A): Generator<A[number]['_A']>;
export function oneOf(): Generator<any> {
  const generators = Array.isArray(arguments[0]) ? arguments[0] : arguments;
  return new Generator((rng, size=100) => {
    const choice = interval(0, generators.length).generate(rng);
    return generators[choice].generate(rng, size);
  });
}


/// apply pure function with multiple arguments
export function ap<A, B>(a: Generator<A>, f: (a: A) => B): Generator<B>;
export function ap<A, B, C>(a: Generator<A>, b: Generator<B>, f: (a: A, b: B) => C): Generator<C>;
export function ap<A, B, C, D>(a: Generator<A>, b: Generator<B>, c: Generator<C>, f: (a: A, b: B, c: C) => D): Generator<D>;
export function ap<A, B, C, D, E>(a: Generator<A>, b: Generator<B>, c: Generator<C>, d: Generator<D>, f: (a: A, b: B, c: C, d: D) => E): Generator<E>;
export function ap<A, B, C, D, E, F>(a: Generator<A>, b: Generator<B>, c: Generator<C>, d: Generator<D>, e: Generator<E>, f: (a: A, b: B, c: C, d: D, e: E) => F): Generator<F>;
export function ap<A, B, C, D, E, F, G>(a: Generator<A>, b: Generator<B>, c: Generator<C>, d: Generator<D>, e: Generator<E>, fa: Generator<F>, f: (a: A, b: B, c: C, d: D, e: E, f: F) => G): Generator<G>;
export function ap<A, B, C, D, E, F, G, H>(a: Generator<A>, b: Generator<B>, c: Generator<C>, d: Generator<D>, e: Generator<E>, fa: Generator<F>, g: Generator<G>, f: (a: A, b: B, c: C, d: D, e: E, f: F, g: G) => H): Generator<H>;
export function ap<A, B, C, D, E, F, G, H, J>(a: Generator<A>, b: Generator<B>, c: Generator<C>, d: Generator<D>, e: Generator<E>, fa: Generator<F>, g: Generator<G>, h: Generator<H>, f: (a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H) => J): Generator<J>;
export function ap<A, B, C, D, E, F, G, H, J, K>(a: Generator<A>, b: Generator<B>, c: Generator<C>, d: Generator<D>, e: Generator<E>, fa: Generator<F>, g: Generator<G>, h: Generator<H>, j: Generator<J>, f: (a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, j: J) => K): Generator<K>;
export function ap<A, B, C, D, E, F, G, H, J, K, L>(a: Generator<A>, b: Generator<B>, c: Generator<C>, d: Generator<D>, e: Generator<E>, fa: Generator<F>, g: Generator<G>, h: Generator<H>, j: Generator<J>, k: Generator<K>, f: (a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, j: J, k: K) => L): Generator<L>;
export function ap(): Generator<any> {
  const _arguments = arguments;
  const func = arguments[arguments.length - 1] as Function;
  return new Generator((rng, size) => {
    const results: Array<any> = [];
    for (let i = 0; i < _arguments.length - 1; i++) results.push(_arguments[i]['generate'](rng, size));
    return func.apply(undefined, results);
  });
}



/// choose one of the given arguments
export function literals<A extends Expr>(a: A): Generator<A>;
export function literals<A extends Expr, B extends Expr>(a: A, b: B): Generator<A|B>;
export function literals<A extends Expr, B extends Expr, C extends Expr>(a: A, b: B, c: C): Generator<A|B|C>;
export function literals<A extends Expr, B extends Expr, C extends Expr, D extends Expr>(a: A, b: B, c: C, d: D): Generator<A|B|C|D>;
export function literals<A extends Expr, B extends Expr, C extends Expr, D extends Expr, E extends Expr>(a: A, b: B, c: C, d: D, e: E): Generator<A|B|C|D|E>;
export function literals<A extends Expr, B extends Expr, C extends Expr, D extends Expr, E extends Expr, F extends Expr>(a: A, b: B, c: C, d: D, e: E, f: F): Generator<A|B|C|D|E|F>;
export function literals<A extends Expr, B extends Expr, C extends Expr, D extends Expr, E extends Expr, F extends Expr, G extends Expr>(a: A, b: B, c: C, d: D, e: E, f: F, g: G): Generator<A|B|C|D|E|F|G>;
export function literals<A extends Expr, B extends Expr, C extends Expr, D extends Expr, E extends Expr, F extends Expr, G extends Expr, H extends Expr>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H): Generator<A|B|C|D|E|F|G|H>;
export function literals<A extends Expr, B extends Expr, C extends Expr, D extends Expr, E extends Expr, F extends Expr, G extends Expr, H extends Expr, I extends Expr>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I): Generator<A|B|C|D|E|F|G|H|I>;
export function literals<A extends Expr[]>(array: A): Generator<A[number]>;
export function literals(): Generator<any> {
  const elems = Array.isArray(arguments[0]) ? arguments[0] : arguments;
  const indexGen = interval(0, elems.length);
  return new Generator(rng => elems[indexGen.generate(rng)]);
}


/// random permutation of the given array
export function shuffle<A>(array: Array<A>): Generator<Array<A>> {
  return new Generator(rng => {
    const output = array.slice();
    for (let i = 0; i < output.length - 1; i++) {
      const j = interval(0, output.length - i).generate(rng);
      const tmp = output[i]; output[i] = output[i + j]; output[i + j] = tmp;
    }
    return output;
  });
}


/// recursive https://github.com/jsverify/jsverify/blob/master/lib/generator.js#L133
export function recursive<A>(genZ: Generator<A>, genS: (self: Generator<A>) => Generator<A>): Generator<A> {
  const chanceGen = interval(0, 3);
  return new Generator((rng, size=100) => {
    const loop = n => {
      if (n <= 0 || chanceGen.generate(rng) === 0) return genZ;
      return genS(loop(n - 1));
    };
    return loop(logsize(size)).generate(rng, size);
  });
}


/// partitions
export function partitions<A>(inputs: A[], count: Number): Generator<A[]>;
export function partitions<A>(inputs: A[], freq: Number[]): Generator<A[]>;
export function partitions<A>(inputs: A[], countOrFreq): Generator<A[]> {
  const count = typeof (countOrFreq) === 'number' ? countOrFreq : countOrFreq.length;
  const freq = typeof (countOrFreq) === 'number' ? Array.apply(undefined, Array(count)).map(() => 100) : countOrFreq;
  const sum = freq.reduce((acc, x) => acc + x, 0);
  const choiceGen = interval(0, sum);
  return new Generator((rng, size=100) => {
    const output = Array.apply(undefined, Array(count)).map(() => []) as any;
    for (const input of inputs) {
      const choice = choiceGen.generate(rng);
      for (let i = 0, acc = 0; i < freq.length; i++) {
        acc += freq[i];
        if (acc > choice) { output[i].push(input); break; }
      }
    }
    return output;
  });
  
}


/// traverse an array
export function traverse<A, B>(arr: Array<A>, f: (a: A) => Generator<B>): Generator<B[]> {
  return new Generator<B[]>((rng, size) => {
    const output = [] as Array<B>;
    for (const i in arr) output.push(f(arr[i]).generate(rng, size));
    return output;
  });
}


/// Helper, essentially: Log2(size + 1) https://github.com/jsverify/jsverify/blob/master/lib/generator.js#L125
export function logsize(size: number): number {
  return Math.max(Math.round(Math.log(size + 1) / Math.log(2)), 0);
}


/// make `RngState` using 32-bit integer number as a seed
export function makeRng(seed?: number): RngState {
  seed = typeof(seed) === 'undefined' ? Math.floor(Math.random() * (2 ** 31 - 1)) : seed; // tslint:disable-line:no-parameter-reassignment
  const rng = new Int32Array([0xf1ea5eed, seed, seed, seed]);
  for (let i = 0; i < 20; i++) randomInt32(rng);
  return rng;
}


/// http://burtleburtle.net/bob/rand/smallprng.html
export function randomInt32(rng: RngState): number {
  const e = rng[0] - ((rng[1] << 27) | (rng[1] >>> (32 - 27)));
  rng[0] = rng[1] ^ ((rng[2] << 17) | (rng[2] >>> (32 - 17)));
  rng[1] = rng[2] + rng[3];
  rng[2] = rng[3] + e;
  rng[3] = e + rng[0];
  return rng[3];
}
