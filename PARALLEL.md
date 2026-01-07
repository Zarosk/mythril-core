# Parallel Claude Code Coordination

## Purpose
This file coordinates multiple Claude Code instances working simultaneously.
READ THIS BEFORE STARTING ANY WORK.

## Current Session
Status: INACTIVE
Instances: 0

---

## File Ownership Rules

### Brain (oads-brain)

| File/Directory | Owner | Notes |
|----------------|-------|-------|
| src/routes/*.ts | EXCLUSIVE | Each route file = one owner |
| src/services/*.ts | EXCLUSIVE | Each service = one owner |
| src/db/migrations/*.sql | EXCLUSIVE | Each migration = one owner |
| src/app.ts | SHARED | Append only - add route imports + registrations |
| src/security/audit.ts | SHARED | Append only - add action types to union |
| src/utils/logger.ts | LOCKED | Do not modify during parallel work |
| src/config.ts | LOCKED | Do not modify during parallel work |

---

## Parallel Session Template

When starting parallel work, copy this to top of file:

```
## Active Session
Started: YYYY-MM-DD HH:MM
Coordinator: CC-5 (or human)

| Instance | Branch | Task | Owned Files | Status |
|----------|--------|------|-------------|--------|
| CC-1 | feat/xxx | Description | file1.ts, file2.ts | WORKING |
| CC-2 | feat/yyy | Description | file3.ts, file4.ts | WORKING |
| CC-3 | feat/zzz | Description | file5.ts, file6.ts | WORKING |
| CC-4 | feat/aaa | Description | file7.ts, file8.ts | WORKING |
| CC-5 | master | QC/Coordinator | PARALLEL.md | WATCHING |
```

---

## Instance Prompt Template

Each parallel instance should receive this header in their prompt:

```
## PARALLEL WORK PROTOCOL

**BEFORE ANY WORK:**
1. Read C:\Users\Alexander\code\oads-brain\PARALLEL.md
2. Run: git checkout [your-branch]
3. Run: git status (confirm clean state)
4. Confirm your owned files list

**YOUR ASSIGNMENT:**
- Instance: CC-[X]
- Branch: feat/[name]
- Owned files (modify freely): [list]
- Shared files (append only): [list]
- Locked files (do not touch): logger.ts, config.ts

**RULES:**
1. ONLY modify files in your "Owned" list
2. For "Shared" files: APPEND to end only, never restructure
3. If you need a "Locked" file: STOP and report to coordinator
4. If build fails: STOP and report
5. Commit to YOUR branch only

**WHEN DONE:**
1. Run: npm run build
2. If build passes: git add . && git commit -m "feat: [description]"
3. Report completion to coordinator
```

---

## Merge Order (QC/Coordinator Reference)

Always merge in this order to minimize conflicts:

1. Isolated branches first (no shared file changes)
2. Branches touching app.ts (most shared)
3. Branches touching audit.ts (shared type union)

---

## Conflict Resolution Patterns

### Import conflicts (app.ts)
```typescript
// KEEP ALL IMPORTS FROM BOTH BRANCHES
import { feedbackRoutes } from './routes/feedback.js';   // from branch 1
import { userDataRoutes } from './routes/user-data.js';  // from branch 2
```

### Route registration conflicts (app.ts)
```typescript
// KEEP ALL ROUTES, ensure unique paths
await app.register(feedbackRoutes);   // from branch 1
await app.register(userDataRoutes);   // from branch 2
```

### Audit action type conflicts (audit.ts)
```typescript
// COMBINE all action types
export type AuditAction =
  | 'existing.action'
  | 'user.unsubscribe' | 'user.resubscribe' | 'user.delete_data'  // branch 1
  | 'feedback.create' | 'feedback.list';                           // branch 2
```

### Migration conflicts
```sql
-- Each migration gets a unique number
-- 002_feedback.sql (branch 1)
-- 003_user_tracking.sql (branch 2)
-- Renumber if needed during merge
```

---

## Post-Merge Checklist

- [ ] All branches merged to master
- [ ] `npm run build` passes
- [ ] `npm run lint` passes (or only pre-existing errors)
- [ ] No duplicate imports in app.ts
- [ ] No duplicate route registrations
- [ ] All audit action types unique
- [ ] Migrations numbered sequentially
- [ ] Session status set to INACTIVE
