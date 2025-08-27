import { type NextRequest, NextResponse } from "next/server"
import { localDB } from "@/lib/local-storage"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId") || "default"
    const characterId = searchParams.get("characterId")
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    if (!characterId) {
      return NextResponse.json({ error: "缺少角色ID" }, { status: 400 })
    }

    const messages = await localDB.getMessages(userId, characterId, limit)

    // 转换为前端期望的格式
    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      role: msg.role,
      timestamp: msg.createdAt,
      image: msg.image,
    }))

    return NextResponse.json({ success: true, messages: formattedMessages })
  } catch (error) {
    console.error("获取消息失败:", error)
    return NextResponse.json({ error: "获取消息失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, role, characterId, userId = "default", image } = body

    // 验证必需字段
    if (!content || !role || !characterId) {
      return NextResponse.json({ error: "缺少必需字段" }, { status: 400 })
    }

    const message = await localDB.createMessage({
      content,
      role,
      characterId,
      userId,
      image,
    })

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        content: message.content,
        role: message.role,
        timestamp: message.createdAt,
        image: message.image,
      },
    })
  } catch (error) {
    console.error("保存消息失败:", error)
    return NextResponse.json({ error: "保存消息失败" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId") || "default"
    const characterId = searchParams.get("characterId")

    if (!characterId) {
      return NextResponse.json({ error: "缺少角色ID" }, { status: 400 })
    }

    const removed = await localDB.clearMessages(userId, characterId)
    return NextResponse.json({ success: true, removed })
  } catch (error) {
    console.error("清空消息失败:", error)
    return NextResponse.json({ error: "清空消息失败" }, { status: 500 })
  }
}
