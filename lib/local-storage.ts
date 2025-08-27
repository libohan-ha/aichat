import { promises as fsp } from "fs"
import { existsSync } from "fs"
import { join, dirname } from "path"

export interface Character {
  id: string
  name: string
  avatar: string
  prompt: string
  userId: string
  background?: string
  backgroundSize?: string
  backgroundPosition?: string
  backgroundRepeat?: string
  userAvatar?: string
  bubbleUserOpacity?: number
  bubbleAiOpacity?: number
  model?: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  characterId: string
  userId: string
  image?: string
  createdAt: string
  updatedAt: string
}

export interface UserSettings {
  id: string
  userId: string
  chatBackground: string
  currentCharacterId?: string
  createdAt: string
  updatedAt: string
}

interface Database {
  characters: Character[]
  messages: Message[]
  settings: Record<string, UserSettings>
}

const DATA_DIR = join(process.cwd(), ".data")
const DB_PATH = join(DATA_DIR, "db.json")

async function ensureDB(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await fsp.mkdir(DATA_DIR, { recursive: true })
  }
  if (!existsSync(DB_PATH)) {
    const initial: Database = { characters: [], messages: [], settings: {} }
    await fsp.writeFile(DB_PATH, JSON.stringify(initial, null, 2), "utf-8")
  }
}

async function readDB(): Promise<Database> {
  await ensureDB()
  const raw = await fsp.readFile(DB_PATH, "utf-8")
  try {
    const parsed = JSON.parse(raw)
    return {
      characters: Array.isArray(parsed.characters) ? parsed.characters : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      settings: parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {},
    }
  } catch {
    return { characters: [], messages: [], settings: {} }
  }
}

async function writeDB(db: Database): Promise<void> {
  const dir = dirname(DB_PATH)
  if (!existsSync(dir)) await fsp.mkdir(dir, { recursive: true })
  await fsp.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8")
}

class JsonFileDB {
  // Characters
  async getCharacters(userId = "default"): Promise<Character[]> {
    const db = await readDB()
    return db.characters.filter((c) => c.userId === userId)
  }

  async createCharacter(character: Omit<Character, "id" | "createdAt" | "updatedAt">): Promise<Character> {
    const db = await readDB()
    const newCharacter: Character = {
      ...character,
      name: character.name || "未命名角色",
      avatar: character.avatar || "/placeholder.svg",
      prompt: character.prompt || "默认提示词",
      background: character.background || "",
      backgroundSize: character.backgroundSize || "cover",
      backgroundPosition: character.backgroundPosition || "center",
      backgroundRepeat: character.backgroundRepeat || "no-repeat",
      userAvatar: (character as any).userAvatar || "/placeholder-user.jpg",
      bubbleUserOpacity: (character as any).bubbleUserOpacity ?? 1,
      bubbleAiOpacity: (character as any).bubbleAiOpacity ?? 1,
      model: (character as any).model || process.env.DEEPSEEK_MODEL || "deepseek-chat",
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    db.characters.unshift(newCharacter)
    await writeDB(db)
    return newCharacter
  }

  async updateCharacter(id: string, updates: Partial<Character>, userId = "default"): Promise<Character | null> {
    const db = await readDB()
    const idx = db.characters.findIndex((c) => c.id === id && c.userId === userId)
    if (idx === -1) return null
    db.characters[idx] = { ...db.characters[idx], ...updates, updatedAt: new Date().toISOString() }
    await writeDB(db)
    return db.characters[idx]
  }

  async deleteCharacter(id: string, userId = "default"): Promise<boolean> {
    const db = await readDB()
    const before = db.characters.length
    db.characters = db.characters.filter((c) => !(c.id === id && c.userId === userId))
    const changed = db.characters.length !== before
    if (changed) await writeDB(db)
    return changed
  }

  // Messages
  async getMessages(userId = "default", characterId: string, limit = 50): Promise<Message[]> {
    const db = await readDB()
    return db.messages
      .filter((m) => m.userId === userId && m.characterId === characterId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-limit)
  }

  async createMessage(message: Omit<Message, "id" | "createdAt" | "updatedAt">): Promise<Message> {
    const db = await readDB()
    const newMessage: Message = {
      ...message,
      content: message.content || "",
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    db.messages.push(newMessage)
    await writeDB(db)
    return newMessage
  }

  async clearMessages(userId = "default", characterId: string): Promise<number> {
    const db = await readDB()
    const before = db.messages.length
    db.messages = db.messages.filter((m) => !(m.userId === userId && m.characterId === characterId))
    const removed = before - db.messages.length
    if (removed > 0) await writeDB(db)
    return removed
  }

  // User Settings
  async getUserSettings(userId = "default"): Promise<UserSettings> {
    const db = await readDB()
    const existing = db.settings[userId]
    if (existing) return existing
    const defaults: UserSettings = {
      id: userId,
      userId,
      chatBackground: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    db.settings[userId] = defaults
    await writeDB(db)
    return defaults
  }

  async updateUserSettings(userId = "default", updates: Partial<UserSettings>): Promise<UserSettings> {
    const db = await readDB()
    const current = db.settings[userId] || {
      id: userId,
      userId,
      chatBackground: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const updated: UserSettings = { ...current, ...updates, updatedAt: new Date().toISOString() }
    db.settings[userId] = updated
    await writeDB(db)
    return updated
  }

  // Initialize with default characters if none exist
  async initializeDefaultData(userId = "default"): Promise<void> {
    const chars = await this.getCharacters(userId)
    if (chars.length === 0) {
      await this.createCharacter({
        name: "AI助手",
        avatar: "/ai-assistant-avatar.png",
        prompt:
          "你是一个友善、有帮助的AI助手。请用简洁明了的方式回答用户的问题，并尽量提供有用的建议。",
        userId,
      })
      await this.createCharacter({
        name: "编程专家",
        avatar: "/programmer-avatar.png",
        prompt:
          "你是一个经验丰富的编程专家，擅长多种编程语言和技术栈。请帮助用户解决编程问题，提供清晰的代码示例和最佳实践建议。",
        userId,
      })
    }
  }
}

export const localDB = new JsonFileDB()
