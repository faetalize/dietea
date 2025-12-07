// Meal Data from specs.md
const MEALS = {
    breakfast: {
        id: 'breakfast',
        name: 'High-Protein Yogurt Bowl',
        type: 'Breakfast',
        calories: 482,
        protein: 56.2,
        ingredients: [
            { name: 'Plain Greek yogurt (low-lactose)', amount: '250 g' },
            { name: 'Rolled oats', amount: '30 g' },
            { name: 'Protein powder', amount: '30 g (1 scoop)' },
            { name: 'Mixed berries', amount: '50 g' },
            { name: 'Chia seeds', amount: '10 g' },
            { name: 'Honey/maple/stevia', amount: '8 g' }
        ],
        instructions: [
            'Place the digital scale on a flat surface and turn it on. Place a medium mixing bowl on the scale and press tare (zero).',
            'Measure 250 g plain Greek yogurt into the bowl using a tablespoon to scrape.',
            'Measure 30 g rolled oats directly into the bowl on top of the yogurt.',
            'Measure 30 g protein powder (one scoop) and add to the bowl. Use a dry spoon to level; close protein tub immediately.',
            'Weigh 50 g mixed berries (fresh or frozen) on the scale and add to the bowl.',
            'Weigh 10 g chia seeds (about 1 tablespoon) and sprinkle into the bowl.',
            'Weigh 8 g honey using the scale and a small spoon and drizzle into the bowl.',
            'Take a fork and mix all ingredients thoroughly for 15 seconds until evenly combined.',
            'Serve immediately in the bowl. Utensils to wash: bowl, fork, tablespoon.'
        ]
    },
    lunchA: {
        id: 'lunchA',
        name: 'Tofu + Quinoa Veg Stir',
        type: 'Lunch',
        calories: 440,
        protein: 32.3,
        ingredients: [
            { name: 'Firm tofu', amount: '150 g' },
            { name: 'Cooked quinoa', amount: '100 g' },
            { name: 'Mixed vegetables', amount: '120 g' },
            { name: 'Olive oil', amount: '7 g' },
            { name: 'Soy sauce', amount: '10 g' },
            { name: 'Garlic', amount: '1 clove' },
            { name: 'Black pepper', amount: 'to taste' }
        ],
        instructions: [
            'Put the saucepan on the stove (medium burner). Measure 40 g dry quinoa into the colander and rinse under cold running water for 10 seconds; let drain 5 seconds.',
            'Transfer rinsed quinoa to the saucepan. Add 80 ml cold water. Put lid on, heat on high until it just boils, then reduce to low and simmer covered for 12 minutes. After 12 minutes, remove from heat and keep covered for 5 minutes to steam.',
            'While quinoa cooks, on the scale take a plate and place 150 g firm tofu on it. Using a chef\'s knife on the cutting board, cut tofu into ~2 cm cubes.',
            'Press tofu briefly: place tofu cubes between two clean plates, place a small can or weight (approx 400 g) on top to squeeze for 5 minutes.',
            'On the scale measure 120 g mixed vegetables. Chop vegetables on the cutting board into bite-size pieces.',
            'Unwrap pressed tofu and pat dry with paper towel.',
            'Place large nonstick frying pan on medium-high heat. Weigh 7 g olive oil and add to the pan. Swirl to coat.',
            'When oil is shimmering (about 30 seconds), add tofu cubes in a single layer. Let cook undisturbed 2.5 minutes until underside golden; flip tofu pieces and cook another 2 minutes. Remove tofu to a plate.',
            'In same pan, add 1 small garlic clove minced. Sauté 15 seconds.',
            'Add the 120 g mixed vegetables to the pan. Stir-fry for 3–4 minutes until vegetables are tender-crisp.',
            'Return tofu to pan, add 10 g soy sauce and black pepper to taste. Stir for 30 seconds to combine and heat through.',
            'Fluff quinoa with fork, weigh 100 g cooked quinoa and transfer to plate or bowl.',
            'Place the tofu + vegetable mixture on top of the quinoa.',
            'Serve hot. Utensils to wash: saucepan, frying pan, knife, board, plate, measuring jug, spatula.'
        ]
    },
    lunchB: {
        id: 'lunchB',
        name: 'Chickpea Avocado Spinach Salad + Bread',
        type: 'Lunch',
        calories: 522,
        protein: 22.2,
        ingredients: [
            { name: 'Chickpeas (cooked/canned, drained)', amount: '150 g' },
            { name: 'Frozen spinach', amount: '100 g' },
            { name: 'Tomato', amount: '100 g' },
            { name: 'Avocado', amount: '30 g' },
            { name: 'Whole wheat bread', amount: '50 g' },
            { name: 'Olive oil', amount: '7 g' },
            { name: 'Lemon juice', amount: '10 g' },
            { name: 'Salt & pepper', amount: 'to taste' }
        ],
        instructions: [
            'Place a small frying pan on medium heat. Put the digital scale on the counter.',
            'Open one can of chickpeas. Pour contents into a colander and drain thoroughly. Place drained chickpeas into a bowl and weigh 150 g chickpeas and set aside.',
            'Measure 100 g frozen spinach on the scale. Add 7 g olive oil to the pan and heat 20 seconds.',
            'Add the 100 g frozen spinach to the pan and sauté 2–3 minutes, stirring frequently, until completely thawed and hot. If there is extra water, tilt the pan and use a wooden spoon to press out liquid.',
            'While spinach warms, on the cutting board cut 100 g tomato into 1 cm dice; measure 30 g avocado and slice thinly.',
            'Add the 150 g drained chickpeas to the warm spinach in the pan and stir for 30 seconds to heat through. Add a pinch of salt (~1 g) and black pepper (~0.2 g) and squeeze half a lemon (~10 g juice) over the mixture. Stir 10 seconds.',
            'Transfer spinach + chickpeas to a plate. Arrange 30 g avocado slices on top and scatter the 100 g chopped tomato.',
            'Weigh 50 g whole wheat bread and place bread slices on the plate.',
            'Drizzle remaining 7 g olive oil over the salad if you prefer.',
            'Serve warm. Utensils to wash: pan, colander, knife, cutting board, plate, bowl.'
        ]
    },
    lunchC: {
        id: 'lunchC',
        name: 'Lentil + Tofu Rice Bowl',
        type: 'Lunch',
        calories: 534,
        protein: 32.3,
        ingredients: [
            { name: 'Cooked lentils', amount: '150 g' },
            { name: 'Cooked brown rice', amount: '120 g' },
            { name: 'Firm tofu', amount: '80 g' },
            { name: 'Mixed vegetables', amount: '100 g' },
            { name: 'Olive oil', amount: '7 g' },
            { name: 'Garlic', amount: '1 clove' },
            { name: 'Cumin', amount: '1 g' },
            { name: 'Salt & pepper', amount: 'to taste' }
        ],
        instructions: [
            'Measure 60 g dry brown lentils on the scale into the colander and give a quick rinse under cold water. Transfer to the medium saucepan.',
            'Add 180 ml cold water to the lentils. Put lid on, bring to a boil on high, then reduce to low and simmer uncovered for 16 minutes. Check tenderness — lentils should be tender but not mushy.',
            'While lentils cook, measure 48 g dry brown rice into the small saucepan; add 120 ml water, lid on, bring to boil, then reduce to low and simmer 22 minutes. After 22 minutes, remove from heat and keep covered 5 minutes.',
            'While grains cook, take 80 g firm tofu, cut into 1.5 cm cubes on the cutting board; pat dry with paper towel.',
            'Place the large frying pan on medium-high heat; weigh 7 g olive oil and add to pan. When oil shimmers, add tofu cubes and pan-fry 3 minutes undisturbed, then flip and fry another 2–3 minutes until golden.',
            'Measure 100 g mixed vegetables and add to the frying pan with 1 minced garlic clove and sauté 3–4 minutes until tender-crisp.',
            'Return tofu to the pan with vegetables, add 1/4 tsp cumin (≈1 g) and a pinch salt & pepper; toss 30 seconds to combine.',
            'Weigh 150 g cooked lentils and 120 g cooked brown rice and place both on a bowl or plate.',
            'Top rice and lentils with the tofu + veg mix. Serve hot.'
        ]
    },
    snackA: {
        id: 'snackA',
        name: 'Cottage Cheese + Banana',
        type: 'Snack',
        calories: 189,
        protein: 14.2,
        ingredients: [
            { name: 'Low-fat cottage cheese', amount: '120 g' },
            { name: 'Banana', amount: '80 g' }
        ],
        instructions: [
            'Place small bowl on scale and tare.',
            'Measure 120 g low-fat cottage cheese into the bowl.',
            'Weigh 80 g banana on scale, peel, and slice into the bowl using a knife.',
            'Stir gently with spoon and eat. Utensils to wash: bowl, spoon, knife.'
        ]
    },
    snackB: {
        id: 'snackB',
        name: 'Protein Shake + Almonds',
        type: 'Snack',
        calories: 207,
        protein: 27.1,
        ingredients: [
            { name: 'Protein powder', amount: '30 g (1 scoop)' },
            { name: 'Water', amount: '300 ml' },
            { name: 'Raw almonds', amount: '15 g' }
        ],
        instructions: [
            'Weigh 30 g protein powder on the scale and pour into a clean shaker bottle or mixing jug.',
            'Add 300 ml cold water (measure with jug) to the shaker/jug.',
            'Close shaker and shake vigorously 15 seconds (or whisk for 20 seconds) until smooth.',
            'Weigh 15 g raw almonds on the scale and place in a small bowl/plate to eat alongside the shake.',
            'Drink shake and eat almonds. Utensils to wash: shaker/jug.'
        ]
    },
    dinner: {
        id: 'dinner',
        name: 'Salmon + Rice + Vegetables Bowl',
        type: 'Dinner',
        calories: 598,
        protein: 40.2,
        ingredients: [
            { name: 'Salmon fillet (raw weight)', amount: '160 g' },
            { name: 'Cooked brown rice', amount: '120 g' },
            { name: 'Mixed vegetables', amount: '150 g' },
            { name: 'Olive oil', amount: '7 g' },
            { name: 'Lemon juice', amount: '10 g' },
            { name: 'Salt', amount: '1 g' },
            { name: 'Black pepper', amount: '0.3 g' },
            { name: 'Smoked paprika', amount: '1 g' },
            { name: 'Garlic', amount: '1 clove' }
        ],
        instructions: [
            'Put the medium saucepan on the stove. Place the scale and measuring jug nearby.',
            'Measure 48 g dry brown rice on the scale into the saucepan. Add 120 ml cold water. Cover with lid, bring to a boil on high, then reduce to low and simmer 22 minutes. Remove from heat and let rest covered 5 minutes.',
            'While rice cooks, rinse salmon briefly under cold water and pat dry with paper towel. Place salmon on cutting board and weigh 160 g raw salmon fillet to confirm weight.',
            'Season salmon: sprinkle 1 g salt (approx 1/4 tsp) and 0.3 g black pepper, and 1/4 tsp smoked paprika (≈1 g) evenly over both sides. Squeeze 5 g lemon juice over fillet.',
            'Measure 150 g mixed vegetables on the scale and chop larger pieces if needed.',
            'Place large nonstick frying pan on medium-high heat. Weigh 7 g olive oil and add to pan. Heat ~30 seconds until oil shimmers.',
            'Add the 150 g mixed vegetables to the pan and sauté 3–4 minutes until slightly tender. Season with a pinch of salt. Move vegetables to the side of the pan.',
            'Add the salmon fillet skin-side down to the cleared area of the pan. Cook 3.5–4 minutes undisturbed on medium-high heat until the bottom is golden.',
            'Flip the salmon and reduce heat to medium. Cook another 3–4 minutes (total salmon cook time ~7–8 minutes). Check doneness: salmon should be opaque and flake with a fork.',
            'While salmon finishes, fluff rice with a fork and weigh 120 g cooked rice to serve.',
            'Plate 120 g cooked rice, add 150 g sautéed vegetables, and place the cooked salmon fillet on top.',
            'Optionally drizzle any remaining pan juices over the plate and squeeze an extra 5 g lemon juice.',
            'Serve immediately. Utensils to wash: saucepan, frying pan, cutting board, plate, tongs, fork.'
        ],
        frozenInstructions: [
            'Put the medium saucepan on the stove. Place the scale and measuring jug nearby.',
            'Measure 48 g dry brown rice on the scale into the saucepan. Add 120 ml cold water. Cover with lid, bring to a boil on high, then reduce to low and simmer 22 minutes. Remove from heat and let rest covered 5 minutes.',
            'Measure 150 g mixed vegetables on the scale and chop larger pieces if needed.',
            'Place large nonstick frying pan on medium-high heat. Weigh 7 g olive oil and add to pan. Heat ~30 seconds until oil shimmers.',
            'Add the 150 g mixed vegetables to the pan and sauté 3–4 minutes until slightly tender. Season with a pinch of salt. Transfer vegetables to a plate and set aside.',
            'Take the 160 g frozen salmon fillet straight out of the freezer. Do NOT thaw. Quickly rinse the surface under cold water to remove any ice crystals. Pat both sides very dry with paper towel.',
            'Season the frozen salmon: sprinkle 1 g salt, 0.3 g black pepper, and 1 g smoked paprika evenly over both sides. Drizzle 5 g lemon juice over the fillet.',
            'Turn heat to MEDIUM (not medium-high). Place the frozen salmon in the pan skin-side down if it has skin. Cook 5 minutes uncovered. It will release water — this is normal.',
            'After 5 minutes, flip the salmon. Increase heat to medium-high and cook 4–5 minutes until the underside turns golden.',
            'Flip the salmon again (onto original side). Reduce heat to medium and cook another 4 minutes.',
            'Check doneness: Press gently at the thickest part with a fork — fish should flake easily and be opaque. Or use a thermometer to check for internal temperature of 63°C (145°F). If still slightly translucent in the center, add 1–2 extra minutes on medium heat.',
            'While salmon finishes, fluff rice with a fork and weigh 120 g cooked rice to serve.',
            'Transfer salmon to a plate with your vegetables and the 120 g cooked rice.',
            'Optionally drizzle any remaining pan juices over the plate and squeeze an extra 5 g lemon juice.',
            'Serve immediately. Total salmon cook time: 13–15 minutes. Utensils to wash: saucepan, frying pan, cutting board, plate, tongs, fork.'
        ],
        frozenNote: 'Frozen salmon releases more water and needs a different heat sequence. This method preserves tenderness while preventing the rubbery texture that happens if you blast frozen fish on high heat.'
    }
};

