import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import { normalizeCategoryId, getCategoryById } from '../data/categories.js';
import {
  checkBackendHealth,
  fetchScenarios,
  executeControlledComparison,
  upsertExperimentSession,
  logExperimentTask,
  submitExperimentQuestionnaire,
  getApiBaseUrl,
} from '../services/api.js';

export const STORAGE_KEY = 'searchlab_experiment_session_v3';

export const ALL_PERMUTATIONS = [
  ['baseline', 'optimized', 'orchestrated'],
  ['baseline', 'orchestrated', 'optimized'],
  ['optimized', 'baseline', 'orchestrated'],
  ['optimized', 'orchestrated', 'baseline'],
  ['orchestrated', 'baseline', 'optimized'],
  ['orchestrated', 'optimized', 'baseline'],
];

export const CONDITION_RATING_KEYS = [
  'overallSatisfaction',
  'perceivedRelevance',
  'easeOfFinding',
  'returnIntention',
];

const LIKERT_FIELD_KEYS = [
  'overall_satisfaction',
  'perceived_relevance',
  'ease_of_finding',
  'perceived_usefulness',
  'perceived_diversity',
  'product_confidence',
  'purchase_intention',
  'return_intention',
  'repeat_purchase_intention',
];

const FALLBACK_SPECIFIC_SCENARIOS = [
  {
    id: 'phone_normal',
    search_type: 'specific',
    category: 'phone',
    scenario_type: 'normal',
    target_product_id: 'B079MBRDNN',
    target_product_title:
      'NUU Mobile G3-64GB/4GB RAM - 13MP+5MP Rear Camera, 13MP Front Selfie Camera - Dual-SIM 4G LTE Unlocked Cell Phone- Blue-One-Year US Warranty',
    target_brand: 'NUU',
  },
  {
    id: 'phone_partner_recovery',
    search_type: 'specific',
    category: 'phone',
    scenario_type: 'partner_recovery',
    target_product_id: 'B07KCHYJ8H',
    target_product_title:
      'NUU Mobile G3 Plus Unlocked Cell Phone 64GB + 4GB RAM 4000 mAh Battery - 5.7" Android 8.1 Oreo Smartphone - Onyx Black',
    target_brand: 'NUU',
  },
  {
    id: 'phone_substitute_only',
    search_type: 'specific',
    category: 'phone',
    scenario_type: 'substitute_only',
    target_product_id: 'B07VQMRB6S',
    target_product_title:
      'NUU Mobile A6L-G Unlocked 5.0" Single SIM 4G LTE GSM Android Smartphone',
    target_brand: 'NUU',
  },
  {
    id: 'laptop_normal',
    search_type: 'specific',
    category: 'laptop',
    scenario_type: 'normal',
    target_product_id: 'B087YVDX4L',
    target_product_title:
      'HP High Performance 15.6" Touch-Screen Laptop (15-EF0023dx) AMD Ryzen 5 3500U 12GB Memory 256GB SSD - Natural Silver',
    target_brand: 'HP',
  },
  {
    id: 'laptop_partner_recovery',
    search_type: 'specific',
    category: 'laptop',
    scenario_type: 'partner_recovery',
    target_product_id: 'B083CYM3TZ',
    target_product_title:
      '2020 HP Pavilion Newest 14 Inch Laptop, 10th Gen Intel 4-Core i5-1035G1 up to 3.6GHz, Intel UHD Graphics, 8GB DDR4 RAM, 256GB SSD, WiFi, Bluetooth, HDMI, Webcam, Windows 10 Home, Gold',
    target_brand: 'HP',
  },
  {
    id: 'laptop_substitute_only',
    search_type: 'specific',
    category: 'laptop',
    scenario_type: 'substitute_only',
    target_product_id: 'B07BBKK2JJ',
    target_product_title:
      'Lenovo ThinkPad P52s 20LB0028US Laptop (Windows 10 Pro, Intel Core i7-8550U, 15.6" LED-Lit Screen, Storage: 512 GB, RAM: 16 GB) Black',
    target_brand: 'Lenovo',
  },
  {
    id: 'watch_normal',
    search_type: 'specific',
    category: 'watch',
    scenario_type: 'normal',
    target_product_id: 'B076KDX36S',
    target_product_title:
      "GUESS Women's Stainless Steel Android Wear Touch Screen Silicone Smart Watch, Color: Blue (Model: C1002M2)",
    target_brand: 'GUESS',
  },
  {
    id: 'watch_partner_recovery',
    search_type: 'specific',
    category: 'watch',
    scenario_type: 'partner_recovery',
    target_product_id: 'B07W7YBBVQ',
    target_product_title:
      'Amazfit GTS Fitness Smartwatch with Heart Rate Monitor, 14-Day Battery Life, Music Control, 1.65" Display, Sleep and Swim Tracking, GPS, Water Resistant, Smart Notifications, Desert Gold',
    target_brand: 'Amazfit',
  },
  {
    id: 'watch_substitute_only',
    search_type: 'specific',
    category: 'watch',
    scenario_type: 'substitute_only',
    target_product_id: 'B08CML75PC',
    target_product_title:
      'Fitness Tracker Watch Smart Watch for Android Phones Fitness Watches for Men Women Sports Activity Tracker Smartwatch Compatible with iOS with Pedometer with Heart Rate',
    target_brand: 'BAUISAN',
  },
  {
    id: 'refrigerator_normal',
    search_type: 'specific',
    category: 'refrigerator',
    scenario_type: 'normal',
    target_product_id: 'B06XW9JS57',
    target_product_title:
      'SMETA 12V Volt Refrigerator 110V Compact Refrigerator Freightliner Cascadia Refrigerator Semi Truck Mini Fridge Upright Freezers RV Can Cooler Camper, 36 qt',
    target_brand: 'SMETA',
  },
  {
    id: 'refrigerator_partner_recovery',
    search_type: 'specific',
    category: 'refrigerator',
    scenario_type: 'partner_recovery',
    target_product_id: 'B00MMRFQR6',
    target_product_title:
      'Midea WHS-87LSS1 Refrigerator, 2.4 Cubic Feet, Stainless Steel',
    target_brand: 'Midea',
  },
  {
    id: 'refrigerator_substitute_only',
    search_type: 'specific',
    category: 'refrigerator',
    scenario_type: 'substitute_only',
    target_product_id: 'B000WCVV4A',
    target_product_title: '3.2 Cubic Foot Refrigerator Freezer',
    target_brand: 'RCA',
  },
];

