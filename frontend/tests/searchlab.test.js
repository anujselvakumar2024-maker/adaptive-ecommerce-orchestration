import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOCK_PRODUCTS, formatINR, getProductsByCategory, getProductById } from '../src/data/mockProducts.js';
import { CATEGORIES, getCategoryById } from '../src/data/categories.js';
import {
  parseQueryConstraints,
  evaluateGeneralSearchCandidates,
  runBaselineSearch,
  runOptimizedSearch,
  runOrchestratedSearch,
  executeThreeWayComparison,
} from '../src/services/searchService.js';
import {
  sessionReducer,
  createInitialSessionState,
  createAssignment,
  ALL_PERMUTATIONS,
  CONDITION_RATING_KEYS,
  assignParticipantTaskType,
  pickRandomSpecificScenario,
  loadSavedState,
  STORAGE_KEY,
} from '../src/hooks/useExperimentSession.js';
import {
  submitFeedbackPayload,
  getDemoFeedbackLog,
  resolveApiBaseUrl,
  PRODUCTION_API_BASE_URL,
  DEVELOPMENT_API_BASE_URL,
  getApiBaseUrl,
  getAdapterStatus,
  getExperimentCsvExportUrl,
  checkBackendHealth,
} from '../src/services/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Catalog integrity & duplicate SKU check: all products have unique IDs, unique SKUs, and valid categories', () => {
  assert.ok(MOCK_PRODUCTS.length >= 16, 'Catalog should contain realistic sample items');
  const validCategories = new Set(CATEGORIES.map((c) => c.id));
  const seenIds = new Set();
  const seenSkus = new Set();

  for (const p of MOCK_PRODUCTS) {
    assert.ok(p.id && p.sku && p.name && p.brand, `Missing core identity fields on ${p.id}`);
    assert.ok(!seenIds.has(p.id), `Duplicate product ID detected: ${p.id}`);
    assert.ok(!seenSkus.has(p.sku), `Duplicate product SKU detected: ${p.sku}`);
    seenIds.add(p.id);
    seenSkus.add(p.sku);

    assert.ok(validCategories.has(p.category), `Invalid category ${p.category} on ${p.id}`);
    assert.equal(typeof p.price, 'number', `Price must be numeric on ${p.id}`);
    assert.ok(formatINR(p.price).startsWith('₹'), 'INR formatting must start with ₹');
  }
});

test('Category isolation across all 4 categories: searches never leak products from other categories', async () => {
  for (const catObj of CATEGORIES) {
    const categoryId = catObj.id;
    const target = getProductById(catObj.defaultTargetId);
    const query = catObj.suggestedQueries[0];
    const comparison = await executeThreeWayComparison({
      query,
      category: categoryId,
      targetProduct: target,
      selectedAttributes: catObj.defaultAttributes,
      searchType: 'general',
    });

    for (const condKey of ['baseline', 'optimized', 'orchestrated']) {
      const cond = comparison.byCondition[condKey];
      assert.ok(cond.results.length > 0, `${condKey} should return results for ${categoryId}`);
      for (const item of cond.results) {
        assert.equal(
          item.product.category,
          categoryId,
          `${condKey} in category ${categoryId} returned foreign product: ${item.product.name} (${item.product.category})`
        );
      }
    }
  }
});

