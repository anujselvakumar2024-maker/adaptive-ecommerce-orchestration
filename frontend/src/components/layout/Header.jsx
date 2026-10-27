import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useExperimentSession } from '../../hooks/useExperimentSession';
import ProgressStepper from './ProgressStepper';
import SessionIndicator from './SessionIndicator';
import {
  Sparkles,
  Search,
  FlaskConical,
  BarChart3,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from '../common/CategoryIcon';

const NAV_LINKS = [
  { to: '/', label: 'Overview', icon: Sparkles, exact: true },
  { to: '/discover', label: 'Product Discovery', icon: Search },
  {
    to: '/experiment',
    label: 'Human Evaluation',
    icon: FlaskConical,
    matchPrefixes: [
      '/experiment',
      '/specific-product',
      '/general-search',
      '/target-confirmation',
      '/query',
      '/comparison',
      '/feedback',
    ],
  },
  { to: '/benchmarks', label: 'Benchmarks', icon: BarChart3 },
  { to: '/researcher', label: 'Researcher View', icon: ShieldCheck },
];

export const EXPERIMENT_ROUTE_PREFIXES = [
  '/experiment',
  '/specific-product',
  '/general-search',
  '/target-confirmation',
  '/query',
  '/comparison',
  '/feedback',
];

export function isExperimentPathname(pathname = '') {
  return EXPERIMENT_ROUTE_PREFIXES.some((p) => pathname.startsWith(p));
}

export default function Header({ onOpenModal }) {
  const location = useLocation();
  const { backendHealth, refreshHealth } = useExperimentSession();

  const isNavActive = (item) => {
    if (item.exact) return location.pathname === item.to;
    if (item.matchPrefixes) {
      return item.matchPrefixes.some((p) => location.pathname.startsWith(p));
    }
    return location.pathname.startsWith(item.to);
  };

  const isExperimentRoute = isExperimentPathname(location.pathname);

  const brandContent = (
    <>
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center shadow-sm transition-all">
        <FlaskConical size={19} />
      </div>
      <div className="flex flex-col">
        <span className="font-headline-sm text-[17px] leading-tight tracking-tight text-slate-900 font-bold">
          Search<span className="text-primary">Lab</span>
        </span>
        <span className="text-[10px] font-mono-data uppercase tracking-wider text-slate-500 hidden sm:inline">
          {isExperimentRoute ? 'Participant Study' : 'Adaptive E-Commerce Discovery'}
        </span>
      </div>
    </>
  );

  return (
    <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="h-16 max-w-[1440px] mx-auto px-4 sm:px-8 flex items-center justify-between gap-3">
        {/* Brand Identity: Non-clickable during experiment routes */}
        {isExperimentRoute ? (
          <div
            className="flex items-center gap-2.5 shrink-0 select-none"
            aria-label="SearchLab Participant Study"
          >
            {brandContent}
          </div>
        ) : (
          <Link
            to="/"
            className="flex items-center gap-2.5 shrink-0 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
          >
            {brandContent}
          </Link>
        )}

        {/* Center Area: Desktop Progress Stepper in Experiment Mode, or Primary Navigation on Normal Routes */}
        {isExperimentRoute ? (
          <ProgressStepper />
        ) : (
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60"
          >
            {NAV_LINKS.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(item);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-label-md text-[13px] transition-all ${
                    active
                      ? 'bg-white text-primary font-semibold shadow-2xs ring-1 ring-slate-200/70'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Icon size={15} className={active ? 'text-primary' : 'text-slate-500'} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Backend Health Status Pill (hidden in participant experiment mode) */}
          {!isExperimentRoute && (
            <button
              type="button"
              onClick={refreshHealth}
              title={
                backendHealth.connected
                  ? `Connected to ${backendHealth.baseUrl} (${backendHealth.products} products, ${backendHealth.latencyMs}ms)`
                  : `Backend disconnected (${backendHealth.baseUrl}). Click to retry.`
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono-data text-[11px] font-semibold border transition-all ${
                backendHealth.checking
                  ? 'bg-slate-100 text-slate-600 border-slate-200'
                  : backendHealth.connected
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70'
                  : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100/70'
              }`}
            >
              {backendHealth.checking ? (
                <RefreshCw size={12} className="animate-spin text-slate-500" />
              ) : backendHealth.connected ? (
                <CheckCircle2 size={12} className="text-emerald-600" />
              ) : (
                <AlertTriangle size={12} className="text-red-600" />
              )}
              <span className="hidden sm:inline">
                {backendHealth.checking
                  ? 'Checking API...'
                  : backendHealth.connected
                  ? `API Online · ${backendHealth.products.toLocaleString()} SKUs`
                  : 'API Offline · Retry'}
              </span>
              <span className="sm:hidden">
                {backendHealth.connected ? 'API OK' : 'Offline'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenModal && onOpenModal('how-it-works')}
            className={`${
              isExperimentRoute ? 'inline-flex' : 'hidden xl:inline-flex'
            } px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-label-md text-[12px] transition-colors border border-transparent hover:border-slate-200`}
          >
            Study Guide
          </button>

          <SessionIndicator />
        </div>
      </div>

      {/* Mobile Navigation Bar (only on non-experiment routes) */}
      {!isExperimentRoute && (
        <div className="flex lg:hidden items-center gap-1 overflow-x-auto px-4 py-1.5 bg-slate-50/90 border-t border-slate-200/60 scrollbar-none">
          {NAV_LINKS.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-label-sm text-[11px] shrink-0 transition-all ${
                  active
                    ? 'bg-primary text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <Icon size={13} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Compact Experiment Sub-Stepper when inside the human evaluation workflow */}
      {isExperimentRoute && <ProgressStepper compact />}
    </header>
  );
}
