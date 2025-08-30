-- Observability and monitoring functions for embedding job queue
-- This provides visibility into job processing, failures, and system health

-- Job tracking table to log completed and failed jobs
create table if not exists embedding_job_log (
  id bigserial primary key,
  msg_id bigint not null,
  table_name text not null,
  schema_name text default 'public',
  row_id text not null,
  column_name text not null,
  status text not null check (status in ('processing', 'completed', 'failed')),
  error_message text,
  error_type text, -- 'api_error', 'validation_error', 'database_error', etc.
  processing_time_ms integer,
  retry_count integer default 0,
  created_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz,
  
  -- Add indexes for common queries
  CREATE INDEX IF NOT EXISTS idx_embedding_job_log_status ON embedding_job_log (status);
  CREATE INDEX IF NOT EXISTS idx_embedding_job_log_created_at ON embedding_job_log (created_at);
  CREATE INDEX IF NOT EXISTS idx_embedding_job_log_table_row ON embedding_job_log (table_name, row_id);
  CREATE INDEX IF NOT EXISTS idx_embedding_job_log_msg_id ON embedding_job_log (msg_id);
);

-- Get comprehensive queue status with job counts and metrics
create or replace function get_embedding_queue_status()
returns jsonb as $$
declare
  queue_metrics jsonb;
  processing_metrics jsonb;
  failure_metrics jsonb;
  result jsonb;
begin
  -- Get queue metrics from pgmq
  select jsonb_build_object(
    'total_messages', coalesce((
      select count(*) 
      from pgmq.q_embedding_jobs
    ), 0),
    'pending_messages', coalesce((
      select count(*) 
      from pgmq.q_embedding_jobs 
      where vt <= now()
    ), 0),
    'processing_messages', coalesce((
      select count(*) 
      from pgmq.q_embedding_jobs 
      where vt > now()
    ), 0)
  ) into queue_metrics;
  
  -- Get processing metrics from job log
  select jsonb_build_object(
    'total_processed', coalesce((
      select count(*) 
      from embedding_job_log 
      where status in ('completed', 'failed')
      and created_at > now() - interval '24 hours'
    ), 0),
    'completed_today', coalesce((
      select count(*) 
      from embedding_job_log 
      where status = 'completed'
      and created_at > now() - interval '24 hours'
    ), 0),
    'failed_today', coalesce((
      select count(*) 
      from embedding_job_log 
      where status = 'failed'
      and created_at > now() - interval '24 hours'
    ), 0),
    'avg_processing_time_ms', coalesce((
      select round(avg(processing_time_ms))
      from embedding_job_log 
      where status = 'completed'
      and processing_time_ms is not null
      and created_at > now() - interval '24 hours'
    ), 0),
    'success_rate_24h', coalesce((
      select case 
        when count(*) = 0 then 100
        else round((count(*) filter (where status = 'completed'))::numeric / count(*) * 100, 1)
      end
      from embedding_job_log
      where status in ('completed', 'failed')
      and created_at > now() - interval '24 hours'
    ), 100)
  ) into processing_metrics;
  
  -- Get failure metrics grouped by error type
  select jsonb_build_object(
    'recent_failures', coalesce((
      select count(*) 
      from embedding_job_log 
      where status = 'failed'
      and created_at > now() - interval '1 hour'
    ), 0),
    'failure_types', coalesce((
      select jsonb_object_agg(
        coalesce(error_type, 'unknown'), 
        count(*)
      )
      from embedding_job_log 
      where status = 'failed'
      and created_at > now() - interval '24 hours'
      group by error_type
    ), '{}'::jsonb),
    'stuck_jobs', coalesce((
      select count(*)
      from embedding_job_log
      where status = 'processing'
      and started_at < now() - interval '5 minutes'
    ), 0)
  ) into failure_metrics;
  
  -- Combine all metrics
  result := jsonb_build_object(
    'queue', queue_metrics,
    'processing', processing_metrics,
    'failures', failure_metrics,
    'last_updated', now()
  );
  
  return result;
end;
$$ language plpgsql security definer;

-- Get recent job history with details
create or replace function get_embedding_job_history(
  limit_count integer default 50,
  status_filter text default null
)
returns table (
  id bigint,
  msg_id bigint,
  table_name text,
  row_id text,
  status text,
  error_message text,
  error_type text,
  processing_time_ms integer,
  retry_count integer,
  created_at timestamptz,
  completed_at timestamptz
) as $$
begin
  return query
  select 
    l.id,
    l.msg_id,
    l.table_name,
    l.row_id,
    l.status,
    l.error_message,
    l.error_type,
    l.processing_time_ms,
    l.retry_count,
    l.created_at,
    l.completed_at
  from embedding_job_log l
  where (status_filter is null or l.status = status_filter)
  order by l.created_at desc
  limit limit_count;
end;
$$ language plpgsql security definer;

-- Get failed jobs with retry information
create or replace function get_failed_embedding_jobs(
  include_retried boolean default false
)
returns table (
  id bigint,
  msg_id bigint,
  table_name text,
  row_id text,
  error_message text,
  error_type text,
  retry_count integer,
  last_failure_at timestamptz,
  can_retry boolean
) as $$
begin
  return query
  select 
    l.id,
    l.msg_id,
    l.table_name,
    l.row_id,
    l.error_message,
    l.error_type,
    l.retry_count,
    l.completed_at as last_failure_at,
    case 
      when l.retry_count < 3 and l.completed_at > now() - interval '1 hour' then true
      else false
    end as can_retry
  from embedding_job_log l
  where l.status = 'failed'
  and (include_retried or l.retry_count = 0)
  order by l.completed_at desc;
