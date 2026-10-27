import { normalizeCategoryId } from '../data/categories.js';

export const PRODUCTION_API_BASE_URL =
  'https://adaptive-ecommerce-orchestration.onrender.com';
export const DEVELOPMENT_API_BASE_URL = 'http://localhost:8000';

/**
 * Resolves the backend API base URL from a Vite-compatible environment object.
 * - Priority 1: Explicit VITE_API_BASE_URL environment variable
 * - Priority 2: PRODUCTION_API_BASE_URL when running in production (PROD === true)
 * - Priority 3: DEVELOPMENT_API_BASE_URL ('http://localhost:8000') in local development
 */
export function resolveApiBaseUrl(env = {}) {
  const configuredUrl =
    env && typeof env.VITE_API_BASE_URL === 'string'
      ? env.VITE_API_BASE_URL.trim()
      : '';
  const isProd = Boolean(
    env && (env.PROD === true || env.MODE === 'production')
  );
  const rawUrl =
    configuredUrl ||
    (isProd ? PRODUCTION_API_BASE_URL : DEVELOPMENT_API_BASE_URL);
  return rawUrl.replace(/\/+$/, '');
}

export const API_BASE_URL = (
  import.meta.env
    ? import.meta.env.VITE_API_BASE_URL ||
      (import.meta.env.PROD
        ? PRODUCTION_API_BASE_URL
        : DEVELOPMENT_API_BASE_URL)
    : PRODUCTION_API_BASE_URL
)
  .trim()
  .replace(/\/+$/, '');

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export class ApiConnectionError extends Error {
  constructor(message, status = null, endpoint = '') {
    super(message);
    this.name = 'ApiConnectionError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

async function requestJson(endpoint, options = {}) {
  const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;
  const {
    timeoutMs = 35000,
    headers: customHeaders,
    ...fetchOptions
  } = options;

  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId =
    controller && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  let response;
  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(customHeaders || {}),
      },
      ...(controller ? { signal: controller.signal } : {}),
      ...fetchOptions,
    });
  } catch (networkErr) {
    const isLocal =
      baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
    const isTimeout = networkErr && networkErr.name === 'AbortError';
    const reason = isTimeout
      ? `Request to ${baseUrl}${cleanEndpoint} timed out after ${Math.round(timeoutMs / 1000)}s.`
      : `Unable to reach FastAPI backend at ${baseUrl}.`;
    const guidance = isLocal
      ? 'Ensure "python -m uvicorn api:app --reload --port 8000" is running locally.'
      : 'The Render backend service may be waking up from a cold start — please wait a few seconds and retry.';
    throw new ApiConnectionError(
      `${reason} ${guidance}`,
      null,
      cleanEndpoint
    );
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errBody = await response.json();
      if (errBody && errBody.detail) {
        detail =
          typeof errBody.detail === 'string'
            ? errBody.detail
            : JSON.stringify(errBody.detail);
      }
    } catch {
      // ignore non-json error body
    }
    throw new ApiConnectionError(
      detail || `Request failed with HTTP ${response.status}`,
      response.status,
      cleanEndpoint
    );
  }

  return response.json();
}

/**
 * 1. Health Check — GET /health
 * Performs a single automatic retry if the initial check fails or times out
 * to handle Render free-tier cold-start spin-up cleanly without infinite polling.
 */
export async function checkBackendHealth({ retryOnColdStart = true } = {}) {
  const baseUrl = getApiBaseUrl();

  const attemptHealth = async (timeoutMs) => {
    const start = performance.now();
    const data = await requestJson('/health', {
      method: 'GET',
      timeoutMs,
    });
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    const isOk = Boolean(
      data && (data.status === 'ok' || typeof data.products === 'number')
    );
    return {
      connected: isOk,
      status: data?.status || (isOk ? 'ok' : 'unknown'),
      products: Number(data?.products) || 0,
      latencyMs,
      baseUrl,
      error: null,
    };
  };

  try {
    return await attemptHealth(25000);
  } catch (firstErr) {
    if (retryOnColdStart) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        return await attemptHealth(35000);
      } catch (retryErr) {
        return {
          connected: false,
          status: 'disconnected',
          products: 0,
          latencyMs: null,
          baseUrl,
          error: retryErr.message || 'Backend unreachable',
        };
      }
    }
    return {
      connected: false,
      status: 'disconnected',
      products: 0,
      latencyMs: null,
      baseUrl,
      error: firstErr.message || 'Backend unreachable',
    };
  }
}

