-- ============================================================
-- BLACK BOOK Supabase 스키마
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여넣고 Run
-- 모든 테이블은 RLS 활성(공개 정책 없음) — 서버의 service_role 키로만 접근.
-- ============================================================

-- 자료실 (구글시트 '자료실' 탭: A 파일명 ~ I 다운로드수)
create table if not exists archive_files (
  id           bigint generated always as identity primary key,
  name         text not null,
  description  text default '',
  category     text default '',          -- 세무/회계/법령/실무/경영/재무/정책자금
  file_type    text default '',          -- XLSX/PDF/HWP …
  prep         text default '',          -- 사전준비
  related_url  text default '',
  download_url text default '',          -- drive 링크
  dated        text default '',          -- yyyy.mm 표기(시트 호환)
  downloads    integer default 0,
  visible      boolean default true,
  created_at   timestamptz default now()
);

-- QnA 질문 (구글시트 '문답' 탭)
create table if not exists qna_questions (
  id         bigint generated always as identity primary key,
  legacy_ts  text unique,                -- 시트 시절 문답ID(ISO 일시) — 이관·답변 연결용
  category   text default '실무',
  title      text not null,
  content    text default '',
  tags       text default '',
  anonymous  boolean default false,
  hidden     boolean default false,
  ua         text default '',
  created_at timestamptz default now()
);

-- QnA 답변 (구글시트 '답변' 탭)
create table if not exists qna_answers (
  id          bigint generated always as identity primary key,
  question_ts text not null,             -- qna_questions.legacy_ts 참조(시트 호환 키)
  author      text default '',
  official    boolean default false,     -- 크레디뷰(운영사) 답변 여부
  content     text not null,
  hidden      boolean default false,
  created_at  timestamptz default now()
);
create index if not exists qna_answers_qts on qna_answers (question_ts);

-- 이메일 리드 (구글시트 '리드' 탭: 소식구독/파인더/자료실)
create table if not exists leads (
  id         bigint generated always as identity primary key,
  source     text default '',            -- 소식 구독 / 정책자금 파인더 / 자료실
  email      text not null,
  consent    boolean default false,      -- 마케팅 동의
  detail     text default '',
  ua         text default '',
  created_at timestamptz default now()
);
create index if not exists leads_email on leads (email);

-- 의견 (구글시트 '의견' 탭)
create table if not exists feedback (
  id         bigint generated always as identity primary key,
  content    text not null,
  email      text default '',
  ua         text default '',
  created_at timestamptz default now()
);

-- 캘린더 일정 (크론 자동 수집 + 수동 등록 공용)
create table if not exists calendar_events (
  id         bigint generated always as identity primary key,
  year       integer not null,
  month      integer not null,
  day        integer not null,
  title      text not null,
  cat        text not null,              -- fund/tax/acc/law
  source     text default 'cron',        -- cron / manual
  kind       text default '',            -- policy / update / statutory
  tag        text default '',            -- start / end
  link       text default '',
  agency     text default '',
  summary    text default '',
  extra      jsonb default '{}'::jsonb,  -- 기업마당 meta(target/field/apply/period 등)
  visible    boolean default true,
  created_at timestamptz default now(),
  unique (year, month, day, title, cat)
);
create index if not exists calendar_events_ym on calendar_events (year, month);

-- RLS: 전부 잠금(service_role만 접근). anon 정책은 만들지 않는다.
alter table archive_files   enable row level security;
alter table qna_questions   enable row level security;
alter table qna_answers     enable row level security;
alter table leads           enable row level security;
alter table feedback        enable row level security;
alter table calendar_events enable row level security;
