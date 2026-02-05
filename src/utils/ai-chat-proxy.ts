/**
 * AI Chat Proxy
 * 
 * Volá Supabase Edge Function pro bezpečné AI API requesty.
 * API klíče jsou uloženy v Supabase secrets, ne v klientovi.
 */

import { supabase } from './supabase/client';
import { projectId, publicAnonKey } from './supabase/info';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
}

interface ChatResponse {
  success: boolean;
  content?: string;
  error?: string;
  model?: string;
}

// Supabase URL - use from info.tsx (always available)
const SUPABASE_URL = `https://${projectId}.supabase.co`;

// Check if we should use the proxy (Edge Function) or direct API calls
// Default: always use proxy (API keys are in Supabase secrets)
// Can be disabled with localStorage.setItem('use_ai_proxy', 'false')
function shouldUseProxy(): boolean {
  // Check if explicitly disabled
  if (typeof window !== 'undefined') {
    const setting = localStorage.getItem('use_ai_proxy');
    if (setting === 'false') {
      return false;
    }
  }
  
  // Default: always use proxy (safest option)
  return true;
}

/**
 * Chat with AI using Supabase Edge Function proxy
 */
export async function chatWithAIProxy(
  messages: ChatMessage[],
  model: string,
  options: ChatOptions = {}
): Promise<string> {
  const { temperature = 0.7, max_tokens = 2048 } = options;

  try {
    console.log('[AI Proxy] Starting request with model:', model);
    
    // Get auth token with timeout
    let authToken = publicAnonKey;
    try {
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Session timeout')), 2000)
      );
      const result = await Promise.race([sessionPromise, timeoutPromise]);
      if (result && 'data' in result && result.data.session?.access_token) {
        authToken = result.data.session.access_token;
      }
    } catch (e) {
      console.log('[AI Proxy] Using anon key (session unavailable)');
    }
    
    console.log('[AI Proxy] Calling edge function...');
    
    // Call edge function with timeout - 3 minuty pro delší generování
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 180s timeout (3 min)
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        messages,
        model,
        temperature,
        max_tokens,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    const data: ChatResponse = await response.json();
    console.log('[AI Proxy] Response received:', data.success ? 'success' : data.error);

    if (!data.success) {
      throw new Error(data.error || 'AI request failed');
    }

    return data.content || '';

  } catch (error: any) {
    console.error('[AI Proxy] Error:', error.message || error);
    throw error;
  }
}

/**
 * Helper to check if AI proxy is available
 */
export function isAIProxyAvailable(): boolean {
  return !!SUPABASE_URL;
}

/**
 * Enable or disable AI proxy for development
 */
export function setUseAIProxy(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('use_ai_proxy', enabled ? 'true' : 'false');
  }
}

export { shouldUseProxy };

/**
 * Generate image using Imagen API via Supabase Edge Function
 */
export async function generateImageWithImagen(
  prompt: string,
  options: { aspectRatio?: string; numberOfImages?: number; dataSetId?: string; illustrationName?: string } = {}
): Promise<{ success: boolean; images?: { base64: string; mimeType: string }[]; url?: string; error?: string }> {
  const { aspectRatio = '1:1', numberOfImages = 1, dataSetId, illustrationName } = options;

  try {
    console.log('[Imagen] Generating image...');
    
    // Get auth token
    let authToken = publicAnonKey;
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        authToken = data.session.access_token;
      }
    } catch (e) {
      console.log('[Imagen] Using anon key');
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/imagen-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        prompt,
        aspectRatio,
        numberOfImages,
        dataSetId,
        illustrationName,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    const data = await response.json();
    console.log('[Imagen] Response status:', response.status);
    console.log('[Imagen] Response data:', {
      success: data.success,
      error: data.error,
      hasUrl: !!data.url,
      url: data.url,
      hasImages: !!data.images,
      imagesCount: data.images?.length,
      firstImageHasBase64: !!data.images?.[0]?.base64,
      firstImageBase64Length: data.images?.[0]?.base64?.length
    });

    return data;

  } catch (error: any) {
    console.error('[Imagen] Error:', error.message);
    return { success: false, error: error.message };
  }
}