test('Constraint parser extracts color, budget, capacity, and handles non-price numeric ranges (e.g., 2-3 people, 5-in-1)', () => {
  const parsed1 = parseQueryConstraints(
    'Samsung double door white frost free 458L under 80000',
    'refrigerator'
  );
  assert.equal(parsed1.parsedColor, 'White');
  assert.ok(parsed1.parsedBrands.includes('Samsung'));
  assert.equal(parsed1.parsedBudget.max, 80000);
  assert.ok(parsed1.constraintCount >= 4);
  assert.equal(parsed1.hasContradictions, false);

  // Regression test for Bug #3: "2-3 people" or "5-in-1" must not block "under ₹80,000" or "within my budget"
  const parsedWithSmallRangeAndUnder = parseQueryConstraints(
    '5-in-1 convertible refrigerator for 2-3 people under ₹78,000',
    'refrigerator'
  );
  assert.ok(parsedWithSmallRangeAndUnder.parsedBudget, 'Budget should be extracted despite 5-in-1 and 2-3 people');
  assert.equal(parsedWithSmallRangeAndUnder.parsedBudget.max, 78000);

  const parsedWithSmallRangeAndGenericBudget = parseQueryConstraints(
    'White fridge for 2-3 members within my budget',
    'refrigerator',
    { minPrice: 15000, maxPrice: 75000 }
  );
  assert.ok(parsedWithSmallRangeAndGenericBudget.parsedBudget, 'Generic budget phrase should resolve when preceded by 2-3 members');
  assert.equal(parsedWithSmallRangeAndGenericBudget.parsedBudget.max, 75000);
});

test('Contradictory constraints are detected in natural-language queries and General Search attributes', () => {
  // 1. Inverted price range in query
  const invertedBudget = parseQueryConstraints(
    'Samsung refrigerator between ₹80,000 and ₹30,000',
    'refrigerator'
  );
  assert.equal(invertedBudget.hasContradictions, true);
  assert.ok(
    invertedBudget.contradictions.some((c) => c.includes('exceeds maximum')),
    'Should flag inverted price range in query'
  );

  // 2. Conflicting door configuration & frost modes
  const conflictingSpecs = parseQueryConstraints(
    'Single door double door refrigerator with frost free direct cool',
    'refrigerator'
  );
  assert.equal(conflictingSpecs.hasContradictions, true);
  assert.ok(conflictingSpecs.contradictions.length >= 2, 'Should flag both door and cooling contradictions');

  // 3. Impossible capacity vs budget (>400L under ₹25,000)
  const impossibleCombo = parseQueryConstraints(
    '458L frost free refrigerator under ₹15,000',
    'refrigerator'
  );
  assert.equal(impossibleCombo.hasContradictions, true);
  assert.ok(
    impossibleCombo.contradictions.some((c) => c.includes('458L capacity')),
    'Should flag 458L under ₹15,000 contradiction'
  );

  // 4. Inverted budget in General Search attribute configuration
  const evalInverted = evaluateGeneralSearchCandidates('refrigerator', {
    minPrice: 60000,
    maxPrice: 20000,
    color: 'White',
    primarySpec: '400 – 500 L',
    brands: ['Samsung'],
  });
  assert.equal(evalInverted.isBudgetInverted, true);
  assert.equal(evalInverted.exactMatches.length, 0);
  assert.ok(
    evalInverted.allEvaluated[0].relaxedConstraints.some((r) => r.includes('Contradictory budget range')),
    'General search should explicitly record contradictory min > max budget'
  );
});

test('Empty queries and unmatched product queries return 0 scores and null targetRank (no fabricated hits)', async () => {
  const target = getProductById('ref-sam-458');

  // Empty / whitespace query
  const emptyComparison = await executeThreeWayComparison({
    query: '   ',
    category: 'refrigerator',
    targetProduct: target,
    selectedAttributes: getCategoryById('refrigerator').defaultAttributes,
    searchType: 'specific',
  });

  for (const condKey of ['baseline', 'optimized', 'orchestrated']) {
    const cond = emptyComparison.byCondition[condKey];
    assert.equal(cond.metrics.targetRank, null, `${condKey} targetRank must be null for empty query`);
    assert.equal(cond.metrics.reciprocalRank, 0, `${condKey} MRR must be 0 for empty query`);
    assert.equal(cond.metrics.attributeMatchRate, 0, `${condKey} attributeMatchRate must be 0 for empty query`);
    for (const r of cond.results) {
      assert.equal(r.score, 0, `${condKey} item score must be 0 for empty query`);
    }
  }

  // Unmatched gibberish / out-of-domain query in Specific Product mode
  const unmatchedComparison = await executeThreeWayComparison({
    query: 'quantum ultrasonic dishwasher toaster xyz999',
    category: 'refrigerator',
    targetProduct: target,
    selectedAttributes: getCategoryById('refrigerator').defaultAttributes,
    searchType: 'specific',
  });

  for (const condKey of ['baseline', 'optimized', 'orchestrated']) {
    const cond = unmatchedComparison.byCondition[condKey];
    assert.equal(cond.metrics.targetRank, null, `${condKey} targetRank must be null when no product matches query`);
    assert.equal(cond.metrics.reciprocalRank, 0, `${condKey} MRR must be 0 when no product matches query`);
    assert.equal(cond.metrics.attributeMatchRate, 0, `${condKey} attributeMatchRate must be 0 when no product matches query`);
    for (const r of cond.results) {
      assert.equal(r.score, 0, `${condKey} item score must be 0 when no product matches query`);
    }
  }
});

