-- uploads 행은 서버(admin)만 만든다. 사용자가 자기 JWT로 created_at이 오래된 행을 대량으로 넣으면
-- 오래된 순으로 하루 일정량만 처리하는 정리 cron이 그 행에 다 쓰여 다른 사용자의 원본 삭제가 밀린다
-- (OWASP 스캔 2026-10-08). 행 생성은 하루 업로드 상한을 거치는 createUpload → adminUploads.create뿐이다.
drop policy uploads_insert on public.uploads;
revoke insert on public.uploads from authenticated;

-- 사용자 client는 업로드 처리(analyze·confirm·recategorize)에 쓰는 컬럼만 고친다.
-- created_at·original_deleted_at·storage_path·sha256·byte_size·user_id는 고칠 수 없다.
revoke update on public.uploads from authenticated;
grant update (card_id, status, error_code, mapping, header_signature, period_from, period_to, counts)
  on public.uploads to authenticated;

-- 미완료 정리(listStale)는 status = 'uploaded'인 오래된 행을 고른다. 사용자가 끝난 행을 'uploaded'로 되돌려
-- 정리 큐 앞자리를 채우지 못하게, 'uploaded'로 돌아가는 전이를 막는다(서버는 이 전이를 쓰지 않는다).
create function public.uploads_status_no_rewind() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if old.status <> 'uploaded' and new.status = 'uploaded' then
    raise exception 'uploads.status cannot return to uploaded' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger uploads_status_no_rewind
  before update of status on public.uploads
  for each row execute function public.uploads_status_no_rewind();
