import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useExperimentSession } from '../hooks/useExperimentSession';
import RatingControl, {
  PER_SYSTEM_RATING_QUESTIONS,
} from '../components/feedback/RatingControl';
import StageInstructionModal from '../components/common/StageInstructionModal';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from '../components/common/CategoryIcon';

export const LIKERT_QUESTIONS = [
  {
    key: 'overall_satisfaction',
    label: '1. Overall Satisfaction',
    question:
      'Overall, how satisfied are you with the search recommendations returned across this task?',
    lowLabel: '1 — Very Dissatisfied',
    highLabel: '5 — Very Satisfied',
  },
  {
    key: 'perceived_relevance',
    label: '2. Perceived Relevance',
    question:
      'How relevant were the top retrieved products to your search intent and requirements?',
    lowLabel: '1 — Highly Irrelevant',
    highLabel: '5 — Highly Relevant',
  },
  {
    key: 'ease_of_finding',
    label: '3. Ease of Finding',
    question:
      'How easy was it to find or identify a product that matched your intended criteria?',
    lowLabel: '1 — Extremely Difficult',
    highLabel: '5 — Extremely Easy',
  },
  {
    key: 'perceived_usefulness',
    label: '4. Perceived Usefulness',
    question:
      'How useful were the provided search results in helping you make an informed purchase decision?',
    lowLabel: '1 — Not at all Useful',
    highLabel: '5 — Extremely Useful',
  },
  {
    key: 'perceived_diversity',
    label: '5. Perceived Diversity',
    question:
      'Did the search results offer an appropriate variety of brands and models without repetitive redundancy?',
    lowLabel: '1 — Poor Variety (Redundant)',
    highLabel: '5 — Excellent Variety',
  },
  {
    key: 'product_confidence',
    label: '6. Product Confidence',
    question:
      'How confident would you feel in selecting the top-ranked item for actual purchase?',
    lowLabel: '1 — Not Confident',
    highLabel: '5 — Completely Confident',
  },
  {
    key: 'purchase_intention',
    label: '7. Stated Purchase-Completion Intention',
    question:
      'Assuming standard market pricing, how likely would you be to complete a purchase from these results?',
    lowLabel: '1 — Very Unlikely',
    highLabel: '5 — Very Likely',
  },
  {
    key: 'return_intention',
    label: '8. Stated Return Intention (Store Loyalty)',
    question:
      'How likely would you be to return to this store for future product discovery searches?',
    lowLabel: '1 — Never Return',
    highLabel: '5 — Definitely Return',
  },
  {
    key: 'repeat_purchase_intention',
    label: '9. Stated Repeat-Purchase Intention',
    question:
      'If you needed another product in the future, how likely would you be to make another purchase through this platform?',
    lowLabel: '1 — Very Unlikely',
    highLabel: '5 — Very Likely',
  },
];

