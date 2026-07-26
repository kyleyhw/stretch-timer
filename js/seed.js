/**
 * @file Built-in stretch library and starter routines (read-only seed data).
 *
 * This is compiled into the app rather than fetched, so it is available offline with no async
 * load. User-created content lives only in localStorage (see js/store.js) and is merged with this
 * seed by js/data.js. Ids here are human slugs; user ids use the `user-` prefix, so they never
 * collide.
 */

/** @typedef {import('./types.js').Stretch} Stretch */
/** @typedef {import('./types.js').Routine} Routine */

/** @type {Stretch[]} */
export const STRETCHES = [
  // Neck & shoulders
  {
    id: 'chin-tuck',
    name: 'Chin Tuck',
    area: 'Neck',
    description: 'Draw your chin straight back, lengthening the back of the neck. Keep it gentle.',
    defaultSeconds: 20,
    perSide: false,
  },
  {
    id: 'neck-side',
    name: 'Neck Side Stretch',
    area: 'Neck',
    description: 'Gently tilt one ear toward that shoulder; let the opposite shoulder relax down.',
    defaultSeconds: 20,
    perSide: true,
  },
  {
    id: 'shoulder-cross',
    name: 'Cross-Body Shoulder Stretch',
    area: 'Shoulders',
    description: 'Draw one arm straight across your chest, easing it in with the opposite hand.',
    defaultSeconds: 20,
    perSide: true,
  },
  {
    id: 'tricep-overhead',
    name: 'Overhead Triceps Stretch',
    area: 'Triceps',
    description: 'Reach one hand down your upper back; gently guide the elbow with the other hand.',
    defaultSeconds: 20,
    perSide: true,
  },
  {
    id: 'chest-doorway',
    name: 'Doorway Chest Stretch',
    area: 'Chest',
    description: 'Forearm on a door frame at shoulder height, then step forward to open the chest.',
    defaultSeconds: 25,
    perSide: true,
  },
  {
    id: 'upper-back-clasp',
    name: 'Upper-Back Clasp',
    area: 'Upper back',
    description: 'Clasp your hands in front, round the upper back, and reach the hands away.',
    defaultSeconds: 20,
    perSide: false,
  },
  // Spine & core
  {
    id: 'seated-twist',
    name: 'Seated Spinal Twist',
    area: 'Spine',
    description: 'Sit tall and rotate your torso, using a knee or chair for gentle leverage.',
    defaultSeconds: 20,
    perSide: true,
  },
  {
    id: 'lat-side-bend',
    name: 'Standing Side Bend',
    area: 'Lats & obliques',
    description: 'Reach one arm overhead and lean to the opposite side, keeping hips level.',
    defaultSeconds: 20,
    perSide: true,
  },
  {
    id: 'child-pose',
    name: "Child's Pose",
    area: 'Back & shoulders',
    description: 'Kneel and reach forward, sinking your hips back toward your heels.',
    defaultSeconds: 30,
    perSide: false,
  },
  {
    id: 'cobra',
    name: 'Cobra Stretch',
    area: 'Abdomen & spine',
    description:
      'Lie prone and press gently through the hands, lengthening the front of the torso.',
    defaultSeconds: 20,
    perSide: false,
  },
  {
    id: 'knees-to-chest',
    name: 'Knees-to-Chest',
    area: 'Lower back',
    description: 'Lie on your back and hug both knees in toward your chest.',
    defaultSeconds: 30,
    perSide: false,
  },
  {
    id: 'supine-twist',
    name: 'Supine Spinal Twist',
    area: 'Lower back & glutes',
    description: 'Lie on your back and let both bent knees fall to one side, shoulders down.',
    defaultSeconds: 30,
    perSide: true,
  },
  // Hips & glutes
  {
    id: 'figure-four',
    name: 'Figure-Four Glute Stretch',
    area: 'Glutes & hips',
    description: 'Cross one ankle over the opposite knee and draw the thigh toward you.',
    defaultSeconds: 30,
    perSide: true,
  },
  {
    id: 'pigeon',
    name: 'Pigeon Pose',
    area: 'Glutes & hips',
    description: 'Bring one shin forward and extend the other leg back, keeping the hips square.',
    defaultSeconds: 30,
    perSide: true,
  },
  {
    id: 'hip-flexor-lunge',
    name: 'Kneeling Hip-Flexor Stretch',
    area: 'Hip flexors',
    description: 'In a low lunge, tuck the pelvis and ease the hips forward.',
    defaultSeconds: 30,
    perSide: true,
  },
  {
    id: 'butterfly',
    name: 'Butterfly Stretch',
    area: 'Inner thigh & groin',
    description: 'Sit with the soles of your feet together and let the knees fall open.',
    defaultSeconds: 30,
    perSide: false,
  },
  {
    id: 'adductor-side-lunge',
    name: 'Side-Lunge Adductor Stretch',
    area: 'Inner thigh',
    description: 'Shift your weight into one bent leg while the other stays straight.',
    defaultSeconds: 25,
    perSide: true,
  },
  // Legs
  {
    id: 'hamstring-standing',
    name: 'Standing Hamstring Stretch',
    area: 'Hamstrings',
    description: 'Hinge at the hips and reach toward your toes, keeping the back flat.',
    defaultSeconds: 30,
    perSide: false,
  },
  {
    id: 'hamstring-supine',
    name: 'Supine Hamstring Stretch',
    area: 'Hamstrings',
    description: 'On your back, extend one leg toward the ceiling, holding the thigh or calf.',
    defaultSeconds: 30,
    perSide: true,
  },
  {
    id: 'quad-standing',
    name: 'Standing Quad Stretch',
    area: 'Quadriceps',
    description: 'Pull one heel toward your glute, keeping the knees together.',
    defaultSeconds: 30,
    perSide: true,
  },
  {
    id: 'calf-wall',
    name: 'Wall Calf Stretch',
    area: 'Calves',
    description: 'Hands on a wall, step one leg back and press the heel toward the floor.',
    defaultSeconds: 30,
    perSide: true,
  },
  {
    id: 'forward-fold',
    name: 'Standing Forward Fold',
    area: 'Hamstrings & back',
    description: 'Hinge forward from the hips and let your upper body hang heavy.',
    defaultSeconds: 30,
    perSide: false,
  },
  // Wrists & forearms
  {
    id: 'wrist-flexor',
    name: 'Wrist Flexor Stretch',
    area: 'Forearms & wrists',
    description: 'Arm extended, palm up; gently draw the fingers back toward you.',
    defaultSeconds: 20,
    perSide: true,
  },
  {
    id: 'wrist-extensor',
    name: 'Wrist Extensor Stretch',
    area: 'Forearms & wrists',
    description: 'Arm extended, palm down; gently press the back of the hand toward you.',
    defaultSeconds: 20,
    perSide: true,
  },
  // Additional stretches used by custom sets
  {
    id: 'leg-spread-standing',
    name: 'Standing Straddle Fold',
    area: 'Adductors & hamstrings',
    description: 'Stand with feet wide, hinge at the hips, and fold forward with a flat back.',
    defaultSeconds: 30,
    perSide: false,
  },
  {
    id: 'groin-frog',
    name: 'Frog Stretch',
    area: 'Groin',
    description: 'On hands and knees, widen the knees and gently ease the hips back.',
    defaultSeconds: 30,
    perSide: false,
  },
  {
    id: 'supermodel',
    name: 'Supermodel Stretch',
    area: 'Hamstrings & IT band',
    description: 'Cross one foot in front of the other and fold forward over the front leg.',
    defaultSeconds: 30,
    perSide: true,
  },
  {
    id: 'leg-spread-sitting',
    name: 'Seated Straddle Fold',
    area: 'Adductors & hamstrings',
    description: 'Sit with the legs wide and walk your hands forward between them.',
    defaultSeconds: 30,
    perSide: false,
  },
  {
    id: 'forearm-palm-up',
    name: 'Forearm — Palm Up',
    area: 'Forearms',
    description:
      'Arm straight out, palm up; gently draw the fingers back and down with the other hand.',
    defaultSeconds: 30,
    perSide: true,
  },
  {
    id: 'forearm-palm-down',
    name: 'Forearm — Palm Down',
    area: 'Forearms',
    description: 'Arm straight out, palm down; gently press the back of the hand toward you.',
    defaultSeconds: 30,
    perSide: true,
  },
  {
    id: 'forearm-fingers-up',
    name: 'Forearm — Fingers Up',
    area: 'Forearms',
    description: 'Arm out, palm away and fingers up; ease the fingers back toward you.',
    defaultSeconds: 30,
    perSide: true,
  },
  {
    id: 'forearm-fingers-down',
    name: 'Forearm — Fingers Down',
    area: 'Forearms',
    description: 'Arm out, palm in and fingers down; gently draw the fingers toward you.',
    defaultSeconds: 30,
    perSide: true,
  },
];

