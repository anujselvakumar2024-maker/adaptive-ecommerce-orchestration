import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useExperimentSession } from '../hooks/useExperimentSession';
import { CATEGORIES } from '../data/categories';
import { BENCHMARK_OVERVIEW } from '../data/benchmarks';
import {
  CategoryIcon,
  FlaskConical,
  Search,
  Sparkles,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Truck,
  Package,
  Layers,
  Activity,
  ChevronRight,
} from '../components/common/CategoryIcon';

export default function WelcomePage() {
  const navigate = useNavigate();
  const { session, setCategory, setSearchType, backendHealth } = useExperimentSession();

  const handleCategoryClick = (catId) => {
    setCategory(catId);
    navigate(`/discover?category=${catId}`);
  };

  const handleStartExperiment = (taskType = null) => {
    if (taskType) setSearchType(taskType);
    navigate('/experiment');
  };

  return (
    <div className="flex flex-col w-full pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/60 via-slate-50 to-white pt-8 pb-16 border-b border-slate-200/60">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 left-10 w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 relative z-10">
          <div className="flex flex-col max-w-4xl gap-4">
            {/* Research Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 text-primary font-mono text-xs font-semibold self-start border border-blue-200/80">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>DAA Academic Research Prototype · Centralized Adaptive Orchestration</span>
            </div>

            {/* Title */}
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-950 leading-tight">
              Adaptive Multi-Agent Orchestration for Stockout Recovery &amp; Product Discovery
            </h1>

            {/* Subtitle */}
            <p className="font-body-lg text-base sm:text-lg text-slate-600 leading-relaxed max-w-3xl">
              When best-ranked products encounter stockouts, standard e-commerce engines drop them or display irrelevant fillers.
              Our framework introduces transaction-aware adaptive orchestration: automatically recovering exact targets through merchant partners,
              reranking attribute-aligned substitutes, and optimizing relevance and brand diversity.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleStartExperiment()}
                className="px-6 py-3.5 rounded-xl bg-primary hover:bg-blue-800 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 group active:scale-[0.99]"
              >
                <FlaskConical size={18} />
                <span>Start Human-Evaluation Experiment</span>
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>

              <Link
                to="/discover"
                className="px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-semibold text-sm border border-slate-300 shadow-2xs transition-all flex items-center gap-2"
              >
                <Search size={18} className="text-primary" />
                <span>Explore Live Product Discovery</span>
              </Link>

              <Link
                to="/benchmarks"
                className="px-4 py-3.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <BarChart3 size={16} />
                <span>Benchmark Data</span>
              </Link>
            </div>

            {/* Real Data Highlight */}
            <div className="flex flex-wrap items-center gap-4 pt-4 text-xs font-mono text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <strong>1,145</strong> Real Amazon ESCI Catalog SKUs
              </span>
              <span>·</span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <strong>173</strong> Ground-Truth Query Benchmarks
              </span>
              <span>·</span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <strong>Zero Target Leakage</strong> Experimental Guarantee
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Product Categories Section with Icons */}
      <section className="max-w-[1360px] mx-auto px-4 sm:px-8 py-12 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-primary font-bold">
              Catalog Domains
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mt-1">
              Select a Product Category to Explore
            </h2>
          </div>
          <p className="text-sm text-slate-500 max-w-md">
            Click any domain to test queries on real Amazon ESCI products across laptops, phones, watches, and refrigerators.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryClick(cat.id)}
              className="text-left p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 shadow-2xs hover:shadow-md transition-all duration-200 group flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 text-primary flex items-center justify-center border border-blue-100 group-hover:scale-105 transition-transform mb-4">
                  <CategoryIcon category={cat.id} size={26} strokeWidth={1.8} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors">
                  {cat.pluralName}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {cat.subtitle}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-500">
                <span className="font-semibold text-slate-700">{cat.catalogCount} Verified Items</span>
                <span className="text-primary flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                  Browse <ChevronRight size={13} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Three Search Approaches Explained */}
      <section className="bg-slate-100/70 border-y border-slate-200/80 py-16 w-full">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-mono uppercase tracking-wider text-primary font-bold">
              Comparative Search Architecture
            </span>
            <h2 className="text-3xl font-bold text-slate-950 mt-1">
              Three Experimental Search Conditions
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Every query in our evaluation study executes simultaneously across these three distinct pipelines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Baseline */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-xs font-semibold mb-3">
                  Condition 01 · Baseline
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Semantic TF-IDF Retrieval
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Standard retrieval matching unigram and bigram token features against catalog text using cosine similarity.
                </p>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>TF-IDF semantic relevance</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-400">
                    <span className="w-3.5 text-center font-bold">✕</span>
                    <span>No structured constraint parsing</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-400">
                    <span className="w-3.5 text-center font-bold">✕</span>
                    <span>No diversity reranking (redundancy risk)</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-400">
                    <span className="w-3.5 text-center font-bold">✕</span>
                    <span>No stockout recovery (drops out-of-stock items)</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 font-mono text-xs text-slate-500">
                Hit@5: 42.2% · Latency: ~15.3 ms
              </div>
            </div>

            {/* Optimized */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono text-xs font-semibold mb-3">
                  Condition 02 · Optimized
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Constraint + Diversity Ranking
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Combines semantic matching with query-parsed numerical constraints (budget, RAM, storage) and Intent-Adaptive MMR reranking.
                </p>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>70/30 semantic &amp; constraint scoring</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>Hard price bounds on general queries</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>Intent-Adaptive MMR brand diversity</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-400">
                    <span className="w-3.5 text-center font-bold">✕</span>
                    <span>No stockout recovery (internal inventory only)</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 font-mono text-xs text-slate-500">
                Diversity: 68.6% · MRR: 0.262
              </div>
            </div>

            {/* Orchestrated */}
            <div className="p-6 rounded-2xl bg-white border-2 border-primary shadow-sm flex flex-col justify-between relative">
              <span className="absolute -top-3 right-5 px-2.5 py-0.5 bg-primary text-white font-mono text-[10px] font-bold rounded-full uppercase tracking-wider">
                Proposed System
              </span>
              <div>
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono text-xs font-semibold mb-3">
                  Condition 03 · Orchestrated
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Centralized Adaptive Orchestration
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Monitors best-ranked candidates for stockout. Adaptively triggers exact merchant partner recovery or substitute reranking with explainable trace.
                </p>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>All optimized retrieval &amp; MMR benefits</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>Simulated partner inventory recovery</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>6/6 controlled partner-available stockouts recovered at Rank #1</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>Explainable decision trace for researchers</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 font-mono text-xs text-primary font-bold">
                Hit@5: 42.2% · MRR: 0.274 · Diversity: 69.3%
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benchmark Summary Teaser */}
      <section className="max-w-[1360px] mx-auto px-4 sm:px-8 py-16 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-primary font-bold">
              Empirical Findings
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              Benchmark Highlights (173 Real ESCI Queries)
            </h2>
          </div>
          <Link
            to="/benchmarks"
            className="text-sm font-semibold text-primary hover:text-blue-800 flex items-center gap-1"
          >
            <span>View Full Benchmark Analysis &amp; Figures</span>
            <ArrowRight size={15} />
          </Link>
        </div>

        {/* Metrics Table */}
        <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-mono border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-5">System Mode</th>
                <th className="py-3.5 px-5">Hit@5</th>
                <th className="py-3.5 px-5">MRR</th>
                <th className="py-3.5 px-5">Brand Diversity</th>
                <th className="py-3.5 px-5">Mean Relevance</th>
                <th className="py-3.5 px-5">Average Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-mono text-xs">
              {BENCHMARK_OVERVIEW.modes.map((m) => {
                const isOrch = m.mode === 'orchestrated';
                return (
                  <tr key={m.mode} className={isOrch ? 'bg-blue-50/50 font-bold text-primary' : 'hover:bg-slate-50'}>
                    <td className="py-4 px-5 font-sans font-semibold text-slate-900 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isOrch ? 'bg-primary' : 'bg-slate-400'}`} />
                      {m.label}
                    </td>
                    <td className="py-4 px-5">{m.hitAt5Formatted}</td>
                    <td className="py-4 px-5">{m.mrrFormatted}</td>
                    <td className="py-4 px-5">{m.brandDiversityFormatted}</td>
                    <td className="py-4 px-5">{m.meanRelevanceFormatted}</td>
                    <td className="py-4 px-5">{m.latencyFormatted}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Honest Research Interpretation Note */}
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed space-y-1">
          <p>
            <strong>Research Interpretation:</strong> Across 173 real ESCI queries, the orchestrated system matches baseline Hit@5 (42.20%) while improving MRR from 0.263 to 0.274 and increasing brand diversity from 64.62% to 69.34%.
          </p>
          <p>
            <strong>Methodological Note:</strong> Search queries and human relevance labels are real from the Amazon ESCI dataset; product prices, stock states, and partner availability are deterministically simulated.
          </p>
        </div>
      </section>

      {/* Participant Testing Call to Action Banner */}
      <section className="max-w-[1360px] mx-auto px-4 sm:px-8 w-full">
        <div className="rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-8 sm:p-12 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl space-y-3">
            <span className="px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-mono font-semibold uppercase tracking-wider backdrop-blur-xs">
              Human Evaluation Protocol
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold">
              Participate in Our Research Study
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Help us evaluate whether adaptive stockout recovery aligns with human search preferences.
              Takes approximately 5–8 minutes. No personal identifying information is collected.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleStartExperiment('specific')}
              className="px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-blue-950 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span>Start Evaluation (Task 1: Specific)</span>
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => handleStartExperiment('general')}
              className="px-6 py-3.5 rounded-xl bg-blue-800/80 hover:bg-blue-800 text-white font-semibold text-sm border border-blue-700/80 transition-colors flex items-center justify-center gap-2"
            >
              <span>Task 2: General Search</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
