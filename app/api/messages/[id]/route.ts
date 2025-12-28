import { localDB } from "@/lib/local-storage"
import { type NextRequest, NextResponse } from "next/server"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: "缺少消息ID" }, { status: 400 })
    }

    const deleted = await localDB.deleteMessage(id)

    if (!deleted) {
      return NextResponse.json({ error: "消息不存在" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("删除消息失败:", error)
    return NextResponse.json({ error: "删除消息失败" }, { status: 500 })
  }
}
