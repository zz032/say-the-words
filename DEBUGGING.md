# 诊断与修复：Speaker 消息发送失败

## 症状
- Speaker 点击 Send 后消息没有显示
- 消息没有消耗每日次数
- Listener 看不到新的 Speaker 消息

## 根本原因排查清单

### 1️⃣ Supabase Realtime 未启用（MOST COMMON）
**症状匹配度:** ⭐⭐⭐⭐⭐

**检查步骤：**
1. 打开 [Supabase Dashboard](https://app.supabase.com/)
2. 进入你的项目 → **Database** (左侧菜单)
3. 点击 **Replication** 标签页
4. 找到 **supabase_realtime** publication
5. 确保以下表已 **enabled**（绿色勾选）：
   - ✅ `messages`
   - ✅ `participants`
   - ✅ `room_config`
6. 如果有红色 ❌，点击表名旁的切换按钮启用

**修复后验证：**
- 刷新应用，新消息应立即显示
- 打开浏览器开发工具 (F12) → Console，查找日志：
  - ✅ 正常: `Speaker message sent: [...]`
  - ❌ 错误: `Failed to send speaker message: [error]`

---

### 2️⃣ RLS (Row Level Security) 策略阻止插入
**症状匹配度:** ⭐⭐⭐

**检查步骤：**
1. Supabase Dashboard → **SQL Editor**
2. 执行以下查询确认当前策略：
```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'messages';
```

3. 确保输出包含一行 `Allow all on messages` policy，且 cmd 包括 `INSERT`

**修复命令：**
```sql
DROP POLICY IF EXISTS "Allow all on messages" ON messages;
CREATE POLICY "Allow all on messages" ON messages FOR ALL USING (true) WITH CHECK (true);
```

然后重新测试 Speaker 发送。

---

### 3️⃣ 消息表的约束限制
**症状匹配度:** ⭐⭐

**检查步骤：**
运行以下 SQL 验证表结构：
```sql
\d messages
```

确认输出包括：
- `content` (TEXT NOT NULL)
- `sender_role` (TEXT CHECK)
- `sender_user_id` (TEXT NOT NULL)
- `reply_to` (UUID, nullable)
- `created_at` (TIMESTAMPTZ)

**常见问题检查：**
- sender_user_id 是否为 NULL？Speaker 在 `sendMessage` 中应确保 userId 已设置
- content 是否为空？检查 `input.trim()` 是否正确

---

### 4️⃣ 客户端状态问题
**症状匹配度:** ⭐

**检查步骤：**
1. 打开浏览器 F12 → Console
2. Speaker View 发送消息时查看输出：
   - ✅ 看到 `Speaker message sent: [...]` → 插入成功，realtime 可能未启用
   - ❌ 看到 `Failed to send speaker message: ...` → 数据库插入失败，查看错误内容

3. 如果看到错误，复制完整错误信息并在 Supabase Dashboard → **Logs** 中查询

---

### 5️⃣ 网络与应用部署问题
**症状匹配度:** ⭐

**检查步骤（如果在 Vercel 上部署）：**
1. 打开应用 → F12 → Network 标签页
2. 点击 Speaker 的 Send 按钮
3. 查找 `POST` 请求到 Supabase API (通常是 `api.supabase.co`)
4. 检查响应状态：
   - 200-201: ✅ 插入成功，检查 realtime
   - 4xx: ❌ 请求参数或权限错误
   - 5xx: ❌ 服务器错误

---

## 快速修复步骤

### 如果怀疑是 Realtime 问题：
```bash
# 1. 本地重新构建并测试
npm run build
npm start

# 2. 在开发服务器上打开多个浏览器标签页（或不同浏览器）
# 3. 一个标签以 Speaker 身份，另一个以 Listener 身份
# 4. Speaker 发送消息，检查 Listener 是否实时看到

# 5. 查看控制台日志
# - 应该看到 "Speaker message sent: [...]"
# - 如无日志，speaker 可能未正确配置
```

### 如果想强制重新加载（跳过 realtime）：
```typescript
// 在 useMessages.ts 的 sendMessage 后添加
if (error) {
  console.error(...);
} else {
  // 强制重新加载消息（不依赖 realtime）
  await new Promise(r => setTimeout(r, 500));
  fetchMessages();
}
```

---

## 最可能的原因（按概率排序）

| 排名 | 原因 | 概率 | 修复时间 |
|------|------|------|---------|
| 🥇 | Realtime publication 未启用 | 70% | 1 分钟 |
| 🥈 | RLS 策略过严格 | 15% | 2 分钟 |
| 🥉 | Network/CORS 跨域限制 | 10% | 5-10 分钟 |
| 4️⃣ | 应用配置（env vars）错误 | 5% | 10-30 分钟 |

---

## 测试验证清单

完成以下每一项以确认修复：

- [ ] Supabase Dashboard 确认 realtime 表已启用
- [ ] 浏览器 Console 看到 "Speaker message sent: [...]"
- [ ] Speaker 与 Listener 在同一房间（人数显示正确）
- [ ] Speaker 发送消息后，Listener 立即看到（无需刷新）
- [ ] Speaker 的"Remaining"次数减少
- [ ] Listener 在 Speaker 消息下看到 "Replies: 1"（如果已回复）
- [ ] Admin (?admin=godmode) 可以看到全部消息与 Kick All 按钮

---

## 获取更多日志

如果以上都检查过仍未解决，收集以下信息：

1. **浏览器 Console 完整错误日志**（F12 → Console）
2. **Supabase Logs**（Dashboard → Logs at bottom）
3. **Network 请求详情**（F12 → Network，filter "messages"）
4. **应用环境变量**（确认 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY 已设置）

---

