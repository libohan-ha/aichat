import fs from "fs"
import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import path from "path"
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
const LOCAL_API_MODELS = ["claude-opus-4-5-thinking", "gemini-3-flash", "gemini-3-pro-high"]

function isLocalApiModel(model: string): boolean {
  return LOCAL_API_MODELS.some(m => model.toLowerCase() === m.toLowerCase())
}

// 通过文件内容检测真实的MIME类型
function detectMimeType(buffer: Buffer): string {
  // 检查文件头（magic bytes）
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg'
  }
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png'
  }
  if (buffer.length >= 4 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return 'image/gif'
  }
  if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp'
  }
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4D) {
    return 'image/bmp'
  }
  // 默认返回jpeg
  return 'image/jpeg'
}

// 将本地图片URL转换为base64
function convertLocalImageToBase64(imageUrl: string): string {
  // 如果已经是base64或完整URL，直接返回
  if (imageUrl.startsWith('data:') || imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl
  }

  try {
    // 处理API路由路径（如 /api/uploads/xxx.jpg）和旧的静态路径（如 /uploads/xxx.jpg）
    let relativePath = imageUrl
    if (imageUrl.startsWith('/api/uploads/')) {
      relativePath = imageUrl.replace('/api/uploads/', '/uploads/')
    }
    
    const publicDir = path.join(process.cwd(), 'public')
    const imagePath = path.join(publicDir, relativePath)

    // 检查文件是否存在
    if (!fs.existsSync(imagePath)) {
      console.error(`图片文件不存在: ${imagePath}`)
      return imageUrl
    }

    // 读取文件并转换为base64
    const imageBuffer = fs.readFileSync(imagePath)
    const base64 = imageBuffer.toString('base64')
    // 通过文件内容检测真实的MIME类型
    const mimeType = detectMimeType(imageBuffer)

    return `data:${mimeType};base64,${base64}`
  } catch (error) {
    console.error(`转换图片失败: ${imageUrl}`, error)
    return imageUrl
  }
}

// 将消息转换为OpenAI多模态格式
function formatMessagesWithImages(messages: Array<{ role: string; content: string; imageUrls?: string[] }>) {
  return messages.map((msg) => {
    // 如果没有图片，返回普通文本消息
    if (!msg.imageUrls || msg.imageUrls.length === 0) {
      return {
        role: msg.role,
        content: msg.content,
      }
    }

    // 有图片时，构建多模态内容数组
    const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = []

    // 先添加文本（如果有）
    if (msg.content && msg.content.trim()) {
      contentParts.push({
        type: "text",
        text: msg.content,
      })
    }

    // 添加图片（转换为base64）
    for (const imageUrl of msg.imageUrls) {
      const base64Url = convertLocalImageToBase64(imageUrl)
      contentParts.push({
        type: "image_url",
        image_url: { url: base64Url },
      })
    }

    return {
      role: msg.role,
      content: contentParts,
    }
  })
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

    // 格式化消息（处理图片）
    const formattedMessages = formatMessagesWithImages(messages)

    // 调用DeepSeek API
    const chosenModel = modelFromBody || character?.model || model

    // Check if using local API model (claude-opus-4-5-thinking, gemini-3-flash, etc.)
    if (typeof chosenModel === "string" && isLocalApiModel(chosenModel)) {
      const localConfig = getLocalApiConfig()
      const localClient = new OpenAI({ apiKey: localConfig.apiKey, baseURL: localConfig.baseURL })

      const requestMessages = [systemMessage, ...formattedMessages]
      console.log("Local API Request:", JSON.stringify({ model: chosenModel, messageCount: requestMessages.length }, null, 2))

      try {
        const completion = await localClient.chat.completions.create({
          model: chosenModel,
          messages: requestMessages as any,
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
      } catch (apiError: any) {
        console.error("Local API Error Details:", {
          status: apiError?.status,
          message: apiError?.message,
          error: apiError?.error,
        })
        throw apiError
      }
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
      messages: [systemMessage, ...formattedMessages] as any,
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