/**
 * 2. Scenario Loading — GET /scenarios
 */
export async function fetchScenarios() {
  const data = await requestJson('/scenarios', { method: 'GET' });
  if (
    !data ||
    typeof data !== 'object' ||
    !Array.isArray(data.specific) ||
    !Array.isArray(data.general)
  ) {
    throw new ApiConnectionError(
      'Malformed /scenarios response: expected { specific: [...], general: [...] }.',
      500,
      '/scenarios'
    );
  }
  if (data.specific.length === 0 && data.general.length === 0) {
    throw new ApiConnectionError(
      'The backend returned an empty scenario list from /scenarios.',
      404,
      '/scenarios'
    );
  }
  return data;
}

/**
 * 3. Category Target List — GET /targets
 */
export async function fetchCategoryTargets(category = 'laptop', limit = 40) {
  const normCategory = normalizeCategoryId(category);
  const data = await requestJson(
    `/targets?category=${encodeURIComponent(normCategory)}&limit=${encodeURIComponent(limit)}`,
    { method: 'GET' }
  );
  if (!Array.isArray(data)) {
    throw new ApiConnectionError('Invalid /targets response format.', 500, '/targets');
  }
  return data;
}

/**
 * 4. Search — POST /search
 * CRITICAL EXPERIMENTAL SAFEGUARD:
 * Never accepts or forwards hidden target_product_id or target_constraints.
 * Only sends { query, mode, category, search_type, k }.
 */
export async function searchProducts({
  query,
  mode = 'orchestrated',
  category = 'laptop',
  search_type = 'specific',
  k = 5,
}) {
  const trimmedQuery = String(query || '').trim();
  if (!trimmedQuery) {
    throw new Error('Please enter a search query before submitting.');
  }

  const allowedModes = ['baseline', 'optimized', 'orchestrated'];
  if (!allowedModes.includes(mode)) {
    throw new Error(`Unsupported search mode: ${mode}`);
  }

  const allowedSearchTypes = ['specific', 'general'];
  const normalizedSearchType = allowedSearchTypes.includes(search_type)
    ? search_type
    : 'specific';

  const normalizedCategory = normalizeCategoryId(category);
  const safeK = Math.min(20, Math.max(1, Number(k) || 5));

  // Strict allowlist payload — guarantees zero target leakage into /search
  const searchPayload = {
    query: trimmedQuery,
    mode,
    category: normalizedCategory,
    search_type: normalizedSearchType,
    k: safeK,
  };

  const start = performance.now();
  const data = await requestJson('/search', {
    method: 'POST',
    body: JSON.stringify(searchPayload),
  });
  const clientLatencyMs = Math.max(1, Math.round(performance.now() - start));

  if (!data || !Array.isArray(data.results)) {
    throw new ApiConnectionError('Malformed response from POST /search.', 500, '/search');
  }

  return {
    ...data,
    clientLatencyMs,
    requestPayloadSent: searchPayload,
  };
}

/**
 * 5. Post-Retrieval Evaluation — POST /evaluate
 * Called ONLY after /search results have been retrieved.
 */
export async function evaluateResults({
  search_type,
  results,
  target_product_id = null,
  target_constraints = null,
}) {
  if (!Array.isArray(results)) {
    throw new Error('Evaluation requires retrieved results array.');
  }

  const evalPayload = {
    search_type,
    results,
  };

  if (search_type === 'specific') {
    if (!target_product_id) {
      throw new Error('Specific search evaluation requires target_product_id.');
    }
    evalPayload.target_product_id = String(target_product_id);
  } else if (search_type === 'general') {
    if (!target_constraints || Object.keys(target_constraints).length === 0) {
      throw new Error('General search evaluation requires target_constraints.');
    }
    evalPayload.target_constraints = target_constraints;
  } else {
    throw new Error('search_type must be specific or general');
  }

  return requestJson('/evaluate', {
    method: 'POST',
    body: JSON.stringify(evalPayload),
  });
}

