/**
 * Stylized San Francisco layout.
 * World units, x = east, z = south, map spans -96..96.
 * Everything here is data; build.mjs turns it into terrain textures, meshes and placements.
 */
import { stops, stopsById } from '../../sources/data/stops.js'

export { stops, stopsById }

// Authoring happens in design units (this file, stops.js, dogs.js, landmarks).
// The exported world is scaled up by W (sites 1.5x bigger than the car). Keep in sync with sources/data/world.js
export const W = 1
export const SIZE = 192 // design units
export const HALF = SIZE / 2
export const WORLD_SIZE = SIZE * W
export const MAX_HEIGHT = 10 * W // world units, height texture 255 = 15

/**
 * Land masses (polygons, smoothed by blur when rasterized)
 */
export const land = {
    city: [
        [-82, -46], [-74, -50], [-66, -53], [-62, -55], [-57, -51], [-44, -49], [-30, -51], [-16, -52],
        [-6, -55], [8, -54], [22, -54], [40, -52], [50, -46], [56, -36], [60, -26], [65, -21],
        [65, -14], [60, -8], [62, 6], [66, 20], [66, 36], [68, 50], [80, 54], [88, 64], [88, 82], [76, 90],
        [40, 90], [0, 90], [-40, 90], [-70, 88], [-84, 80], [-86, 40], [-86, 0], [-86, -30],
    ],
    marin: [
        [-100, -100], [-26, -100], [-26, -92], [-36, -88], [-46, -82], [-54, -76], [-62, -72.5], [-70, -71], [-80, -69], [-100, -68.5],
    ],
    alcatraz: { ellipse: [4, -82, 19, 12] },   // 2x, west of the Pier 39 floats
}

/** Shallow sandbars (none now: Alcatraz has the boardwalk) */
export const sandbars = []

/** The Alcatraz boardwalk: a wooden causeway on pilings from the Embarcadero to the island, lamp posts and string lights */
export const boardwalk = { points: [[7, -51.6], [7.4, -56.5], [9, -61.5], [8.8, -66.5], [6.8, -73.5]], width: 4 }

/** Ponds and lagoons (water inside land, always at sea level) */
export const ponds = [
    { ellipse: [-40, -19, 14, 6], depth: 0.32 }, // Palace of Fine Arts lagoon: big, in front of the rotunda (shallow, easy to drive out)
]

/**
 * Hills: gaussian bumps [x, z, height, sigma]
 */
export const hills = [
    [-62, -46, 3.4, 6],    // Fort Point, bridge south anchor
    [-50, -30, 2.0, 10],   // Presidio
    [-66, -84, 3.6, 6],    // Marin, bridge north anchor
    [-76, -97, 3.0, 7],    // Marin headlands
    [-48, -97, 3.0, 7],
    [-16, -36, 4.0, 8],    // Russian Hill (top of Lombard at Hyde)
    [6, -18, 4.0, 8],      // Nob Hill (west of Chinatown, under California St)
    [42, -40, 3.5, 6],     // Telegraph Hill
    [-24, -22, 2.5, 12],   // Pacific Heights
    [-52, 66, 4.5, 6],     // the turkey hill
    [-28, 10, 3.0, 5],     // Alamo Square: the park on its hill, across the street from the Painted Ladies
    [-44, 40, 4.0, 8],     // Mount Sutro
    [3, 52, 3.4, 8],       // Dolores Heights: the park slopes down from here toward downtown
    [3, -84, 3.0, 8],      // Alcatraz
]

/**
 * Flat pads: [x, z, innerRadius, outerRadius, targetHeight | null]
 * null = keep the hills' height at the center
 */
