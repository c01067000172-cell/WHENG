-- WHENG 운영용 Supabase 스키마
-- 프로젝트: wheng / 서울 리전

create extension if not exists pgcrypto;

-- 최초 관리자 생성은 Edge Function `wheng-bootstrap-admin`에서 처리합니다.

create table if not exists public.wheng_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.wheng_services (
  id text primary key,
  name text not null,
  description text not null default '',
  price_text text not null default '',
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wheng_cases (
  id text primary key,
  title text not null,
  area text not null default '',
  category text not null default '',
  summary text not null default '',
  image_url text not null default '',
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wheng_quotes (
  id uuid primary key,
  area text not null check (char_length(area) between 1 and 80),
  service_key text not null check (char_length(service_key) between 1 and 80),
  issue text not null check (char_length(issue) between 2 and 3000),
  phone text not null check (char_length(phone) between 9 and 30),
  preferred_date date,
  privacy_agreed boolean not null default false,
  status text not null default '신규' check (status in ('신규','상담중','예약완료','시공완료','취소')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wheng_quote_photos (
  id uuid primary key,
  quote_id uuid not null references public.wheng_quotes(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create or replace function public.wheng_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wheng_services_touch on public.wheng_services;
create trigger wheng_services_touch before update on public.wheng_services
for each row execute function public.wheng_touch_updated_at();

drop trigger if exists wheng_cases_touch on public.wheng_cases;
create trigger wheng_cases_touch before update on public.wheng_cases
for each row execute function public.wheng_touch_updated_at();

drop trigger if exists wheng_quotes_touch on public.wheng_quotes;
create trigger wheng_quotes_touch before update on public.wheng_quotes
for each row execute function public.wheng_touch_updated_at();

revoke all on function public.wheng_touch_updated_at() from public, anon, authenticated;

alter table public.wheng_admins enable row level security;
alter table public.wheng_services enable row level security;
alter table public.wheng_cases enable row level security;
alter table public.wheng_quotes enable row level security;
alter table public.wheng_quote_photos enable row level security;

create policy "anon read active wheng services" on public.wheng_services
for select to anon using (active = true);

create policy "authenticated read active wheng services" on public.wheng_services
for select to authenticated using (
  active = true or exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid()))
);

create policy "anon read active wheng cases" on public.wheng_cases
for select to anon using (active = true);

create policy "authenticated read active wheng cases" on public.wheng_cases
for select to authenticated using (
  active = true or exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid()))
);

create policy "admin can read own admin row" on public.wheng_admins
for select to authenticated using (user_id = (select auth.uid()));

create policy "anon submit wheng quote" on public.wheng_quotes
for insert to anon with check (privacy_agreed = true and status = '신규' and admin_note = '');

create policy "admin read quotes" on public.wheng_quotes
for select to authenticated using (exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid())));

create policy "admin update quotes" on public.wheng_quotes
for update to authenticated
using (exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid())));

create policy "admin delete quotes" on public.wheng_quotes
for delete to authenticated using (exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid())));

create policy "anon add quote photo row" on public.wheng_quote_photos
for insert to anon with check (
  storage_path ~ ('^incoming/' || quote_id::text || '/[0-9a-fA-F-]+\.(jpg|jpeg|png|webp|heic|heif)$')
);

create policy "admin read quote photo rows" on public.wheng_quote_photos
for select to authenticated using (exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid())));

create policy "admin delete quote photo rows" on public.wheng_quote_photos
for delete to authenticated using (exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid())));

create policy "admin services insert" on public.wheng_services for insert to authenticated
with check (exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid())));
create policy "admin services update" on public.wheng_services for update to authenticated
using (exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid())));
create policy "admin services delete" on public.wheng_services for delete to authenticated
using (exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid())));

create policy "admin cases insert" on public.wheng_cases for insert to authenticated
with check (exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid())));
create policy "admin cases update" on public.wheng_cases for update to authenticated
using (exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid())));
create policy "admin cases delete" on public.wheng_cases for delete to authenticated
using (exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid())));

grant usage on schema public to anon, authenticated;
grant select on public.wheng_services, public.wheng_cases to anon, authenticated;
grant insert (id,area,service_key,issue,phone,preferred_date,privacy_agreed) on public.wheng_quotes to anon;
grant insert (id,quote_id,storage_path) on public.wheng_quote_photos to anon;
grant select on public.wheng_admins to authenticated;
grant select, insert, update, delete on public.wheng_services, public.wheng_cases, public.wheng_quotes, public.wheng_quote_photos to authenticated;

create index if not exists wheng_quote_photos_quote_id_idx on public.wheng_quote_photos(quote_id);
create index if not exists wheng_quotes_created_at_idx on public.wheng_quotes(created_at desc);
create index if not exists wheng_quotes_status_idx on public.wheng_quotes(status);
create index if not exists wheng_cases_sort_order_idx on public.wheng_cases(sort_order);
create index if not exists wheng_services_sort_order_idx on public.wheng_services(sort_order);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('wheng-quotes','wheng-quotes',false,5242880,array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

create policy "anon upload incoming quote photos" on storage.objects for insert to anon
with check (
  bucket_id='wheng-quotes' and (storage.foldername(name))[1]='incoming'
  and name ~ '^incoming/[0-9a-fA-F-]+/[0-9a-fA-F-]+\.(jpg|jpeg|png|webp|heic|heif)$'
);

create policy "admin read quote photos" on storage.objects for select to authenticated
using (
  bucket_id='wheng-quotes' and exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid()))
);

create policy "admin delete quote photos" on storage.objects for delete to authenticated
using (
  bucket_id='wheng-quotes' and exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid()))
);

insert into public.wheng_services(id,name,description,price_text,sort_order,active) values
('svc-visit','기본 출장·현장 점검','현장 상태 확인 및 기본 점검','50,000원~',10,true),
('svc-faucet','싱크대·세면대 수전','노후 수전, 누수, 흔들림, 수압 이상','사진 확인 후 안내',20,true),
('svc-toilet','양변기 수리·교체','필밸브, 부속, 누수, 흔들림, 교체','현장 조건별 안내',30,true),
('svc-leak','단순 누수 보수','세면대, 싱크대, 연결부 누수','80,000원~',40,true),
('svc-toilet-leak','변기 주변 누수','실리콘, 정심, 연결부 등 점검','120,000원~',50,true),
('svc-boiler','보일러 분배기','밸브, 구동기, 제어기, 분배기 이상','사진/현장 확인',60,true),
('svc-pipe','배수·배관','트랩, 호스, 노후 배관, 연결부 문제','현장 견적',70,true),
('svc-remodel','부분 설비공사','주방·욕실 위치 변경 및 설비 보수','현장 견적',80,true)
on conflict (id) do nothing;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('wheng-public','wheng-public',true,5242880,array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

create policy "wheng admin upload public case images" on storage.objects for insert to authenticated
with check (
  bucket_id='wheng-public' and (storage.foldername(name))[1]='cases'
  and exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid()))
);

create policy "wheng admin update public case images" on storage.objects for update to authenticated
using (
  bucket_id='wheng-public' and exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid()))
)
with check (
  bucket_id='wheng-public' and exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid()))
);

create policy "wheng admin delete public case images" on storage.objects for delete to authenticated
using (
  bucket_id='wheng-public' and exists (select 1 from public.wheng_admins a where a.user_id = (select auth.uid()))
);
