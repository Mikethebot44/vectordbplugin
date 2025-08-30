-- Full-text search function using PostgreSQL's built-in FTS with BM25-style ranking
create or replace function fulltext_search(
  table_name text,
  content_column text,
  search_query text,
  k int default 5,
  schema_name text default 'public'
) returns table(row_data jsonb, bm25_score float) as $$
declare
  query_text text;
begin
  query_text := format(
    'select to_jsonb(t.*) as row_data,
            ts_rank_cd(to_tsvector(''english'', t.%I), plainto_tsquery(''english'', %L)) as bm25_score
     from %I.%I t 
     where to_tsvector(''english'', t.%I) @@ plainto_tsquery(''english'', %L)
     order by bm25_score desc 
     limit %s',
    content_column, search_query, schema_name, table_name, content_column, search_query, k
  );
  
  return query execute query_text;
end;
$$ language plpgsql;

-- Convenience function for documents table full-text search
create or replace function fulltext_search_documents(
  search_query text,
  k int default 5
) returns table(
  id uuid,
  content text,
  embedding_model text,
  embedding_updated_at timestamptz,
  bm25_score float
) as $$
begin
  return query
    select d.id, d.content, d.embedding_model, d.embedding_updated_at,
           ts_rank_cd(to_tsvector('english', d.content), plainto_tsquery('english', search_query)) as bm25_score
    from documents d
    where to_tsvector('english', d.content) @@ plainto_tsquery('english', search_query)
    order by bm25_score desc
    limit k;
end;
$$ language plpgsql;

-- Server-side hybrid search with weighted scoring
create or replace function hybrid_search(
  table_name text,
  content_column text,
  search_query text,
  query_embedding vector(1536),
  alpha float default 0.3,
  beta float default 0.7,
  k int default 5,
  schema_name text default 'public'
) returns table(row_data jsonb, hybrid_score float, bm25_score float, vector_score float) as $$
declare
  query_text text;
begin
  query_text := format(
    'with vector_results as (
       select to_jsonb(t.*) as row_data,
              1 - (t.embedding <=> $1) as vector_score,
              t.%I as content_text
       from %I.%I t 
       where t.embedding is not null
     ),
     fulltext_results as (
       select to_jsonb(t.*) as row_data,
              ts_rank_cd(to_tsvector(''english'', t.%I), plainto_tsquery(''english'', %L)) as bm25_score
       from %I.%I t 
       where to_tsvector(''english'', t.%I) @@ plainto_tsquery(''english'', %L)
     ),
     combined_results as (
       select 
         coalesce(v.row_data, f.row_data) as row_data,
         coalesce(v.vector_score, 0) as vector_score,
         coalesce(f.bm25_score, 0) as bm25_score
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
       vector_score
     from normalized_results
     where (%s * norm_bm25_score + %s * norm_vector_score) > 0
     order by hybrid_score desc
     limit %s',
    content_column, schema_name, table_name, content_column, search_query, 
    schema_name, table_name, content_column, search_query,
    alpha, beta, alpha, beta, k
  );
  
  return query execute query_text using query_embedding;
end;
$$ language plpgsql;

-- Convenience function for documents table hybrid search
create or replace function hybrid_search_documents(
  search_query text,
  query_embedding vector(1536),
  alpha float default 0.3,
  beta float default 0.7,
  k int default 5
) returns table(
  id uuid,
  content text,
  embedding_model text,
  embedding_updated_at timestamptz,
  hybrid_score float,
  bm25_score float,
  vector_score float
) as $$
begin
  return query
    with vector_results as (
      select d.id, d.content, d.embedding_model, d.embedding_updated_at,
             1 - (d.embedding <=> query_embedding) as vector_score
      from documents d
      where d.embedding is not null
    ),
    fulltext_results as (
      select d.id, d.content, d.embedding_model, d.embedding_updated_at,
             ts_rank_cd(to_tsvector('english', d.content), plainto_tsquery('english', search_query)) as bm25_score
      from documents d
      where to_tsvector('english', d.content) @@ plainto_tsquery('english', search_query)
    ),
    combined_results as (
      select 
        coalesce(v.id, f.id) as id,
        coalesce(v.content, f.content) as content,
        coalesce(v.embedding_model, f.embedding_model) as embedding_model,
        coalesce(v.embedding_updated_at, f.embedding_updated_at) as embedding_updated_at,
        coalesce(v.vector_score, 0) as vector_score,
        coalesce(f.bm25_score, 0) as bm25_score
      from vector_results v
      full outer join fulltext_results f on v.id = f.id
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
      id, content, embedding_model, embedding_updated_at,
      (alpha * norm_bm25_score + beta * norm_vector_score) as hybrid_score,
      bm25_score,
      vector_score
    from normalized_results
    where (alpha * norm_bm25_score + beta * norm_vector_score) > 0
    order by hybrid_score desc
    limit k;
end;
$$ language plpgsql;