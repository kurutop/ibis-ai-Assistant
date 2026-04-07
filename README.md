# 🤖 Ibis Magus AI

> Agentic CLI Assistant - Production Grade

AI assistant ที่พร้อมใช้งานทันที มาพร้อมกับระบบ Tool, Permission, Hook, Command ที่แข็งแกร่ง

---

## 🚀 Quick Start

```bash
# ติดตั้ง dependencies
npm install

# รันโปรแกรม
npm start

# Development mode (auto-reload)
npm run dev

# รัน test suite
npm test
```

---

## 📁 Project Structure

```
ibis/
├── src/
│   ├── tools.ts           # Tool Registry (10 tools + Zod validation)
│   ├── state.ts           # State Store (pub/sub pattern)
│   ├── contextManager.ts  # Context Manager (system prompt, history, tokens)
│   ├── permissions.ts     # Permission Framework (rule-based)
│   ├── hooks.ts           # Hook System (event-driven)
│   ├── commands.ts        # Command System (10 slash commands)
│   ├── engine.ts          # Main Engine (tool calling loop)
│   └── cli.ts             # CLI Interface
├── workspace/             # Working directory for file operations
├── package.json
├── test.ts                # Test suite
└── README.md
```

---

## 🛠️ Available Tools (10)

| Category | Tool | Description |
|----------|------|-------------|
| **File** | `read_file` | อ่านไฟล์ (รองรับ line range) |
| **File** | `write_file` | เขียนไฟล์ (สร้าง folder อัตโนมัติ) |
| **File** | `edit_file` | แก้ไขไฟล์แบบ targeted edit |
| **File** | `list_files` | ดูรายการไฟล์และโฟลเดอร์ |
| **Shell** | `bash` | รัน shell command |
| **Search** | `grep` | ค้นหาข้อความในไฟล์ |
| **Memory** | `save_memory` | บันทึกข้อมูลความจำ |
| **Memory** | `recall_memory` | เรียกข้อมูลความจำ |
| **Memory** | `list_memories` | ดูความจำทั้งหมด |
| **Memory** | `delete_memory` | ลบข้อมูลความจำ |

---

## 💬 Slash Commands (10)

### Session
- `/clear` - ล้าง conversation
- `/status` - ดู session stats

### Configuration
- `/model <name>` - เปลี่ยน model
- `/max_turns <n>` - ตั้งค่า max tool turns
- `/verbose` - เปิด/ปิด verbose mode
- `/permission <ask|allow|deny>` - ตั้ง permission mode
- `/instructions <text>` - ตั้ง custom instructions

### Information
- `/tools [category]` - ดู tools ทั้งหมด
- `/tool_info <name>` - ดูรายละเอียด tool
- `/help [command]` - ดูวิธีใช้

---

## 🏗️ Architecture

### Tool Registry
- Zod schema validation สำหรับทุก tool
- Metadata: category, permission level, read-only/destructive flags
- Path safety validation (ป้องกัน path traversal)

### State Store
- Immutable pub/sub pattern
- Session tracking: messages, tool calls, tokens, cost
- Configuration management

### Context Manager
- System prompt assembly อัตโนมัติ
- Conversation history management
- Token estimation และ auto-compaction

### Permission Framework
- Rule-based permission system
- 3 presets: permissive, cautious, restrictive
- ประเมินตาม tool name, category, read-only/destructive

### Hook System
- Event-driven hooks: PreToolUse, PostToolUse, PreToolExecution, etc.
- Logging, validation, safety checks
- Extensible - เพิ่ม hook ได้เอง

### Engine
- Proper tool calling loop
- JSON-based tool parsing
- Validation → Permission → Execution pipeline
- Hook integration ทุกขั้นตอน

---

## 🔧 Configuration

### เปลี่ยน Model
```
/model llama3.1:8b
/model mistral
```

### เปลี่ยน Permission Mode
```
/permission allow    # อนุญาตทุกอย่าง
/permission ask      # ถามก่อน (default)
/permission deny     # ปฏิเสธทั้งหมด
```

### ตั้ง Custom Instructions
```
/instructions คุณเป็นผู้ช่วยเขียนโค้ด เชี่ยวชาญ TypeScript
```

---

## 📊 Example Usage

```
❖ Ibis ❯ ช่วยอ่านไฟล์ package.json ให้หน่อย

Ibis: ได้ค่ะ กำลังอ่านไฟล์ให้...
[ใช้ tool: read_file]
[ผลลัพธ์: อ่านสำเร็จ]

เนื้อหาไฟล์ package.json คือ:
{
  "name": "ibis-magus-ai-v2",
  ...
}
```

```
❖ Ibis ❯ /status

📊 Session Status:
  • Messages: 5
  • Tool calls: 3
  • Model: llama3.2:3b
  • Max turns: 10
  • Uptime: 2m 15s
  • Workspace: /home/user/ibis
```

---

## 🎯 Key Features

✅ **10 Tools** - ไฟล์, shell, search, memory  
✅ **Zod Validation** - ตรวจสอบ input ทุกครั้ง  
✅ **Permission System** - ควบคุมการเข้าถึง  
✅ **Hook Pipeline** - Extensible event system  
✅ **State Management** - Session tracking  
✅ **Context Manager** - Token estimation + auto-compaction  
✅ **Slash Commands** - 10 commands พร้อมใช้  
✅ **Path Safety** - ป้องกัน path traversal  
✅ **Error Handling** - Graceful error recovery  
✅ **Thai Language** - สื่อสารเป็นภาษาไทย  

---

## 🔮 Future Enhancements

- [ ] Web search tool
- [ ] MCP integration
- [ ] Streaming responses
- [ ] Multi-agent support
- [ ] Plugin system
- [ ] Remote/bridge mode

---

## 📝 License

MIT

---

**สร้างด้วย ❤️ โดย Ibis Magus AI Team**
