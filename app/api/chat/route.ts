import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
// Ensure Node.js runtime for server-side fetch/proxy
export const runtime = "nodejs"

function getDeepseekConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY
  let baseURL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1"
  // ensure baseURL ends with /v1 for OpenAI SDK compatibility
  if (!/\/v1\/?$/.test(baseURL)) {
    baseURL = baseURL.replace(/\/+$/, "") + "/v1"
  }
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat"
  return { apiKey, baseURL, model }
}

function getLocalApiConfig() {
  const apiKey = process.env.LOCAL_API_KEY || "sk-ace780b87a754995a3437a13518e99c9"
  const baseURL = process.env.LOCAL_API_BASE_URL || "http://127.0.0.1:8045/v1"
  return { apiKey, baseURL }
}

// 本地API支持的模型列表
const LOCAL_API_MODELS = ["claude-opus-4-5-thinking", "gemini-3-flash"]

function isLocalApiModel(model: string): boolean {
  return LOCAL_API_MODELS.some(m => model.toLowerCase() === m.toLowerCase())
}

export async function POST(request: NextRequest) {
  try {
    const { messages, character, model: modelFromBody } = await request.json()

    const { apiKey, baseURL, model } = getDeepseekConfig()

    // 构建系统提示词
    const systemMessage = {
      role: "system" as const,
      content: character?.prompt || "你是一个友善的AI助手，请用中文回答问题。",
    }

    // 调用DeepSeek API
    const chosenModel = modelFromBody || character?.model || model

    // Check if using local API model (claude-opus-4-5-thinking, gemini-3-flash, etc.)
    if (typeof chosenModel === "string" && isLocalApiModel(chosenModel)) {
      const localConfig = getLocalApiConfig()
      const localClient = new OpenAI({ apiKey: localConfig.apiKey, baseURL: localConfig.baseURL })
      
      const completion = await localClient.chat.completions.create({
        model: chosenModel,
        messages: [systemMessage, ...messages],
        stream: true,
        temperature: 0.7,
        max_tokens: 4096,
      })

      // 创建流式响应
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of completion) {
              const content = chunk.choices[0]?.delta?.content || ""
              if (content) {
                const data = encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                controller.enqueue(data)
              }
            }
            controller.close()
          } catch (error) {
            console.error("Stream error:", error)
            controller.error(error)
          }
        },
      })

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    }

    // Default: DeepSeek-compatible OpenAI API
    if (!apiKey) {
      return NextResponse.json(
        { error: "缺少 DeepSeek API 密钥，请在 .env.local 配置 DEEPSEEK_API_KEY" },
        { status: 500 },
      )
    }
    const deepseek = new OpenAI({ apiKey, baseURL })
    const completion = await deepseek.chat.completions.create({
      model: chosenModel,
      messages: [systemMessage, ...messages],
      stream: true,
      temperature: 0.7,
      max_tokens: 4096,
    })

    // 创建流式响应
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || ""
            if (content) {
              const data = encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
              controller.enqueue(data)
            }
          }
          controller.close()
        } catch (error) {
          console.error("Stream error:", error)
          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("API Error:", error)
    return NextResponse.json({ error: "API调用失败，请检查API密钥配置" }, { status: 500 })
  }
}