test('Whole-word boundary matching prevents false substring matches (e.g., "ai" inside "stainless")', async () => {
  const target = getProductById('ref-sam-458');
  const baseline = await runBaselineSearch({
    query: 'ai',
    category: 'refrigerator',
    targetProduct: target,
  });

  // Only Samsung Bespoke 458L has "AI" as a standalone word ("AI Energy Mode"); stainless steel models must not match "ai"
  const matchedIds = baseline.results.filter((r) => r.score > 0).map((r) => r.product.id);
  assert.deepEqual(matchedIds, ['ref-sam-458'], 'Only ref-sam-458 contains standalone word "AI"');
});

test('No ground-truth target leakage: querying for LG 242L while target is Samsung 458L ranks LG #1 across all pipelines', async () => {
  const targetSamsung = getProductById('ref-sam-458');
  const queryForLG = 'LG 242L shiny steel double door refrigerator under ₹30,000';

  const comparison = await executeThreeWayComparison({
    query: queryForLG,
    category: 'refrigerator',
    targetProduct: targetSamsung,
    selectedAttributes: getCategoryById('refrigerator').defaultAttributes,
    searchType: 'specific',
  });

  for (const condKey of ['baseline', 'optimized', 'orchestrated']) {
    const topProduct = comparison.byCondition[condKey].results[0].product;
    assert.equal(
      topProduct.id,
      'ref-lg-242',
      `${condKey} must rank the queried LG 242L #1 without leaking ground-truth targetProduct (Samsung 458L)`
    );
  }
});

test('General search candidate evaluation flags relaxed constraints when target violates budget', () => {
  const evalResult = evaluateGeneralSearchCandidates('refrigerator', {
    minPrice: 10000,
    maxPrice: 20000,
    color: 'White',
    primarySpec: '200 – 300 L',
    brands: ['Samsung', 'LG'],
    secondarySpec: '3 Star & Above',
    tertiarySpec: 'Small Family (2–3 members)',
  });

  assert.ok(evalResult.exactMatches.length >= 2, 'Should find exact matches in ₹10k-₹20k');
  const bespokeEntry = evalResult.allEvaluated.find((e) => e.product.id === 'ref-sam-458');
  assert.ok(bespokeEntry, 'Bespoke 458L should be evaluated');
  assert.equal(bespokeEntry.isExactMatch, false);
  assert.ok(
    bespokeEntry.relaxedConstraints.some((r) => r.includes('exceeds max budget')),
    'Should explicitly flag budget violation for ₹74,990 refrigerator against ₹20,000 max'
  );
});