export const pads = [
    [-62, -46, 3, 6, 3.2],    // bridge south deck level
    [-62, -82, 4, 8, 3.2],    // bridge north deck level (Vista Point, the fork to Napa and Muir Woods)
    [-52, -86, 2, 10, 2.1],   // gentle step down the coast road toward Muir Woods
    [65, 69, 15, 21, 0],      // SFO (bigger airport)
    [12, 79, 12, 18, 0],      // Levi's
    [59, -18, 6, 10, 0],      // Ferry Building
    [50, 3.5, 3.5, 6, 0],     // MIRA (280 Spear St)
    [34, 13, 6, 10, 0],       // Union Square
    [24, -13, 9, 14, 0.3],    // Chinatown: flat street level under the shops and the gate
    [36, -54, 4, 7, 0],       // Pier 39 shore
    [-40, -32, 11, 16, 0],    // Palace of Fine Arts (1.5x)
    [-58, 16, 17, 22, 0],     // tennis (1.85x): wide flat ground so no hill creeps onto the courts
    [-52, 66, 9.5, 15, 4.2],  // Thanksgiving turkey (1.5x) on top of its own hill (the old Twin Peaks hill moved here)
    [-79, -84, 15, 22, 3.2],  // secret: Napa castle (west of the bridge), at bridge deck level: flat, smooth drive
    [-34, -92, 5, 8, 0.8],    // secret: Muir Woods
    [-75, 52, 3, 6, 0],       // 小可's house (off the hill)
    [-29, 52, 4, 7, 0],       // Dookie's house (off the hill)
    // JAY ♥ JESSICA blocks: a long flat strip north of the turkey hill
    [-66, 46, 4.5, 7, 0],
    [-60, 46, 4.5, 7, 0],
    [-54, 46, 4.5, 7, 0],
    [-48, 46, 4.5, 7, 0],
    [-42, 46, 4.5, 7, 0],
    [-36, 46, 4.5, 7, 0],
    [3, -84, 8.5, 12, 2.4],   // Alcatraz summit (flat for the cellhouse), cliffs all around
    [-17, -52, 2, 5, 0],      // cable car turnaround
    [-17, -40.7, 2.2, 5, null], // flat landing at the top of Lombard (Hyde St): the car doesn't roll away on spawn
]

/** Grass areas */
export const parks = [
    { rect: [-84, -2, -34, 40] },         // Golden Gate Park (tennis center inside)
    { rect: [-34, 13, -24, 18] },         // Panhandle
    { ellipse: [-31.5, 10, 9.5, 8] },     // Alamo Square park
    { ellipse: [9, 43.5, 13, 9.5] },      // Dolores Park: the big sloping lawn
    { ellipse: [-52, 66, 13, 13] },       // the turkey hill, grassy slopes
    { ellipse: [-44, 40, 8, 7] },         // Mount Sutro
    { ellipse: [-50, -30, 14, 11] },      // Presidio
    { rect: [-56, -48, -30, -44] },       // Crissy Field
    { ellipse: [-62, -94, 36, 9] },       // Marin
    { ellipse: [-78, 50, 6, 18] },        // Sunset dunes
    { ellipse: [4, -84, 12, 6] },         // Alcatraz garden
]

/**
 * Streets, painted on the terrain as paving.
 * asphalt: true streets also get a dark road ribbon mesh (Bruno's glittery road material)
 */
