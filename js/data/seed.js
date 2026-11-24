// Public starter data: an empty profile and a template weekly plan.
// Personal history is NOT in this file. It is imported from a private backup (Settings -> Restore backup).
// Unknown values are null (never invented).

export const SEED_VERSION = 2;

export function seedState() {
  return {
    schema: 1,
    seedVersion: SEED_VERSION,
    createdAt: new Date().toISOString(),
    onboarded: false,
    profile: {
      name: '',
      age: null, ageAsOf: '',
      heightCm: null,
      country: '',
      units: 'metric',
      occupation: '',
      experience: '',
      trainingTime: '',
      equipment: 'Primarily gym machines',
      frequencyTarget: { strength: 4, cardio: 1 },
      weightLossGuidance: '~0.25–0.5 kg per week depending on recovery, performance, nutrition and weight trend (planning guidance, not medically validated).',
      previousAspiration: '',
      unknowns: {
        currentWeight: null, waistCm: null, bodyFatPct: null, dailyKcal: null, sleepHours: null, restingHr: null,
        kneeDiagnosis: null, armDiagnosis: null, armResolvedSince20Nov: null, maxStrength: null,
        legMachineWeights: null, supplementAdherence: null, dietaryAdherence: null, creatineDaily: null,
        intermittentFasting: null, machineModels: null, cardioAfter20Nov: null,
      },
    },
    goals: [],
    measurements: [],
    plan: defaultPlan(),
    routines: [
      {
        id: 'r_short_upper', name: 'Short upper body (tired day)', type: 'strength', focus: 'Fewer sets, main lifts only',
        items: [
          { exerciseId: 'chest_press', sets: 2, repsMin: 10, repsMax: 12 },
          { exerciseId: 'lat_pulldown', sets: 2, repsMin: 10, repsMax: 12 },
          { exerciseId: 'seated_row', sets: 2, repsMin: 10, repsMax: 12 },
        ],
      },
      {
        id: 'r_morning_mob', name: 'Morning mobility (8–10 min)', type: 'mobility', focus: 'Define your own moves',
        items: [{ exerciseId: 'plank', sets: 2, repsMin: 30, repsMax: 45 }],
      },
    ],
    exerciseSettings: {},
    customExercises: [],
    sessions: [],
    cardio: [],
    checkins: [],
    symptoms: [],
    active: null,
    nutrition: {
      target: { kcal: null, protein: null, carbs: null, fat: null, fibre: null, status: 'unknown', note: 'Set your own targets.' },
      entries: [],
      fasting: { enabled: false, start: '11:00', end: '19:00', note: 'Optional, never mandatory.' },
    },
    customFoods: [],
    customRecipes: [],
    supplements: [],
    suppIntake: [],
    labs: [],
    settings: {
      namesFirst: 'de', weightStep: 2.5, defaultRest: 90, sound: true, vibrate: true,
      deload: false, shortMode: false, theme: 'dark',
    },
  };
}

