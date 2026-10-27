import React from 'react';
import RatingControl from './RatingControl';

export default function FeedbackForm({
  session,
  orderedColumns,
  onUpdateField,
  onRateCondition,
  onSubmit,
  onBackToComparison,
  validationErrors,
  isSubmitting,
}) {
  const { feedback, selectedTargetProduct, experimentAssignment } = session;
  const blindedMode = Boolean(experimentAssignment?.blindedMode);

  const retrievalOptions = [
    {
      value: 'exact',
      icon: 'verified',
      title: 'Yes, the exact product',
      description: `Found the ${
        selectedTargetProduct?.shortName || selectedTargetProduct?.name || 'target product'
      } directly aligned with my query intent.`,
      footer: 'Exact ground-truth benchmark retrieved',
    },
    {
      value: 'alternative',
      icon: 'swap_horiz',
      title: 'I found a similar alternative',
      description:
        'Located an equivalent product in the same category with comparable specifications and budget.',
      footer: 'Alternative brand or specification match',
    },
    {
      value: 'none',
      icon: 'search_off',
      title: 'No, I couldn’t find what I wanted',
      description:
        'The retrieved product lists either omitted my target model or missed key constraints.',
      footer: 'Unmet search criteria',
    },
  ];

  const preferenceOptions = [
    ...orderedColumns.map((col) => ({
      value: col.conditionId,
      label: blindedMode
        ? col.displayLabel
        : `${col.displayLabel} (${col.data?.conditionName || col.conditionId})`,
    })),
    {
      value: 'no_pref',
      label: 'No preference',
    },
  ];

  return (
    <form className="space-y-space-xl" id="evaluationForm" onSubmit={onSubmit} noValidate>
      {validationErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-xl bg-error-container p-space-md text-on-error-container border border-error/30 shadow-sm"
        >
          <div className="flex items-center gap-2 font-headline-sm text-headline-sm font-semibold mb-1">
            <span className="material-symbols-outlined">error</span>
            <span>Please complete all required evaluation fields before submitting:</span>
          </div>
          <ul className="list-disc list-inside font-body-sm text-body-sm space-y-0.5">
            {validationErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 1: Target Retrieval Verification */}
      <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        <div className="flex items-center gap-2 mb-space-sm">
          <span className="w-6 h-6 rounded-full bg-primary-container text-on-primary font-mono-data text-[11px] font-bold flex items-center justify-center">
            1
          </span>
          <span className="font-mono-data text-label-sm text-on-surface-variant uppercase tracking-wider">
            Retrieval Accuracy Assessment (Required)
          </span>
        </div>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-2">
          Did you find the product you originally wanted?
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
          Assess whether your designated target benchmark or an acceptable substitute appeared
          within your exploration session.
        </p>

        {/* 3 Large Interactive Radio Selection Tiles (Unselected by default) */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-space-md"
          role="radiogroup"
          aria-label="Did you find the product you originally wanted?"
        >
          {retrievalOptions.map((opt) => {
            const isSelected = feedback.targetRetrieval === opt.value;
            return (
              <label
                key={opt.value}
                className={`relative flex flex-col p-space-md rounded-xl cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md ${
                  isSelected
                    ? 'bg-surface-container-low ring-2 ring-primary-container'
                    : 'bg-surface-container-lowest hover:bg-surface-container-low'
                }`}
              >
                <input
                  type="radio"
                  name="target_retrieval"
                  value={opt.value}
                  checked={isSelected}
                  onChange={() => onUpdateField({ targetRetrieval: opt.value })}
                  className="sr-only"
                />
                <div
                  className={`absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-primary-container text-on-primary opacity-100'
                      : 'bg-surface-container-high text-on-surface-variant opacity-40'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                </div>

                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center mb-space-sm ${
                    isSelected
                      ? 'bg-surface-container text-primary-container'
                      : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]">{opt.icon}</span>
                </div>

                <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  {opt.title}
                </span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  {opt.description}
                </p>

                <div
                  className={`mt-4 pt-3 flex items-center gap-1.5 font-label-sm text-label-sm ${
                    isSelected ? 'text-primary font-semibold' : 'text-on-surface-variant'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? 'bg-primary-container' : 'bg-outline-variant'
                    }`}
                  />
                  <span>{opt.footer}</span>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {/* Section 2: Comparative Ratings Across All Three Search Experiences */}
      <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-space-md">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded-full bg-primary-container text-on-primary font-mono-data text-[11px] font-bold flex items-center justify-center">
                2
              </span>
              <span className="font-mono-data text-label-sm text-on-surface-variant uppercase tracking-wider">
                Multi-Factor Analytical Comparison (Required)
              </span>
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Comparative Ratings Across All Three Search Experiences
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Rate each search experience independently across four evaluation
              questions (Scale: 1 = Lowest, 5 = Highest).
            </p>
          </div>
          <div className="hidden lg:flex items-center gap-4 px-3 py-1.5 rounded-lg bg-surface-container-low font-mono-data text-label-sm text-on-surface-variant">
            <span>Score Legend:</span>
            <span className="text-primary font-semibold">1 (Lowest) → 5 (Highest)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
          {orderedColumns.map((col) => (
            <RatingControl
              key={col.shortCode}
              columnSlot={col}
              ratings={(feedback.condition_ratings || feedback.ratings)?.[col.conditionId]}
              onRateMetric={onRateCondition}
              blindedMode={blindedMode}


            />
          ))}
        </div>
      </section>

      {/* Section 3: Qualitative Feedback & Preference */}
      <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        <div className="flex items-center gap-2 mb-space-sm">
          <span className="w-6 h-6 rounded-full bg-primary-container text-on-primary font-mono-data text-[11px] font-bold flex items-center justify-center">
            3
          </span>
          <span className="font-mono-data text-label-sm text-on-surface-variant uppercase tracking-wider">
            Qualitative Synthesis &amp; Preference Selection
          </span>
        </div>

        <div className="space-y-space-lg">
          {/* Free-text field */}
          <div>
            <label
              className="block font-headline-sm text-headline-sm text-on-surface font-semibold mb-1"
              htmlFor="qualitativeNotes"
            >
              What could have been better?
            </label>
            <p className="font-body-md text-body-md text-on-surface-variant mb-space-sm">
              Please highlight any anomalies, noisy attribute predictions, pricing mismatch, or
              ranking observations you experienced.
            </p>
            <div className="relative">
              <textarea
                id="qualitativeNotes"
                rows={4}
                maxLength={500}
                value={feedback.qualitativeNotes}
                onChange={(e) => onUpdateField({ qualitativeNotes: e.target.value })}
                placeholder="Share any observations regarding ranking accuracy, noise, or irrelevant items..."
                className="w-full rounded-xl bg-surface-container-low p-space-md text-on-surface placeholder:text-outline font-body-md text-body-md outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container transition-all"
              />
              <div className="absolute bottom-3 right-3 text-outline font-mono-data text-label-sm tabular-nums">
                Optional · {feedback.qualitativeNotes.length} / 500 chars
              </div>
            </div>
          </div>

          {/* Choice Question: Preferred experience (starts unselected) */}
          <div>
            <span className="block font-headline-sm text-headline-sm text-on-surface font-semibold mb-1">
              Which search experience would you choose next time? (Required)
            </span>
            <p className="font-body-md text-body-md text-on-surface-variant mb-space-sm">
              Select the variant you would prefer as your default online shopping engine.
            </p>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-sm"
              role="radiogroup"
              aria-label="Which search experience would you choose next time?"
            >
              {preferenceOptions.map((opt) => {
                const isSelected = feedback.preferredExperience === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 p-space-sm rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-surface-container-highest shadow-sm ring-2 ring-primary-container'
                        : 'bg-surface-container-low hover:bg-surface-container'
                    }`}
                  >
                    <input
                      type="radio"
                      name="preferred_engine"
                      value={opt.value}
                      checked={isSelected}
                      onChange={() => onUpdateField({ preferredExperience: opt.value })}
                      className="w-4 h-4 text-primary-container focus:ring-primary accent-primary"
                    />
                    <span
                      className={`font-label-lg text-label-lg text-on-surface ${
                        isSelected ? 'font-bold' : ''
                      }`}
                    >
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Submission Area */}
      <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col md:flex-row items-center justify-between gap-space-md">
        <div className="flex items-start gap-space-sm max-w-xl text-left">
          <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[20px]">shield</span>
          </div>
          <div>
            <div className="font-label-lg text-label-lg text-on-surface font-semibold">
              Anonymous Study Response
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Responses are recorded anonymously under Participant Session {session.sessionId}. Data
              is associated with your selected target ({selectedTargetProduct?.sku}) and condition
              mapping.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-space-sm w-full md:w-auto shrink-0">
          <button
            type="button"
            onClick={onBackToComparison}
            className="w-full sm:w-auto px-space-md py-3 rounded-lg bg-surface-container-high text-on-surface font-label-lg text-label-lg hover:bg-surface-container transition-colors text-center"
          >
            Review Comparison Grid
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-space-lg py-3 rounded-lg bg-primary-container text-on-primary font-label-lg text-label-lg shadow-md hover:bg-primary transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <span>
              {isSubmitting
                ? 'Recording Evaluation...'
                : 'Submit Evaluation & Complete Study'}
            </span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </form>
  );
}
