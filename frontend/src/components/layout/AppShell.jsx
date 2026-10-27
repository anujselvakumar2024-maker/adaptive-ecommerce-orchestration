import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header, { isExperimentPathname } from './Header';
import { useExperimentSession } from '../../hooks/useExperimentSession';
import { getApiBaseUrl } from '../../services/api';
import {
  FlaskConical,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
} from '../common/CategoryIcon';

export function getParticipantGuideStorageKey(sessionId) {
  return `searchlab_participant_guide_seen_${sessionId || 'default'}`;
}

export default function AppShell({ children }) {
  const location = useLocation();
  const [activeModal, setActiveModal] = useState(null);
  const { session, backendHealth, refreshHealth, toast, dismissToast } =
    useExperimentSession();

  const isExperimentRoute = isExperimentPathname(location.pathname);
  const activeBaseUrl = backendHealth.baseUrl || getApiBaseUrl();
  const isLocalBackend =
    activeBaseUrl.includes('localhost') || activeBaseUrl.includes('127.0.0.1');

  // Auto-open the Participant Guide once when a participant starts on /experiment
  useEffect(() => {
    if (!location.pathname.startsWith('/experiment')) return;
    const guideKey = getParticipantGuideStorageKey(session?.sessionId);
    try {
      if (typeof sessionStorage !== 'undefined') {
        if (sessionStorage.getItem(guideKey) !== 'true') {
          sessionStorage.setItem(guideKey, 'true');
          setActiveModal('how-it-works');
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [location.pathname, session?.sessionId]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-body-md text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-900">
      <Header onOpenModal={(modalType) => setActiveModal(modalType)} />

      {/* Disconnected Backend Warning Banner if offline */}
      {!backendHealth.checking && !backendHealth.connected && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-red-600 text-white px-4 py-2 text-center text-sm font-medium flex flex-wrap items-center justify-center gap-2 shadow-sm">
          <AlertTriangle size={16} />
          <span>
            FastAPI Backend is currently unreachable at{' '}
            <code className="bg-red-700/80 px-1.5 py-0.5 rounded text-xs font-mono">
              {activeBaseUrl}
            </code>
            .{' '}
            {isLocalBackend ? (
              <>
                Run{' '}
                <code className="bg-red-700/80 px-1.5 py-0.5 rounded text-xs font-mono">
                  python -m uvicorn api:app --port 8000
                </code>{' '}
                to enable live search and experiment logging.
              </>
            ) : (
              'The deployed Render service may be waking up from a cold start — please wait a moment and retry.'
            )}
          </span>
          <button
            type="button"
            onClick={refreshHealth}
            className="ml-1 px-2.5 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white text-xs font-mono font-semibold transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Main Page Body */}
      <main className="w-full pt-24 lg:pt-20 flex-1 flex flex-col">
        {children}
      </main>

      {/* Global Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 text-white shadow-xl border border-slate-700 transition-all transform animate-in fade-in slide-in-from-bottom-3 duration-200 max-w-md"
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          ) : toast.type === 'error' ? (
            <AlertTriangle size={18} className="text-red-400 shrink-0" />
          ) : (
            <Info size={18} className="text-blue-400 shrink-0" />
          )}
          <span className="text-sm font-medium leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={dismissToast}
            className="text-slate-400 hover:text-white transition-colors ml-auto shrink-0 p-1"
            aria-label="Dismiss toast"
          >
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* Footer: Simplified on participant experiment routes, technical on research routes */}
      <footer className="w-full bg-white border-t border-slate-200 py-6 mt-16">
        {isExperimentRoute ? (
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 text-center text-slate-500 text-xs">
            Academic Research Study · Anonymous Session
          </div>
        ) : (
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500 text-xs text-center md:text-left">
            <div className="space-y-1">
              <div className="font-semibold text-slate-700">
                Adaptive Multi-Agent Orchestration for Stockout Recovery and Relevance–Diversity-Aware Product Discovery in E-Commerce
              </div>
              <div>
                Academic Research Prototype · Department of Computer Science &amp; Engineering
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 font-mono-data text-[11px] text-slate-500">
              <span className="flex items-center gap-1" title={activeBaseUrl}>
                <span className={`w-2 h-2 rounded-full ${backendHealth.connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {backendHealth.connected
                  ? `FastAPI Online (${backendHealth.products} SKUs)`
                  : 'Backend Offline'}
              </span>
              <span>·</span>
              <span>173 ESCI Ground-Truth Queries</span>
              <span>·</span>
              <span>Zero-Target-Leakage Protocol</span>
            </div>
          </div>
        )}
      </footer>

      {/* Study Guide / Protocol Information Modal */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="study-guide-modal-title"
            className="max-w-2xl w-full bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FlaskConical size={20} className="text-primary" />
                <h3
                  id="study-guide-modal-title"
                  className="font-headline-sm text-lg font-bold text-slate-900"
                >
                  {activeModal === 'how-it-works'
                    ? isExperimentRoute
                      ? 'How this study works'
                      : 'How the Human Evaluation Study Works'
                    : 'About This Research Prototype'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label="Close guide"
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <XCircle size={18} />
              </button>
            </div>

            {activeModal === 'how-it-works' ? (
              isExperimentRoute ? (
                <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                  <div className="space-y-2.5">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <strong className="text-slate-900 block mb-0.5">
                        1. Choose or review a product target
                      </strong>
                      <span>
                        You will either select the type of product you want and its specifications, or be shown a specific product to find.
                      </span>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <strong className="text-slate-900 block mb-0.5">
                        2. Write your own search query
                      </strong>
                      <span>
                        Search for it in your own words, just as you normally would on an online shopping website.
                      </span>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <strong className="text-slate-900 block mb-0.5">
                        3. Compare three search experiences
                      </strong>
                      <span>
                        You will see three sets of search results labelled A, B, and C. Review them based only on which results are most useful to you.
                      </span>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <strong className="text-slate-900 block mb-0.5">
                        4. Give your feedback
                      </strong>
                      <span>
                        Rate the three search experiences and complete a short questionnaire.
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 pt-1">
                    There are no right or wrong answers. Please use your normal shopping judgment.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                  <p>
                    This research evaluation measures how well different search architectures satisfy product discovery queries, especially when optimal items are out of stock.
                  </p>
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <strong className="text-slate-900">1. Scenario &amp; Target Presentation:</strong> You are presented with a product discovery task (either an exact model or specific feature constraints). The hidden ground-truth target is kept strictly private by the client state.
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <strong className="text-slate-900">2. Natural-Language Query:</strong> You formulate and enter your own natural query, exactly as you would on an e-commerce platform. The query is dispatched to the backend without any target information.
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <strong className="text-slate-900">3. Blinded 3-Way Search Execution:</strong> The backend retrieves results using Baseline, Optimized, and Adaptive Orchestrated pipelines. Results are presented blindly as System A, B, and C in randomized order.
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <strong className="text-slate-900">4. Objective Evaluation &amp; Research Questionnaire:</strong> After retrieval, the backend evaluation calculates Hit@k and MRR against the hidden reference. You provide feedback on satisfaction, relevance, and purchase intention.
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                <p>
                  <strong>Research Contribution:</strong> Conventional e-commerce search algorithms rank catalog items solely based on lexical or embedding similarity. When high-relevance items encounter stockouts, standard systems simply drop them, causing customer churn.
                </p>
                <p>
                  Our architecture introduces <strong>Centralized Adaptive Orchestration</strong>:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-700">
                  <li>Detects stockout of best-ranked candidates in internal inventory.</li>
                  <li>Coordinates automated exact-product recovery via simulated partner inventory.</li>
                  <li>When exact recovery is unfeasible, adaptively routes to attribute-matched internal and partner substitutes.</li>
                  <li>Preserves search relevance while increasing brand diversity through intent-adaptive Maximal Marginal Relevance (MMR).</li>
                </ul>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-800 transition-colors"
              >
                {isExperimentRoute ? 'Got it' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