end;
$$ language plpgsql security definer;

-- Retry failed jobs by re-queuing them
create or replace function retry_failed_jobs(
  max_retries integer default 3,
  min_age_minutes integer default 5
)
returns jsonb as $$
declare
  retry_count integer := 0;
  job_record record;
  new_payload jsonb;
  result jsonb;
begin
  -- Find failed jobs eligible for retry
  for job_record in
    select l.id, l.msg_id, l.table_name, l.schema_name, l.row_id, l.column_name, l.retry_count
    from embedding_job_log l
    where l.status = 'failed'
    and l.retry_count < max_retries
    and l.completed_at < now() - (min_age_minutes || ' minutes')::interval
    and not exists (
      -- Don't retry if there's already a pending job for this row
      select 1 from pgmq.q_embedding_jobs q
      where (q.message->>'table') = l.table_name
      and (q.message->>'row_id') = l.row_id
    )
  loop
    -- Build new job payload
    new_payload := jsonb_build_object(
      'table', job_record.table_name,
      'schema', job_record.schema_name,
      'row_id', job_record.row_id,
      'column', job_record.column_name,
      'model', 'openai/text-embedding-3-small',
      'retry_of_msg_id', job_record.msg_id,
      'retry_count', job_record.retry_count + 1
    );
    
    -- Send job to queue
    perform pgmq.send('embedding_jobs', new_payload);
    
    -- Mark original as retried
    update embedding_job_log 
    set retry_count = job_record.retry_count + 1
    where id = job_record.id;
    
    retry_count := retry_count + 1;
  end loop;
  
  result := jsonb_build_object(
    'retried_jobs', retry_count,
    'timestamp', now()
  );
  
  return result;
end;
$$ language plpgsql security definer;

-- Get processing metrics and performance data
create or replace function get_processing_metrics(
  time_window_hours integer default 24
)
returns jsonb as $$
declare
  result jsonb;
begin
  with time_series as (
    select 
      date_trunc('hour', created_at) as hour,
      count(*) filter (where status = 'completed') as completed,
      count(*) filter (where status = 'failed') as failed,
      avg(processing_time_ms) filter (where status = 'completed') as avg_time_ms
    from embedding_job_log
    where created_at > now() - (time_window_hours || ' hours')::interval
    group by date_trunc('hour', created_at)
    order by hour
  ),
  summary_stats as (
    select 
      count(*) filter (where status = 'completed') as total_completed,
      count(*) filter (where status = 'failed') as total_failed,
      avg(processing_time_ms) filter (where status = 'completed') as avg_processing_time,
      percentile_cont(0.5) within group (order by processing_time_ms) filter (where status = 'completed') as median_processing_time,
      percentile_cont(0.95) within group (order by processing_time_ms) filter (where status = 'completed') as p95_processing_time,
      max(processing_time_ms) filter (where status = 'completed') as max_processing_time
    from embedding_job_log
    where created_at > now() - (time_window_hours || ' hours')::interval
  )
  select jsonb_build_object(
    'time_window_hours', time_window_hours,
    'summary', to_jsonb(s.*),
    'hourly_data', coalesce(
      (select jsonb_agg(to_jsonb(ts.*)) from time_series ts),
      '[]'::jsonb
    ),
    'generated_at', now()
  ) into result
  from summary_stats s;
  
  return result;
end;
$$ language plpgsql security definer;

-- Clean up old job logs (for maintenance)
create or replace function cleanup_job_logs(
  keep_days integer default 30
)
returns jsonb as $$
declare
  deleted_count integer;
begin
  delete from embedding_job_log
  where created_at < now() - (keep_days || ' days')::interval;
  
  get diagnostics deleted_count = row_count;
  
  return jsonb_build_object(
    'deleted_records', deleted_count,
    'cleanup_date', now()
  );
end;
$$ language plpgsql security definer;

-- Helper function to log job start (called from edge function)
create or replace function log_job_start(
  p_msg_id bigint,
  p_table_name text,
  p_schema_name text,
  p_row_id text,
  p_column_name text
)
returns void as $$
begin
  insert into embedding_job_log (
    msg_id, table_name, schema_name, row_id, column_name, 
    status, started_at
  ) values (
    p_msg_id, p_table_name, p_schema_name, p_row_id, p_column_name,
    'processing', now()
  )
  on conflict (msg_id) do update set
    status = 'processing',
    started_at = now();
end;
$$ language plpgsql security definer;

-- Helper function to log job completion (called from edge function)
create or replace function log_job_completion(
  p_msg_id bigint,
  p_status text,
  p_processing_time_ms integer default null,
  p_error_message text default null,
  p_error_type text default null
)
returns void as $$
begin
  update embedding_job_log 
  set 
    status = p_status,
    completed_at = now(),
    processing_time_ms = p_processing_time_ms,
    error_message = p_error_message,
    error_type = p_error_type
  where msg_id = p_msg_id;
  
  -- If no existing record, create one (shouldn't happen but defensive)
  if not found then
    insert into embedding_job_log (
      msg_id, table_name, schema_name, row_id, column_name,
      status, completed_at, processing_time_ms, error_message, error_type
    ) values (
      p_msg_id, 'unknown', 'public', 'unknown', 'unknown',
      p_status, now(), p_processing_time_ms, p_error_message, p_error_type
    );
  end if;
end;
$$ language plpgsql security definer;