// 6-Day Schedule from specs.md
const SCHEDULE = [
    { lunch: 'lunchB', snack: 'snackB', calories: 1808, protein: 145.5 },
    { lunch: 'lunchC', snack: 'snackB', calories: 1820, protein: 155.6 },
    { lunch: 'lunchB', snack: 'snackA', calories: 1790, protein: 132.6 },
    { lunch: 'lunchC', snack: 'snackA', calories: 1802, protein: 142.7 },
    { lunch: 'lunchA', snack: 'snackB', calories: 1726, protein: 155.6 },
    { lunch: 'lunchB', snack: 'snackB', calories: 1808, protein: 145.5 }
];

// Shopping list from specs.md
const SHOPPING_LIST = {
    'Proteins': [
        { name: 'Salmon fillets', amount: '960 g raw (160 g × 6 days)', notes: 'Any fatty fish (trout, mackerel)' },
        { name: 'Firm tofu', amount: '1,040 g (4 blocks × 300 g)', notes: 'Freeze extra 160 g' },
        { name: 'Protein powder', amount: '360 g (12 scoops)', notes: 'Whey isolate or vegan blend' },
        { name: 'Cottage cheese', amount: '240 g', notes: 'Low-lactose' },
        { name: 'Greek yogurt', amount: '1,500 g', notes: 'Lactose-free OK' }
    ],
    'Legumes & Pulses': [
        { name: 'Chickpeas (canned)', amount: '4 cans (400 g each)', notes: 'Drained ~180-200 g each' },
        { name: 'Lentils (dry)', amount: '120 g', notes: 'Or 1 can lentils, drained' }
    ],
    'Grains & Carbs': [
        { name: 'Rolled oats', amount: '180 g', notes: 'For breakfast' },
        { name: 'Brown rice (dry)', amount: '384 g', notes: 'Yields ~960 g cooked' },
        { name: 'Quinoa (dry)', amount: '40 g', notes: 'Yields ~100 g cooked' },
        { name: 'Whole wheat bread', amount: '150 g (~5 slices)', notes: '' }
    ],
    'Fruits': [
        { name: 'Berries', amount: '300 g', notes: 'Fresh or frozen' },
        { name: 'Bananas', amount: '160 g (~2 small)', notes: 'For Snack A' },
        { name: 'Lemons', amount: '4', notes: '1 extra for fish marinade' }
    ],
    'Vegetables': [
        { name: 'Mixed vegetables', amount: '1,520 g', notes: 'Bell pepper, broccoli, zucchini, carrot, mushrooms' },
        { name: 'Spinach (frozen)', amount: '300 g', notes: 'For Lunch B' },
        { name: 'Tomatoes', amount: '300 g', notes: 'For Lunch B' }
    ],
    'Fats & Oils': [
        { name: 'Olive oil', amount: '91 g (~100 ml)', notes: 'For lunches + dinners' },
        { name: 'Almonds', amount: '60 g', notes: 'For Snack B' },
        { name: 'Avocado', amount: '90 g', notes: '~½ medium avocado' }
    ],
    'Condiments & Seasonings': [
        { name: 'Honey or maple syrup', amount: '48 g', notes: 'For breakfast' },
        { name: 'Chia seeds', amount: '60 g', notes: 'For breakfast' },
        { name: 'Soy sauce', amount: '100 ml', notes: 'Lunch seasoning' },
        { name: 'Salt', amount: '200 g', notes: 'Minimum package' },
        { name: 'Black pepper', amount: '30 g', notes: 'Minimum package' },
        { name: 'Garlic (fresh or powder)', amount: '3 cloves or 10 g powder', notes: '' },
        { name: 'Onion (fresh or powder)', amount: '2 onions or 20 g powder', notes: '' },
        { name: 'Paprika (smoked)', amount: '10 g', notes: '' },
        { name: 'Cumin', amount: '10 g', notes: 'For Lunch C' },
        { name: 'Turmeric', amount: '5 g', notes: 'Optional' }
    ]
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// App State
let state = {
    onboarded: false,
    startDay: 1,
    checkedItems: {}
};

// DOM Elements
const onboardingModal = document.getElementById('onboarding-modal');
const app = document.getElementById('app');
const startDaySelect = document.getElementById('start-day');
const startBtn = document.getElementById('start-btn');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const shoppingList = document.getElementById('shopping-list');
const scheduleList = document.getElementById('schedule-list');
const scheduleCalendar = document.getElementById('schedule-calendar');
const viewBtns = document.querySelectorAll('.view-btn');
const menuCards = document.getElementById('menu-cards');
const menuSearch = document.getElementById('menu-search');
const mealDetail = document.getElementById('meal-detail');
const mealDetailContent = document.getElementById('meal-detail-content');
const backToMenuBtn = document.getElementById('back-to-menu');
const resetShoppingBtn = document.getElementById('reset-shopping');
const settingsBtn = document.getElementById('settings-btn');
const backFromSettingsBtn = document.getElementById('back-from-settings');
const settingsTab = document.getElementById('settings-tab');

let previousTab = 'shopping';

// Initialize App
function init() {
    loadState();

    if (state.onboarded) {
        showApp();
    } else {
        showOnboarding();
    }

    setupEventListeners();
}

// Load state from localStorage
function loadState() {
    const saved = localStorage.getItem('mealPrepState');
    if (saved) {
        state = JSON.parse(saved);
    }
}

// Save state to localStorage
function saveState() {
    localStorage.setItem('mealPrepState', JSON.stringify(state));
}

// Show onboarding modal
function showOnboarding() {
    onboardingModal.classList.remove('hidden');
    app.classList.add('hidden');
    startDaySelect.value = state.startDay;
}

// Show main app
function showApp() {
    onboardingModal.classList.add('hidden');
    app.classList.remove('hidden');
    renderShoppingList();
    renderSchedule();
    renderMenuCards();
}

// Setup event listeners
function setupEventListeners() {
    // Onboarding
    startBtn.addEventListener('click', () => {
        state.startDay = parseInt(startDaySelect.value);
        state.onboarded = true;
        saveState();
        showApp();
    });

    // Tab navigation
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });

    // Menu search
    menuSearch.addEventListener('input', (e) => {
        filterMenuCards(e.target.value);
    });

    // Back to menu
    backToMenuBtn.addEventListener('click', () => {
        mealDetail.classList.remove('active');
        document.getElementById('menu-tab').classList.add('active');
    });

    // Reset shopping list with inline confirmation
    const resetWrapper = document.querySelector('.reset-wrapper');
    const resetConfirmBtn = document.getElementById('reset-confirm');
    const resetCancelBtn = document.getElementById('reset-cancel');

    resetShoppingBtn.addEventListener('click', () => {
        resetWrapper.classList.add('confirming');
    });

    resetCancelBtn.addEventListener('click', () => {
        resetWrapper.classList.remove('confirming');
    });

    resetConfirmBtn.addEventListener('click', () => {
        state.checkedItems = {};
        saveState();
        renderShoppingList();
        resetWrapper.classList.remove('confirming');
    });

    // Settings navigation
    settingsBtn.addEventListener('click', () => {
        // Remember which tab we came from
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            previousTab = activeTab.dataset.tab;
        }
        // Hide all tabs and show settings
        tabBtns.forEach(btn => btn.classList.remove('active'));
        tabPanels.forEach(panel => panel.classList.remove('active'));
        settingsTab.classList.add('active');
        settingsBtn.classList.add('active');
    });

    backFromSettingsBtn.addEventListener('click', () => {
        settingsTab.classList.remove('active');
        settingsBtn.classList.remove('active');
        switchTab(previousTab);
    });

    // Schedule view toggle
    const scheduleViewBtns = document.querySelectorAll('.view-btn');
    const scheduleGrid = document.getElementById('schedule-list');
    const scheduleCalendar = document.getElementById('schedule-calendar');

    scheduleViewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;

            // Update active button
            scheduleViewBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Toggle views
            if (view === 'list') {
                scheduleGrid.classList.remove('hidden');
                scheduleCalendar.classList.add('hidden');
                scrollToCurrentDay();
            } else {
                scheduleGrid.classList.add('hidden');
                scheduleCalendar.classList.remove('hidden');
            }
        });
    });

    // Schedule meal click handlers (event delegation)
    const handleMealClick = (e) => {
        const mealElement = e.target.closest('[data-meal-id]');
        if (mealElement) {
            const mealId = mealElement.dataset.mealId;
            if (MEALS[mealId]) {
                switchTab('menu');
                showMealDetail(mealId);
            }
        }
    };

    scheduleGrid.addEventListener('click', handleMealClick);
    scheduleCalendar.addEventListener('click', handleMealClick);
}

