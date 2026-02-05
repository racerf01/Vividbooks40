/**
 * Imagen Generate Edge Function
 * 
 * Generates images using Nano Banana Pro 3 (gemini-3-pro-image-preview).
 * https://ai.google.dev/gemini-api/docs/image-generation
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImagenRequest {
  prompt: string;
  aspectRatio?: string;
  numberOfImages?: number;
  dataSetId?: string;
  illustrationName?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt, aspectRatio = "1:1", dataSetId }: ImagenRequest = await req.json();

    const apiKey = Deno.env.get("GEMINI_API_KEY_RAG");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY_RAG not configured");
    }

    console.log("[Nano Banana Pro 3] Generating image...");
    console.log("[Nano Banana Pro 3] Prompt:", prompt.substring(0, 200) + "...");

    // Nano Banana Pro 3 = gemini-3-pro-image-preview
    // Docs: https://ai.google.dev/gemini-api/docs/image-generation
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            imageConfig: {
              aspectRatio: aspectRatio
            }
          }
        }),
      }
    );

    const responseText = await response.text();
    console.log("[Nano Banana Pro 3] Response status:", response.status);

    if (!response.ok) {
      console.error("[Nano Banana Pro 3] Error response:", responseText);
      throw new Error(`API error: ${responseText.substring(0, 300)}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
    }

    // Hledat obrázek v odpovědi (inlineData)
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      console.error("[Nano Banana Pro 3] No image in response:", JSON.stringify(data).substring(0, 500));
      throw new Error("No image data in response");
    }

    const base64Image = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    
    console.log("[Nano Banana Pro 3] Successfully generated image!");

    // Nahrání do Supabase Storage
    let publicUrl = "";
    if (dataSetId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const fileName = `${dataSetId}/${crypto.randomUUID()}.png`;
        const binaryData = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));

        const { error: uploadError } = await supabase.storage
          .from("curriculum_media")
          .upload(fileName, binaryData, { contentType: "image/png", upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("curriculum_media").getPublicUrl(fileName);
          publicUrl = urlData.publicUrl;
          console.log("[Nano Banana Pro 3] Uploaded to storage:", publicUrl);
        } else {
          console.error("[Nano Banana Pro 3] Storage upload error:", uploadError);
        }
      } catch (e) {
        console.error("[Nano Banana Pro 3] Storage error:", e);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        images: [{ base64: base64Image, mimeType }],
        url: publicUrl 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[Nano Banana Pro 3] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
