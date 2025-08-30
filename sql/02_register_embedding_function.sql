-- Function to register a table column for embedding
create or replace function register_embedding(
  table_name text,
  column_name text,
  model text default 'openai/text-embedding-3-small'
) returns void as $$
declare
  embedding_column text := 'embedding';
  model_column text := 'embedding_model';
  updated_column text := 'embedding_updated_at';
  trigger_name text := format('%s_%s_embedding_trigger', table_name, column_name);
  index_name text := format('%s_%s_hnsw', table_name, embedding_column);
begin
  -- Add embedding columns if they don't exist
  execute format(
    'alter table %I add column if not exists %I vector(1536)',
    table_name, embedding_column
  );
  
  execute format(
    'alter table %I add column if not exists %I text',
    table_name, model_column
  );
  
  execute format(
    'alter table %I add column if not exists %I timestamptz',
    table_name, updated_column
  );
  
  -- Create HNSW index for vector similarity search
  execute format(
    'create index if not exists %I on %I using hnsw (%I vector_cosine_ops)',
    index_name, table_name, embedding_column
  );
  
  -- Create trigger for automatic embedding job queuing
  execute format(
    'create trigger %I
     after insert or update of %I on %I
     for each row execute function enqueue_embedding_job()',
    trigger_name, column_name, table_name
  );
  
  -- Create embedding jobs queue if it doesn't exist
  perform pgmq.create('embedding_jobs');
  
  raise notice 'Registered embedding for %.% with model %', table_name, column_name, model;
end;
$$ language plpgsql;