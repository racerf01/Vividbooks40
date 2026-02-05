/**
 * AI Chat Edge Function
 * 
 * Bezpečné proxy pro OpenAI a Gemini API.
 * API klíče jsou uloženy jako Supabase secrets.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  max_tokens?: number;
  thinking_level?: 'minimal' | 'low' | 'medium' | 'high'; // Gemini 3 Flash specific
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages, model, temperature = 0.7, max_tokens = 8192, thinking_level }: ChatRequest = await req.json()

    console.log(`Request: model=${model}, max_tokens=${max_tokens}`)

    if (!messages || messages.length === 0) {
      throw new Error('Messages are required')
    }

    // Determine which API to use based on model name
    const isGemini = model.toLowerCase().includes('gemini')
    
    let responseText: string

    if (isGemini) {
      // === GEMINI API ===
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY_RAG')
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY_RAG not configured')
      }

      // Convert messages to Gemini format
      const geminiContents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }))

      // Add system instruction if present
      const systemMessage = messages.find(m => m.role === 'system')
      
      // Determine model version first (needed for thinking config)
      // See: https://ai.google.dev/gemini-api/docs/gemini-3
      let geminiModel: string
      const isGemini3Pro = model.includes('gemini-3-pro') || model.includes('gemini-3 pro')
      const isGemini3Flash = model.includes('gemini-3-flash') || model.includes('gemini-3 flash') || (model.includes('3') && model.includes('flash'))
      const isGemini3 = isGemini3Pro || isGemini3Flash
      
      if (isGemini3Pro) {
        // Gemini 3 Pro - for complex reasoning tasks
        geminiModel = 'gemini-3-pro-preview'
      } else if (isGemini3Flash) {
        // Gemini 3 Flash - for fast, simple tasks
        geminiModel = 'gemini-3-flash-preview'
      } else if (model.includes('2.0')) {
        geminiModel = 'gemini-2.0-flash'
      } else if (model.includes('2.5') || model.includes('gemini-2.5')) {
        geminiModel = 'gemini-2.5-flash'
      } else {
        // Default to Gemini 3 Flash (latest)
        geminiModel = 'gemini-3-flash-preview'
      }
      
      const geminiBody: any = {
        contents: geminiContents,
        generationConfig: {
          maxOutputTokens: max_tokens,
          temperature: temperature,
        }
      }

      // Add thinking_level for Gemini 3 models
      // Supported levels: minimal, low, medium, high (default)
      // For chat, use 'low' for faster responses
      if (isGemini3) {
        geminiBody.generationConfig.thinkingConfig = {
          thinkingLevel: thinking_level || 'low' // 'low' for chat (faster), 'high' for complex reasoning
        }
      }

      if (systemMessage) {
        geminiBody.systemInstruction = {
          parts: [{ text: systemMessage.content }]
        }
      }
      
      console.log(`Using Gemini model: ${geminiModel}`)
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody)
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    } else {
      // === OPENAI API ===
      const openaiApiKey = Deno.env.get('open_ai_key2')
      if (!openaiApiKey) {
        throw new Error('open_ai_key2 not configured')
      }

      // Determine if it's a GPT-5 model (different parameters)
      const isGpt5 = model.toLowerCase().includes('gpt-5')

      const openaiBody: any = {
        model: model,
        messages: messages,
      }

      // GPT-5 has different parameter requirements
      if (isGpt5) {
        openaiBody.max_completion_tokens = max_tokens
        // GPT-5 only supports default temperature
      } else {
        openaiBody.max_tokens = max_tokens
        openaiBody.temperature = temperature
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(openaiBody)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error?.message || 'Unknown error'
        
        // Provide specific error messages
        if (response.status === 401) {
          throw new Error('Neplatný OpenAI API klíč')
        } else if (response.status === 429) {
          throw new Error('Překročen limit OpenAI API. Počkej chvíli.')
        } else if (response.status === 402) {
          throw new Error('Nedostatečný kredit na OpenAI účtu')
        }
        
        throw new Error(`OpenAI API error: ${response.status} - ${errorMessage}`)
      }

      const data = await response.json()
      responseText = data.choices?.[0]?.message?.content || ''
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        content: responseText,
        model: model 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('AI Chat error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
      }
    )
  }
})

