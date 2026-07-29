-- PostgREST introspects the schema cache as the `authenticator` role, so every
-- API role needs USAGE on the schema for the tables to appear once `dietea` is
-- added to the project's exposed schemas.
grant usage on schema dietea to anon, authenticated, service_role;

-- Table privileges stay with authenticated and service_role. anon is granted no
-- table access: all data is user-scoped, so an anonymous request should be
-- rejected outright rather than silently returning an empty set.
grant select, insert, update, delete on all tables in schema dietea to authenticated, service_role;

-- Same treatment for anything added to the schema later.
alter default privileges in schema dietea
  grant select, insert, update, delete on tables to authenticated, service_role;

alter default privileges in schema dietea
  grant usage, select on sequences to authenticated, service_role;