// Switch between tabs
function switchTab(tabId) {
    tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    tabPanels.forEach(panel => {
        panel.classList.remove('active');
    });

    document.getElementById(`${tabId}-tab`).classList.add('active');
    
    // Remove active styling from settings button when switching tabs
    settingsBtn.classList.remove('active');

    // Scroll to current day when switching to schedule tab (if list view is active)
    if (tabId === 'schedule' && !scheduleList.classList.contains('hidden')) {
        scrollToCurrentDay();
    }
}

// Render shopping list
function renderShoppingList() {
    shoppingList.innerHTML = '';

    Object.entries(SHOPPING_LIST).forEach(([category, items]) => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'shopping-category';

        categoryDiv.innerHTML = `
            <h2>${category}</h2>
            <div class="shopping-items">
                ${items.map((item, index) => {
            const itemId = `${category}-${index}`;
            const isChecked = state.checkedItems[itemId] || false;
            return `
                        <div class="shopping-item ${isChecked ? 'checked' : ''}">
                            <input type="checkbox" id="${itemId}" ${isChecked ? 'checked' : ''}>
                            <label for="${itemId}">${item.name}${item.notes ? ` <small>(${item.notes})</small>` : ''}</label>
                            <span class="amount">${item.amount}</span>
                        </div>
                    `;
        }).join('')}
            </div>
        `;

        shoppingList.appendChild(categoryDiv);
    });

    // Add click listeners to entire shopping item row
    shoppingList.querySelectorAll('.shopping-item').forEach(item => {
        item.addEventListener('click', () => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;
            const itemId = checkbox.id;
            state.checkedItems[itemId] = checkbox.checked;
            item.classList.toggle('checked', checkbox.checked);
            saveState();
        });
    });
}