/**
 * 6. Controlled 3-Way Comparison Runner (Search first, then Evaluate)
 * Runs the identical participant query across baseline, optimized, and orchestrated modes.
 * Never sends target_product_id or target_constraints to /search.
 * Calls /evaluate only after each retrieval finishes.
 */
export async function executeControlledComparison({
  query,
  category,
  search_type,
  k = 5,
  hiddenTargetProductId = null,
  hiddenTargetConstraints = null,
  assignment = null,
}) {
  const modes = ['baseline', 'optimized', 'orchestrated'];
  const normCategory = normalizeCategoryId(category);

  // Step A: Retrieve results from POST /search for all 3 modes (NO target sent)
  const searchResponses = await Promise.all(
    modes.map((mode) =>
      searchProducts({
        query,
        mode,
        category: normCategory,
        search_type,
        k,
      })
    )
  );

  const searchByMode = {
    baseline: searchResponses[0],
    optimized: searchResponses[1],
    orchestrated: searchResponses[2],
  };

  // Step B: Call POST /evaluate AFTER retrieval using hidden target
  const evalResponses = await Promise.all(
    modes.map((mode) =>
      evaluateResults({
        search_type,
        results: searchByMode[mode].results,
        target_product_id: search_type === 'specific' ? hiddenTargetProductId : null,
        target_constraints: search_type === 'general' ? hiddenTargetConstraints : null,
      })
    )
  );

  const evalByMode = {
    baseline: evalResponses[0],
    optimized: evalResponses[1],
    orchestrated: evalResponses[2],
  };

  const conditionMetadata = {
    baseline: {
      conditionId: 'baseline',
      pipelineCode: 'MODE 01 · BASELINE',
      conditionName: 'Baseline Search',
      description: 'TF-IDF semantic retrieval over internal inventory only.',
    },
    optimized: {
      conditionId: 'optimized',
      pipelineCode: 'MODE 02 · OPTIMIZED',
      conditionName: 'Optimized Search',
      description: 'Structured constraint scoring + Intent-Adaptive MMR diversity reranking.',
    },
    orchestrated: {
      conditionId: 'orchestrated',
      pipelineCode: 'MODE 03 · ORCHESTRATED',
      conditionName: 'Adaptive Orchestrated Search',
      description:
        'Detects top-candidate stockouts and adaptively routes to exact partner recovery or substitutes.',
    },
  };

  const byCondition = {};
  for (const mode of modes) {
    const sRes = searchByMode[mode];
    const eRes = evalByMode[mode];
    byCondition[mode] = {
      ...conditionMetadata[mode],
      query: sRes.query,
      search_type: sRes.search_type,
      category: sRes.category,
      parsed_constraints: sRes.parsed_constraints || {},
      orchestration_triggered: Boolean(sRes.orchestration_triggered),
      decision_trace: sRes.decision_trace || null,
      executionTimeMs: sRes.clientLatencyMs,
      results: (sRes.results || []).map((item, idx) => ({
        ...item,
        rank: idx + 1,
      })),
      evaluation: eRes,
    };
  }

  const columns = (assignment?.columns || [
    {
      displayLabel: 'Search Experience A',
      shortCode: 'exp_a',
      variantLabel: 'System A',
      conditionId: 'baseline',
    },
    {
      displayLabel: 'Search Experience B',
      shortCode: 'exp_b',
      variantLabel: 'System B',
      conditionId: 'optimized',
    },
    {
      displayLabel: 'Search Experience C',
      shortCode: 'exp_c',
      variantLabel: 'System C',
      conditionId: 'orchestrated',
    },
  ]).map((slot) => ({
    ...slot,
    data: byCondition[slot.conditionId],
  }));

  return {
    query: String(query).trim(),
    category: normCategory,
    search_type,
    executedAt: new Date().toISOString(),
    byCondition,
    orderedColumns: columns,
  };
}

/**
 * 7. Experiment Persistence Endpoints
 */
export async function upsertExperimentSession({
  session_id,
  consent_given = true,
  status = 'in_progress',
}) {
  return requestJson('/experiments/session', {
    method: 'POST',
    body: JSON.stringify({
      session_id,
      consent_given,
      status,
    }),
  });
}

