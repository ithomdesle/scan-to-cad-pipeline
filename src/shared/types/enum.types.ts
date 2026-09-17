export const createEnum = <const TEnum extends Record<string, string>>(
  definition: TEnum,
): Readonly<TEnum> => Object.freeze(definition);

export type EnumValues<TEnum> = TEnum[keyof TEnum];
