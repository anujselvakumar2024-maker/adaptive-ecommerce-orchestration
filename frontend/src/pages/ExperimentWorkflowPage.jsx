import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExperimentSession } from '../hooks/useExperimentSession';
import { CATEGORIES, getCategoryById } from '../data/categories';
import ProductSpecificationBuilder from '../components/experiment/ProductSpecificationBuilder';
import StageInstructionModal from '../components/common/StageInstructionModal';
import {
  CategoryIcon,
  FlaskConical,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Info,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from '../components/common/CategoryIcon';

export default function ExperimentWorkflowPage() {
  const navigate = useNavigate();
  const {
    session,
    scenarios,
    scenariosLoading,
    grantConsent,
    selectScenario,
    setDynamicSpecification,
    setSearchType,
    setCategory,
    showToast,
  } = useExperimentSession();

  const [hasConsented, setHasConsented] = useState(session.consentGiven);
  const [showLegacyMode, setShowLegacyMode] = useState(false);

  useEffect(() => {
    setHasConsented(session.consentGiven);
  }, [session.consentGiven]);

  const activeCategoryObj = getCategoryById(session.category);
  const isSpecificTask = session.searchType === 'specific';
  const currentPool =
    session.searchType === 'general' ? scenarios.general : scenarios.specific;
  const filteredScenarios = currentPool.filter((s) => s.category === session.category);

  const handleConsentSubmit = async () => {
    await grantConsent();
    setHasConsented(true);
    showToast('Consent recorded. You can begin the study.', 'success');
  };

  const handleConfirmSpecification = (specs) => {
    setDynamicSpecification(specs);
    showToast('Requirements saved. Proceeding to query entry.', 'success');
    navigate('/query');
  };

  const handleTaskTypeSwitch = (type) => {
    setSearchType(type);
  };

  const handleCategorySwitch = (catId) => {
    setCategory(catId);
  };

  const handleSelectScenario = (scenario) => {
    selectScenario(scenario);
    showToast(`Scenario selected (${getCategoryById(scenario.category).name}).`, 'info');
  };

  const handleProceedWithScenario = () => {
    if (!session.activeScenario) {
      showToast('Please wait for the target product to load.', 'error');
      return;
    }
    navigate('/query');
  };

  // STEP 1: Participant Information and Informed Consent Screen
  if (!hasConsented) {
    return (
      <div className="w-full max-w-[960px] mx-auto px-4 sm:px-8 py-10">
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-primary flex items-center justify-center border border-blue-100">
              <FlaskConical size={24} />
            </div>
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
                Human-Evaluation Research Study
              </span>
              <h1 className="text-2xl font-bold text-slate-950 mt-0.5">
                Participant Information &amp; Consent
              </h1>
            </div>
          </div>

          <div className="prose prose-slate text-sm text-slate-600 leading-relaxed space-y-3 pt-2 border-t border-slate-100">
            <p>
              You are invited to take part in an academic research study evaluating product discovery and search result rankings in online shopping.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 font-normal">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-primary" />
                  <span>Anonymous Session</span>
                </div>
                <p className="text-xs text-slate-500">
                  You are identified only by a randomized session ID ({session.sessionId}). The study application does not store names, email addresses, student IDs, or IP addresses in the experiment database.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Info size={16} className="text-primary" />
                  <span>Duration &amp; Procedure</span>
                </div>
                <p className="text-xs text-slate-500">
                  Takes approximately 5–8 minutes. You will review or choose a product target, write a search query in your own words, compare three search experiences, and complete a short questionnaire.
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="font-semibold text-slate-800 text-sm">What will be recorded:</div>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li>Your assigned product task or selected requirements.</li>
                <li>The search query you write in your own words.</li>
                <li>The retrieved product rankings across the three search experiences.</li>
                <li>Your ratings and questionnaire responses.</li>
              </ul>
            </div>

            <p className="text-xs text-slate-500 pt-1">
              <strong>Voluntary Participation:</strong> Your participation is completely voluntary. You may decline or stop at any time by closing this tab or resetting your session.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              type="button"
              onClick={handleConsentSubmit}
              className="w-full sm:w-auto px-7 py-3 rounded-xl bg-primary hover:bg-blue-800 text-white font-semibold text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} />
              <span>I Understand &amp; Agree to Participate</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 2: Task Setup Screen (Specific Product Search Task OR General Product Requirements Task)
  return (
    <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-8">
      <StageInstructionModal
        sessionId={session.sessionId}
        stageKey="setup"
        title="What to do"
        message={
          isSpecificTask
            ? 'Review the product you have been asked to find. On the next screen, write the search query you would normally use to look for this product.'
            : 'Choose the type of product and the specifications you would be looking to buy. On the next screen, you’ll write a search query just as you would on a shopping website like Amazon.'
        }
      />

      {/* Step Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-primary font-bold uppercase tracking-wider mb-1">
            <span>Stage 01</span>
            <span>·</span>
            <span>
              {isSpecificTask
                ? 'Specific Product Search Task'
                : 'General Product Requirements Task'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
            {isSpecificTask
              ? 'Specific Product Search Task'
              : 'General Product Requirements Task'}
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            {isSpecificTask
              ? 'You will be shown a target product and asked to search for it in your own words.'
              : 'Choose the type of product and specifications you would be looking to buy, then search for it in your own words.'}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-600 self-start md:self-auto shadow-2xs">
          <ShieldCheck size={14} className="text-primary" />
          <span>Participant: {session.sessionId}</span>
        </div>
      </div>

      {/* Task Body: Specific Target Review OR General Specification Builder */}
      {isSpecificTask ? (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-primary flex items-center justify-center border border-blue-100 shrink-0">
              <CategoryIcon category={session.category} size={22} />
            </div>
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
                Assigned Target Product
              </div>
              <div className="text-xs text-slate-500 font-mono capitalize mt-0.5">
                Category: {activeCategoryObj?.name || session.category}
              </div>
            </div>
          </div>

          {session.activeScenario ? (
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="text-xs font-mono uppercase text-slate-500 font-bold">
                Product to Search For:
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                {session.activeScenario.target_product_title}
              </h2>
              {session.activeScenario.target_brand && (
                <div className="text-xs font-mono text-slate-600">
                  Brand:{' '}
                  <strong className="text-slate-900">
                    {session.activeScenario.target_brand}
                  </strong>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
              Loading your assigned product target...
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Info size={14} className="text-primary shrink-0" />
              <span>
                Review the product details above, then continue to write your own search query.
              </span>
            </div>

            <button
              type="button"
              disabled={!session.activeScenario}
              onClick={handleProceedWithScenario}
              className="px-7 py-3.5 rounded-xl bg-primary hover:bg-blue-800 disabled:opacity-50 text-white font-semibold text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <span>Continue to Search Query</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <ProductSpecificationBuilder
          initialCategory={session.category || 'laptop'}
          onConfirmSpecification={handleConfirmSpecification}
        />
      )}

      {/* Secondary / Advanced: Researcher Predefined Scenario Calibration (Collapsible) */}
      <div className="mt-4 pt-6 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setShowLegacyMode(!showLegacyMode)}
          className="w-full p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal size={16} className="text-slate-500" />
            <div>
              <span className="text-xs font-bold text-slate-800">
                Researcher Calibration Mode: Select from Predefined Static Scenarios
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Use fixed benchmark scenarios from scenarios.json for reproducible algorithm verification.
              </p>
            </div>
          </div>
          <div className="text-slate-400">
            {showLegacyMode ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        {showLegacyMode && (
          <div className="mt-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Predefined Benchmark Scenario Library
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Controlled tasks from the evaluation suite.
                </p>
              </div>
              <div className="text-xs font-mono text-slate-400">
                Category: {activeCategoryObj.name}
              </div>
            </div>

            {/* Task Type Switcher */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleTaskTypeSwitch('specific')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  session.searchType === 'specific'
                    ? 'bg-blue-50/70 border-primary ring-2 ring-primary/20'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Specific Product Discovery</span>
                  {session.searchType === 'specific' && <CheckCircle2 size={14} className="text-primary" />}
                </div>
                <p className="text-xs text-slate-500 mt-1">Exact SKU / Title discovery benchmark</p>
              </button>

              <button
                type="button"
                onClick={() => handleTaskTypeSwitch('general')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  session.searchType === 'general'
                    ? 'bg-blue-50/70 border-primary ring-2 ring-primary/20'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">General Constraint Search</span>
                  {session.searchType === 'general' && <CheckCircle2 size={14} className="text-primary" />}
                </div>
                <p className="text-xs text-slate-500 mt-1">Multi-attribute constraint satisfaction benchmark</p>
              </button>
            </div>

            {/* Category pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => {
                const isActive = session.category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySwitch(cat.id)}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <CategoryIcon category={cat.id} size={16} />
                    <span className="text-xs font-semibold">{cat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Scenarios Stream */}
            {scenariosLoading ? (
              <div className="p-6 text-center text-xs text-slate-500">Loading benchmark scenarios...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredScenarios.map((sc, idx) => {
                  const isSelected = session.activeScenario?.id === sc.id;
                  return (
                    <div
                      key={sc.id}
                      onClick={() => handleSelectScenario(sc)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-50/70 border-primary ring-2 ring-primary/20'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>Scenario #{idx + 1}</span>
                        {isSelected && <span className="text-primary font-bold">Selected</span>}
                      </div>
                      <div className="font-semibold text-xs text-slate-900 mt-1 line-clamp-2">
                        {sc.search_type === 'specific'
                          ? sc.target_product_title
                          : sc.description || `Constraint Task ${sc.id}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={!session.activeScenario}
                onClick={handleProceedWithScenario}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center gap-2"
              >
                <span>Proceed with Selected Scenario</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
