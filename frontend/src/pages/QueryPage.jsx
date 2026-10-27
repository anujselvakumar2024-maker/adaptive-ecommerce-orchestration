import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useExperimentSession } from '../hooks/useExperimentSession';
import { getCategoryById, formatINR } from '../data/categories';
import StageInstructionModal from '../components/common/StageInstructionModal';
import {
  CategoryIcon,
  Lock,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Info,
} from '../components/common/CategoryIcon';

export default function QueryPage() {
  const navigate = useNavigate();
  const {
    session,
    setUserQuery,
    runComparisonExperiment,
    showToast,
  } = useExperimentSession();

  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const activeScenario = session.activeScenario;
  const activeCategoryObj = getCategoryById(session.category);
  const isSpecificTask = session.searchType === 'specific';

  // If user arrived without selecting a scenario or defining specs, redirect to /experiment
  if (!activeScenario) {
    return (
      <div className="w-full max-w-[800px] mx-auto px-4 py-16 text-center space-y-4">
        <AlertTriangle size={36} className="text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">No Target Task Configured</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Please review or choose your product task before entering a search query.
        </p>
        <Link
          to="/experiment"
          className="inline-flex px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-blue-800 transition-colors"
        >
          Go to Task Setup →
        </Link>
      </div>
    );
  }

  const constraints = activeScenario.target_constraints || {};

  const handleQueryChange = (val) => {
    if (errorMsg) setErrorMsg('');
    setUserQuery(val);
  };

  const handleRunSearch = async (e) => {
    if (e) e.preventDefault();
    const trimmed = (session.userQuery || '').trim();
    if (!trimmed) {
      setErrorMsg('Please enter your own natural-language search query.');
      showToast('Please type a search query.', 'error');
      return;
    }

    setErrorMsg('');
    setIsRunning(true);

    try {
      await runComparisonExperiment(trimmed);
      showToast('Search completed. Compare the three sets of results.', 'success');
      navigate('/comparison');
    } catch (err) {
      setErrorMsg(err.message || 'Search execution failed.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="w-full max-w-[1100px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
      <StageInstructionModal
        sessionId={session.sessionId}
        stageKey="query"
        title="What to do"
        message="Write your search query as if you were a customer looking for the product or specifications shown above. Next, you’ll compare the search results returned for your query."
      />

      {/* Step Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mb-1">
            <Link to="/experiment" className="hover:text-primary transition-colors">
              Task Setup
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Stage 02 · Query Entry</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
            Write Your Search Query
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            {isSpecificTask
              ? 'You will be shown a target product and asked to search for it in your own words.'
              : 'Choose the type of product and specifications you would be looking to buy, then search for it in your own words.'}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-600 shadow-2xs">
          <span>Session: {session.sessionId}</span>
        </div>
      </div>

      {/* Target Task Brief Card (Displays strictly participant-facing requirements) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-primary flex items-center justify-center border border-blue-100">
              <CategoryIcon category={session.category} size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
                  {isSpecificTask
                    ? 'Specific Product Search Task'
                    : 'General Product Requirements Task'}
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono capitalize mt-0.5">
                Category: {activeCategoryObj?.name || session.category}
              </div>
            </div>
          </div>

          <Link
            to="/experiment"
            className="text-xs text-primary hover:text-blue-800 font-semibold transition-colors"
          >
            {isSpecificTask ? 'Review Target →' : 'Edit Requirements →'}
          </Link>
        </div>

        {/* Task Objective Description */}
        {isSpecificTask ? (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="text-xs font-mono uppercase text-slate-500 font-bold">
              Target Product Title:
            </div>
            <p className="text-base font-bold text-slate-900 leading-snug">
              {activeScenario.target_product_title}
            </p>
            {activeScenario.target_brand && (
              <div className="text-xs font-mono text-slate-500">
                Brand: <strong className="text-slate-800">{activeScenario.target_brand}</strong>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="text-xs font-mono uppercase text-slate-500 font-bold">
              Selected Product Requirements:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
              {/* Budget Range */}
              {(constraints.min_price || constraints.max_price) && (
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs">
                  <div className="text-slate-400 font-mono text-[10px] uppercase font-bold">Budget Window</div>
                  <div className="font-bold text-blue-700 font-mono mt-0.5">
                    {constraints.min_price && constraints.max_price
                      ? `${formatINR(constraints.min_price)} – ${formatINR(constraints.max_price)}`
                      : constraints.max_price
                      ? `Up to ${formatINR(constraints.max_price)}`
                      : `From ${formatINR(constraints.min_price)}`}
                  </div>
                </div>
              )}

              {/* RAM */}
              {(constraints.min_ram_gb || constraints.ram_gb) && (
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs">
                  <div className="text-slate-400 font-mono text-[10px] uppercase font-bold">RAM</div>
                  <div className="font-bold text-slate-900 font-mono mt-0.5">
                    {constraints.min_ram_gb || constraints.ram_gb} GB or more
                  </div>
                </div>
              )}

              {/* Storage */}
              {(constraints.min_storage_gb || constraints.storage_gb) && (
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs">
                  <div className="text-slate-400 font-mono text-[10px] uppercase font-bold">Storage / SSD</div>
                  <div className="font-bold text-slate-900 font-mono mt-0.5">
                    {(() => {
                      const val = constraints.min_storage_gb || constraints.storage_gb;
                      return val >= 1024 ? `${val / 1024} TB or more` : `${val} GB or more`;
                    })()}
                  </div>
                </div>
              )}

              {/* Screen Size */}
              {((constraints.min_screen_size && constraints.max_screen_size) || constraints.screen_inches) && (
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs">
                  <div className="text-slate-400 font-mono text-[10px] uppercase font-bold">Screen Size</div>
                  <div className="font-bold text-slate-900 font-mono mt-0.5">
                    {constraints.min_screen_size && constraints.max_screen_size
                      ? `${constraints.min_screen_size}" – ${constraints.max_screen_size}"`
                      : `${constraints.screen_inches}"`}
                  </div>
                </div>
              )}

              {/* Color */}
              {constraints.color && constraints.color !== 'any' && (
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs">
                  <div className="text-slate-400 font-mono text-[10px] uppercase font-bold">Color Preference</div>
                  <div className="font-bold text-slate-900 font-mono capitalize mt-0.5">
                    {constraints.color}
                  </div>
                </div>
              )}

              {/* Brand */}
              {(constraints.preferred_brand || (constraints.brand && constraints.brand !== 'any')) && (
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs">
                  <div className="text-slate-400 font-mono text-[10px] uppercase font-bold">Preferred Brand</div>
                  <div className="font-bold text-slate-900 font-mono capitalize mt-0.5">
                    {constraints.preferred_brand || constraints.brand}
                  </div>
                </div>
              )}

              {/* Refrigerator Capacity */}
              {constraints.min_capacity_cu_ft && (
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs">
                  <div className="text-slate-400 font-mono text-[10px] uppercase font-bold">Capacity</div>
                  <div className="font-bold text-slate-900 font-mono mt-0.5">
                    {constraints.min_capacity_cu_ft} cu. ft. or more
                  </div>
                </div>
              )}

              {/* Watch Feature */}
              {constraints.feature && (
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs">
                  <div className="text-slate-400 font-mono text-[10px] uppercase font-bold">Feature Focus</div>
                  <div className="font-bold text-slate-900 font-mono capitalize mt-0.5">
                    {constraints.feature}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
          <Info size={14} className="text-primary shrink-0" />
          <span>
            Write the search query you would normally type into an online store search bar to find this product.
          </span>
        </div>
      </div>

      {/* Query Formulation Input Box */}
      <form
        onSubmit={handleRunSearch}
        className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <label htmlFor="participant-query-input" className="text-sm font-bold text-slate-900">
            Enter your search query:
          </label>
          <span className="text-xs font-mono text-slate-400">
            {session.userQuery?.length || 0} characters
          </span>
        </div>

        <div className="relative">
          <textarea
            id="participant-query-input"
            rows={3}
            value={session.userQuery || ''}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Type your search query in your own words..."
            className="w-full p-4 rounded-2xl bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:border-primary focus:ring-2 focus:ring-blue-100 text-base font-medium transition-all outline-none resize-none"
          />
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Target Privacy Callout */}
        <div className="p-3.5 rounded-xl bg-slate-50 text-xs text-slate-600 flex items-start gap-2 border border-slate-100">
          <Lock size={15} className="text-slate-400 shrink-0 mt-0.5" />
          <span>
            Target privacy: Only your search query is used during retrieval. The target information is used only after results are returned for evaluation.
          </span>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <Link
            to="/experiment"
            className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Back to Task Setup
          </Link>

          <button
            type="submit"
            disabled={isRunning}
            className="px-8 py-3.5 rounded-xl bg-primary hover:bg-blue-800 disabled:opacity-60 text-white font-semibold text-sm shadow-sm hover:shadow transition-all flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Running search...</span>
              </>
            ) : (
              <>
                <span>Search &amp; Compare Results</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