export const streets = [
    // Embarcadero, along the waterfront
    { points: [[-6, -50], [10, -50], [24, -50], [38, -49], [48, -43], [54, -34], [57, -24], [55, -12]], width: 5.4, asphalt: true },
    // ...and from the Ferry Building down to SFO it's a highway (it narrows smoothly back into the Embarcadero at the Ferry Building)
    { points: [[55, -12], [56, 4], [60, 20], [60, 40], [57, 54], [58, 62]], width: 7, asphalt: true, highway: true, taper: { at: 'start', width: 5.4, length: 10 } },
    // Market St, in two parts around the (bigger) Union Square
    { points: [[55, -16], [46, -8], [43, -2], [44, 5]], width: 5.4, asphalt: true },
    { points: [[21, 26], [19, 30], [14, 32.5], [2, 38], [-6, 41]], width: 5.4, asphalt: true },
    // to Levi's: branches off the Embarcadero just before SFO (the Embarcadero itself runs all the way down the waterfront to SFO)
    { points: [[57.5, 50], [50, 58], [42, 64], [35, 70]], width: 7, asphalt: true, highway: true, name: '101' }, // ends at the stadium lot
    // Marina Blvd to the bridge
    { points: [[-6, -50], [-20, -48], [-34, -46], [-48, -46], [-58, -46], [-62, -48]], width: 5.4, asphalt: true },
    // Hyde St (cable car line), the top of the crooked block
    { points: [[-17, -52], [-17, -40], [-17, -26], [-17, -12]], width: 4.4, asphalt: true },
    // Lombard St, east of the crooked block (from Grant toward Telegraph Hill)
    { points: [[29, -32], [34, -35], [38, -40], [42, -45.8]], width: 4.4, asphalt: true },
    // Grant Ave, from the north end of Chinatown (Chinatown itself is a pedestrian street) to North Beach
    { points: [[24.5, -29], [29.5, -33], [31.5, -40], [34, -50]], width: 4.4, asphalt: true },
    // California / Pine over Nob Hill
    { points: [[-17, -16], [6, -16], [7, -8], [10, -1], [15, 4.5], [21, 7]], width: 4.4, asphalt: true },
    // Geary to Union Square
    { points: [[-43, 2], [-34, 2], [-22, 2], [-10, 4], [10, 6], [16, 7.5], [21, 8.5]], width: 4.4, asphalt: true },
    // Van Ness / Divisadero spine
    { points: [[-17, -16], [-19.5, -8], [-20, 4], [-18, 24], [-4, 34], [8, 36]], width: 4.4, asphalt: true },
    // Golden Gate Park drive
    { points: [[-84, 24], [-76, 37], [-58, 39], [-44, 35], [-35, 24], [-28, 21], [-19.5, 20]], width: 4.4, asphalt: true },
    // Palace of Fine Arts loop
    { points: [[-40, -46], [-40, -41]], width: 4.4, asphalt: true },
    // Great Highway, Ocean Beach
    { points: [[-63, -47.5], [-72, -45], [-80, -38], [-82, -10], [-82, 30], [-80, 60], [-70, 84]], width: 7, asphalt: true, highway: true, taper: { at: 'end', width: 4.4, length: 14 } }, // eases down into the normal road by the turkey
    // round the north side of the stadium, from the coast road to the 101 (no dead ends at the stadium)
    { points: [[-24, 84], [-22, 74], [-18, 63], [-8, 57], [8, 56], [24, 56.5], [36, 57.5], [44, 58]], width: 4.4, asphalt: true },
    // Peninsula road west of Levi's
    { points: [[-70, 84], [-60, 86], [-46, 86.2], [-34, 84.6], [-24, 84], [-12, 83.5]], width: 4.4, asphalt: true }, // skirts the turkey hill, stops at the stadium lot // stops at the stadium lot (never into the field)
    // Marin: Highway 101 continues straight off the north end of the bridge, then sweeps west (one smooth
    // quarter turn, radius 6) into the Napa castle driveway. Nothing stands on the inside of the bend.
    { points: [[-62, -76.5], [-62, -78], [-62.46, -80.3], [-63.76, -82.24], [-65.7, -83.54], [-68, -84], [-73, -84]], width: 7, asphalt: true, highway: true, name: 'napa' },
    // and east along the coast to Muir Woods, forking right off the same exit
    { points: [[-61, -79.5], [-59, -82], [-55, -84], [-48, -86], [-40, -88.5], [-36, -91]], width: 4.4, asphalt: true },
]

/** Paved plazas (painted paving only) */
export const plazas = [
    { rect: [20, 3, 47, 28] },       // Union Square
    { ellipse: [59, -18, 7, 6] },    // Ferry Building
    { rect: [45.5, -0.5, 47.6, 6.5] }, // MIRA's front drive
    { rect: [48, 56, 82, 86] },      // SFO forecourt and apron
    { ellipse: [-62, -86.5, 4, 5] }, // Vista Point, straight ahead off the bridge
    { rect: [18, -29, 30, 1] },      // Chinatown: Grant Ave as a wide pedestrian street
    { ellipse: [-40, -38, 6, 4] },   // Palace
    { rect: [-71, 1, -45, 31] },     // tennis courts surround
    { ellipse: [36, -53, 5, 2.5] },  // Pier 39 entrance
    { ellipse: [12, 79, 15, 12] },   // stadium lot
]

/**
 * Lombard St, the crooked block (九曲花街): 8 hairpins down the east face of Russian Hill,
 * from Hyde St (top, west) to Grant Ave (bottom, east). Red brick, one lane, flower beds in every bend.
 * Legs run north-south, `spacing` apart; each hairpin is a half circle of radius spacing / 2.
 */
export const lombard = {
    hydeX: -17,
    firstLegX: -11.6,
    hairpins: 8,
    spacing: 4.4,
    north: -38.5,        // z of the northern hairpin centers
    south: -33.5,        // z of the southern hairpin centers
    lane: 3.0,           // brick lane width (the car is 1.7 wide)
    top: 3.9,            // ground height at Hyde St
    bottom: 0.5,         // ground height at Grant Ave
}
