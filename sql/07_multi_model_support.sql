-- Add provider metadata columns to support multiple embedding models
-- This migration allows storing embeddings from different providers with their metadata

-- Function to add provider metadata columns to any table
create or replace function add_multi_model_columns(
  table_name text,
  schema_name text default 'public'
) returns void as $$
declare
  sql_text text;
begin
  sql_text := format(
    'alter table %I.%I 
     add column if not exists embedding_provider text default ''openai'',
     add column if not exists embedding_model text default ''text-embedding-3-small'',
     add column if not exists embedding_dimensions int default 1536,
     add column if not exists embedding_normalized boolean default true',
    schema_name, table_name
  );
  
  execute sql_text;
  
  -- Add index on provider for efficient filtering
  sql_text := format(
    'create index if not exists idx_%I_embedding_provider 
     on %I.%I (embedding_provider)',
    table_name, schema_name, table_name
  );
  
  execute sql_text;
end;
$$ language plpgsql;

-- Add multi-model support to documents table
select add_multi_model_columns('documents');

-- Update the register_embedding function to support provider specification
create or replace function register_embedding(
  table_name text,
  column_name text,
  model text default 'openai/text-embedding-3-small',
  provider text default null,
  dimensions int default null
) returns void as $$
declare
  sql_text text;
  parsed_provider text;
  parsed_model text;
  model_dimensions int;
begin
  -- Parse provider/model format (e.g., 'openai/text-embedding-3-small')
  if position('/' in model) > 0 then
    parsed_provider := split_part(model, '/', 1);
    parsed_model := split_part(model, '/', 2);
  else
    parsed_provider := coalesce(provider, 'openai');
    parsed_model := model;
  end if;

  -- Set default dimensions based on provider/model
  if dimensions is null then
    case 
      when parsed_provider = 'openai' and parsed_model = 'text-embedding-3-large' then
        model_dimensions := 3072;
      when parsed_provider = 'cohere' and parsed_model like '%light%' then
        model_dimensions := 384;
      when parsed_provider = 'cohere' then
        model_dimensions := 1024;
      when parsed_provider = 'voyage' and parsed_model = 'voyage-2' then
        model_dimensions := 1024;
      when parsed_provider = 'voyage' and parsed_model = 'voyage-lite-02-instruct' then
        model_dimensions := 1024;
      else
        model_dimensions := 1536; -- Default for OpenAI and Voyage large models
    end case;
  else 
    model_dimensions := dimensions;
  end if;

  -- Ensure multi-model columns exist
  perform add_multi_model_columns(table_name);
  
  -- Create or replace the trigger function for this specific table
  sql_text := format(
    'create or replace function %I_generate_embedding() returns trigger as $trigger$
     begin
       if NEW.%I is not null and NEW.%I != OLD.%I then
         NEW.embedding_provider := %L;
         NEW.embedding_model := %L;
         NEW.embedding_dimensions := %s;
         NEW.embedding_normalized := true;
         NEW.embedding_updated_at := now();
       end if;
       return NEW;
     end;
     $trigger$ language plpgsql;',
    table_name, column_name, column_name, column_name,
    parsed_provider, parsed_model, model_dimensions
  );
  
  execute sql_text;
  
  -- Create the trigger
  sql_text := format(
    'drop trigger if exists %I_embedding_trigger on %I;
     create trigger %I_embedding_trigger
       before insert or update on %I
       for each row execute function %I_generate_embedding();',
    table_name, table_name, table_name, table_name, table_name
  );
  
  execute sql_text;
  
  raise notice 'Registered embedding for %.% using %/%', table_name, column_name, parsed_provider, parsed_model;
end;
$$ language plpgsql;

-- Enhanced semantic search function that supports multiple providers
create or replace function semantic_search_multi(
  table_name text,
  query_embedding vector,
  k int default 5,
  provider_filter text default null,
  model_filter text default null,
  dimensions int default null,
  schema_name text default 'public'
) returns table(row_data jsonb, similarity float, provider text, model text) as $$
declare
  query_text text;
  dimension_filter text := '';
  provider_clause text := '';
begin
  -- Build provider filter clause
  if provider_filter is not null then
    provider_clause := format(' and t.embedding_provider = %L', provider_filter);
  end if;
  
  if model_filter is not null then
    provider_clause := provider_clause || format(' and t.embedding_model = %L', model_filter);
  end if;
  
  if dimensions is not null then
    provider_clause := provider_clause || format(' and t.embedding_dimensions = %s', dimensions);
  end if;

  query_text := format(
    'select to_jsonb(t.*) as row_data, 
            1 - (t.embedding <=> $1) as similarity,
            t.embedding_provider as provider,
            t.embedding_model as model
     from %I.%I t 
     where t.embedding is not null %s
     order by t.embedding <=> $1 
     limit %s',
    schema_name, table_name, provider_clause, k
  );
  
  return query execute query_text using query_embedding;
end;
$$ language plpgsql;

