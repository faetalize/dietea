/**
 * Calorie Calculation Service
 * BMR, TDEE, and goal calculations using Mifflin-St Jeor equation
 */

/**
 * Calculate Basal Metabolic Rate
 * @param {number} weight - Weight in kg
 * @param {number} height - Height in cm
 * @param {number} age - Age in years
 * @param {string} sex - 'male' or 'female'
 */
export function calculateBMR(weight, height, age, sex) {
  if (sex === 'male') {
    return (10 * weight) + (6.25 * height) - (5 * age) + 5;
  } else {
    return (10 * weight) + (6.25 * height) - (5 * age) - 161;
  }
}

/**
 * Calculate Total Daily Energy Expenditure
 * @param {number} bmr - Basal Metabolic Rate
 * @param {number} activityLevel - Activity multiplier (1.2-1.9)
 */
export function calculateTDEE(bmr, activityLevel) {
  return Math.round(bmr * activityLevel);
}

/**
 * Calculate recommended daily calories for weight goal
 * @param {number} maintenanceCalories - TDEE
 * @param {number} currentWeight - Current weight in kg
 * @param {number} goalWeight - Goal weight in kg
 * @param {number} goalMonths - Timeframe in months
 */
export function calculateRecommendedCalories(maintenanceCalories, currentWeight, goalWeight, goalMonths) {
  // 1 kg of body weight ≈ 7700 kcal
  const weightChange = currentWeight - goalWeight; // positive = weight loss, negative = weight gain
  const totalCalorieChange = weightChange * 7700;
  const days = goalMonths * 30; // approximate
  const dailyCalorieChange = totalCalorieChange / days;
  
  // Calculate recommended calories
  let recommended = Math.round(maintenanceCalories - dailyCalorieChange);
  
  // Safety limits: 
  // - Max healthy deficit is ~1000 kcal/day (lose ~1kg/week)
  // - Max healthy surplus is ~500 kcal/day (gain ~0.5kg/week)
  // - Never go below 1200 kcal
  const minCalories = 1200;
  const maxDeficit = 1000;
  const maxSurplus = 500;
  
  if (recommended < maintenanceCalories - maxDeficit) {
    recommended = maintenanceCalories - maxDeficit;
  }
  if (recommended < minCalories) {
    recommended = minCalories;
  }
  if (recommended > maintenanceCalories + maxSurplus) {
    recommended = maintenanceCalories + maxSurplus;
  }
  
  return recommended;
}

/**
 * Check if weight goal is realistic (0.5-1kg per week is healthy)
 */
export function isGoalRealistic(currentWeight, goalWeight, goalMonths) {
  const weightChange = Math.abs(currentWeight - goalWeight);
  const weeks = goalMonths * 4;
  const weeklyChange = weightChange / weeks;
  
  // Healthy rate: 0.5-1kg per week for loss, 0.25-0.5kg for gain
  const isLoss = currentWeight > goalWeight;
  const maxHealthyRate = isLoss ? 1.0 : 0.5;
  
  return {
    isRealistic: weeklyChange <= maxHealthyRate,
    weeklyChange: weeklyChange,
    recommendedMonths: Math.ceil(weightChange / (maxHealthyRate * 4))
  };
}

/**
 * Get activity level label
 */
export function getActivityLevelLabel(level) {
  const labels = {
    1.2: 'Sedentary',
    1.375: 'Lightly active',
    1.55: 'Moderately active',
    1.725: 'Very active',
    1.9: 'Extra active'
  };
  return labels[level] || 'Moderate';
}

/**
 * Split a daily calorie target into macro targets.
 *
 * The rules: protein is fixed at 1.6 g/kg, fat aims for 0.8 g/kg with a 0.6 g/kg
 * floor, and carbs absorb whatever calories are left. When protein and the fat
 * target together exceed the day's calories — which happens on an aggressive
 * deficit at higher body weights — fat drops toward the floor rather than
 * letting carbs go negative.
 *
 * Kept pure and weight-passed rather than reading `state`, so it stays in the
 * services layer alongside the BMR math and can be unit-reasoned about.
 *
 * This lives here because three callers need identical numbers: the profile
 * card, the schedule generator, and the AI context. It previously existed as two
 * separate copies, which meant the agent could have reported targets that
 * disagreed with the wheel the user was looking at.
 */
export function calculateMacroTargets(targetCalories, weightKg) {
  const weight = Number(weightKg);
  const safeWeight = Number.isFinite(weight) && weight > 0 ? weight : 75;
  const calories = Number.isFinite(targetCalories) && targetCalories > 0 ? targetCalories : 2000;

  const proteinG = Math.max(0, Math.round(safeWeight * 1.6));
  const proteinKcal = proteinG * 4;

  const fatTargetG = Math.max(0, Math.round(safeWeight * 0.8));
  const fatFloorG = Math.max(0, Math.round(safeWeight * 0.6));
  const maxFatByRemaining = Math.max(0, Math.floor((calories - proteinKcal) / 9));

  let fatsG = fatTargetG;
  if (fatsG > maxFatByRemaining) {
    fatsG = Math.max(Math.min(fatFloorG, maxFatByRemaining), 0);
  }

  const fatsKcal = fatsG * 9;
  const carbsKcal = Math.max(0, calories - proteinKcal - fatsKcal);
  const carbsG = Math.round(carbsKcal / 4);

  // Protein and fat round independently, then carbs take the remainder, so the
  // three always sum to exactly 100 instead of drifting to 99 or 101.
  const proteinPct = calories > 0 ? Math.round((proteinKcal / calories) * 100) : 0;
  const fatsPct = calories > 0 ? Math.round((fatsKcal / calories) * 100) : 0;
  const carbsPct = Math.max(0, 100 - proteinPct - fatsPct);

  return {
    calories,
    weightKg: safeWeight,

    proteinG,
    proteinKcal,
    proteinPct,
    proteinRatio: calories > 0 ? proteinKcal / calories : 0,

    carbsG,
    carbsKcal,
    carbsPct,
    carbsRatio: calories > 0 ? carbsKcal / calories : 0,

    fatsG,
    fatsKcal,
    fatsPct,
    fatsRatio: calories > 0 ? fatsKcal / calories : 0,

    fatTargetG,
    fatFloorG,
    fatsMinG: Math.min(fatFloorG, maxFatByRemaining),
    isFatLimited: fatsG < fatTargetG
  };
}

/**
 * Calculate full profile metrics
 */
export function calculateProfileMetrics(profile) {
  const { age, sex, weight, height, activityLevel, goalWeight, goalMonths } = profile;
  
  if (!age || !weight || !height || !activityLevel || !goalWeight || !goalMonths) {
    return null;
  }
  
  const bmr = calculateBMR(weight, height, age, sex);
  const maintenanceCalories = calculateTDEE(bmr, activityLevel);
  const recommendedCalories = calculateRecommendedCalories(
    maintenanceCalories, 
    weight, 
    goalWeight, 
    goalMonths
  );
  
  return {
    bmr,
    maintenanceCalories,
    recommendedCalories
  };
}