export function defaultPlan() {
  const it = (exerciseId, sets, repsMin, repsMax, extra = {}) => ({ exerciseId, sets, repsMin, repsMax, ...extra });
  return {
    mon: {
      type: 'strength', title: 'Chest, shoulders, triceps', priority: 'Chest growth',
      note: 'If upper-arm discomfort is present: avoid aggravating exercises and reassess rather than repeating prior loads.',
      items: [
        it('chest_press', 3, 8, 12),
        it('incline_chest_press', 3, 10, 12),
        it('butterfly', 3, 10, 15, { setsNote: '2–3 sets' }),
        it('lateral_raise', 3, 10, 15, { setsNote: '2–3 sets' }),
        it('triceps_pushdown', 2, 10, 15),
        it('db_shoulder_press', 2, 8, 10, { optional: true }),
      ],
    },
    tue: {
      type: 'strength', title: 'Back and biceps', priority: 'Back width, arm strength', note: '',
      items: [
        it('lat_pulldown', 3, 10, 12),
        it('seated_row', 3, 10, 12),
        it('reverse_butterfly', 2, 12, 12),
        it('biceps_curl_machine', 3, 8, 12, { setsNote: '2–3 sets' }),
      ],
    },
    wed: { type: 'rest', title: 'Rest / recovery', priority: '', note: 'Optional: short morning mobility, easy walk.', items: [] },
    thu: {
      type: 'strength', title: 'Legs, glutes, abdomen (knee-friendly)', priority: 'Knee-friendly strength',
      note: 'Knee symptoms override selection. No heavy squats. Controlled, comfortable range of motion.',
      knee: true,
      items: [
        it('leg_curl_seated', 3, 12, 12),
        it('leg_press', 2, 10, 12),
        it('hip_abduction', 2, 12, 15),
        it('calf_raise', 2, 12, 15),
        it('ab_crunch_machine', 3, 12, 15),
        it('plank', 2, 30, 45, { optional: true }),
      ],
    },
    fri: {
      type: 'strength', title: 'Upper body, chest emphasis', priority: 'Extra upper-body stimulus',
      note: 'If upper-arm symptoms recur: reassess whether both chest exercises and the current volume are appropriate before the next heavy session.',
      items: [
        it('chest_press', 2, 10, 12),
        it('chest_crossover', 2, 10, 12),
        it('lat_pulldown', 2, 10, 12),
        it('seated_row', 2, 10, 12),
        it('biceps_curl_machine', 2, 10, 12),
        it('triceps_pushdown', 2, 10, 12),
      ],
    },
    sat: { type: 'rest', title: 'Rest / recovery', priority: '', note: '', items: [] },
    sun: {
      type: 'cardio', title: 'Relaxed treadmill cardio', priority: 'Fat loss, cardio fitness', knee: true,
      note: 'Treadmill walk ~40–50 min at ~4.5–5 km/h, incline adjusted to knee and recovery. Knee uncomfortable: start 0–3 %, reassess after 5–10 min. Pain-free: progress time or incline gradually. Should feel relatively easy.',
      cardio: { minutes: [40, 50], speed: [4.5, 5], incline: 'comfortable' },
      items: [],
    },
  };
}

