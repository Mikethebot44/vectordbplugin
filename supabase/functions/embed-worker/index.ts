import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface EmbeddingJob {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: {
    table: string;
    schema: string;
    row_id: string;
    column: string;
    new_text: string;
    model: string;
    retry_of_msg_id?: number;
    retry_count?: number;
  };
}

async function generateEmbedding(text: string, model = "text-embedding-3-small"): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

function categorizeError(error: Error): { type: string; category: string } {
  const message = error.message.toLowerCase();
  
  // OpenAI API errors
  if (message.includes('openai api error: 429')) {
    return { type: 'api_rate_limit', category: 'OpenAI rate limit exceeded' };
  }
  if (message.includes('openai api error: 401')) {
    return { type: 'api_auth_error', category: 'OpenAI authentication failed' };
  }
  if (message.includes('openai api error: 500')) {
    return { type: 'api_server_error', category: 'OpenAI server error' };
  }
  if (message.includes('openai api error')) {
    return { type: 'api_error', category: 'OpenAI API error' };
  }
  
  // Validation errors
  if (message.includes('text too long') || message.includes('token limit')) {
    return { type: 'validation_error', category: 'Text content too long' };
  }
  if (message.includes('empty text') || message.includes('no content')) {
    return { type: 'validation_error', category: 'Empty or invalid text content' };
  }
  
  // Database errors
  if (message.includes('failed to update row') || message.includes('database error')) {
    return { type: 'database_error', category: 'Database update failed' };
  }
  
  // Network/timeout errors
  if (message.includes('timeout') || message.includes('network')) {
    return { type: 'network_error', category: 'Network or timeout error' };
  }
  
  // Default
  return { type: 'unknown_error', category: 'Unknown error occurred' };
}

async function processEmbeddingJob(supabase: any, job: EmbeddingJob): Promise<void> {
  const { table, schema = 'public', row_id, column, new_text, model } = job.message;
  const startTime = Date.now();
  
  // Log job start
  try {
    await supabase.rpc('log_job_start', {
      p_msg_id: job.msg_id,
      p_table_name: table,
      p_schema_name: schema,
      p_row_id: row_id,
      p_column_name: column
    });
  } catch (logError) {
    console.warn('Failed to log job start:', logError);
  }
  
  try {
    // Validation
    if (!new_text || typeof new_text !== 'string' || new_text.trim().length === 0) {
      throw new Error('Empty or invalid text content provided');
    }
    
    if (new_text.length > 50000) { // Reasonable limit for embedding
      throw new Error('Text too long for embedding (max 50,000 characters)');
    }
    
    // Generate embedding
    console.log(`Processing embedding for ${table}.${row_id} (${new_text.length} chars)`);
    const embedding = await generateEmbedding(new_text, model.split("/")[1]);
    
    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Invalid embedding generated from OpenAI');
    }
    
    // Update the row with the embedding
    const { error: updateError } = await supabase
      .from(table)
      .update({
        embedding: `[${embedding.join(",")}]`,
        embedding_model: model,
        embedding_updated_at: new Date().toISOString(),
      })
      .eq("id", row_id);

    if (updateError) {
      throw new Error(`Failed to update row: ${updateError.message}`);
    }

    // Delete the job from queue
    const { error: deleteError } = await supabase.rpc("pgmq_delete", {
      queue_name: "embedding_jobs",
      msg_id: job.msg_id,
    });

    if (deleteError) {
      console.error("Failed to delete job from queue:", deleteError);
      // Don't throw here - the embedding was successful
    }

    const processingTime = Date.now() - startTime;
    
    // Log successful completion
    try {
      await supabase.rpc('log_job_completion', {
        p_msg_id: job.msg_id,
        p_status: 'completed',
        p_processing_time_ms: processingTime
      });
    } catch (logError) {
      console.warn('Failed to log job completion:', logError);
    }

    console.log(`Successfully processed embedding for ${table}.${row_id} in ${processingTime}ms`);
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorInfo = categorizeError(error instanceof Error ? error : new Error(String(error)));
    
    // Log failed completion
    try {
      await supabase.rpc('log_job_completion', {
        p_msg_id: job.msg_id,
        p_status: 'failed',
        p_processing_time_ms: processingTime,
        p_error_message: error instanceof Error ? error.message : String(error),
        p_error_type: errorInfo.type
      });
    } catch (logError) {
      console.warn('Failed to log job failure:', logError);
    }
    
    console.error(`Failed to process job ${job.msg_id} for ${table}.${row_id} (${errorInfo.category}):`, error);
    
    // Job will be retried due to visibility timeout unless it's a validation error
    if (errorInfo.type === 'validation_error') {
      // For validation errors, delete the job to prevent infinite retries
      try {
        await supabase.rpc("pgmq_delete", {
          queue_name: "embedding_jobs",
          msg_id: job.msg_id,
        });
        console.log(`Deleted job ${job.msg_id} due to validation error (won't retry)`);
      } catch (deleteError) {
        console.error(`Failed to delete invalid job ${job.msg_id}:`, deleteError);
      }
    }
    
    // Re-throw to indicate job failure
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Process one job at a time
    const { data: jobs, error } = await supabase.rpc("pgmq_read", {
      queue_name: "embedding_jobs",
      vt: 30, // 30 second visibility timeout
      qty: 1,
    });

    if (error) {
      console.error("Failed to read from queue:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ message: "No jobs in queue" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process the job
    await processEmbeddingJob(supabase, jobs[0] as EmbeddingJob);

    return new Response(JSON.stringify({ 
      message: "Job processed successfully",
      processed: jobs[0].msg_id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});