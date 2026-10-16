// Deep copy for plain-JSON data (all engine state is JSON). Avoids host globals like structuredClone.
export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