// Food library — per-portion values are rough ESTIMATES for logging convenience.
export const FOODS = [
  { id: 'f_chicken_breast', name: 'Chicken breast, cooked (150 g)', kcal: 248, protein: 46, carbs: 0, fat: 5, tag: 'Protein' },
  { id: 'f_chicken_thigh', name: 'Chicken thigh, skinless, cooked (150 g)', kcal: 290, protein: 38, carbs: 0, fat: 15, tag: 'Protein' },
  { id: 'f_salmon', name: 'Salmon fillet (150 g)', kcal: 310, protein: 31, carbs: 0, fat: 20, tag: 'Fish' },
  { id: 'f_white_fish', name: 'White fish e.g. cod / tilapia (150 g)', kcal: 150, protein: 33, carbs: 0, fat: 1.5, tag: 'Fish' },
  { id: 'f_prawns', name: 'Prawns, cooked (150 g)', kcal: 150, protein: 33, carbs: 1, fat: 1.5, tag: 'Seafood' },
  { id: 'f_eggs2', name: 'Eggs (2 large)', kcal: 145, protein: 12.5, carbs: 1, fat: 10, tag: 'Protein' },
  { id: 'f_tofu', name: 'Firm tofu (150 g)', kcal: 215, protein: 23, carbs: 3, fat: 13, tag: 'Protein' },
  { id: 'f_rice', name: 'Jasmine rice, cooked (200 g)', kcal: 260, protein: 5, carbs: 57, fat: 0.5, tag: 'Carbs' },
  { id: 'f_rice_small', name: 'Jasmine rice, cooked, small (120 g)', kcal: 155, protein: 3, carbs: 34, fat: 0.3, tag: 'Carbs' },
  { id: 'f_potatoes', name: 'Boiled potatoes (250 g)', kcal: 215, protein: 5, carbs: 48, fat: 0.3, tag: 'Carbs' },
  { id: 'f_quark', name: 'Magerquark / low-fat quark (250 g)', kcal: 170, protein: 30, carbs: 10, fat: 0.5, tag: 'Swiss' },
  { id: 'f_huttenkase', name: 'Hüttenkäse / cottage cheese (200 g)', kcal: 196, protein: 24, carbs: 6, fat: 8, tag: 'Swiss' },
  { id: 'f_skyr', name: 'Skyr / high-protein yoghurt (170 g)', kcal: 110, protein: 19, carbs: 7, fat: 0.3, tag: 'Swiss' },
  { id: 'f_bircher', name: 'Birchermüesli (250 g)', kcal: 380, protein: 12, carbs: 55, fat: 11, tag: 'Swiss' },
  { id: 'f_brot', name: 'Wholegrain bread (2 slices, 80 g)', kcal: 195, protein: 7, carbs: 34, fat: 2.5, tag: 'Swiss' },
  { id: 'f_cheese', name: 'Swiss hard cheese, e.g. Emmentaler (30 g)', kcal: 120, protein: 8.5, carbs: 0, fat: 9.5, tag: 'Swiss' },
  { id: 'f_milk', name: 'Milk, semi-skimmed (250 ml)', kcal: 120, protein: 8.5, carbs: 12, fat: 4, tag: 'Swiss' },
  { id: 'f_whey', name: 'Whey protein shake (30 g powder, water)', kcal: 120, protein: 24, carbs: 3, fat: 1.5, tag: 'Protein' },
  { id: 'f_vegetables', name: 'Mixed stir-fried vegetables (200 g)', kcal: 110, protein: 4, carbs: 12, fat: 5, tag: 'Veg' },
  { id: 'f_banana', name: 'Banana (1 medium)', kcal: 105, protein: 1.3, carbs: 27, fat: 0.4, tag: 'Fruit' },
  { id: 'f_apple', name: 'Apple (1 medium)', kcal: 95, protein: 0.5, carbs: 25, fat: 0.3, tag: 'Fruit' },
  { id: 'f_nuts', name: 'Mixed nuts (30 g)', kcal: 180, protein: 5, carbs: 6, fat: 16, tag: 'Snack' },
  { id: 'f_sambal', name: 'Sambal tumis (2 tbsp)', kcal: 90, protein: 1, carbs: 6, fat: 7, tag: 'Asian' },
];