// Get day names based on start day
function getScheduleDays() {
    const days = [];
    for (let i = 0; i < 6; i++) {
        const dayIndex = (state.startDay + i) % 7;
        days.push(DAY_NAMES[dayIndex]);
    }
    return days;
}

// Get current day index in the schedule (0-5, or -1 if cheat day/outside schedule)
function getCurrentDayIndex() {
    const today = new Date().getDay(); // 0 = Sunday
    for (let i = 0; i < 6; i++) {
        const scheduleDay = (state.startDay + i) % 7;
        if (scheduleDay === today) {
            return i;
        }
    }
    return -1; // Cheat day or not in schedule
}

// Get current meal based on time of day
function getCurrentMeal() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const time = hours * 60 + minutes;

    // Meal windows:
    // Breakfast: 5:00 AM - 10:30 AM (300 - 630)
    // Lunch: 10:30 AM - 3:00 PM (630 - 900)
    // Snack: 3:00 PM - 6:00 PM (900 - 1080)
    // Dinner: 6:00 PM - 10:00 PM (1080 - 1320)

    if (time >= 300 && time < 630) return 'breakfast';
    if (time >= 630 && time < 900) return 'lunch';
    if (time >= 900 && time < 1080) return 'snack';
    if (time >= 1080 && time < 1320) return 'dinner';
    return null; // Outside meal times
}