export default function FeedbackPage() {
  const navigate = useNavigate();
  const {
    session,
    updateFeedbackField,
    updateConditionRating,
    submitQuestionnaire,
    resetSession,
    showToast,
  } = useExperimentSession();

  const [validationErrors, setValidationErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState(null);
  const [showThankYou, setShowThankYou] = useState(session.feedback.submitted);

  const feedback = session.feedback;
  const orderedColumns = session.searchResults?.orderedColumns || [];
  const conditionRatings = feedback.condition_ratings || {};

  // Check if participant has completed search
  if (!session.searchResults) {
    return (
      <div className="w-full max-w-[800px] mx-auto px-4 py-16 text-center space-y-4">
        <AlertTriangle size={36} className="text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Search Task Not Yet Executed</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Please run a search query and compare results before submitting participant feedback.
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

  // Calculate questionnaire completion percentage across all required responses:
  // 1 (Target Retrieval) + 9 (Overall Likert) + 12 (3 systems × 4 ratings) + 1 (Preferred System) = 23
  const perSystemRequiredCount =
    orderedColumns.length * PER_SYSTEM_RATING_QUESTIONS.length;
  const totalRequired = LIKERT_QUESTIONS.length + perSystemRequiredCount + 2;

  let completedCount = 0;
  if (feedback.target_retrieval_outcome) completedCount += 1;
  LIKERT_QUESTIONS.forEach((q) => {
    if (feedback[q.key] !== null && feedback[q.key] !== undefined) {
      completedCount += 1;
    }
  });
  orderedColumns.forEach((colSlot) => {
    const condObj = conditionRatings[colSlot.conditionId] || {};
    PER_SYSTEM_RATING_QUESTIONS.forEach((m) => {
      if (condObj[m.key] !== null && condObj[m.key] !== undefined) {
        completedCount += 1;
      }
    });
  });
  if (feedback.preferred_condition) completedCount += 1;

  const progressPercent =
    totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 0;

  const validate = () => {
    const errs = [];
    if (!feedback.target_retrieval_outcome) {
      errs.push('Please answer Section A: Did the search find the product you intended?');
    }

    LIKERT_QUESTIONS.forEach((q) => {
      if (feedback[q.key] === null || feedback[q.key] === undefined) {
        errs.push(`Please rate ${q.label} in Section B.`);
      }
    });

    orderedColumns.forEach((colSlot, idx) => {
      const sysLabel =
        colSlot.variantLabel || `System ${String.fromCharCode(65 + idx)}`;
      const condObj = conditionRatings[colSlot.conditionId] || {};
      PER_SYSTEM_RATING_QUESTIONS.forEach((m) => {
        if (condObj[m.key] === null || condObj[m.key] === undefined) {
          errs.push(`Please rate "${m.label}" for ${sysLabel} in Section C.`);
        }
      });
    });

    if (!feedback.preferred_condition) {
      errs.push('Please select your preferred search experience in Section D.');
    }

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (feedback.submitted) {
      setShowThankYou(true);
      return;
    }

    const errs = validate();
    if (errs.length > 0) {
      setValidationErrors(errs);
      showToast('Please complete all required questionnaire items.', 'error');
      window.scrollTo({ top: 200, behavior: 'smooth' });
      return;
    }

    setValidationErrors([]);
    setSubmissionError(null);
    setIsSubmitting(true);

    try {
      await submitQuestionnaire();
      setShowThankYou(true);
      showToast('Response recorded successfully.', 'success');
    } catch (err) {
      setSubmissionError(err.message || 'Failed to submit feedback.');
      showToast(err.message || 'Submission failed. Please retry.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartFresh = () => {
    resetSession();
    navigate('/experiment');
  };

  // Completion / Thank You Screen
  if (showThankYou) {
    return (
      <div className="w-full max-w-[800px] mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 size={36} />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Evaluation Complete
            </span>
            <h1 className="text-3xl font-bold text-slate-950 pt-1">
              Thank You for Participating
            </h1>
            <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
              Your responses have been recorded for this study under Participant Session{' '}
              <strong className="font-mono text-slate-900">{session.sessionId}</strong>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600 max-w-md mx-auto space-y-1 text-left">
            <div>
              Session ID: <strong className="text-slate-900">{session.sessionId}</strong>
            </div>
            <div>
              Category Evaluated:{' '}
              <strong className="text-slate-900 capitalize">{session.category}</strong>
            </div>
            <div>
              Status:{' '}
              <strong className="text-emerald-700 font-bold">
                Response recorded successfully
              </strong>
            </div>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleStartFresh}
              className="px-6 py-3 rounded-xl bg-primary hover:bg-blue-800 text-white font-semibold text-sm shadow-sm transition-all flex items-center gap-2"
            >
              <span>Start Another Task</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[980px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
      <StageInstructionModal
        sessionId={session.sessionId}
        stageKey="feedback"
        title="What to do"
        message="Rate each of the three search experiences based on the results you just reviewed, then complete the short overall questionnaire."
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mb-1">
            <Link to="/comparison" className="hover:text-primary transition-colors">
              Comparison Results
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Stage 04 · Participant Survey</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
            Participant Evaluation Questionnaire
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Please evaluate the search results you just observed. Responses use a 5-point Likert scale (1 = Lowest / Least Favorable, 5 = Highest / Most Favorable).
          </p>
        </div>

        {/* Progress Pill */}
        <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 shadow-2xs space-y-1">
          <div className="flex justify-between gap-4">
            <span>Survey Progress:</span>
            <strong className="text-primary">{progressPercent}%</strong>
          </div>
          <div className="w-36 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              style={{ width: `${progressPercent}%` }}
              className="h-full bg-primary transition-all duration-300"
            />
          </div>
        </div>
      </div>

      {/* Validation Alert */}
      {validationErrors.length > 0 && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs space-y-1.5 shadow-2xs">
          <div className="font-bold flex items-center gap-1.5 text-sm">
            <AlertTriangle size={16} className="text-red-600" />
            <span>Please complete the following required items before submitting:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-red-700 pl-1">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Submission Error Banner */}
      {submissionError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-800 text-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-600 shrink-0" />
            <span>{submissionError}</span>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-3 py-1 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Retry Submission
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION A: Target Retrieval Verification */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">
              Section A: Target Retrieval Verification (Required)
            </h2>
            <span className="text-xs font-mono text-slate-400">Required</span>
          </div>

          <p className="text-xs text-slate-600">
            Did the returned search results contain the product or criteria you were looking for?
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {[
              {
                value: 'exact',
                title: 'Yes, exact match found',
                sub: 'The intended product appeared in the results.',
              },
              {
                value: 'alternative',
                title: 'Found a suitable alternative',
                sub: 'Found an acceptable substitute matching the requirements.',
              },
              {
                value: 'none',
                title: 'No, intended item missing',
                sub: 'Neither the target nor a satisfactory substitute appeared.',
              },
            ].map((opt) => {
              const isSelected = feedback.target_retrieval_outcome === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-50/70 border-primary ring-2 ring-primary/20 shadow-2xs'
                      : 'bg-slate-50 hover:bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xs text-slate-900">{opt.title}</span>
                    <input
                      type="radio"
                      name="target_retrieval"
                      value={opt.value}
                      checked={isSelected}
                      onChange={() =>
                        updateFeedbackField({ target_retrieval_outcome: opt.value })
                      }
                      className="mt-0.5 text-primary accent-primary"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">{opt.sub}</p>
                </label>
              );
            })}
          </div>
        </section>

        {/* SECTION B: Core Research Likert Dimensions (Questions 1 through 9) */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Section B: Overall Search Experience (Required)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                5-point Likert scale: 1 = Lowest / Least Favorable, 5 = Highest / Most Favorable.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">9 Dimensions (1–5 Scale)</span>
          </div>

          <div className="space-y-6 divide-y divide-slate-100">
            {LIKERT_QUESTIONS.map((item, idx) => {
              const currentVal = feedback[item.key];

              return (
                <div key={item.key} className={idx > 0 ? 'pt-6 space-y-2.5' : 'space-y-2.5'}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-bold text-sm text-slate-900">
                      {item.label}
                    </span>
                    <span className="font-mono text-xs font-bold text-primary">
                      {currentVal !== null ? `${currentVal} / 5` : 'Not Rated'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-snug">
                    {item.question}
                  </p>

                  {/* 1 to 5 Selectable Buttons */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((val) => {
                        const isSelected = currentVal === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => updateFeedbackField({ [item.key]: val })}
                            className={`py-2.5 rounded-xl font-mono text-xs font-bold transition-all ${
                              isSelected
                                ? 'bg-primary text-white shadow-sm ring-2 ring-primary/30'
                                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                            }`}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex justify-between text-[11px] font-mono text-slate-400 px-1">
                      <span>{item.lowLabel}</span>
                      <span>{item.highLabel}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION C: Per-System Subjective Ratings (Systems A, B, and C) */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Section C: Rate Each Search Experience (Required)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Rate System A, System B, and System C individually on a 1–5 scale (1 = Lowest, 5 = Highest).
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">Systems A, B &amp; C</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {orderedColumns.map((colSlot, colIdx) => (
              <RatingControl
                key={colSlot.shortCode || colIdx}
                columnSlot={colSlot}
                columnIndex={colIdx}
                ratings={conditionRatings[colSlot.conditionId]}
                onRateMetric={updateConditionRating}
                blindedMode={true}
              />
            ))}
          </div>
        </section>

        {/* SECTION D: Comparative Preference Selection */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">
              Section D: Preferred Search Experience (Required)
            </h2>
            <span className="text-xs font-mono text-slate-400">Required</span>
          </div>

          <p className="text-xs text-slate-600">
            Based on the results shown on the comparison page, which search experience would you prefer as your default shopping search?
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {orderedColumns.map((colSlot) => {
              const isSelected = feedback.preferred_condition === colSlot.conditionId;
              return (
                <label
                  key={colSlot.conditionId}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-50/70 border-primary ring-2 ring-primary/20 shadow-2xs'
                      : 'bg-slate-50 hover:bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">
                      {colSlot.variantLabel} ({colSlot.displayLabel})
                    </span>
                    <input
                      type="radio"
                      name="preferred_system"
                      value={colSlot.conditionId}
                      checked={isSelected}
                      onChange={() =>
                        updateFeedbackField({ preferred_condition: colSlot.conditionId })
                      }
                      className="text-primary accent-primary"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono mt-3">
                    Select as preferred experience
                  </span>
                </label>
              );
            })}

            {/* No Preference Option */}
            <label
              className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                feedback.preferred_condition === 'no_preference'
                  ? 'bg-blue-50/70 border-primary ring-2 ring-primary/20 shadow-2xs'
                  : 'bg-slate-50 hover:bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">No Preference</span>
                <input
                  type="radio"
                  name="preferred_system"
                  value="no_preference"
                  checked={feedback.preferred_condition === 'no_preference'}
                  onChange={() =>
                    updateFeedbackField({ preferred_condition: 'no_preference' })
                  }
                  className="text-primary accent-primary"
                />
              </div>
              <span className="text-[11px] text-slate-400 font-mono mt-3">
                All systems felt equivalent
              </span>
            </label>
          </div>
        </section>

        {/* SECTION E: Open-Ended Comments */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">
              Section E: Additional Comments (Optional)
            </h2>
            <span className="text-xs font-mono text-slate-400">
              {(feedback.comments || '').length} / 500 chars
            </span>
          </div>

          <p className="text-xs text-slate-600">
            Share any thoughts on the search results, product variety, or how well the systems matched what you were looking for:
          </p>

          <textarea
            rows={3}
            maxLength={500}
            value={feedback.comments || ''}
            onChange={(e) => updateFeedbackField({ comments: e.target.value })}
            placeholder="Optional comments on system differences, product recommendations, or ease of search..."
            className="w-full p-4 rounded-2xl bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:border-primary focus:ring-2 focus:ring-blue-100 text-xs transition-all outline-none resize-none"
          />
        </section>

        {/* Submit Action Bar */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <ShieldCheck size={16} className="text-primary" />
            <span>Responses saved anonymously under {session.sessionId}</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Link
              to="/comparison"
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-semibold transition-colors"
            >
              ← Back to Comparison Grid
            </Link>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3.5 rounded-xl bg-primary hover:bg-blue-800 disabled:opacity-60 text-white font-semibold text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Submitting Response...</span>
                </>
              ) : (
                <>
                  <span>Submit Feedback</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
