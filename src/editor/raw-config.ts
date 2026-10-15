export type Raw = Record<string, unknown>;
export type Path = readonly (string | number)[];

export interface FieldRules {
  defaults: Raw;
  fromForm?: (form: Raw) => Raw;
}

export function isPlainObject(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => k in b && deepEqual(a[k], b[k]));
  }
  return false;
}

export function getAt(root: unknown, path: Path): unknown {
  let node = root;
  for (const key of path) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string | number, unknown>)[key];
  }
  return node;
}

export function setAt<T>(root: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T;
  const [key, ...rest] = path;
  const next = setAt(getAt(root, [key]), rest, value);
  if (Array.isArray(root)) {
    const copy = [...root];
    copy[key as number] = next;
    return copy as T;
  }
  return { ...(isPlainObject(root) ? root : {}), [key]: next } as T;
}

export function clearAt<T>(root: T, path: Path): T {
  if (path.length === 0 || !(isPlainObject(root) || Array.isArray(root))) return root;
  const [key, ...rest] = path;
  const node = root as Record<string | number, unknown>;
  if (!(key in node)) return root;
  if (rest.length === 0) return Array.isArray(root) ? root : without(node, key);
  const child = node[key];
  const next = clearAt(child, rest);
  if (next === child) return root;
  if (Array.isArray(root)) {
    const copy = [...root];
    copy[key as number] = next;
    return copy as T;
  }
  if (isPlainObject(next) && Object.keys(next).length === 0) return without(node, key);
  return { ...node, [key]: next } as T;
}

function without<T>(node: Record<string | number, unknown>, key: string | number): T {
  const { [key]: _removed, ...others } = node;
  return others as T;
}

export const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === '';

export function applyFormChange<T>(root: T, prefix: Path, before: Raw, after: Raw, rules: FieldRules): T {
  const out = rules.fromForm ? rules.fromForm(after) : after;
  let next = root;
  for (const key of Object.keys(rules.defaults)) {
    if (deepEqual(before[key], after[key])) continue;
    const value = out[key];
    const path = [...prefix, key];
    next = isEmpty(value) || deepEqual(value, rules.defaults[key]) ? clearAt(next, path) : setAt(next, path, value);
  }
  return next;
}
