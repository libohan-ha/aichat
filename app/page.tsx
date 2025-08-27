"use client"

import dynamic from "next/dynamic"
const ChatInterface = dynamic(() => import("@/components/chat-interface").then((m) => m.ChatInterface), {
  ssr: false,
})
import { Toaster } from "@/components/ui/toaster"

export default function HomePage() {
  return (
    <main className="h-[100dvh] flex flex-col">
      <ChatInterface />
      <Toaster />
    </main>
  )
}