export function assignParticipantTaskType(rng = Math.random) {
  return rng() < 0.5 ? 'specific' : 'general';
}

export function pickRandomSpecificScenario(pool = FALLBACK_SPECIFIC_SCENARIOS, rng = Math.random) {
  const validPool =
    Array.isArray(pool) && pool.length > 0 ? pool : FALLBACK_SPECIFIC_SCENARIOS;
  const idx = Math.floor(rng() * validPool.length);
  return validPool[Math.max(0, Math.min(validPool.length - 1, idx))];
}

export function createAssignment(randomize = true, rng = Math.random) {
  const ordered = randomize
    ? ALL_PERMUTATIONS[Math.floor(rng() * ALL_PERMUTATIONS.length)]
    : ALL_PERMUTATIONS[0];

  const labels = ['Search Experience A', 'Search Experience B', 'Search Experience C'];
  const codes = ['exp_a', 'exp_b', 'exp_c'];
  const variants = ['System A', 'System B', 'System C'];

  return {
    randomized: randomize,
    blindedMode: true, // Always blinded for participants to prevent bias
    columns: ordered.map((condId, idx) => ({
      displayLabel: labels[idx],
      shortCode: codes[idx],
      variantLabel: variants[idx],
      conditionId: condId,
    })),
  };
}

