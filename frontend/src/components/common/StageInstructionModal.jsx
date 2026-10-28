import React, { useEffect, useRef, useState } from 'react';
import { Info, XCircle } from './CategoryIcon';

function getInstructionStorageKey(sessionId, stageKey) {
  return `searchlab_stage_instruction_seen_${sessionId || 'default'}_${stageKey || 'stage'}`;
}

export default function StageInstructionModal({
  sessionId,
  stageKey,
  title = 'What to do',
  message,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef(null);
  const primaryButtonRef = useRef(null);

  useEffect(() => {
    const storageKey = getInstructionStorageKey(sessionId, stageKey);

    try {
      if (
        typeof sessionStorage !== 'undefined' &&
        sessionStorage.getItem(storageKey) !== 'true'
      ) {
        setIsOpen(true);
      }
    } catch {
      // If sessionStorage is unavailable, still show the instruction.
      setIsOpen(true);
    }
  }, [sessionId, stageKey]);

  useEffect(() => {
    if (!isOpen) return;

    const previousActiveElement = document.activeElement;

    const focusTimer = window.setTimeout(() => {
      primaryButtonRef.current?.focus();
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.disabled);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousActiveElement?.focus?.();
    };
  }, [isOpen]);

  const dismiss = () => {
    const storageKey = getInstructionStorageKey(sessionId, stageKey);

    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(storageKey, 'true');
      }
    } catch {
      // Ignore storage errors; closing the modal should still work.
    }

    setIsOpen(false);
  };

  if (!isOpen || !message) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`stage-instruction-title-${stageKey}`}
        aria-describedby={`stage-instruction-message-${stageKey}`}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary">
              <Info size={19} aria-hidden="true" />
            </div>
            <h2
              id={`stage-instruction-title-${stageKey}`}
              className="font-headline-sm text-lg font-bold text-slate-900"
            >
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Close instruction"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <XCircle size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-5">
          <p
            id={`stage-instruction-message-${stageKey}`}
            className="text-sm leading-6 text-slate-600"
          >
            {message}
          </p>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-4">
          <button
            ref={primaryButtonRef}
            type="button"
            onClick={dismiss}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export { getInstructionStorageKey };
