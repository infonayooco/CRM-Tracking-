// Shared "Modernize" class tokens. Import these instead of re-declaring the same
// card/button/input strings per file (they were duplicated across ItemModal,
// CustomerEditModal, ItemsView, …). Colors resolve to the @theme tokens in
// app/globals.css, so a token change recolors every consumer.

/** Soft rounded surface with the signature Modernize elevation. Add your own padding. */
export const cardClass = "rounded-xl border border-border-soft bg-surface shadow-card";

/** Card + comfortable default padding. */
export const cardPadClass = `${cardClass} p-5`;

/** Dashed empty-state surface. */
export const emptyCardClass =
  "rounded-xl border border-dashed border-slate-300 bg-surface px-6 py-16 text-center";

export const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-ink outline-none transition placeholder:text-muted focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-100 disabled:bg-slate-50 disabled:text-muted";

export const primaryBtnClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-none transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100 focus-visible:ring-offset-2";

export const ghostBtnClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100";

/** Tinted (soft) button — periwinkle wash that fills on hover, Modernize's text-button look. */
export const tintedBtnClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary-light px-4 text-sm font-medium text-primary-dark transition hover:bg-brand-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100";

/** Uppercase eyebrow above a section/panel. */
export const sectionLabelClass = "text-xs font-semibold uppercase tracking-wide text-muted";

export const pageTitleClass = "text-2xl font-bold text-ink";