export function createInitialFeedback() {
  const initialConditionRatings = {
    baseline: {
      overallSatisfaction: null,
      perceivedRelevance: null,
      easeOfFinding: null,
      returnIntention: null,
    },
    optimized: {
      overallSatisfaction: null,
      perceivedRelevance: null,
      easeOfFinding: null,
      returnIntention: null,
    },
    orchestrated: {
      overallSatisfaction: null,
      perceivedRelevance: null,
      easeOfFinding: null,
      returnIntention: null,
    },
  };

  return {
    overall_satisfaction: null,
    perceived_relevance: null,
    ease_of_finding: null,
    perceived_usefulness: null,
    perceived_diversity: null,
    product_confidence: null,
    purchase_intention: null,
    return_intention: null,
    repeat_purchase_intention: null,
    target_retrieval_outcome: '', // 'exact' | 'alternative' | 'none'
    preferred_condition: '', // 'baseline' | 'optimized' | 'orchestrated' | 'no_preference'
    condition_ratings: initialConditionRatings,
    ratings: initialConditionRatings,
    comments: '',
    submitted: false,
    submittedAt: null,
    submissionId: null,
  };
}

function generateSessionId() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `SL-2026-${num}`;
}

export function createInitialSessionState(optionsOrSessionId = null, initialSearchType = null) {
  const customSessionId =
    optionsOrSessionId && typeof optionsOrSessionId === 'object'
      ? optionsOrSessionId.sessionId || null
      : optionsOrSessionId;
  const requestedType =
    optionsOrSessionId && typeof optionsOrSessionId === 'object'
      ? optionsOrSessionId.taskType || optionsOrSessionId.searchType || initialSearchType
      : initialSearchType;
  const assignedType =
    requestedType === 'specific' || requestedType === 'general'
      ? requestedType
      : assignParticipantTaskType();

  const initialSpecificScenario =
    assignedType === 'specific' ? pickRandomSpecificScenario() : null;
  const initialCat = initialSpecificScenario
    ? normalizeCategoryId(initialSpecificScenario.category)
    : 'refrigerator';
  const catObj = getCategoryById(initialCat);

  return {
    sessionId: customSessionId || generateSessionId(),
    consentGiven: false,
    consentTimestamp: null,
    taskTypeAssigned: true,
    searchType: assignedType, // 'specific' | 'general'
    category: initialCat, // 'phone' | 'laptop' | 'watch' | 'refrigerator'
    activeScenario: initialSpecificScenario,
    hiddenTargetProductId: initialSpecificScenario
      ? initialSpecificScenario.target_product_id
      : 'ref-sam-458',
    hiddenTargetConstraints: null, // Private for general task /evaluate
    selectedTargetProduct: {
      id: 'ref-sam-458',
      sku: 'RF45B9011-BESPOKE',
      name: 'Samsung 458 L Bespoke AI Frost-Free Double Door Refrigerator',
      category: 'refrigerator',
    },
    selectedAttributes: catObj?.defaultAttributes ? { ...catObj.defaultAttributes } : {},
    relaxedConstraints: [],
    userQuery: '', // Always starts empty — never prefilled with reference_query
    experimentAssignment: createAssignment(true),
    searchResults: null,
    evaluationMetrics: null,
    tasksLog: [],
    feedback: createInitialFeedback(),
    currentStep: 1,
  };
}

function isValidAssignment(assignment) {
  if (!assignment || !Array.isArray(assignment.columns) || assignment.columns.length !== 3) {
    return false;
  }
  const ids = assignment.columns.map((c) => c?.conditionId).sort();
  return (
    ids[0] === 'baseline' &&
    ids[1] === 'optimized' &&
    ids[2] === 'orchestrated'
  );
}

