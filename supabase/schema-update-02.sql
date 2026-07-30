-- ============================================================
-- 스키마 업데이트 02 — QnA 감정표현(공감·도움돼요)
-- 적용: Supabase SQL Editor에서 이 파일 전체 실행
-- 같은 방문자(voter_key)가 같은 글에 같은 반응을 두 번 누르면
-- 유니크 제약에 걸리고, 서버가 이를 '취소(토글 오프)'로 처리한다.
-- ============================================================

create table if not exists qna_reactions (
  id          bigint generated always as identity primary key,
  question_ts text not null,              -- qna_questions.legacy_ts
  kind        text not null,              -- 'heart'(공감) | 'like'(도움돼요)
  voter_key   text not null,              -- 브라우저 로컬 식별자(익명)
  created_at  timestamptz default now(),
  unique (question_ts, kind, voter_key)
);
create index if not exists qna_reactions_q on qna_reactions (question_ts);
alter table qna_reactions enable row level security;