test('Three search conditions operate as distinct service interfaces and rank target accurately on realistic query', async () => {
  const target = getProductById('ref-sam-458');
  const query = 'Find me a reliable white refrigerator for a small family within my budget';
  const selectedAttributes = { color: 'White', minPrice: 10000, maxPrice: 80000 };
  const parsedConstraints = parseQueryConstraints(query, 'refrigerator', selectedAttributes);

  const baseline = await runBaselineSearch({ query, category: 'refrigerator', targetProduct: target });
  const optimized = await runOptimizedSearch({
    query,
    category: 'refrigerator',
    targetProduct: target,
    parsedConstraints,
  });
  const orchestrated = await runOrchestratedSearch({
    query,
    category: 'refrigerator',
    targetProduct: target,
    parsedConstraints,
    selectedAttributes,
    searchType: 'general',
  });

  assert.equal(baseline.conditionId, 'baseline');
  assert.equal(optimized.conditionId, 'optimized');
  assert.equal(orchestrated.conditionId, 'orchestrated');
  assert.equal(orchestrated.metrics.targetRank, 1, 'Orchestrated search should rank target #1');
  assert.ok(
    orchestrated.metrics.targetRank <= baseline.metrics.targetRank,
    'Orchestrated search should rank target at least as well as baseline'
  );
});

test('Fixed per-session column blinding covers all 6 permutations, preserves assignment across reloads, and exposes no participant shuffle button', async () => {
  assert.equal(ALL_PERMUTATIONS.length, 6, 'Must define all 6 permutations of the 3 conditions');

  const observedPermutations = new Set();
  for (let i = 0; i < 6; i++) {
    const assignment = createAssignment(true, () => (i + 0.1) / 6);
    assert.equal(assignment.randomized, true);
    const ids = assignment.columns.map((c) => c.conditionId);
    assert.deepEqual([...ids].sort(), ['baseline', 'optimized', 'orchestrated']);
    observedPermutations.add(ids.join(','));
  }
  assert.equal(observedPermutations.size, 6, 'All 6 permutations in ALL_PERMUTATIONS must be reachable');

  // Verify session state preserves the same experimentAssignment across reload without reshuffling
  const sessionStore = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (k) => (sessionStore.has(k) ? sessionStore.get(k) : null),
      setItem: (k, v) => sessionStore.set(k, String(v)),
      removeItem: (k) => sessionStore.delete(k),
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
  };

  let state = createInitialSessionState();
  const originalColumns = state.experimentAssignment.columns.map((c) => c.conditionId);
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  const reloaded = loadSavedState();
  assert.deepEqual(
    reloaded.experimentAssignment.columns.map((c) => c.conditionId),
    originalColumns,
    'experimentAssignment must remain fixed across session reloads'
  );

  // Verify per-system ratings store all 4 required dimensions under both condition_ratings and ratings
  for (const condId of ['baseline', 'optimized', 'orchestrated']) {
    for (const metricKey of CONDITION_RATING_KEYS) {
      state = sessionReducer(state, {
        type: 'UPDATE_CONDITION_RATING',
        payload: { conditionId: condId, metricKey, value: 4 },
      });
      assert.equal(state.feedback.condition_ratings[condId][metricKey], 4);
      assert.equal(state.feedback.ratings[condId][metricKey], 4);
    }
  }

  // Verify ComparisonPage.jsx has no participant-facing Randomize Columns control
  const comparisonSource = fs.readFileSync(
    path.join(__dirname, '../src/pages/ComparisonPage.jsx'),
    'utf8'
  );
  assert.equal(
    comparisonSource.includes('Randomize Columns'),
    false,
    'ComparisonPage.jsx must not render a Randomize Columns button'
  );

  delete globalThis.window;
});