// Recipe templates — cooked for TWO; values are per serving and are ESTIMATES. No pork.
export const RECIPES = [
  { id: 'rc_ayam_merah', name: 'Ayam masak merah (chicken in spiced tomato-chilli sauce)', cuisine: 'Malaysian', servings: 2, perServing: { kcal: 520, protein: 45, carbs: 20, fat: 28 },
    ingredients: ['500 g chicken thigh, skinless', '1 onion, 3 garlic cloves, 2 cm ginger', '3 tbsp chilli paste', '200 g crushed tomatoes', '1 stick cinnamon, 2 star anise', '1 tbsp oil', 'salt, a little palm sugar'],
    steps: ['Sauté onion, garlic, ginger and spices in the oil.', 'Add chilli paste, cook until fragrant and the oil separates.', 'Add chicken and tomatoes, simmer 20–25 min until thick.', 'Serve with 120–200 g rice per person.'] },
  { id: 'rc_sambal_prawn', name: 'Sambal tumis udang (prawns in sambal)', cuisine: 'Malaysian', servings: 2, perServing: { kcal: 330, protein: 34, carbs: 14, fat: 15 },
    ingredients: ['400 g prawns, peeled', '4 tbsp sambal tumis base (dried chilli, shallot, garlic, belacan optional)', '1 onion, sliced', '1 tbsp tamarind water', '1 tbsp oil'],
    steps: ['Fry the sambal base in oil until dark red and fragrant.', 'Add onion and tamarind, cook 2 min.', 'Add prawns, cook 3–4 min until just done.'] },
  { id: 'rc_ikan_bakar', name: 'Ikan bakar (grilled spiced fish) with cucumber salad', cuisine: 'Malaysian', servings: 2, perServing: { kcal: 300, protein: 40, carbs: 8, fat: 12 },
    ingredients: ['2 fish fillets (≈180 g each), e.g. sea bass', '2 tbsp spice paste (chilli, lemongrass, turmeric, garlic)', 'lime', 'cucumber, red onion'],
    steps: ['Rub fish with spice paste, rest 15 min.', 'Grill or bake at 220 °C for 10–12 min.', 'Serve with lime and cucumber salad.'] },
  { id: 'rc_chicken_curry', name: 'Kari ayam (Malaysian chicken curry, lighter coconut)', cuisine: 'Malaysian', servings: 2, perServing: { kcal: 560, protein: 46, carbs: 24, fat: 30 },
    ingredients: ['500 g chicken breast or thigh', '2 potatoes, cubed', '3 tbsp meat curry powder', '150 ml light coconut milk + water', 'onion, garlic, ginger, curry leaves'],
    steps: ['Sauté aromatics, add curry powder paste.', 'Add chicken and potatoes, then coconut milk and water.', 'Simmer 25 min until potatoes are tender.'] },
  { id: 'rc_thai_basil', name: 'Thai basil chicken (pad krapow gai) with egg', cuisine: 'Thai', servings: 2, perServing: { kcal: 470, protein: 48, carbs: 12, fat: 24 },
    ingredients: ['400 g minced chicken', '2 eggs', 'Thai holy basil', 'garlic, chillies', '1 tbsp oyster sauce, 1 tsp fish sauce, 1 tsp soy'],
    steps: ['Fry garlic and chilli, add chicken and cook through.', 'Season, toss in basil.', 'Top with a fried egg; rice optional.'] },
  { id: 'rc_steamed_fish', name: 'Steamed fish with ginger, soy and spring onion', cuisine: 'Chinese / Asian', servings: 2, perServing: { kcal: 240, protein: 38, carbs: 4, fat: 8 },
    ingredients: ['2 white fish fillets (≈180 g each)', '3 cm ginger, julienned', '2 spring onions', '2 tbsp light soy sauce', '1 tsp sesame oil'],
    steps: ['Steam fish with ginger 8–10 min.', 'Top with spring onion, pour over hot soy and sesame oil.'] },
  { id: 'rc_tomyum', name: 'Tom yum seafood soup', cuisine: 'Thai', servings: 2, perServing: { kcal: 230, protein: 32, carbs: 10, fat: 6 },
    ingredients: ['300 g prawns + 150 g squid or fish', 'lemongrass, galangal, kaffir lime leaves', 'mushrooms, tomatoes', 'chilli paste, fish sauce, lime'],
    steps: ['Simmer aromatics in 800 ml water 10 min.', 'Add vegetables, then seafood for 3–4 min.', 'Season with fish sauce, lime and chilli paste.'] },
  { id: 'rc_satay', name: 'Chicken satay (grilled) with peanut sauce, small', cuisine: 'Malaysian', servings: 2, perServing: { kcal: 450, protein: 44, carbs: 14, fat: 24 },
    ingredients: ['450 g chicken breast in strips', 'turmeric, lemongrass, coriander marinade', '3 tbsp peanut sauce per person'],
    steps: ['Marinate 1 h+, thread on skewers.', 'Grill 8–10 min, turning.', 'Serve with cucumber, onion and a small amount of sauce.'] },
  { id: 'rc_salmon_ch', name: 'Oven salmon with potatoes and green beans', cuisine: 'Swiss / European', servings: 2, perServing: { kcal: 560, protein: 38, carbs: 45, fat: 24 },
    ingredients: ['2 salmon fillets (≈150 g)', '500 g potatoes', '300 g green beans', 'lemon, dill, 1 tbsp olive oil'],
    steps: ['Roast potatoes 25 min at 210 °C.', 'Add salmon and beans for the last 12 min.'] },
  { id: 'rc_quark_bowl', name: 'Quark protein bowl with berries and oats', cuisine: 'Swiss', servings: 1, perServing: { kcal: 380, protein: 36, carbs: 45, fat: 5 },
    ingredients: ['250 g Magerquark', '40 g oats', '100 g berries', '1 tsp honey'], steps: ['Mix and eat — good after training.'] },
];
