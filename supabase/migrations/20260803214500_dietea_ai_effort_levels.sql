-- Widen the reasoning effort options to the full set the Responses API accepts.
--
-- The original constraint only allowed low/medium/high, which silently omitted
-- `none` (skip reasoning entirely — right for quick lookups) and `xhigh` (the
-- top tier, worth it for parsing a bad photo of a nutrition label).

alter table dietea.profiles
  drop constraint if exists profiles_ai_reasoning_effort_check;

alter table dietea.profiles
  add constraint profiles_ai_reasoning_effort_check
  check (ai_reasoning_effort in ('none', 'low', 'medium', 'high', 'xhigh'));
