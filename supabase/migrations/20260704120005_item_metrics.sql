-- ============================================================
-- items.metrics — array of close-out metrics per item.
--
-- Each element: { id, name, unit, targetValue, actualValue }. Supersedes the
-- single scalar metric columns (metric_name/metric_unit/target_value/
-- actual_value), which are KEPT and mirror metrics[0] (the client keeps them in
-- sync via normalizeItem). Expand step of expand → migrate → contract: additive,
-- non-breaking, reversible.
--
-- DEPLOY ORDERING: apply BEFORE deploying the client that writes `metrics`
-- (itemToRow inserts the column). Reads are safe pre-migration — a `select *`
-- omits the missing column and the client synthesizes metrics from the scalars.
--
-- Rollback: alter table public.items drop column if exists metrics;
-- ============================================================

alter table public.items
  add column if not exists metrics jsonb not null default '[]'::jsonb;

-- Backfill a single-metric array from the existing scalars for rows that carry
-- any metric data. Idempotent: only fills rows still at the default empty array.
update public.items
  set metrics = jsonb_build_array(
    jsonb_build_object(
      'id', 'metric_' || id,
      'name', coalesce(metric_name, ''),
      'unit', coalesce(metric_unit, ''),
      'targetValue', target_value,
      'actualValue', actual_value
    )
  )
  where metrics = '[]'::jsonb
    and (coalesce(btrim(metric_name), '') <> '' or target_value is not null or actual_value is not null);

comment on column public.items.metrics is
  'Close-out metrics array [{id,name,unit,targetValue,actualValue}]. Source of truth; the scalar metric_* columns mirror metrics[0] for backward-compat.';
