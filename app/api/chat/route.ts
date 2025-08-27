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

    // If using Gemini model family
    if (typeof chosenModel === "string" && chosenModel.toLowerCase().startsWith("gemini")) {
      const geminiKey = process.env.GEMINI_API_KEY
      if (!geminiKey) {
        return NextResponse.json(
          { error: "缺少 Gemini API 密钥，请在 .env.local 配置 GEMINI_API_KEY" },
          { status: 500 },
        )
      }

      // Build Gemini payload following ai.txt style: single parts-only content
      const combinedText = [
        String(systemMessage.content || ""),
        ...(messages as Array<{ role: string; content: string }>).map((m) =>
          `${m.role === "assistant" ? "助手" : "用户"}: ${String(m.content ?? "")}`,
        ),
      ]
        .filter(Boolean)
        .join("\n\n")

      const contents = [
        {
          parts: [{ text: combinedText }],
        },
      ]

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chosenModel)}:generateContent`
      const proxyUrl = process.env.GEMINI_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY
      let dispatcher: any = undefined
      if (proxyUrl) {
        try {
          const undici = await import("undici")
          // @ts-ignore: runtime import typing
          dispatcher = new undici.ProxyAgent(proxyUrl)
        } catch (e) {
          console.warn("未安装 undici 或无法加载 ProxyAgent，跳过代理。", e)
        }
      }
      const resp = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": geminiKey },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
        // Use proxy if configured
        // @ts-ignore undici option
        dispatcher,
      })

      if (!resp.ok) {
        const text = await resp.text()
        console.error("Gemini API error:", resp.status, text)
        return NextResponse.json({ error: `Gemini API 调用失败: ${resp.status}` }, { status: 500 })
      }

      const data = await resp.json()
      // Robustly extract text from Gemini responses
      const collectText = (d: any): string => {
        try {
          const cands = Array.isArray(d?.candidates) ? d.candidates : []
          for (const c of cands) {
            // Preferred: content.parts[].text
            if (Array.isArray(c?.content?.parts)) {
              const t = c.content.parts.map((p: any) => p?.text).filter(Boolean).join("")
              if (t) return t
            }
            // Fallback: content is array of parts
            if (Array.isArray(c?.content)) {
              const t = c.content.map((p: any) => p?.text).filter(Boolean).join("")
              if (t) return t
            }
            // Fallback: direct text field (rare)
            if (typeof c?.text === "string" && c.text.trim()) return c.text
          }
        } catch {}
        return ""
      }
      const fullText = collectText(data)
      // Clean leading role labels like "助手:" / "用户:" once at the start
      let cleaned = fullText.replace(/^\s*(助手|用户|assistant|user)\s*[:：]\s*/i, "").trim()
      // Fallback: if cleaning removed everything (e.g., model only echoed a label), use original
      if (!cleaned) cleaned = fullText.trim()

      // If Gemini returned no text, return an empty SSE to let client handle gracefully (no DeepSeek fallback)

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            if (cleaned && cleaned.trim().length > 0) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: cleaned })}\n\n`))
            }
            controller.close()
          } catch (err) {
            controller.error(err)
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
