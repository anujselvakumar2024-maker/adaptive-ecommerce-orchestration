import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  Eye,
  FileSpreadsheet,
  Filter,
  Flame,
  HelpCircle,
  Layers,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Terminal,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  checkBackendHealth,
  fetchExperimentSummary,
  getExperimentCsvExportUrl,
  getApiBaseUrl,
  searchProducts,
  fetchScenarios,
} from '../services/api.js';
import { formatINR, CATEGORIES } from '../data/categories.js';
import CategoryIcon, { ProductVisual } from '../components/common/CategoryIcon.jsx';

const LIKERT_METRICS = [
  { key: 'overall_satisfaction', label: 'Overall Satisfaction', desc: 'Overall satisfaction with retrieved results' },
  { key: 'perceived_relevance', label: 'Perceived Relevance', desc: 'How well products matched search intent' },
  { key: 'ease_of_finding', label: 'Ease of Finding', desc: 'Ease of locating desirable products' },
  { key: 'perceived_usefulness', label: 'Perceived Usefulness', desc: 'Practical utility of recommendations' },
  { key: 'perceived_diversity', label: 'Perceived Diversity', desc: 'Variety of brands and specifications shown' },
  { key: 'product_confidence', label: 'Product Confidence', desc: 'Confidence that target exists in catalog' },
  { key: 'purchase_intention', label: 'Purchase Intention', desc: 'Likelihood of completing a simulated purchase' },
  { key: 'return_intention', label: 'Return Intention Risk', desc: 'Perceived risk of returning if purchased (lower is better)' },
  { key: 'repeat_purchase_intention', label: 'Repeat Purchase', desc: 'Likelihood of using this engine again' },
];