-- Enhanced hybrid search with multi-provider support
create or replace function hybrid_search_multi(
  table_name text,
  content_column text,
  search_query text,
  query_embedding vector,
  alpha float default 0.3,
  beta float default 0.7,
  k int default 5,
  provider_filter text default null,
  model_filter text default null,
  schema_name text default 'public'
) returns table(row_data jsonb, hybrid_score float, bm25_score float, vector_score float, provider text, model text) as $$
declare
  query_text text;
  provider_clause text := '';
begin
  -- Build provider filter clause
  if provider_filter is not null then
    provider_clause := format(' and t.embedding_provider = %L', provider_filter);
  end if;
  
  if model_filter is not null then
    provider_clause := provider_clause || format(' and t.embedding_model = %L', model_filter);
  end if;

  query_text := format(
    'with vector_results as (
       select to_jsonb(t.*) as row_data,
              1 - (t.embedding <=> $1) as vector_score,
              t.embedding_provider,
              t.embedding_model
       from %I.%I t 
       where t.embedding is not null %s
     ),
     fulltext_results as (
       select to_jsonb(t.*) as row_data,
              ts_rank_cd(to_tsvector(''english'', t.%I), plainto_tsquery(''english'', %L)) as bm25_score,
              t.embedding_provider,
              t.embedding_model
       from %I.%I t 
       where to_tsvector(''english'', t.%I) @@ plainto_tsquery(''english'', %L) %s
     ),
     combined_results as (
       select 
         coalesce(v.row_data, f.row_data) as row_data,
         coalesce(v.vector_score, 0) as vector_score,
         coalesce(f.bm25_score, 0) as bm25_score,
         coalesce(v.embedding_provider, f.embedding_provider) as embedding_provider,
         coalesce(v.embedding_model, f.embedding_model) as embedding_model
       from vector_results v
       full outer join fulltext_results f on v.row_data = f.row_data
     ),
     normalized_results as (
       select *,
         case 
           when max(vector_score) over() > 0 then 
             vector_score / max(vector_score) over()
           else 0 
         end as norm_vector_score,
         case 
           when max(bm25_score) over() > 0 then 
             bm25_score / max(bm25_score) over()
           else 0 
         end as norm_bm25_score
       from combined_results
     )
     select 
       row_data,
       (%s * norm_bm25_score + %s * norm_vector_score) as hybrid_score,
       bm25_score,
       vector_score,
       embedding_provider as provider,
       embedding_model as model
     from normalized_results
     where (%s * norm_bm25_score + %s * norm_vector_score) > 0
     order by hybrid_score desc
     limit %s',
    schema_name, table_name, provider_clause,
    content_column, search_query, 
    schema_name, table_name, content_column, search_query, provider_clause,
    alpha, beta, alpha, beta, k
  );
  
  return query execute query_text using query_embedding;
end;
$$ language plpgsql;

-- Convenience function to get provider statistics
create or replace function get_provider_stats(
  table_name text,
  schema_name text default 'public'
) returns table(
  provider text,
  model text,
  dimensions int,
  count bigint,
  avg_updated_age interval
) as $$
declare
  query_text text;
begin
  query_text := format(
    'select 
       t.embedding_provider as provider,
       t.embedding_model as model,
       t.embedding_dimensions as dimensions,
       count(*) as count,
       avg(now() - t.embedding_updated_at) as avg_updated_age
     from %I.%I t
     where t.embedding is not null
     group by t.embedding_provider, t.embedding_model, t.embedding_dimensions
     order by count desc',
    schema_name, table_name
  );
  
  return query execute query_text;
end;
$$ language plpgsql;

-- Function to migrate embeddings between providers (useful for switching providers)
create or replace function migrate_embeddings_provider(
  table_name text,
  old_provider text,
  old_model text,
  new_provider text,
  new_model text,
  new_dimensions int,
  schema_name text default 'public'
) returns int as $$
declare
  affected_rows int;
  sql_text text;
begin
  sql_text := format(
    'update %I.%I 
     set embedding = null,
         embedding_provider = %L,
         embedding_model = %L,
         embedding_dimensions = %s,
         embedding_updated_at = null
     where embedding_provider = %L 
       and embedding_model = %L',
    schema_name, table_name,
    new_provider, new_model, new_dimensions,
    old_provider, old_model
  );
  
  execute sql_text;
  get diagnostics affected_rows = row_count;
  
  raise notice 'Migrated % rows from %/% to %/%', 
    affected_rows, old_provider, old_model, new_provider, new_model;
  
  return affected_rows;
end;
$$ language plpgsql;

-- Update documents table with new multi-model columns (if they don't exist)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'documents' 
    and column_name = 'embedding_provider'
  ) then
    alter table documents 
    add column embedding_provider text default 'openai',
    add column embedding_model text default 'text-embedding-3-small', 
    add column embedding_dimensions int default 1536,
    add column embedding_normalized boolean default true;
    
    create index idx_documents_embedding_provider 
    on documents (embedding_provider);
    
    raise notice 'Added multi-model columns to documents table';
  end if;
end $$;