// Render schedule list view
// Helper to get label like "Lunch A" from "lunchA"
function getMealLabel(key, type) {
    const letter = key.replace(type.toLowerCase(), '').toUpperCase();
    return letter ? `${type} ${letter}` : type;
}

// Render schedule list view
function renderScheduleList() {
    const days = getScheduleDays();
    const currentDayIndex = getCurrentDayIndex();
    const currentMeal = getCurrentMeal();
    scheduleList.innerHTML = '';

    SCHEDULE.forEach((day, index) => {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'schedule-day';
        if (index === currentDayIndex) {
            dayDiv.classList.add('current-day');
        }

        const lunchLabel = getMealLabel(day.lunch, 'Lunch');
        const snackLabel = getMealLabel(day.snack, 'Snack');

        const isCurrentDay = index === currentDayIndex;
        const breakfastCurrent = isCurrentDay && currentMeal === 'breakfast' ? ' current-meal' : '';
        const lunchCurrent = isCurrentDay && currentMeal === 'lunch' ? ' current-meal' : '';
        const snackCurrent = isCurrentDay && currentMeal === 'snack' ? ' current-meal' : '';
        const dinnerCurrent = isCurrentDay && currentMeal === 'dinner' ? ' current-meal' : '';

        dayDiv.innerHTML = `
            <h2>Day ${index + 1} — ${days[index]}</h2>
            <div class="schedule-meals">
                <div class="schedule-meal${breakfastCurrent}" data-meal-id="breakfast">
                    <span class="meal-time">7:00 AM</span>
                    <span class="material-symbols-rounded meal-icon">egg_alt</span>
                    <span class="meal-name">Breakfast</span>
                    <span class="meal-calories">${MEALS.breakfast.calories} kcal</span>
                </div>
                <div class="schedule-meal${lunchCurrent}" data-meal-id="${day.lunch}">
                    <span class="meal-time">1:00 PM</span>
                    <span class="material-symbols-rounded meal-icon">lunch_dining</span>
                    <span class="meal-name">${lunchLabel}</span>
                    <span class="meal-calories">${MEALS[day.lunch].calories} kcal</span>
                </div>
                <div class="schedule-meal${snackCurrent}" data-meal-id="${day.snack}">
                    <span class="meal-time">4:00 PM</span>
                    <span class="material-symbols-rounded meal-icon">nutrition</span>
                    <span class="meal-name">${snackLabel}</span>
                    <span class="meal-calories">${MEALS[day.snack].calories} kcal</span>
                </div>
                <div class="schedule-meal${dinnerCurrent}" data-meal-id="dinner">
                    <span class="meal-time">7:00 PM</span>
                    <span class="material-symbols-rounded meal-icon">set_meal</span>
                    <span class="meal-name">Dinner</span>
                    <span class="meal-calories">${MEALS.dinner.calories} kcal</span>
                </div>
            </div>
            <div class="schedule-day-total">
                <span><strong>Daily Total:</strong> ${day.calories} kcal</span>
                <span><strong>Protein:</strong> ${day.protein} g</span>
            </div>
        `;

        scheduleList.appendChild(dayDiv);
    });

    // Scroll to current day
    scrollToCurrentDay();
}