export default function ResearcherPage() {
  // Summary & Health states
  const [health, setHealth] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Trace Inspector states
  const [inspectorCategory, setInspectorCategory] = useState('laptop');
  const [inspectorType, setInspectorType] = useState('general');
  const [inspectorQuery, setInspectorQuery] = useState('17 inch gaming laptop under 80000');
  const [scenariosList, setScenariosList] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [inspectorRunning, setInspectorRunning] = useState(false);
  const [inspectorResults, setInspectorResults] = useState(null);
  const [inspectorError, setInspectorError] = useState(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState('orchestrated');

  // Load scenarios for quick tester
  useEffect(() => {
    fetchScenarios()
      .then((data) => {
        const flat = [...(data.specific || []), ...(data.general || [])];
        setScenariosList(flat);
      })
      .catch(() => {});
  }, []);

  const refreshAll = useCallback(async () => {
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const [hRes, sRes] = await Promise.all([
        checkBackendHealth(),
        fetchExperimentSummary().catch((e) => ({ error: e.message })),
      ]);
      setHealth(hRes);
      if (sRes && !sRes.error) {
        setSummary(sRes);
      } else {
        setSummaryError(sRes?.error || 'Failed to fetch summary');
      }
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      setSummaryError(err.message || 'Error refreshing metrics');
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refreshAll();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshAll]);

  // Handle scenario selection in inspector
  const handleSelectScenario = (scId) => {
    setSelectedScenarioId(scId);
    const found = scenariosList.find((s) => s.id === scId);
    if (found) {
      setInspectorCategory(found.category || 'laptop');
      setInspectorType(found.type || 'general');
      setInspectorQuery(found.reference_query || found.description || '');
    }
  };

  // Run 3-way trace inspector search
  const handleRunInspector = async (e) => {
    if (e) e.preventDefault();
    if (!inspectorQuery.trim()) return;

    setInspectorRunning(true);
    setInspectorError(null);
    setInspectorResults(null);

    try {
      const modes = ['baseline', 'optimized', 'orchestrated'];
      const responses = await Promise.all(
        modes.map(async (mode) => {
          const t0 = performance.now();
          const res = await searchProducts({
            query: inspectorQuery.trim(),
            mode,
            category: inspectorCategory,
            search_type: inspectorType,
            k: 5,
          });
          const latency = Math.round(performance.now() - t0);
          return { mode, latency, data: res };
        })
      );

      const byMode = {};
      responses.forEach((r) => {
        byMode[r.mode] = { ...r.data, clientLatencyMs: r.latency };
      });
      setInspectorResults(byMode);
    } catch (err) {
      setInspectorError(err.message || 'Inspector retrieval failed');
    } finally {
      setInspectorRunning(false);
    }
  };

  const csvDownloadUrl = getExperimentCsvExportUrl();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Top Header Banner */}
      <div className="bg-slate-900 border-b border-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-3">
                <Terminal className="w-3.5 h-3.5" />
                Researcher Diagnostic & Human Evaluation Control
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Live Experiment Diagnostics & Decision Inspector
              </h1>
              <p className="text-slate-400 text-sm mt-1 max-w-2xl">
                Monitors participant sessions in real-time, displays aggregated 9-point Likert questionnaire responses, and inspects multi-agent orchestration decision traces.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  autoRefresh
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Clock className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-pulse text-emerald-400' : ''}`} />
                {autoRefresh ? 'Auto-refresh: ON (10s)' : 'Auto-refresh: OFF'}
              </button>

              <button
                type="button"
                onClick={refreshAll}
                disabled={loadingSummary}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? 'animate-spin text-blue-400' : ''}`} />
                Refresh
              </button>

              <a
                href={csvDownloadUrl}
                download="human_evaluation_results.csv"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 shadow-sm transition-colors"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                Export CSV Dataset
              </a>
            </div>
          </div>

          {/* Health & Status strip */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">FastAPI Backend:</span>
                {health?.connected ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-emerald-300 bg-emerald-950 border border-emerald-800 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    ONLINE ({health.products} products · {health.latencyMs}ms)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-red-300 bg-red-950 border border-red-800 font-mono">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    DISCONNECTED ({health?.baseUrl || getApiBaseUrl()})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                <span>Store: <code className="text-slate-300">data/experiments.db</code> (SQLite)</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-400">
              {lastRefreshed && <span>Updated at {lastRefreshed}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {summaryError && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Notice: Live experiment database is empty or resetting</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {summaryError}. If no participants have completed the study yet, execute an evaluation run or run the diagnostic query below.
              </p>
            </div>
          </div>
        )}

        {/* SECTION 1: High Level KPI Cards */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            Human Evaluation Participant Cohort
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="text-slate-500 text-xs font-medium uppercase tracking-wider">Total Sessions</div>
              <div className="text-3xl font-extrabold text-slate-900 mt-2">
                {summary?.total_sessions ?? 0}
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {summary?.completed_sessions ?? 0} Completed
                </span>
                <span>·</span>
                <span className="text-slate-500">
                  {summary?.incomplete_sessions ?? 0} Incomplete
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="text-slate-500 text-xs font-medium uppercase tracking-wider">Tasks Executed</div>
              <div className="text-3xl font-extrabold text-slate-900 mt-2">
                {summary?.total_tasks_logged ?? 0}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Queries retrieved across 3 conditions
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="text-slate-500 text-xs font-medium uppercase tracking-wider">Survey Submissions</div>
              <div className="text-3xl font-extrabold text-slate-900 mt-2">
                {summary?.total_submissions ?? 0}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                9-point Likert records logged
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="text-slate-500 text-xs font-medium uppercase tracking-wider">Top Preference</div>
              <div className="text-2xl font-extrabold text-blue-600 mt-2 capitalize">
                {(() => {
                  const prefs = summary?.preferred_condition_counts || {};
                  const best = Object.entries(prefs).sort((a, b) => b[1] - a[1])[0];
                  if (!best || best[1] === 0) return 'No Data Yet';
                  return `${best[0]} (${best[1]})`;
                })()}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Condition chosen by participants
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: 9-Dimension Likert & Condition Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Likert Mean Scores */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-blue-600" />
                  Participant Perceived Quality (7-Point Likert Means)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  1 = Strongly Disagree, 4 = Neutral, 7 = Strongly Agree (N = {summary?.total_submissions || 0})
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              {LIKERT_METRICS.map((m) => {
                const meanVal = summary?.questionnaire_means?.[m.key];
                const pct = meanVal ? (meanVal / 7) * 100 : 0;
                return (
                  <div key={m.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700" title={m.desc}>
                        {m.label}
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {meanVal !== null && meanVal !== undefined ? `${meanVal} / 7.0` : '—'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          m.key === 'return_intention'
                            ? 'bg-amber-500'
                            : meanVal && meanVal >= 5.0
                            ? 'bg-emerald-500'
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Higher score = better (except Return Intention Risk)</span>
              <span>Validated research survey dimensions</span>
            </div>
          </div>

          {/* Right: Preference & Outcomes Breakdown */}
          <div className="lg:col-span-5 space-y-6">
            {/* Preferred System Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
              <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Condition Preference Distribution
              </h3>

              {(() => {
                const prefs = summary?.preferred_condition_counts || {
                  baseline: 0,
                  optimized: 0,
                  orchestrated: 0,
                  no_preference: 0,
                };
                const total =
                  (prefs.baseline || 0) +
                  (prefs.optimized || 0) +
                  (prefs.orchestrated || 0) +
                  (prefs.no_preference || 0);

                const items = [
                  { id: 'orchestrated', name: 'Mode 3 · Orchestrated', count: prefs.orchestrated || 0, color: 'bg-blue-600' },
                  { id: 'optimized', name: 'Mode 2 · Optimized', count: prefs.optimized || 0, color: 'bg-indigo-500' },
                  { id: 'baseline', name: 'Mode 1 · Baseline', count: prefs.baseline || 0, color: 'bg-slate-400' },
                  { id: 'no_preference', name: 'No Preference', count: prefs.no_preference || 0, color: 'bg-slate-300' },
                ];

                return (
                  <div className="space-y-3">
                    {items.map((it) => {
                      const share = total > 0 ? Math.round((it.count / total) * 100) : 0;
                      return (
                        <div key={it.id} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-slate-700">{it.name}</span>
                            <span className="text-slate-500 font-mono">
                              {it.count} ({share}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className={`h-full ${it.color} rounded-full`} style={{ width: `${share}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Target Retrieval Outcome */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
              <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Participant Target Retrieval Outcome
              </h3>
              {(() => {
                const outcomes = summary?.retrieval_outcome_counts || {
                  exact: 0,
                  alternative: 0,
                  none: 0,
                };
                const total =
                  (outcomes.exact || 0) +
                  (outcomes.alternative || 0) +
                  (outcomes.none || 0);

                const list = [
                  { label: 'Exact target found', count: outcomes.exact || 0, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                  { label: 'Viable substitute accepted', count: outcomes.alternative || 0, color: 'text-blue-700 bg-blue-50 border-blue-200' },
                  { label: 'Neither found / unfulfilled', count: outcomes.none || 0, color: 'text-rose-700 bg-rose-50 border-rose-200' },
                ];

                return (
                  <div className="space-y-2">
                    {list.map((o) => {
                      const pct = total > 0 ? Math.round((o.count / total) * 100) : 0;
                      return (
                        <div
                          key={o.label}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${o.color}`}
                        >
                          <span className="font-medium">{o.label}</span>
                          <span className="font-mono font-bold">
                            {o.count} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* SECTION 3: Live System Evaluation Performance Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Condition-wise Algorithmic Evaluation Summary
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluated across participant-entered queries in the active human experiment session
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Evaluated: {summary?.condition_eval_summary?.orchestrated?.evaluated_tasks ?? 0} tasks
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <th className="py-3 px-4">Search Pipeline Mode</th>
                  <th className="py-3 px-4 text-center">Hit Rate (Hit@5)</th>
                  <th className="py-3 px-4 text-center">Mean Reciprocal Rank (MRR)</th>
                  <th className="py-3 px-4 text-center">Constraint Match %</th>
                  <th className="py-3 px-4 text-center">Participant Preference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {[
                  {
                    id: 'baseline',
                    name: 'Mode 1: Baseline TF-IDF',
                    desc: 'Pure lexical similarity retrieval',
                    badge: 'Baseline',
                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                  },
                  {
                    id: 'optimized',
                    name: 'Mode 2: Optimized MMR',
                    desc: 'Query constraint parsing + Intent MMR reranking',
                    badge: 'Optimized',
                    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                  },
                  {
                    id: 'orchestrated',
                    name: 'Mode 3: Adaptive Orchestration',
                    desc: 'Stockout detection + Multi-agent partner & substitute recovery',
                    badge: 'Orchestrated',
                    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 font-bold',
                  },
                ].map((row) => {
                  const mSummary = summary?.condition_eval_summary?.[row.id] || {};
                  const prefCount = summary?.preferred_condition_counts?.[row.id] || 0;
                  const totalPref =
                    (summary?.preferred_condition_counts?.baseline || 0) +
                    (summary?.preferred_condition_counts?.optimized || 0) +
                    (summary?.preferred_condition_counts?.orchestrated || 0) +
                    (summary?.preferred_condition_counts?.no_preference || 0);
                  const prefPct = totalPref > 0 ? Math.round((prefCount / totalPref) * 100) : 0;

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] border font-medium ${row.badgeClass}`}>
                            {row.badge}
                          </span>
                          <span className="font-semibold text-slate-900">{row.name}</span>
                        </div>
                        <p className="text-slate-500 text-[11px] mt-0.5">{row.desc}</p>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900">
                        {mSummary.target_success_rate !== null && mSummary.target_success_rate !== undefined
                          ? `${mSummary.target_success_rate}%`
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-900">
                        {mSummary.mean_reciprocal_rank !== null && mSummary.mean_reciprocal_rank !== undefined
                          ? mSummary.mean_reciprocal_rank
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-900">
                        {mSummary.mean_constraint_match_percent !== null &&
                        mSummary.mean_constraint_match_percent !== undefined
                          ? `${mSummary.mean_constraint_match_percent}%`
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700">
                        {prefCount} ({prefPct}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 4: Interactive Decision Trace & Orchestration Inspector */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-900 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs font-semibold mb-1">
                  <Terminal className="w-3.5 h-3.5" />
                  Researcher Diagnostic Tool
                </div>
                <h3 className="font-extrabold text-white text-base">
                  Interactive Decision Trace & Multi-Agent Routing Inspector
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Execute test queries across all 3 search modes and inspect agent orchestration triggers, partner inventory recoveries, and parsed constraints.
                </p>
              </div>

              {scenariosList.length > 0 && (
                <div className="flex items-center gap-2">
                  <label htmlFor="scenario-quick-load" className="text-xs text-slate-400">Load Scenario:</label>
                  <select
                    id="scenario-quick-load"
                    aria-label="Load Scenario"
                    value={selectedScenarioId}
                    onChange={(e) => handleSelectScenario(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">— Choose a scenario —</option>
                    {scenariosList.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        [{sc.category}] {sc.id}: {sc.title || sc.target_title || sc.description?.slice(0, 45)}...
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Query Form */}
            <form onSubmit={handleRunInspector} className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-2">
                <label htmlFor="inspector-category" className="block text-[11px] font-medium text-slate-400 mb-1">Category</label>
                <select
                  id="inspector-category"
                  aria-label="Category"
                  value={inspectorCategory}
                  onChange={(e) => setInspectorCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-2"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="inspector-search-type" className="block text-[11px] font-medium text-slate-400 mb-1">Search Type</label>
                <select
                  id="inspector-search-type"
                  aria-label="Search Type"
                  value={inspectorType}
                  onChange={(e) => setInspectorType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-2"
                >
                  <option value="general">General Requirements</option>
                  <option value="specific">Specific Product</option>
                </select>
              </div>

              <div className="md:col-span-6">
                <label htmlFor="inspector-nl-query" className="block text-[11px] font-medium text-slate-400 mb-1">Natural-Language Query</label>
                <input
                  id="inspector-nl-query"
                  type="text"
                  value={inspectorQuery}
                  onChange={(e) => setInspectorQuery(e.target.value)}
                  placeholder="e.g. 17 inch gaming laptop under 80000 with 16gb ram"
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2 flex items-end">
                <button
                  type="submit"
                  disabled={inspectorRunning || !inspectorQuery.trim()}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  {inspectorRunning ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  Execute Diagnostics
                </button>
              </div>
            </form>
          </div>

          {/* Inspector Error */}
          {inspectorError && (
            <div className="p-4 bg-red-50 border-b border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span>Diagnostic retrieval failed: {inspectorError}</span>
            </div>
          )}

          {/* Inspector Output */}
          {inspectorResults && (
            <div className="p-6 space-y-6">
              {/* Tab Selector for Modes */}
              <div className="flex border-b border-slate-200">
                {[
                  { id: 'orchestrated', name: 'Mode 3 · Orchestrated Pipeline', badge: 'Orchestrated' },
                  { id: 'optimized', name: 'Mode 2 · Optimized MMR', badge: 'Optimized' },
                  { id: 'baseline', name: 'Mode 1 · Baseline TF-IDF', badge: 'Baseline' },
                ].map((tab) => {
                  const mData = inspectorResults[tab.id];
                  const triggered = mData?.orchestration_triggered;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveInspectorTab(tab.id)}
                      className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
                        activeInspectorTab === tab.id
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <span>{tab.name}</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        ({mData?.clientLatencyMs}ms)
                      </span>
                      {triggered && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-semibold">
                          Stockout Recovered
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active Tab Content */}
              {(() => {
                const current = inspectorResults[activeInspectorTab];
                if (!current) return null;

                const trace = current.decision_trace;
                const constraints = current.parsed_constraints || {};
                const results = current.results || [];

                return (
                  <div className="space-y-6">
                    {/* Metadata & Routing Status */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Box 1: Pipeline Execution */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                          Pipeline Metadata
                        </div>
                        <div className="text-xs text-slate-800 space-y-1">
                          <div>
                            <span className="text-slate-500">Mode:</span>{' '}
                            <code className="font-bold text-slate-900">{current.mode}</code>
                          </div>
                          <div>
                            <span className="text-slate-500">Category:</span>{' '}
                            <span className="capitalize">{current.category}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Search Type:</span>{' '}
                            <span>{current.search_type}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Latency:</span>{' '}
                            <span className="font-mono font-semibold">{current.clientLatencyMs} ms</span>
                          </div>
                        </div>
                      </div>

                      {/* Box 2: Parsed Constraints */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1 flex items-center justify-between">
                          <span>Parsed Constraints</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {Object.keys(constraints).length} detected
                          </span>
                        </div>
                        {Object.keys(constraints).length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {Object.entries(constraints).map(([k, v]) => (
                              <span
                                key={k}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-blue-50 text-blue-800 border border-blue-200 font-mono"
                              >
                                <span className="font-semibold text-blue-900">{k}:</span>
                                <span>{String(v)}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 italic mt-2">
                            No structured constraints extracted (pure lexical matching).
                          </p>
                        )}
                      </div>

                      {/* Box 3: Orchestration Trigger Status */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                          Orchestration Agent Trigger
                        </div>
                        {current.orchestration_triggered ? (
                          <div className="mt-2 space-y-1 text-xs text-amber-900">
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-100 border border-amber-300 font-bold text-amber-800">
                              <Flame className="w-3.5 h-3.5 text-amber-600" />
                              Stockout Trigger Activated
                            </div>
                            <p className="text-[11px] text-amber-700 mt-1">
                              Top candidate is out-of-stock. Adaptive multi-agent recovery routed to external partner inventory.
                            </p>
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-slate-500 space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
                              Not Triggered / In-Stock
                            </span>
                            <p className="text-[11px] text-slate-500 mt-1">
                              Catalog items available or stockout handling inactive for this condition.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Decision Trace Log Box */}
                    {trace && (
                      <div className="rounded-xl border border-slate-200 bg-slate-900 text-slate-200 p-4">
                        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                          <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                            <Terminal className="w-4 h-4" />
                            Backend Decision Trace Log
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            trigger_reason: {trace.trigger_reason || 'none'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                          <div className="space-y-1.5">
                            <div>
                              <span className="text-slate-400">Recovery Action:</span>{' '}
                              <span className="text-amber-300 font-bold">{trace.recovery_action || 'none'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Stockout Product ID:</span>{' '}
                              <span className="text-slate-200">{trace.stockout_product_id || 'n/a'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Stockout Title:</span>{' '}
                              <span className="text-slate-200">{trace.stockout_product_title || 'n/a'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Partner Queried:</span>{' '}
                              <span className="text-slate-200">{trace.partner_searched ? 'YES' : 'NO'}</span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div>
                              <span className="text-slate-400">Partner Match Found:</span>{' '}
                              <span className="text-emerald-400 font-bold">
                                {trace.partner_match_found ? 'YES (Rank 1 restored)' : 'NO'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Substitute Selected:</span>{' '}
                              <span className="text-slate-200">{trace.substitute_selected ? 'YES' : 'NO'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Latency Overhead:</span>{' '}
                              <span className="text-blue-300">
                                {trace.agent_latency_ms !== undefined ? `${trace.agent_latency_ms} ms` : 'n/a'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {trace.explanation && (
                          <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 italic">
                            Agent explanation: "{trace.explanation}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* Retrieved Product List */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-blue-600" />
                          Retrieved Results ({results.length} items)
                        </h4>
                        <span className="text-xs text-slate-500">
                          Mode: <span className="font-mono font-semibold">{current.mode}</span>
                        </span>
                      </div>

                      <div className="space-y-2">
                        {results.map((prod, idx) => {
                          const isPartner = prod.source && prod.source !== 'catalog';
                          const inStock = prod.in_stock !== false;
                          return (
                            <div
                              key={prod.product_id || idx}
                              className={`p-3 rounded-lg border flex items-center justify-between gap-4 text-xs ${
                                isPartner
                                  ? 'bg-amber-50/70 border-amber-300'
                                  : inStock
                                  ? 'bg-white border-slate-200'
                                  : 'bg-rose-50/70 border-rose-300'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 shrink-0">
                                  #{idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-slate-900 truncate">
                                      {prod.product_title}
                                    </span>
                                    {isPartner && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-400">
                                        Partner: {prod.source}
                                      </span>
                                    )}
                                    {!inStock && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-900 border border-rose-400">
                                        OUT OF STOCK
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                    <span>Brand: <strong>{prod.product_brand || 'Unknown'}</strong></span>
                                    <span>·</span>
                                    <span>ID: <code className="text-slate-600">{prod.product_id}</code></span>
                                    {prod.score !== undefined && (
                                      <>
                                        <span>·</span>
                                        <span>Score: <strong className="font-mono">{Number(prod.score).toFixed(3)}</strong></span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div className="font-bold text-slate-900 font-mono">
                                  {formatINR(prod.final_price || prod.price)}
                                </div>
                                {prod.constraint_match !== undefined && (
                                  <div className="text-[10px] text-slate-500">
                                    Match: {Math.round(prod.constraint_match * 100)}%
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* SECTION 5: Recent Submissions Log Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                Recent Participant Submissions Log
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Last recorded submissions from SQLite database (N = {summary?.recent_submissions?.length || 0})
              </p>
            </div>
            <a
              href={csvDownloadUrl}
              download="human_evaluation_results.csv"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Export CSV <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <th className="py-3 px-4">Session ID</th>
                  <th className="py-3 px-4">Task Info</th>
                  <th className="py-3 px-4 text-center">Satisfaction (1-7)</th>
                  <th className="py-3 px-4 text-center">Preferred System</th>
                  <th className="py-3 px-4 text-center">Target Outcome</th>
                  <th className="py-3 px-4">Participant Notes</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {summary?.recent_submissions && summary.recent_submissions.length > 0 ? (
                  summary.recent_submissions.map((sub, i) => (
                    <tr key={sub.submission_id || i} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        {sub.session_id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="capitalize font-semibold text-slate-900">{sub.category}</span>
                          {sub.scenario_id && sub.scenario_id.startsWith('dynamic_spec_') ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Dynamic Spec
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                              Fixed ({sub.search_type || 'scenario'})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900 font-mono">
                        {sub.overall_satisfaction ? `${sub.overall_satisfaction} / 7` : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            sub.preferred_condition === 'orchestrated'
                              ? 'bg-blue-100 text-blue-800'
                              : sub.preferred_condition === 'optimized'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {sub.preferred_condition || 'none'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center capitalize text-slate-700 font-medium">
                        {sub.target_retrieval_outcome || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={sub.comments}>
                        {sub.comments || <span className="italic text-slate-300">No notes</span>}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400 font-mono text-[11px]">
                        {sub.submitted_at ? new Date(sub.submitted_at).toLocaleTimeString() : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                      No submissions recorded in the database yet. Launch the Human Evaluation Workflow to test!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
