-- Example documents table for testing
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  title text,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Register the content column for embedding
select register_embedding('documents', 'content');