/* eslint-disable @typescript-eslint/no-explicit-any */

const UNIFORMS_SYMBOL = Symbol("uniform");

// this overloading is to make the decorator work with or without arguments
// https://github.com/Microsoft/TypeScript/issues/13173#issuecomment-269246173
export function uniform(
  altName: string
): (target: Record<string, any>, propertyKey: string) => void;
export function uniform(target: Record<string, any>, propertyKey: string): void;
export function uniform(
  targetOrAltName: Record<string, any> | string,
  propertyKey?: string
) {
  if (typeof targetOrAltName === "string") {
    return function (target: Record<string, any>, propertyKey: string) {
      addUniform(target, propertyKey, targetOrAltName);
    };
  }
  // called without arguments
  const target = targetOrAltName;
  addUniform(target, propertyKey!, propertyKey!);
}

function addUniform(
  target: Record<string, any>,
  propertyKey: string,
  altName: string
) {
  if (!target.constructor.prototype[UNIFORMS_SYMBOL]) {
    target.constructor.prototype[UNIFORMS_SYMBOL] = new Map();
  }
  target.constructor.prototype[UNIFORMS_SYMBOL].set(altName, propertyKey);
}

export function getUniforms(target: Record<string, any>): Map<string, string> {
  return target.constructor.prototype[UNIFORMS_SYMBOL] || new Map();
}
