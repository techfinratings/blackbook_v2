-- ============================================================
-- 스키마 업데이트 01 — 실무백과 자동 감지 플래그
-- 적용: Supabase SQL Editor에서 이 파일 전체 실행 (schema.sql 이후)
-- 매일 크론이 법제처 개정 법령을 감지해 관련 백과 항목에
-- '검토 필요' 플래그를 남기고, 관리자(/admin 백과 탭)에서 확인 처리한다.
-- ============================================================

create table if not exists guide_flags (
  id          bigint generated always as identity primary key,
  guide_slug  text not null,              -- lib/guides.js의 slug (withholding/vat/…)
  guide_title text default '',
  law_title   text not null,              -- 감지된 법령명
  law_link    text default '',
  eff_date    text default '',            -- 시행일 (yyyymmdd)
  status      text default '검토 필요',    -- 검토 필요 → 확인 처리 시 행 삭제
  created_at  timestamptz default now(),
  unique (guide_slug, law_title, eff_date)
);
alter table guide_flags enable row level security;
