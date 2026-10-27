import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useExperimentSession } from '../hooks/useExperimentSession';
import { formatINR, getCategoryById } from '../data/categories';
import { ProductVisual } from '../components/common/CategoryIcon';
import StageInstructionModal from '../components/common/StageInstructionModal';
import {
  ArrowRight,
  AlertTriangle,
  EyeOff,
  Truck,
} from '../components/common/CategoryIcon';

export default function ComparisonPage() {
  const navigate = useNavigate();
  const { session } = useExperimentSession();

  const resultsData = session.searchResults;
  const activeCategoryObj = getCategoryById(session.category);

  // If user arrived without results, prompt to execute query first
  if (!resultsData || !resultsData.orderedColumns) {
    return (
      <div className="w-full max-w-[800px] mx-auto px-4 py-16 text-center space-y-4">
        <AlertTriangle size={36} className="text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">No Search Results Available</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Please formulate and run a query first before comparing search systems.
        </p>
        <Link
          to="/query"
          className="inline-flex px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-blue-800 transition-colors"
        >
          Go to Query Formulation →
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
      <StageInstructionModal
        sessionId={session.sessionId}
        stageKey="comparison"
        title="What to do"
        message="You are seeing results from three different versions of our search system. Compare the results as you would while shopping and decide which search experience was most useful to you. The system identities are hidden during the study."
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mb-1">
            <Link to="/query" className="hover:text-primary transition-colors">
              Query Entry
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Stage 03 · Result Comparison</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
            Compare Three Search Result Sets
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Review the three sets of search results returned for your query. The system identities are hidden during the study.
          </p>
        </div>
      </div>

      {/* Query & Task Brief Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
            Your Search Query
          </div>
          <div className="text-base font-bold text-slate-900 font-sans">
            &ldquo;{resultsData.query}&rdquo;
          </div>
          <div className="text-xs text-slate-500 font-mono">
            Category: {activeCategoryObj.name}
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-600 self-start md:self-auto">
          <EyeOff size={14} className="text-slate-500" />
          <span>Double-Blind Presentation Active</span>
        </div>
      </div>

      {/* 3-Column Comparative Grid (Blinded System A, System B, System C) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {resultsData.orderedColumns.map((colSlot, colIdx) => {
          const { displayLabel, variantLabel, data } = colSlot;
          const results = data?.results || [];

          return (
            <div
              key={colSlot.shortCode || colIdx}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between"
            >
              {/* Column Header */}
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center">
                      {String.fromCharCode(65 + colIdx)}
                    </span>
                    <div>
                      <h2 className="font-bold text-slate-900 text-sm">
                        {variantLabel} ({displayLabel})
                      </h2>
                      <div className="text-[10px] font-mono text-slate-400">
                        {results.length} Products Retrieved
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    ~{data.executionTimeMs}ms
                  </span>
                </div>

                {/* Ranked Product Results List */}
                <div className="space-y-3.5">
                  {results.map((product, rankIdx) => {
                    const finalPrice = product.final_price || product.price;

                    return (
                      <article
                        key={product.product_id || rankIdx}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                          <span className="font-bold text-slate-700">Rank #{rankIdx + 1}</span>
                          <span className="truncate max-w-[150px]">
                            {product.product_brand || 'Catalog Model'}
                          </span>
                        </div>

                        <div className="flex gap-3 items-center">
                          <div className="w-16 h-16 shrink-0">
                            <ProductVisual
                              product={product}
                              category={session.category}
                              size="sm"
                              className="w-full h-full"
                              showBrandBadge={false}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-slate-900 line-clamp-2 leading-snug">
                              {product.product_title}
                            </h3>
                            {product.product_color && (
                              <div className="text-[11px] text-slate-500 capitalize mt-0.5">
                                Color: {product.product_color}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-baseline justify-between pt-1 border-t border-slate-200/60 font-mono">
                          <span className="font-bold text-slate-900 text-sm">
                            {formatINR(finalPrice)}
                          </span>
                          {product.partner_delivery_days ? (
                            <span className="text-[11px] text-emerald-700 flex items-center gap-1">
                              <Truck size={11} />
                              Est: {product.partner_delivery_days}d
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Standard</span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              {/* Column Footer */}
              <div className="mt-5 pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-400 text-center">
                End of results
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation to Feedback Survey */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
        <div className="space-y-1 text-center sm:text-left">
          <div className="font-bold text-slate-900 text-sm">
            Finished reviewing the search results?
          </div>
          <p className="text-xs text-slate-500">
            Proceed to the survey to rate each search experience and share your feedback.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/feedback')}
          className="px-7 py-3 rounded-xl bg-primary hover:bg-blue-800 text-white font-semibold text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto"
        >
          <span>Continue to Feedback Survey</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
