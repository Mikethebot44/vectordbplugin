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

async function processEmbeddingJob(supabase: any, job: EmbeddingJob): Promise<void> {
  const { table, schema, row_id, column, new_text, model } = job.message;
  
  try {
    // Generate embedding
    const embedding = await generateEmbedding(new_text, model.split("/")[1]);
    
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
    }

    console.log(`Successfully processed embedding for ${table}.${row_id}`);
  } catch (error) {
    console.error(`Failed to process job ${job.msg_id}:`, error);
    // Job will be retried due to visibility timeout
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