export async function logExperimentTask(taskPayload) {
  return requestJson('/experiments/task', {
    method: 'POST',
    body: JSON.stringify(taskPayload),
  });
}

export const LOCAL_BACKUP_STORAGE_KEY = 'searchlab_experiment_submissions_backup_v1';

export async function submitExperimentQuestionnaire(submissionPayload) {
  const response = await requestJson('/experiments/submit', {
    method: 'POST',
    body: JSON.stringify(submissionPayload),
  });

  // Also keep a browser backup copy for safety
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existingRaw = window.localStorage.getItem(LOCAL_BACKUP_STORAGE_KEY);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      existing.push({ ...submissionPayload, serverResponse: response });
      window.localStorage.setItem(LOCAL_BACKUP_STORAGE_KEY, JSON.stringify(existing));
    }
  } catch {
    // ignore storage errors
  }

  return response;
}

export async function fetchExperimentSummary() {
  return requestJson('/experiments/summary', { method: 'GET' });
}

export function getExperimentCsvExportUrl() {
  return `${getApiBaseUrl().replace(/\/+$/, '')}/experiments/export.csv`;
}

/**
 * Backward compatibility helpers for searchService / legacy mock unit tests
 */
export function isLiveBackendConfigured() {
  return true;
}

export function getAdapterStatus() {
  return {
    isConfigured: true,
    mode: 'live',
    baseUrl: getApiBaseUrl(),
  };
}

export async function submitFeedbackPayload(payload = {}) {
  const isDemo =
    payload.sessionId?.startsWith('#SL-TEST') ||
    payload.session_id?.startsWith('#SL-TEST') ||
    payload.mode === 'demo';
  const now = new Date().toISOString();

  if (isDemo) {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem('stitch_feedback_records_demo_v1');
      const list = raw ? JSON.parse(raw) : [];
      list.push({ ...payload, submittedAt: now });
      window.localStorage.setItem('stitch_feedback_records_demo_v1', JSON.stringify(list));
    }
    return {
      status: 'recorded_locally',
      adapterMode: 'demo',
      submissionId: 'demo-' + Date.now(),
      recordedAt: now,
    };
  }

  const normalized = {
    session_id: payload.session_id || payload.sessionId || 'DEMO-SESSION',
    search_type: payload.search_type || payload.searchType || 'general',
    category: payload.category || 'refrigerator',
    scenario_id: payload.scenario_id || payload.scenarioId || 'sc-demo-1',
    query: payload.query || payload.userQuery || 'test query',
    questionnaire: payload.questionnaire || {
      overall_satisfaction: payload.overallSatisfaction || 5,
      perceived_relevance: payload.perceivedRelevance || 5,
      ease_of_finding: payload.easeOfFinding || 5,
      perceived_usefulness: payload.perceivedUsefulness || 5,
      perceived_diversity: payload.perceivedDiversity || 5,
      product_confidence: payload.productConfidence || 5,
      purchase_intention: payload.purchaseIntention || 5,
      return_intention: payload.returnIntention || 3,
      repeat_purchase_intention: payload.repeatPurchaseIntention || 5,
    },
    preferred_condition: payload.preferred_condition || payload.preferredCondition || 'orchestrated',
    target_retrieval_outcome: payload.target_retrieval_outcome || payload.targetRetrievalOutcome || 'exact',
    comments: payload.comments || '',
    condition_ratings: payload.condition_ratings || {},
    tasks_log: payload.tasks_log || [],
  };

  try {
    return await submitExperimentQuestionnaire(normalized);
  } catch (err) {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existingRaw = window.localStorage.getItem(LOCAL_BACKUP_STORAGE_KEY);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      existing.push(normalized);
      window.localStorage.setItem(LOCAL_BACKUP_STORAGE_KEY, JSON.stringify(existing));
    }
    return {
      status: 'recorded_locally',
      adapterMode: 'fallback',
      session_id: normalized.session_id,
      submissionId: 'fallback-' + Date.now(),
      recordedAt: now,
    };
  }
}

export function getDemoFeedbackLog() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem('stitch_feedback_records_demo_v1');
      return raw ? JSON.parse(raw) : [];
    }
  } catch {
    // ignore
  }
  return [];
}