export function loadSavedState() {
  try {
    const store =
      typeof sessionStorage !== 'undefined'
        ? sessionStorage
        : typeof window !== 'undefined' && window.sessionStorage
        ? window.sessionStorage
        : null;
    if (!store) return createInitialSessionState();
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return createInitialSessionState();
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.sessionId) return createInitialSessionState();

    const savedSearchType =
      parsed.searchType === 'specific' || parsed.searchType === 'general'
        ? parsed.searchType
        : assignParticipantTaskType();

    const baseState = createInitialSessionState(parsed.sessionId, savedSearchType);
    const baseFeedback = createInitialFeedback();
    const parsedFeedback = parsed.feedback || {};
    const mergedConditionRatings = {
      baseline: {
        ...baseFeedback.condition_ratings.baseline,
        ...(parsedFeedback.condition_ratings?.baseline || parsedFeedback.ratings?.baseline || {}),
      },
      optimized: {
        ...baseFeedback.condition_ratings.optimized,
        ...(parsedFeedback.condition_ratings?.optimized || parsedFeedback.ratings?.optimized || {}),
      },
      orchestrated: {
        ...baseFeedback.condition_ratings.orchestrated,
        ...(parsedFeedback.condition_ratings?.orchestrated || parsedFeedback.ratings?.orchestrated || {}),
      },
    };

    return {
      ...baseState,
      ...parsed,
      searchType: savedSearchType,
      taskTypeAssigned: true,
      category: normalizeCategoryId(parsed.category || baseState.category),
      experimentAssignment: isValidAssignment(parsed.experimentAssignment)
        ? parsed.experimentAssignment
        : baseState.experimentAssignment,
      feedback: {
        ...baseFeedback,
        ...parsedFeedback,
        condition_ratings: mergedConditionRatings,
        ratings: mergedConditionRatings,
      },
    };
  } catch {
    return createInitialSessionState();
  }
}