test('Participant task assignment supports 50/50 specific vs general tasks, never prefills reference_query, and preserves 5-point Likert wording', () => {
  // 1. 50/50 assignment function can produce both specific and general
  assert.equal(assignParticipantTaskType(() => 0.2), 'specific');
  assert.equal(assignParticipantTaskType(() => 0.8), 'general');

  // 2. Specific session starts with empty userQuery, valid activeScenario with target_product_title, and never prefills reference_query
  const specificState = createInitialSessionState({ taskType: 'specific' });
  assert.equal(specificState.searchType, 'specific');
  assert.equal(specificState.userQuery, '', 'Specific task must start with an empty userQuery');
  assert.ok(specificState.activeScenario, 'Specific task must have an activeScenario');
  assert.ok(
    specificState.activeScenario.target_product_title,
    'Specific task activeScenario must include target_product_title'
  );

  const selectedScenarioState = sessionReducer(specificState, {
    type: 'SELECT_SCENARIO',
    payload: {
      id: 'spec_test_1',
      type: 'specific',
      category: 'phone',
      title: 'Specific Phone Target',
      description: 'Find this specific phone',
      target_product_id: 'B0TEST123',
      target_product_title: 'Samsung Galaxy S23 Ultra 5G',
      target_brand: 'Samsung',
      reference_query: 'samsung galaxy s23 ultra 5g phantom black',
    },
  });
  assert.equal(
    selectedScenarioState.userQuery,
    '',
    'Selecting a specific scenario must never prefill reference_query into userQuery'
  );

  // 3. General session uses SET_DYNAMIC_SPECIFICATION to create a general hidden target
  const generalState = createInitialSessionState({ taskType: 'general' });
  assert.equal(generalState.searchType, 'general');
  const afterSpec = sessionReducer(generalState, {
    type: 'SET_DYNAMIC_SPECIFICATION',
    payload: {
      category: 'laptop',
      constraints: { brand: 'Dell', ram_gb: 16, max_price: 85000 },
      title: 'Custom Laptop Target',
      description: 'Participants must retrieve a laptop matching: Brand: Dell · 16GB RAM.',
    },
  });
  assert.equal(afterSpec.searchType, 'general');
  assert.equal(afterSpec.category, 'laptop');
  assert.deepEqual(afterSpec.hiddenTargetConstraints, { brand: 'Dell', ram_gb: 16, max_price: 85000 });
  assert.equal(afterSpec.userQuery, '');

  // 4. Verify FeedbackPage.jsx has the updated repeat_purchase_intention question and 1-5 endpoints
  const feedbackSource = fs.readFileSync(
    path.join(__dirname, '../src/pages/FeedbackPage.jsx'),
    'utf8'
  );
  assert.ok(
    feedbackSource.includes(
      'If you needed another product in the future, how likely would you be to make another purchase through this platform?'
    ),
    'FeedbackPage.jsx must include the exact repeat_purchase_intention question'
  );
  assert.ok(
    feedbackSource.includes("lowLabel: '1 — Very Unlikely'") &&
      feedbackSource.includes("highLabel: '5 — Very Likely'"),
    'FeedbackPage.jsx must use 1 — Very Unlikely and 5 — Very Likely endpoints for repeat_purchase_intention'
  );
});

test('Session state persistence, cross-category target selection, and full session reset work cleanly', () => {
  // Mock window.sessionStorage and window.localStorage in Node environment
  const sessionStore = new Map();
  const localStore = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (k) => (sessionStore.has(k) ? sessionStore.get(k) : null),
      setItem: (k, v) => sessionStore.set(k, String(v)),
      removeItem: (k) => sessionStore.delete(k),
    },
    localStorage: {
      getItem: (k) => (localStore.has(k) ? localStore.get(k) : null),
      setItem: (k, v) => localStore.set(k, String(v)),
      removeItem: (k) => localStore.delete(k),
    },
  };

  let state = createInitialSessionState({ taskType: 'specific' });
  // Select a laptop from Specific Product catalog
  const macbook = getProductById('lap-apl-mba15');
  state = sessionReducer(state, {
    type: 'SET_TARGET_PRODUCT',
    payload: { product: macbook, relaxedConstraints: [] },
  });

  assert.equal(state.category, 'laptop', 'Category should update to laptop');
  assert.equal(
    state.selectedAttributes.primarySpec,
    getCategoryById('laptop').defaultAttributes.primarySpec,
    'Selected attributes should sync to laptop defaults when switching category via product selection'
  );

  // Grant consent and verify task type is preserved
  state = sessionReducer(state, { type: 'GRANT_CONSENT' });
  assert.equal(state.searchType, 'specific');

  // Persist to sessionStorage and reload
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const reloaded = loadSavedState();
  assert.equal(reloaded.selectedTargetProduct.id, 'lap-apl-mba15');
  assert.equal(reloaded.category, 'laptop');
  assert.equal(reloaded.searchType, 'specific');

  // Reset session and confirm fresh state
  const resetState = sessionReducer(reloaded, {
    type: 'RESET_SESSION',
    payload: { preserveDefaultId: false },
  });
  assert.ok(['specific', 'general'].includes(resetState.searchType));
  assert.equal(resetState.userQuery, '');
  assert.equal(resetState.searchResults, null);
  assert.notEqual(resetState.sessionId, '#SL-8821');

  delete globalThis.window;
});