// Scroll to current day in list view (accounting for fixed header)
function scrollToCurrentDay() {
    const currentDayElement = scheduleList.querySelector('.schedule-day.current-day');
    if (currentDayElement) {
        setTimeout(() => {
            const header = document.querySelector('.tab-nav');
            const headerHeight = header ? header.offsetHeight : 0;
            const elementTop = currentDayElement.getBoundingClientRect().top + window.scrollY;
            const offsetPosition = elementTop - headerHeight - 16; // 16px extra padding

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }, 100);
    }
}

// Render schedule calendar view
function renderScheduleCalendar() {
    const days = getScheduleDays();
    const currentDayIndex = getCurrentDayIndex();
    const currentMeal = getCurrentMeal();
    scheduleCalendar.innerHTML = '';

    // Helper to get cell classes
    const getCellClass = (dayIndex, mealType) => {
        const classes = ['calendar-cell'];
        if (dayIndex === currentDayIndex) {
            classes.push('current-day');
            if (currentMeal === mealType) {
                classes.push('current-meal');
            }
        }
        return classes.join(' ');
    };

    // Create calendar grid - column-based for proper current day outline
    const calendarHTML = `
        <div class="calendar-grid">
            <div class="calendar-column time-column">
                <div class="calendar-time-label"></div>
                <div class="calendar-time-label">7:00 AM</div>
                <div class="calendar-time-label">1:00 PM</div>
                <div class="calendar-time-label">4:00 PM</div>
                <div class="calendar-time-label">7:00 PM</div>
            </div>
            ${SCHEDULE.map((day, i) => `
                <div class="calendar-column${i === currentDayIndex ? ' current-day-column' : ''}">
                    <div class="calendar-day-header">Day ${i + 1}<br><span>${days[i]}</span></div>
                    <div class="${getCellClass(i, 'breakfast')}" data-meal-id="breakfast">Breakfast</div>
                    <div class="${getCellClass(i, 'lunch')}" data-meal-id="${day.lunch}">${getMealLabel(day.lunch, 'Lunch')}</div>
                    <div class="${getCellClass(i, 'snack')}" data-meal-id="${day.snack}">${getMealLabel(day.snack, 'Snack')}</div>
                    <div class="${getCellClass(i, 'dinner')}" data-meal-id="dinner">Dinner</div>
                </div>
            `).join('')}
            <div class="calendar-column cheat-column">
                <div class="calendar-day-header cheat-day">Cheat Day</div>
                <div class="calendar-cell cheat-cell">🎉</div>
                <div class="calendar-cell cheat-cell">🎉</div>
                <div class="calendar-cell cheat-cell">🎉</div>
                <div class="calendar-cell cheat-cell">🎉</div>
            </div>
        </div>
    `;

    scheduleCalendar.innerHTML = calendarHTML;
}