export function sessionReducer(state, action) {
  switch (action.type) {
    case 'GRANT_CONSENT': {
      const payload =
        action.payload && typeof action.payload === 'object'
          ? action.payload
          : { timestamp: action.payload };
      const timestamp = payload.timestamp || new Date().toISOString();
      const lockedSearchType =
        state.taskTypeAssigned &&
        (state.searchType === 'specific' || state.searchType === 'general')
          ? state.searchType
          : payload.searchType === 'specific' || payload.searchType === 'general'
          ? payload.searchType
          : assignParticipantTaskType();

      let nextScenario = state.activeScenario;
      let nextCategory = state.category;
      let nextHiddenTargetId = state.hiddenTargetProductId;
      let nextHiddenConstraints = state.hiddenTargetConstraints;

      if (lockedSearchType === 'specific') {
        if (!nextScenario || nextScenario.search_type !== 'specific') {
          const pool =
            Array.isArray(payload.specificPool) && payload.specificPool.length > 0
              ? payload.specificPool
              : FALLBACK_SPECIFIC_SCENARIOS;
          nextScenario = pickRandomSpecificScenario(pool);
        }
        nextCategory = normalizeCategoryId(nextScenario.category);
        nextHiddenTargetId = nextScenario.target_product_id || null;
        nextHiddenConstraints = null;
      } else if (lockedSearchType === 'general') {
        if (nextScenario && nextScenario.search_type === 'specific') {
          nextScenario = null;
          nextHiddenTargetId = null;
        }
      }

      return {
        ...state,
        consentGiven: true,
        consentTimestamp: timestamp,
        taskTypeAssigned: true,
        searchType: lockedSearchType,
        category: nextCategory,
        activeScenario: nextScenario,
        hiddenTargetProductId: nextHiddenTargetId,
        hiddenTargetConstraints: nextHiddenConstraints,
      };
    }

    case 'SELECT_SCENARIO': {
      const scenario = action.payload;
      if (!scenario) return state;
      const nextSearchType = scenario.search_type === 'general' ? 'general' : 'specific';
      const nextCategory = normalizeCategoryId(scenario.category);
      const scenarioChanged = state.activeScenario?.id !== scenario.id;

      return {
        ...state,
        searchType: nextSearchType,
        taskTypeAssigned: true,
        category: nextCategory,
        activeScenario: scenario,
        hiddenTargetProductId:
          nextSearchType === 'specific' ? scenario.target_product_id || null : null,
        hiddenTargetConstraints:
          nextSearchType === 'general' ? scenario.target_constraints || null : null,
        // Never prefill reference_query; clear query when switching scenarios
        userQuery: scenarioChanged ? '' : state.userQuery,
        searchResults: scenarioChanged ? null : state.searchResults,
        evaluationMetrics: scenarioChanged ? null : state.evaluationMetrics,
        currentStep: Math.max(state.currentStep, 2),
      };
    }

    case 'SET_DYNAMIC_SPECIFICATION': {
      const spec = action.payload || {};
      const cat = normalizeCategoryId(spec.category || state.category);
      const targetConstraints =
        spec.constraints && typeof spec.constraints === 'object' ? spec.constraints : spec;
      const scenarioId = `dynamic_spec_${cat}_${Date.now()}`;
      const dynamicScenario = {
        id: scenarioId,
        search_type: 'general',
        category: cat,
        target_constraints: targetConstraints,
        title: spec.title || `Custom ${cat.charAt(0).toUpperCase() + cat.slice(1)} Specification`,
        isDynamic: true,
      };

      return {
        ...state,
        searchType: 'general',
        taskTypeAssigned: true,
        category: cat,
        activeScenario: dynamicScenario,
        hiddenTargetConstraints: targetConstraints,
        hiddenTargetProductId: null,
        userQuery: '',
        searchResults: null,
        evaluationMetrics: null,
        currentStep: Math.max(state.currentStep, 2),
      };
    }

    case 'SET_SEARCH_TYPE': {
      const nextType = action.payload === 'general' ? 'general' : 'specific';
      if (nextType === state.searchType) return state;
      const nextScenario =
        nextType === 'specific' ? pickRandomSpecificScenario() : null;
      const nextCat = nextScenario
        ? normalizeCategoryId(nextScenario.category)
        : state.category;
      return {
        ...state,
        searchType: nextType,
        taskTypeAssigned: true,
        category: nextCat,
        activeScenario: nextScenario,
        hiddenTargetProductId: nextScenario ? nextScenario.target_product_id : null,
        hiddenTargetConstraints: null,
        userQuery: '',
        searchResults: null,
        evaluationMetrics: null,
      };
    }

    case 'SET_CATEGORY': {
      const nextCategory = normalizeCategoryId(action.payload);
      return {
        ...state,
        category: nextCategory,
      };
    }

    case 'SET_USER_QUERY': {
      return {
        ...state,
        userQuery: String(action.payload ?? ''),
      };
    }

    case 'SET_SEARCH_RESULTS': {
      const payload = action.payload || {};
      const comparisonOutput = payload.comparisonOutput || payload;
      const taskRecord = payload.taskRecord || null;
      const nextTasksLog = taskRecord
        ? [...(state.tasksLog || []), taskRecord]
        : state.tasksLog || [];

      return {
        ...state,
        searchResults: comparisonOutput,
        evaluationMetrics: {
          baseline: comparisonOutput?.byCondition?.baseline?.evaluation || null,
          optimized: comparisonOutput?.byCondition?.optimized?.evaluation || null,
          orchestrated: comparisonOutput?.byCondition?.orchestrated?.evaluation || null,
        },
        tasksLog: nextTasksLog,
        currentStep: Math.max(state.currentStep, 4),
      };
    }

    case 'UPDATE_FEEDBACK_FIELD': {
      return {
        ...state,
        feedback: {
          ...state.feedback,
          ...action.payload,
        },
      };
    }

    case 'SET_TARGET_PRODUCT': {
      const product = action.payload?.product || action.payload;
      const nextCat = normalizeCategoryId(product?.category || state.category);
      const catObj = getCategoryById(nextCat);
      return {
        ...state,
        category: nextCat,
        selectedTargetProduct: product,
        hiddenTargetProductId: product?.id || null,
        activeScenario:
          state.activeScenario && state.activeScenario.category !== nextCat
            ? {
                ...state.activeScenario,
                category: nextCat,
                target_product_id: product?.id || state.activeScenario.target_product_id,
                target_product_title: product?.name || state.activeScenario.target_product_title,
                target_brand: product?.brand || state.activeScenario.target_brand,
              }
            : state.activeScenario,
        selectedAttributes: catObj?.defaultAttributes
          ? { ...catObj.defaultAttributes }
          : state.selectedAttributes,
        relaxedConstraints: action.payload?.relaxedConstraints || [],
      };
    }

    case 'UPDATE_CONDITION_RATING': {
      const { conditionId, metricKey, value } = action.payload;
      const updatedConditionRatings = {
        ...(state.feedback.condition_ratings || {}),
        [conditionId]: {
          ...(state.feedback.condition_ratings?.[conditionId] || {}),
          [metricKey]: value,
        },
      };
      return {
        ...state,
        feedback: {
          ...state.feedback,
          condition_ratings: updatedConditionRatings,
          ratings: updatedConditionRatings,
        },
      };
    }

    case 'MARK_FEEDBACK_SUBMITTED': {
      const { recordedAt, submissionId } = action.payload || {};
      return {
        ...state,
        feedback: {
          ...state.feedback,
          submitted: true,
          submittedAt: recordedAt || new Date().toISOString(),
          submissionId: submissionId || null,
        },
        currentStep: 5,
      };
    }

    case 'SET_CURRENT_STEP': {
      return {
        ...state,
        currentStep: action.payload,
      };
    }

    case 'RESET_SESSION':
    case 'RESET_EXPERIMENT_SESSION': {
      return createInitialSessionState(generateSessionId());
    }

    default:
      return state;
  }
}

