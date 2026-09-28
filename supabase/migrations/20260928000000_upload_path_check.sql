alter table public.uploads
  add constraint uploads_storage_path_matches_owner
  check (storage_path = user_id::text || '/' || id::text || '/original');
