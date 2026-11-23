/**
 * The data files (stops.js, dogs.js, secrets.js) use design units.
 * The generated world is WORLD_SCALE times bigger (scripts/sf/layout.mjs W).
 */
export const WORLD_SCALE = 1

/** design {x, z} -> world {x, z} */
export const toWorld = (p) => ({ x: p.x * WORLD_SCALE, z: p.z * WORLD_SCALE })