// Render both schedule views
function renderSchedule() {
    renderScheduleList();
    renderScheduleCalendar();
}

// Render menu cards
function renderMenuCards() {
    menuCards.innerHTML = '';

    Object.values(MEALS).forEach(meal => {
        const card = document.createElement('div');
        card.className = 'menu-card';
        card.dataset.mealId = meal.id;

        const typeClass = meal.type === 'Snack' ? 'snack' : '';

        card.innerHTML = `
            <span class="meal-type ${typeClass}">${meal.type}</span>
            <h3>${meal.name}</h3>
            <div class="macros">
                <span><span class="material-symbols-rounded">local_fire_department</span> ${meal.calories} kcal</span>
                <span><span class="material-symbols-rounded">fitness_center</span> ${meal.protein} g protein</span>
            </div>
        `;

        card.addEventListener('click', () => showMealDetail(meal.id));
        menuCards.appendChild(card);
    });
}

// Filter menu cards
function filterMenuCards(query) {
    const cards = menuCards.querySelectorAll('.menu-card');
    const lowerQuery = query.toLowerCase();

    cards.forEach(card => {
        const mealId = card.dataset.mealId;
        const meal = MEALS[mealId];
        const searchText = `${meal.name} ${meal.type}`.toLowerCase();

        if (searchText.includes(lowerQuery)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

// Show meal detail
function showMealDetail(mealId) {
    const meal = MEALS[mealId];
    
    // Build alternate instructions section if available (e.g., frozen salmon)
    let instructionsSection = '';
    if (meal.frozenInstructions) {
        instructionsSection = `
            <div class="detail-section">
                <h2><span class="material-symbols-rounded">menu_book</span> Cooking Instructions</h2>
                <div class="cooking-method-toggle">
                    <button class="method-btn active" data-method="fresh">
                        <span class="material-symbols-rounded">ac_unit</span>
                        Fresh/Thawed Salmon
                    </button>
                    <button class="method-btn" data-method="frozen">
                        <span class="material-symbols-rounded">severe_cold</span>
                        Frozen Salmon
                    </button>
                </div>
                ${meal.frozenNote ? `<p class="frozen-note hidden" id="frozen-note"><span class="material-symbols-rounded">info</span> ${meal.frozenNote}</p>` : ''}
                <ol class="instructions-list" id="instructions-fresh">
                    ${meal.instructions.map(step => `<li>${step}</li>`).join('')}
                </ol>
                <ol class="instructions-list hidden" id="instructions-frozen">
                    ${meal.frozenInstructions.map(step => `<li>${step}</li>`).join('')}
                </ol>
            </div>
        `;
    } else {
        instructionsSection = `
            <div class="detail-section">
                <h2><span class="material-symbols-rounded">menu_book</span> Cooking Instructions</h2>
                <ol class="instructions-list">
                    ${meal.instructions.map(step => `<li>${step}</li>`).join('')}
                </ol>
            </div>
        `;
    }

    mealDetailContent.innerHTML = `
        <h1>${meal.name}</h1>
        <span class="meal-type ${meal.type === 'Snack' ? 'snack' : ''}" style="display: inline-block; margin-bottom: 1.5rem;">${meal.type}</span>
        
        <div class="detail-section">
            <h2><span class="material-symbols-rounded">monitoring</span> Nutrition Information</h2>
            <div class="nutrition-grid">
                <div class="nutrition-item">
                    <div class="value">${meal.calories}</div>
                    <div class="label">Calories (kcal)</div>
                </div>
                <div class="nutrition-item">
                    <div class="value">${meal.protein}</div>
                    <div class="label">Protein (g)</div>
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <h2><span class="material-symbols-rounded">grocery</span> Ingredients</h2>
            <ul class="ingredients-list">
                ${meal.ingredients.map(ing => `
                    <li>
                        <span class="ingredient-name">${ing.name}</span>
                        <span class="ingredient-amount">${ing.amount}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
        
        ${instructionsSection}
    `;
    
    // Add event listeners for cooking method toggle if present
    if (meal.frozenInstructions) {
        const methodBtns = mealDetailContent.querySelectorAll('.method-btn');
        methodBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const method = btn.dataset.method;
                
                // Update active button
                methodBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Toggle instructions visibility
                const freshInstructions = document.getElementById('instructions-fresh');
                const frozenInstructions = document.getElementById('instructions-frozen');
                const frozenNote = document.getElementById('frozen-note');
                
                if (method === 'frozen') {
                    freshInstructions.classList.add('hidden');
                    frozenInstructions.classList.remove('hidden');
                    if (frozenNote) frozenNote.classList.remove('hidden');
                } else {
                    freshInstructions.classList.remove('hidden');
                    frozenInstructions.classList.add('hidden');
                    if (frozenNote) frozenNote.classList.add('hidden');
                }
            });
        });
    }

    document.getElementById('menu-tab').classList.remove('active');
    mealDetail.classList.add('active');
}

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', init);