const ExperimentSessionContext = createContext(null);

export function ExperimentSessionProvider({ children }) {
  const [state, dispatch] = useReducer(sessionReducer, undefined, loadSavedState);

  const [backendHealth, setBackendHealth] = useState({
    connected: false,
    status: 'checking',
    products: 0,
    latencyMs: null,
    baseUrl: getApiBaseUrl(),
    error: null,
    checking: true,
  });

  const [scenarios, setScenarios] = useState({
    specific: FALLBACK_SPECIFIC_SCENARIOS,
    general: [],
  });
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [scenariosError, setScenariosError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ id: Date.now(), message, type });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const refreshHealth = useCallback(async () => {
    setBackendHealth((prev) => ({
      ...prev,
      baseUrl: getApiBaseUrl(),
      checking: true,
    }));
    const res = await checkBackendHealth();
    setBackendHealth({
      ...res,
      baseUrl: res.baseUrl || getApiBaseUrl(),
      checking: false,
    });
    return res;
  }, []);

  const reloadScenarios = useCallback(async () => {
    setScenariosLoading(true);
    setScenariosError(null);
    try {
      const data = await fetchScenarios();
      setScenarios(data);
      return data;
    } catch (err) {
      setScenariosError(err.message || 'Failed to load scenarios from /scenarios.');
      return null;
    } finally {
      setScenariosLoading(false);
    }
  }, []);

  // Initial health check & scenario loading on mount
  useEffect(() => {
    let active = true;
    Promise.all([refreshHealth(), reloadScenarios()]).then(
      ([healthRes, scenariosData]) => {
        if (active && healthRes?.connected && !scenariosData) {
          reloadScenarios();
        }
      }
    );
    return () => {
      active = false;
    };
  }, [refreshHealth, reloadScenarios]);

  // Ensure a specific-task session has a fixed specific scenario selected from the specific pool
  useEffect(() => {
    if (
      state.searchType === 'specific' &&
      (!state.activeScenario || state.activeScenario.search_type !== 'specific') &&
      scenarios.specific.length > 0
    ) {
      const chosen = pickRandomSpecificScenario(scenarios.specific);
      if (chosen) {
        dispatch({ type: 'SELECT_SCENARIO', payload: chosen });
      }
    }
  }, [scenarios.specific, state.activeScenario, state.searchType]);

  // Save session state in sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors
    }
  }, [state]);

  const actions = useMemo(
    () => ({
      showToast,
      dismissToast,
      refreshHealth,
      reloadScenarios,
      grantConsent: async () => {
        const ts = new Date().toISOString();
        dispatch({
          type: 'GRANT_CONSENT',
          payload: {
            timestamp: ts,
            specificPool: scenarios.specific,
          },
        });
        try {
          await upsertExperimentSession({
            session_id: state.sessionId,
            consent_given: true,
            status: 'in_progress',
          });
        } catch {
          // Non-fatal if session registration retries on task/submit
        }
      },
      selectScenario: (scenario) => {
        dispatch({ type: 'SELECT_SCENARIO', payload: scenario });
      },
      setSearchType: (type) => {
        const nextType = type === 'general' ? 'general' : 'specific';
        dispatch({ type: 'SET_SEARCH_TYPE', payload: nextType });
        if (nextType === 'specific') {
          const pool =
            scenarios.specific.length > 0
              ? scenarios.specific
              : FALLBACK_SPECIFIC_SCENARIOS;
          const nextScenario = pickRandomSpecificScenario(pool);
          if (nextScenario) {
            dispatch({ type: 'SELECT_SCENARIO', payload: nextScenario });
          }
        }
      },
      setCategory: (categoryId) => {
        const norm = normalizeCategoryId(categoryId);
        dispatch({ type: 'SET_CATEGORY', payload: norm });
        if (!state.activeScenario?.isDynamic) {
          const pool =
            state.searchType === 'general' ? scenarios.general : scenarios.specific;
          const nextScenario = pool.find((s) => s.category === norm);
          if (nextScenario) {
            dispatch({ type: 'SELECT_SCENARIO', payload: nextScenario });
          }
        }
      },
      setDynamicSpecification: (spec) => {
        dispatch({ type: 'SET_DYNAMIC_SPECIFICATION', payload: spec });
      },
      setUserQuery: (queryText) => {
        dispatch({ type: 'SET_USER_QUERY', payload: queryText });
      },
      runComparisonExperiment: async (overrideQuery) => {
        const activeQuery = String(
          overrideQuery !== undefined ? overrideQuery : state.userQuery
        ).trim();
        if (!activeQuery) {
          throw new Error('Please enter your own natural-language search query.');
        }
        if (!state.activeScenario) {
          throw new Error(
            'No controlled scenario is active. Please check that your target task is configured.'
          );
        }

        const comparisonOutput = await executeControlledComparison({
          query: activeQuery,
          category: state.activeScenario.category,
          search_type: state.activeScenario.search_type,
          k: 5,
          hiddenTargetProductId: state.hiddenTargetProductId,
          hiddenTargetConstraints: state.hiddenTargetConstraints,
          assignment: state.experimentAssignment,
        });

        const hiddenTargetRecord =
          state.activeScenario.search_type === 'specific'
            ? {
                target_product_id: state.hiddenTargetProductId,
                target_product_title: state.activeScenario.target_product_title,
              }
            : {
                target_constraints: state.hiddenTargetConstraints,
              };

        const taskRecord = {
          session_id: state.sessionId,
          task_number: (state.tasksLog?.length || 0) + 1,
          scenario_id: state.activeScenario.id,
          search_type: state.activeScenario.search_type,
          category: normalizeCategoryId(state.activeScenario.category),
          query: activeQuery,
          hidden_target: hiddenTargetRecord,
          assignment: state.experimentAssignment,
          results_by_mode: {
            baseline: comparisonOutput.byCondition.baseline.results,
            optimized: comparisonOutput.byCondition.optimized.results,
            orchestrated: comparisonOutput.byCondition.orchestrated.results,
          },
          evaluations_by_mode: {
            baseline: comparisonOutput.byCondition.baseline.evaluation,
            optimized: comparisonOutput.byCondition.optimized.evaluation,
            orchestrated: comparisonOutput.byCondition.orchestrated.evaluation,
          },
          executed_at: comparisonOutput.executedAt,
        };

        try {
          await logExperimentTask(taskRecord);
        } catch {
          // Will also be sent in full tasks_log upon final questionnaire submission
        }

        dispatch({
          type: 'SET_SEARCH_RESULTS',
          payload: { comparisonOutput, taskRecord },
        });
        return comparisonOutput;
      },
      updateFeedbackField: (fields) =>
        dispatch({ type: 'UPDATE_FEEDBACK_FIELD', payload: fields }),
      updateConditionRating: (conditionId, metricKey, value) =>
        dispatch({
          type: 'UPDATE_CONDITION_RATING',
          payload: { conditionId, metricKey, value },
        }),
      submitQuestionnaire: async () => {
        if (state.feedback.submitted) {
          throw new Error('This session has already been submitted.');
        }
        if (!state.activeScenario || !state.searchResults) {
          throw new Error('Please run at least one search evaluation task before submitting.');
        }

        for (const key of LIKERT_FIELD_KEYS) {
          const val = state.feedback[key];
          if (typeof val !== 'number' || !Number.isInteger(val) || val < 1 || val > 5) {
            throw new Error(`Please provide a rating from 1 to 5 for ${key}.`);
          }
        }

        if (!state.feedback.target_retrieval_outcome) {
          throw new Error('Please select whether the search returned your intended product.');
        }

        if (!state.feedback.preferred_condition) {
          throw new Error('Please select your preferred search experience.');
        }

        const conditionRatings = state.feedback.condition_ratings || {};
        for (const condId of ['baseline', 'optimized', 'orchestrated']) {
          const condObj = conditionRatings[condId] || {};
          for (const metricKey of CONDITION_RATING_KEYS) {
            const mVal = condObj[metricKey];
            if (typeof mVal !== 'number' || !Number.isInteger(mVal) || mVal < 1 || mVal > 5) {
              throw new Error('Please complete all four ratings (1–5) for each search experience.');
            }
          }
        }

        const hiddenTargetRecord =
          state.activeScenario.search_type === 'specific'
            ? {
                target_product_id: state.hiddenTargetProductId,
                target_product_title: state.activeScenario.target_product_title,
              }
            : {
                target_constraints: state.hiddenTargetConstraints,
              };

        const payload = {
          session_id: state.sessionId,
          search_type: state.activeScenario.search_type,
          scenario_id: state.activeScenario.id,
          category: normalizeCategoryId(state.activeScenario.category),
          query: state.searchResults.query || state.userQuery,
          hidden_target: hiddenTargetRecord,
          assignment: state.experimentAssignment,
          results_summary: {
            baseline: state.searchResults.byCondition.baseline.results,
            optimized: state.searchResults.byCondition.optimized.results,
            orchestrated: state.searchResults.byCondition.orchestrated.results,
          },
          evaluations: {
            baseline: state.searchResults.byCondition.baseline.evaluation,
            optimized: state.searchResults.byCondition.optimized.evaluation,
            orchestrated: state.searchResults.byCondition.orchestrated.evaluation,
          },
          tasks_log: state.tasksLog || [],
          questionnaire: {
            overall_satisfaction: Number(state.feedback.overall_satisfaction),
            perceived_relevance: Number(state.feedback.perceived_relevance),
            ease_of_finding: Number(state.feedback.ease_of_finding),
            perceived_usefulness: Number(state.feedback.perceived_usefulness),
            perceived_diversity: Number(state.feedback.perceived_diversity),
            product_confidence: Number(state.feedback.product_confidence),
            purchase_intention: Number(state.feedback.purchase_intention),
            return_intention: Number(state.feedback.return_intention),
            repeat_purchase_intention: Number(state.feedback.repeat_purchase_intention),
            target_retrieval_outcome: state.feedback.target_retrieval_outcome,
            preferred_condition: state.feedback.preferred_condition,
            condition_ratings: state.feedback.condition_ratings,
            comments: state.feedback.comments || '',
          },
        };

        const result = await submitExperimentQuestionnaire(payload);
        dispatch({
          type: 'MARK_FEEDBACK_SUBMITTED',
          payload: {
            recordedAt: result.recorded_at,
            submissionId: result.submission_id,
          },
        });
        return result;
      },
      setCurrentStep: (step) => dispatch({ type: 'SET_CURRENT_STEP', payload: step }),
      resetSession: () => {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
        dispatch({ type: 'RESET_SESSION' });
      },
    }),
    [
      state,
      scenarios,
      showToast,
      dismissToast,
      refreshHealth,
      reloadScenarios,
    ]
  );

  const value = useMemo(
    () => ({
      session: state,
      backendHealth,
      scenarios,
      scenariosLoading,
      scenariosError,
      toast,
      ...actions,
    }),
    [
      state,
      backendHealth,
      scenarios,
      scenariosLoading,
      scenariosError,
      toast,
      actions,
    ]
  );

  return React.createElement(ExperimentSessionContext.Provider, { value }, children);
}

export function useExperimentSession() {
  const ctx = useContext(ExperimentSessionContext);
  if (!ctx) {
    throw new Error('useExperimentSession must be used within an ExperimentSessionProvider');
  }
  return ctx;
}
