-- Somente banco local isolado. Nunca executar em Supabase hospedado.
create role supabase_auth_admin login password 'araread-local-auth-only' noinherit createrole;
create schema auth authorization supabase_auth_admin;
alter role supabase_auth_admin set search_path to auth,public;
grant create on database araread to supabase_auth_admin;
create role authenticated nologin;
create role anon nologin;
create role service_role nologin;
create role araread_app login password 'araread-local-only' noinherit;
grant authenticated to araread_app;
