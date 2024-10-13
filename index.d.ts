import { Config } from 'prettier';

export interface PluginConfig {
    svelteSortOrder?: SortOrder;
    svelteBracketNewLine?: boolean;
    svelteAllowShorthand?: boolean;
    svelteIndentScriptAndStyle?: boolean;
}

export type PrettierConfig = PluginConfig & Config;

type SliceArrayEnd<T extends unknown[], N extends number> = T extends [
    ...infer Rest extends unknown[],
    ...ArrayWithLength<Subtract<T['length'], N>>,
]
    ? Rest
    : never;
type SliceArrayStart<T extends unknown[], N extends number> = T extends [
    ...ArrayWithLength<N>,
    ...infer Rest extends unknown[],
]
    ? Rest
    : never;
type Tail<T extends unknown[]> = SliceArrayStart<T, 1>;

type ArrayWithLength<
    Length extends number,
    Array extends unknown[] = [],
> = Array['length'] extends Length ? Array : ArrayWithLength<Length, [...Array, unknown]>;
type Add<N1 extends number, N2 extends number> = [
    ...ArrayWithLength<N1>,
    ...ArrayWithLength<N2>,
]['length'] &
    number;
type Subtract<N1 extends number, N2 extends number> = ArrayWithLength<N1> extends [
    ...ArrayWithLength<N2>,
    ...infer R,
]
    ? R['length']
    : never;

type InsertIntoArray<T extends unknown[], ToAdd, Index extends number> = [
    ...SliceArrayEnd<T, Index>,
    ToAdd,
    ...SliceArrayStart<T, Index>,
];

type InsertIntoEachIndexInArray<T extends unknown[], ToAdd, Count extends number> = [
    InsertIntoArray<T, ToAdd, Count>,
    ...(Count extends T['length'] ? [] : InsertIntoEachIndexInArray<T, ToAdd, Add<Count, 1>>),
];

type AddToCombinations<T extends unknown[][], ToAdd extends unknown> = T extends []
    ? []
    : [
          ...InsertIntoEachIndexInArray<T[0], ToAdd, 0>,
          ...(Tail<T> extends infer Narrowed extends unknown[][]
              ? AddToCombinations<Narrowed, ToAdd>
              : never),
      ];

type Join<T extends string[], JoinWith extends string> = T extends []
    ? ''
    : T['length'] extends 1
    ? `${T[0]}`
    : Tail<T> extends infer Narrowed extends string[]
    ? `${T[0]}${JoinWith}${Join<Narrowed, JoinWith>}`
    : never;

type _EveryCombination<T extends string[], Result extends string[][] = [[T[0]]]> = T extends [
    string,
]
    ? Result
    : _EveryCombination<
          /** @ts-expect-error not sure why this doesn't narrow but it */
          Tail<T>,
          AddToCombinations<Result, T[1]>
      >;

type EveryCombination<T extends string[]> = Join<
    _EveryCombination<T> extends infer Result ? Result[number & keyof Result] : never,
    '-'
>;

type SortOrder = EveryCombination<['options', 'scripts', 'markup', 'styles']> | 'none';
