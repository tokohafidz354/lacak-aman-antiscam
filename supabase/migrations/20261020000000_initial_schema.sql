-- Lacak Aman Anti-Scam: initial private schema
-- Apply via Supabase SQL Editor or Supabase CLI migrations.
-- This migration deliberately does not create public read access.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  incident_type text not null default 'Penipuan online',
  status text not null default 'Baru'
    check (status in ('Baru', 'Ditinjau', 'Dilaporkan', 'Selesai')),
  incident_date date,
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.phone_subjects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  phone_e164 text not null check (phone_e164 ~ '^\\+[1-9][0-9]{6,14}$'),
  label text not null default '',
  created_at timestamptz not null default now(),
  unique (owner_id, phone_e164, case_id)
);

create table if not exists public.number_checks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  phone_subject_id uuid not null references public.phone_subjects(id) on delete cascade,
  source_name text not null check (source_name in ('AduanNomor', 'CekRekening', 'Indonesia Anti-Scam Centre', 'Lainnya')),
  source_url text,
  result_status text not null default 'Belum diperiksa'
    check (result_status in ('Belum diperiksa', 'Ada laporan', 'Belum ditemukan pada sumber yang diperiksa', 'Gagal diperiksa')),
  note text not null default '',
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  phone_subject_id uuid references public.phone_subjects(id) on delete set null,
  report_type text not null default 'Laporan komunitas',
  description text not null default '',
  verification_status text not null default 'Belum terverifikasi'
    check (verification_status in ('Belum terverifikasi', 'Sedang ditinjau', 'Terkonfirmasi', 'Ditolak')),
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (case_id is not null or phone_subject_id is not null)
);

create table if not exists public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain')),
  size_bytes bigint not null check (size_bytes between 1 and 8388608),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  uploaded_at timestamptz not null default now()
);

create table if not exists public.location_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete set null,
  consented_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > consented_at),
  check (recipient_user_id is null or recipient_user_id <> owner_id)
);

create table if not exists public.location_points (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.location_sessions(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  recorded_at timestamptz not null,
  received_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists cases_owner_created_idx on public.cases(owner_id, created_at desc);
create index if not exists phone_subjects_owner_phone_idx on public.phone_subjects(owner_id, phone_e164);
create index if not exists number_checks_owner_checked_idx on public.number_checks(owner_id, checked_at desc);
create index if not exists evidence_files_case_idx on public.evidence_files(owner_id, case_id);
create index if not exists location_sessions_owner_expiry_idx on public.location_sessions(owner_id, expires_at desc);
create index if not exists location_points_session_received_idx on public.location_points(session_id, received_at desc);

alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.phone_subjects enable row level security;
alter table public.number_checks enable row level security;
alter table public.reports enable row level security;
alter table public.evidence_files enable row level security;
alter table public.location_sessions enable row level security;
alter table public.location_points enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profile owner can view" on public.profiles;
create policy "profile owner can view" on public.profiles
for select to authenticated using (id = auth.uid());
drop policy if exists "profile owner can insert" on public.profiles;
create policy "profile owner can insert" on public.profiles
for insert to authenticated with check (id = auth.uid());
drop policy if exists "profile owner can update" on public.profiles;
create policy "profile owner can update" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "case owner full access" on public.cases;
create policy "case owner full access" on public.cases
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "phone owner full access" on public.phone_subjects;
create policy "phone owner full access" on public.phone_subjects
for all to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and (case_id is null or exists (
    select 1 from public.cases c where c.id = case_id and c.owner_id = auth.uid()
  ))
);

drop policy if exists "number check owner access" on public.number_checks;
create policy "number check owner access" on public.number_checks
for all to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.phone_subjects p
    where p.id = phone_subject_id and p.owner_id = auth.uid()
  )
);

drop policy if exists "report owner access" on public.reports;
create policy "report owner access" on public.reports
for all to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and (case_id is null or exists (
    select 1 from public.cases c where c.id = case_id and c.owner_id = auth.uid()
  ))
  and (phone_subject_id is null or exists (
    select 1 from public.phone_subjects p where p.id = phone_subject_id and p.owner_id = auth.uid()
  ))
);

drop policy if exists "evidence owner access" on public.evidence_files;
create policy "evidence owner access" on public.evidence_files
for all to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.cases c where c.id = case_id and c.owner_id = auth.uid()
  )
  and storage_path like auth.uid()::text || '/%'
);

drop policy if exists "location session owner or recipient read" on public.location_sessions;
create policy "location session owner or recipient read" on public.location_sessions
for select to authenticated
using (owner_id = auth.uid() or recipient_user_id = auth.uid());
drop policy if exists "location session owner create" on public.location_sessions;
create policy "location session owner create" on public.location_sessions
for insert to authenticated
with check (owner_id = auth.uid() and consented_at <= now() and expires_at > now());
drop policy if exists "location session owner update" on public.location_sessions;
create policy "location session owner update" on public.location_sessions
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "location point authorized read" on public.location_points;
create policy "location point authorized read" on public.location_points
for select to authenticated
using (exists (
  select 1 from public.location_sessions s
  where s.id = session_id
    and (s.owner_id = auth.uid() or s.recipient_user_id = auth.uid())
));
drop policy if exists "location point owner insert active session" on public.location_points;
create policy "location point owner insert active session" on public.location_points
for insert to authenticated
with check (exists (
  select 1 from public.location_sessions s
  where s.id = session_id
    and s.owner_id = auth.uid()
    and s.consented_at <= now()
    and s.expires_at > now()
    and s.revoked_at is null
));

drop policy if exists "audit log actor can read" on public.audit_logs;
create policy "audit log actor can read" on public.audit_logs
for select to authenticated using (actor_id = auth.uid());
drop policy if exists "audit log actor can insert" on public.audit_logs;
create policy "audit log actor can insert" on public.audit_logs
for insert to authenticated with check (actor_id = auth.uid());

-- Evidence storage is private. Object path convention: <auth.uid>/<case_id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('case-evidence', 'case-evidence', false, 8388608,
  array['image/png','image/jpeg','image/webp','application/pdf','text/plain'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "private evidence object owner select" on storage.objects;
create policy "private evidence object owner select" on storage.objects
for select to authenticated
using (
  bucket_id = 'case-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "private evidence object owner insert" on storage.objects;
create policy "private evidence object owner insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'case-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "private evidence object owner delete" on storage.objects;
create policy "private evidence object owner delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'case-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
);