/**
 * Build routine items from stretch ids, using each stretch's default hold.
 * @param {string[]} ids
 * @returns {import('./types.js').RoutineItem[]}
 */
function items(ids) {
  return ids.map((id) => {
    const stretch = STRETCHES.find((s) => s.id === id);
    if (!stretch) throw new Error(`seed: unknown stretch id "${id}"`);
    return { stretchId: id, seconds: stretch.defaultSeconds };
  });
}

/**
 * A single stretch reference with an explicit hold duration.
 * @param {string} id
 * @param {number} seconds
 * @returns {import('./types.js').StretchRef}
 */
function ref(id, seconds) {
  if (!STRETCHES.some((s) => s.id === id)) throw new Error(`seed: unknown stretch id "${id}"`);
  return { stretchId: id, seconds };
}

/**
 * A per-side block of stretch references (performed all on one side, then the other).
 * @param {import('./types.js').StretchRef[]} refs
 * @returns {import('./types.js').SideBlock}
 */
function block(refs) {
  return { block: refs };
}

/** @type {Routine[]} */
export const ROUTINES = [
  {
    id: 'climbing',
    name: 'Climbing',
    description: 'Shoulders, hips, forearms and legs — the leg trio runs as a per-side block.',
    builtIn: true,
    items: [
      ref('shoulder-cross', 30),
      ref('tricep-overhead', 30),
      ref('leg-spread-standing', 30),
      ref('groin-frog', 30),
      ref('supermodel', 30),
      ref('butterfly', 30),
      ref('leg-spread-sitting', 30),
      ref('forearm-palm-up', 30),
      ref('forearm-palm-down', 30),
      ref('forearm-fingers-up', 30),
      ref('forearm-fingers-down', 30),
      ref('calf-wall', 30),
      block([ref('hip-flexor-lunge', 30), ref('hamstring-standing', 30), ref('quad-standing', 30)]),
      ref('pigeon', 30),
    ],
  },
  {
    id: 'morning-wakeup',
    name: 'Morning Wake-Up',
    description: 'A gentle full-body sequence to loosen up after sleep.',
    builtIn: true,
    items: items([
      'child-pose',
      'knees-to-chest',
      'cobra',
      'supine-twist',
      'figure-four',
      'forward-fold',
    ]),
  },
  {
    id: 'post-run-lower',
    name: 'Post-Run Lower Body',
    description: 'Cool-down for the legs and hips after a run.',
    builtIn: true,
    items: items([
      'hamstring-standing',
      'quad-standing',
      'calf-wall',
      'hip-flexor-lunge',
      'figure-four',
      'adductor-side-lunge',
      'butterfly',
    ]),
  },
  {
    id: 'desk-neck-shoulders',
    name: 'Desk · Neck & Shoulders',
    description: 'Relieve tension from sitting at a screen.',
    builtIn: true,
    items: items([
      'chin-tuck',
      'neck-side',
      'shoulder-cross',
      'tricep-overhead',
      'chest-doorway',
      'upper-back-clasp',
      'seated-twist',
      'wrist-flexor',
      'wrist-extensor',
    ]),
  },
  {
    id: 'full-body',
    name: 'Full Body',
    description: 'A well-rounded head-to-toe routine.',
    builtIn: true,
    items: items([
      'neck-side',
      'shoulder-cross',
      'seated-twist',
      'lat-side-bend',
      'hip-flexor-lunge',
      'hamstring-standing',
      'quad-standing',
      'calf-wall',
      'pigeon',
      'butterfly',
    ]),
  },
];
