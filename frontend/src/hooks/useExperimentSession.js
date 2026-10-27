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

const ALL_PERMUTATIONS = [
  ['baseline', 'optimized', 'orchestrated'],
  ['baseline', 'orchestrated', 'optimized'],
  ['optimized', 'baseline', 'orchestrated'],
  ['optimized', 'orchestrated', 'baseline'],
  ['orchestrated', 'baseline', 'optimized'],
  ['orchestrated', 'optimized', 'baseline'],
];

export function createAssignment(randomize = true) {
  const nonIdentity = ALL_PERMUTATIONS.slice(1);
  const ordered = randomize
    ? nonIdentity[Math.floor(Math.random() * nonIdentity.length)]
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

export function createInitialSessionState(customSessionId = null) {
  const initialCat = 'refrigerator';
  const catObj = getCategoryById(initialCat);
  return {
    sessionId: customSessionId || generateSessionId(),
    consentGiven: false,
    consentTimestamp: null,
    searchType: 'specific', // 'specific' | 'general'
    category: initialCat, // 'phone' | 'laptop' | 'watch' | 'refrigerator'
    activeScenario: null, // Loaded from GET /scenarios
    hiddenTargetProductId: 'ref-sam-458', // Private for specific task /evaluate
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
    return {
      ...createInitialSessionState(),
      ...parsed,
      category: normalizeCategoryId(parsed.category),
      feedback: {
        ...createInitialFeedback(),
        ...(parsed.feedback || {}),
      },
    };
  } catch {
    return createInitialSessionState();
  }
}

export function sessionReducer(state, action) {
  switch (action.type) {
    case 'GRANT_CONSENT': {
      return {
        ...state,
        consentGiven: true,
        consentTimestamp: action.payload || new Date().toISOString(),
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
      const scenarioId = `dynamic_spec_${cat}_${Date.now()}`;
      const dynamicScenario = {
        id: scenarioId,
        search_type: 'general',
        category: cat,
        target_constraints: spec,
        title: `Custom ${cat.charAt(0).toUpperCase() + cat.slice(1)} Specification`,
        isDynamic: true,
      };

      return {
        ...state,
        searchType: 'general',
        category: cat,
        activeScenario: dynamicScenario,
        hiddenTargetConstraints: spec,
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
      return {
        ...state,
        searchType: nextType,
        activeScenario: null,
        hiddenTargetProductId: null,
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

    case 'SHUFFLE_CONDITION_ASSIGNMENT': {
      const nextAssignment = createAssignment(Boolean(action.payload));
      const updatedSearchResults = state.searchResults
        ? {
            ...state.searchResults,
            orderedColumns: nextAssignment.columns.map((slot) => ({
              ...slot,
              data: state.searchResults.byCondition[slot.conditionId],
            })),
          }
        : null;

      return {
        ...state,
        experimentAssignment: nextAssignment,
        searchResults: updatedSearchResults,
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

  const [scenarios, setScenarios] = useState({ specific: [], general: [] });
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
    setBackendHealth((prev) => ({ ...prev, checking: true }));
    const res = await checkBackendHealth();
    setBackendHealth({ ...res, checking: false });
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
    refreshHealth();
    reloadScenarios();
  }, [refreshHealth, reloadScenarios]);

  // Select default initial scenario once /scenarios loads if none selected yet
  useEffect(() => {
    if (!state.activeScenario && scenarios.specific.length > 0) {
      const list =
        state.searchType === 'general' ? scenarios.general : scenarios.specific;
      const matchCat = list.find((s) => s.category === state.category) || list[0];
      if (matchCat) {
        dispatch({ type: 'SELECT_SCENARIO', payload: matchCat });
      }
    }
  }, [scenarios, state.activeScenario, state.searchType, state.category]);

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
        dispatch({ type: 'GRANT_CONSENT', payload: ts });
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
        if (!state.activeScenario?.isDynamic) {
          const pool = nextType === 'general' ? scenarios.general : scenarios.specific;
          const nextScenario =
            pool.find((s) => s.category === state.category) || pool[0] || null;
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
            'No controlled scenario is active. Please check that the backend /scenarios endpoint is reachable.'
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

        // Persist task log to SQLite backend
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
      shuffleConditionAssignment: (randomize = true) =>
        dispatch({ type: 'SHUFFLE_CONDITION_ASSIGNMENT', payload: randomize }),
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
