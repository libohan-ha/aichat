import { localDB } from "@/lib/local-storage"
import { type NextRequest, NextResponse } from "next/server"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title } = body

    const conversation = await localDB.updateConversation(id, { title })

    if (!conversation) {
      return NextResponse.json({ error: "对话不存在" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      conversation,
    })
  } catch (error) {
    console.error("更新对话失败:", error)
    return NextResponse.json({ error: "更新对话失败" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const deleted = await localDB.deleteConversation(id)

    if (!deleted) {
      return NextResponse.json({ error: "对话不存在" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("删除对话失败:", error)
    return NextResponse.json({ error: "删除对话失败" }, { status: 500 })
  }
}