import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { MongoClient } from "npm:mongodb@6.12.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

let client: MongoClient | null = null;

async function getDb() {
  const uri = Deno.env.get("MONGODB_URI");
  if (!uri) throw new Error("MONGODB_URI is not configured");
  
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db("Campusride");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const db = await getDb();
    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    // path: /mongodb-api/{collection}/{action}
    const collection = path[1] || '';
    const action = path[2] || '';

    if (!collection) {
      return new Response(JSON.stringify({ error: "Collection required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const col = db.collection(collection);
    let result: unknown;

    if (req.method === 'GET') {
      // GET: list documents, optional ?filter=JSON&limit=N
      const filterParam = url.searchParams.get('filter');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const filter = filterParam ? JSON.parse(filterParam) : {};
      result = await col.find(filter).limit(limit).toArray();

    } else if (req.method === 'POST') {
      const body = await req.json();

      if (action === 'insert') {
        if (Array.isArray(body)) {
          const r = await col.insertMany(body);
          result = { insertedCount: r.insertedCount };
        } else {
          const r = await col.insertOne(body);
          result = { insertedId: r.insertedId };
        }
      } else if (action === 'update') {
        const { filter, update } = body;
        const r = await col.updateMany(filter || {}, update);
        result = { matchedCount: r.matchedCount, modifiedCount: r.modifiedCount };
      } else if (action === 'delete') {
        const { filter } = body;
        const r = await col.deleteMany(filter || {});
        result = { deletedCount: r.deletedCount };
      } else if (action === 'findOne') {
        result = await col.findOne(body.filter || {});
      } else {
        return new Response(JSON.stringify({ error: "Unknown action. Use: insert, update, delete, findOne" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("MongoDB API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
