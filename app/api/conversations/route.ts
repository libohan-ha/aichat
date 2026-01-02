import { localDB } from "@/lib/local-storage"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId") || "default"
    const characterId = searchParams.get("characterId")

    if (!characterId) {
      return NextResponse.json({ error: "缺少角色ID" }, { status: 400 })
    }

    const conversations = await localDB.getConversations(userId, characterId)

    return NextResponse.json({
      success: true,
      conversations,
    })
  } catch (error) {
    console.error("获取对话列表失败:", error)
    return NextResponse.json({ error: "获取对话列表失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { characterId, userId = "default", title = "新对话" } = body

    if (!characterId) {
      return NextResponse.json({ error: "缺少角色ID" }, { status: 400 })
    }

    const conversation = await localDB.createConversation(userId, characterId, title)

    return NextResponse.json({
      success: true,
      conversation,
    })
  } catch (error) {
    console.error("创建对话失败:", error)
    return NextResponse.json({ error: "创建对话失败" }, { status: 500 })
  }
}