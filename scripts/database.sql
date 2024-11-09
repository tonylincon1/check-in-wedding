-- Supabase AI is experimental and may produce incorrect answers
-- Always verify the output before executing

-- Supabase AI is experimental and may produce incorrect answers
-- Always verify the output before executing
-- Supabase AI is experimental and may produce incorrect answers
-- Always verify the output before executing
-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Drop the existing table if it exists
drop table if exists convidados;

-- Create the 'convidados' table
create table
  convidados (
    id uuid default uuid_generate_v4 () primary key,
    "Nome" text not null,
    "Email" text,
    "Telefone" text,
    "Mensagem" text,
    "TipoConvidado" text,
    "DataHoraConfirmacao" timestamp with time zone,
    "DataHoraCheckIn" timestamp with time zone
  );

-- Add a unique constraint on the Email column
-- alter table convidados
-- add constraint unique_email unique ("Email");

-- Create an index on the Nome column for faster searches
create index idx_convidados_nome on convidados ("Nome");

-- Enable Row Level Security (RLS)
alter table convidados enable row level security;

-- Drop existing policies
drop policy if exists "Allow all operations for authenticated users" on convidados;

drop policy if exists "Allow insert for all, other operations for authenticated users" on convidados;

-- Drop the existing policy that may cause conflict
drop policy if exists "Allow insert and select for all, update and delete for authenticated users" on convidados;

-- Create a new policy that allows all operations (select, insert, update, delete) for authenticated users
create policy "Allow all operations for authenticated users" on convidados for all using (auth.role () = 'authenticated')
with
  check (auth.role () = 'authenticated');

-- If you want to allow anonymous users to insert and select, but only authenticated users to update and delete,
-- comment out the policy above and uncomment this policy instead:
create policy "Allow insert and select for all, update and delete for authenticated users" on convidados for all using (
  auth.role () = 'authenticated'
  or (
    auth.role () = 'anon'
    and (
      current_setting('request.method') = 'POST'
      or current_setting('request.method') = 'GET'
      or current_setting('request.method') = 'DELETE'
      or current_setting('request.method') = 'PATCH'
    )
  )
)
with
  check (
    auth.role () = 'authenticated'
    or (
      auth.role () = 'anon'
      and current_setting('request.method') = 'POST'
      or current_setting('request.method') = 'GET'
      or current_setting('request.method') = 'DELETE'
      or current_setting('request.method') = 'PATCH'
    )
  );

-- Grant necessary permissions to the 'authenticated' role
grant all on convidados to authenticated;

-- If you want to allow public access for inserts and selects, uncomment the following line:
-- GRANT SELECT, INSERT ON convidados TO anon;