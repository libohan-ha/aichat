import { type NextRequest, NextResponse } from "next/server"
import { localDB } from "@/lib/local-storage"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const url = new URL(request.url)
    const pathId = url.pathname.split("/").pop() || ""
    const id = (params as any)?.id ?? pathId
    if (!id) {
      return NextResponse.json({ error: "缺少角色ID" }, { status: 400 })
    }
    const { name, avatar, prompt, background, backgroundSize, backgroundPosition, backgroundRepeat, userAvatar, bubbleUserOpacity, bubbleAiOpacity, model, userId = "default" } = body

    // 允许部分更新：至少提供一个可更新字段
    const updates: any = {}
    if (name !== undefined) updates.name = name
    if (avatar !== undefined) updates.avatar = avatar
    if (prompt !== undefined) updates.prompt = prompt
    if (background !== undefined) updates.background = background
    if (backgroundSize !== undefined) updates.backgroundSize = backgroundSize
    if (backgroundPosition !== undefined) updates.backgroundPosition = backgroundPosition
    if (backgroundRepeat !== undefined) updates.backgroundRepeat = backgroundRepeat
    if (userAvatar !== undefined) updates.userAvatar = userAvatar
    if (bubbleUserOpacity !== undefined) updates.bubbleUserOpacity = bubbleUserOpacity
    if (bubbleAiOpacity !== undefined) updates.bubbleAiOpacity = bubbleAiOpacity
    if (model !== undefined) updates.model = model

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 })
    }

    const character = await localDB.updateCharacter(id, updates, userId)

    if (!character) {
      return NextResponse.json({ error: "角色不存在" }, { status: 404 })
    }

    return NextResponse.json({ success: true, character })
  } catch (error) {
    console.error("更新角色失败:", error)
    return NextResponse.json({ error: "更新角色失败" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams, pathname } = new URL(request.url)
    const userId = searchParams.get("userId") || "default"
    const pathId = pathname.split("/").pop() || ""
    const id = (params as any)?.id ?? pathId
    if (!id) {
      return NextResponse.json({ error: "缺少角色ID" }, { status: 400 })
    }

    const success = await localDB.deleteCharacter(id, userId)

    if (!success) {
      return NextResponse.json({ error: "角色不存在" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("删除角色失败:", error)
    return NextResponse.json({ error: "删除角色失败" }, { status: 500 })
  }
}
