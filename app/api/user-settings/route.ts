import { type NextRequest, NextResponse } from "next/server"
import { localDB } from "@/lib/local-storage"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId") || "default"

    const settings = await localDB.getUserSettings(userId)

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error("获取用户设置失败:", error)
    return NextResponse.json({ error: "获取用户设置失败" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId = "default", chatBackground, currentCharacterId } = body

    const updates: any = {}
    if (chatBackground !== undefined) updates.chatBackground = chatBackground
    if (currentCharacterId !== undefined) updates.currentCharacterId = currentCharacterId

    const settings = await localDB.updateUserSettings(userId, updates)

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error("更新用户设置失败:", error)
    return NextResponse.json({ error: "更新用户设置失败" }, { status: 500 })
  }
}
