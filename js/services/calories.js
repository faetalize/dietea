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
