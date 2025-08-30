-- Trigger function to enqueue embedding jobs
create or replace function enqueue_embedding_job()
returns trigger as $$
declare
  payload jsonb;
  column_name text;
begin
  -- Get the column name from trigger
  column_name := tg_argv[0];
  if column_name is null then
    -- Default to detecting changed text columns
    column_name := case 
      when tg_op = 'INSERT' then 'content'
      when tg_op = 'UPDATE' then 'content'
    end;
  end if;
  
  -- Build payload for embedding job
  payload := jsonb_build_object(
    'table', tg_table_name,
    'schema', tg_table_schema,
    'row_id', new.id,
    'column', column_name,
    'new_text', case 
      when column_name = 'content' then new.content
      else null
    end,
    'model', 'openai/text-embedding-3-small'
  );
  
  -- Send job to queue
  perform pgmq.send('embedding_jobs', payload);
  
  return new;
end;
$$ language plpgsql;