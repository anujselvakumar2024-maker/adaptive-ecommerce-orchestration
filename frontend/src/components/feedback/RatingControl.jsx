import React from 'react';

export const PER_SYSTEM_RATING_QUESTIONS = [
  {
    key: 'overallSatisfaction',
    label: 'Overall Satisfaction',
  },
  {
    key: 'perceivedRelevance',
    label: 'Relevance to Your Search',
  },
  {
    key: 'easeOfFinding',
    label: 'Ease of Finding a Suitable Product',
  },
  {
    key: 'returnIntention',
    label: 'Likelihood of Using This Search Experience Again',
  },
];

export default function RatingControl({
  columnSlot,
  ratings,
  onRateMetric,
  blindedMode = true,
  columnIndex = 0,
}) {
  const { displayLabel, variantLabel, conditionId } = columnSlot || {};
  const currentRatings = ratings || {
    overallSatisfaction: null,
    perceivedRelevance: null,
    easeOfFinding: null,
    returnIntention: null,
  };

  const letterBadge = String.fromCharCode(65 + columnIndex);

  return (
    <div className="flex flex-col rounded-2xl bg-slate-50 border border-slate-200 p-4 shadow-2xs space-y-3.5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
            {letterBadge}
          </span>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              {variantLabel || `System ${letterBadge}`}
            </h3>
            <p className="text-[11px] font-mono text-slate-500">
              {blindedMode
                ? displayLabel || `Search Experience ${letterBadge}`
                : `${displayLabel} (${conditionId})`}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {PER_SYSTEM_RATING_QUESTIONS.map((row) => {
          const currentVal = currentRatings[row.key];
          return (
            <div
              key={row.key}
              className="bg-white rounded-xl border border-slate-200/90 p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800 leading-snug">
                  {row.label}
                </span>
                <span className="font-mono text-[11px] font-bold text-primary shrink-0 tabular-nums">
                  {currentVal ? `${currentVal} / 5` : 'Select 1–5'}
                </span>
              </div>

              <div
                className="grid grid-cols-5 gap-1.5"
                role="radiogroup"
                aria-label={`${variantLabel || displayLabel} — ${row.label}`}
              >
                {[1, 2, 3, 4, 5].map((scoreVal) => {
                  const isSelected = currentVal === scoreVal;
                  return (
                    <button
                      key={scoreVal}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onRateMetric(conditionId, row.key, scoreVal)}
                      className={`py-2 rounded-lg font-mono text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-primary text-white shadow-2xs ring-2 ring-primary/30'
                          : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                      }`}
                    >
                      {scoreVal}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-1 flex justify-between text-[10px] font-mono text-slate-400 px-0.5">
        <span>1 = Lowest</span>
        <span>5 = Highest</span>
      </div>
    </div>
  );
}
