/**
 * The fixed supplement catalog shared by the tracker UI and live AI tools.
 *
 * Completion state is user data and lives in `dietea.supplement_days`; these
 * definitions are application data. Keeping them in core lets components and
 * services read the same names and ids without importing across layer boundaries.
 */

const SUPPLEMENT_CATALOG = [
  { id: 'd3', name: 'Vitamin D3', timing: 'Morning (with fat)', dosage: '2,000 - 5,000 IU', note: 'Bone health, mood, immunity.' },
  { id: 'k2', name: 'Vitamin K2', timing: 'Morning (with D3)', dosage: '100 mcg', note: 'Helps direct calcium to bones.' },
  { id: 'b12', name: 'Vitamin B12', timing: 'Morning', dosage: 'Daily value+', note: 'Energy and nervous system support.' },
  { id: 'vitc', name: 'Vitamin C', timing: 'Morning', dosage: '500 - 1000 mg', note: 'Immunity and collagen support.' },
  { id: 'ltheanine', name: 'L-Theanine', timing: 'Morning (with coffee)', dosage: '100 - 200 mg', note: 'Calm focus with caffeine.' },
  { id: 'omega3', name: 'Omega-3', timing: 'With meals', dosage: '1,000 mg EPA/DHA', note: 'Heart and brain support.' },
  { id: 'fiber', name: 'Fiber', timing: 'With meals', dosage: '30g+ daily', note: 'Gut health support.' },
  { id: 'creatine', name: 'Creatine', timing: 'Anytime', dosage: '5 g', note: 'Muscle and performance support.' },
  { id: 'collagen', name: 'Collagen Powder', timing: 'Anytime', dosage: '10 - 20 g', note: 'Joint and skin support.' },
  { id: 'taurine', name: 'Taurine', timing: 'Evening / pre-workout', dosage: '1 - 2 g', note: 'Calmness and heart support.' },
  { id: 'magnesium', name: 'Magnesium', timing: 'Evening', dosage: '200 - 400 mg', note: 'Recovery and sleep support.' },
  { id: 'glycine', name: 'Glycine', timing: 'Bedtime', dosage: '3 - 5 g', note: 'Sleep quality support.' },
  { id: 'protein', name: 'Protein Intake', timing: 'Across meals', dosage: '', note: 'Daily target based on body weight.' }
];

/** Return fresh objects so callers may safely add display-only fields. */
export function getSupplementCatalog(proteinGoalG) {
  return SUPPLEMENT_CATALOG.map((supplement) => {
    if (supplement.id !== 'protein') return { ...supplement };

    const goal = Number(proteinGoalG);
    return {
      ...supplement,
      dosage: Number.isFinite(goal) && goal > 0 ? `${Math.round(goal)} g total` : 'Based on body weight'
    };
  });
}