test('Feedback submission adapter stores records in localStorage in demo mode without fabricating missing ratings', async () => {
  const localStore = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (localStore.has(k) ? localStore.get(k) : null),
      setItem: (k, v) => localStore.set(k, String(v)),
      removeItem: (k) => localStore.delete(k),
    },
  };

  const response = await submitFeedbackPayload({
    sessionId: '#SL-TEST',
    category: 'refrigerator',
    targetProduct: { id: 'ref-sam-458', sku: 'RF458BESP-WH' },
    userQuery: 'white fridge under 80000',
  });

  assert.ok(response.recordedAt, 'Should include ISO timestamp');
  assert.equal(response.adapterMode, 'demo');
  assert.equal(response.status, 'recorded_locally');

  const log = getDemoFeedbackLog();
  assert.equal(log.length, 1);
  assert.equal(log[0].sessionId, '#SL-TEST');
  assert.equal(log[0].targetProduct.sku, 'RF458BESP-WH');

  delete globalThis.window;
});

test('API base URL resolution uses Render in production, localhost in development, and preserves baseUrl on health checks', async () => {
  assert.equal(
    resolveApiBaseUrl({ PROD: true, MODE: 'production' }),
    PRODUCTION_API_BASE_URL,
    'Production builds without VITE_API_BASE_URL must resolve to the Render production URL'
  );
  assert.equal(
    resolveApiBaseUrl({ PROD: true, VITE_API_BASE_URL: '   ' }),
    PRODUCTION_API_BASE_URL,
    'Blank VITE_API_BASE_URL in production must fall back to Render production URL'
  );
  assert.equal(
    resolveApiBaseUrl({ PROD: false, MODE: 'development' }),
    DEVELOPMENT_API_BASE_URL,
    'Local development without VITE_API_BASE_URL must resolve to http://localhost:8000'
  );
  assert.equal(
    resolveApiBaseUrl({
      PROD: true,
      VITE_API_BASE_URL: 'https://adaptive-ecommerce-orchestration.onrender.com///',
    }),
    'https://adaptive-ecommerce-orchestration.onrender.com',
    'Trailing slashes must be stripped from VITE_API_BASE_URL'
  );

  assert.equal(
    getAdapterStatus().baseUrl,
    getApiBaseUrl(),
    'Adapter status must report the shared resolved API base URL'
  );
  assert.equal(
    getExperimentCsvExportUrl(),
    `${getApiBaseUrl()}/experiments/export.csv`,
    'CSV export endpoint must use the shared resolved API base URL'
  );

  // Verify failed health check preserves getApiBaseUrl() and never resets to localhost
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    requestedUrls.push(url);
    throw new Error('Simulated network timeout');
  };
  try {
    const health = await checkBackendHealth({ retryOnColdStart: false });
    assert.equal(health.connected, false);
    assert.equal(health.baseUrl, getApiBaseUrl());
    assert.deepEqual(requestedUrls, [`${getApiBaseUrl()}/health`]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
