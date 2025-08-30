-- Generic semantic search function
create or replace function semantic_search(
  table_name text,
  query_embedding vector(1536),
  k int default 5,
  schema_name text default 'public'
) returns table(row_data jsonb, similarity float) as $$
declare
  query_text text;
begin
  query_text := format(
    'select to_jsonb(t.*) as row_data, 
            1 - (t.embedding <=> $1) as similarity
     from %I.%I t 
     where t.embedding is not null
     order by t.embedding <=> $1 
     limit %s',
    schema_name, table_name, k
  );
  
  return query execute query_text using query_embedding;
end;
$$ language plpgsql;

-- Convenience function for documents table
create or replace function search_documents(
  query_embedding vector(1536),
  k int default 5
) returns table(
  id uuid,
  content text,
  embedding_model text,
  embedding_updated_at timestamptz,
  similarity float
) as $$
begin
  return query
    select d.id, d.content, d.embedding_model, d.embedding_updated_at,
           1 - (d.embedding <=> query_embedding) as similarity
    from documents d
    where d.embedding is not null
    order by d.embedding <=> query_embedding
    limit k;
end;
$$ language plpgsql;