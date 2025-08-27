import { type NextRequest, NextResponse } from "next/server"
import { localDB } from "@/lib/local-storage"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId") || "default"

    // Initialize default data if needed
    await localDB.initializeDefaultData(userId)

    const characters = await localDB.getCharacters(userId)

    return NextResponse.json({ success: true, characters })
  } catch (error) {
    console.error("获取角色列表失败:", error)
    return NextResponse.json({ error: "获取角色列表失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, avatar, prompt, background, backgroundSize, backgroundPosition, backgroundRepeat, userAvatar, bubbleUserOpacity, bubbleAiOpacity, model, userId = "default" } = body

    // 验证必需字段（头像可选，服务端兜底）
    if (!name || !prompt) {
      return NextResponse.json({ error: "缺少必需字段" }, { status: 400 })
    }

    const character = await localDB.createCharacter({
      name,
      avatar: avatar || "/placeholder.svg",
      prompt,
      background,
      backgroundSize,
      backgroundPosition,
      backgroundRepeat,
      bubbleUserOpacity,
      bubbleAiOpacity,
      model,
      userId,
      userAvatar,
    })

    return NextResponse.json({ success: true, character })
  } catch (error) {
    console.error("创建角色失败:", error)
    return NextResponse.json({ error: "创建角色失败" }, { status: 500 })
  }
}
