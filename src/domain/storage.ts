import type { Direction, Goal, HabitEvent, LocalData, Result } from './types'

const STORE_KEY = 'more-choices-uniapp-v1'
const SQLITE_NAME = 'more-choices'
const SQLITE_PATH = '_doc/more-choices.db'

const now = () => Date.now()
const id = (prefix: string) => `${prefix}-${now()}-${Math.random().toString(36).slice(2, 8)}`

const demoData: LocalData = {
  schemaVersion: 1,
  goals: [
    {
      id: 'reading', title: '每天读一页书', direction: 'increase', replacementAction: '', replacementSeconds: 30,
      futureNote: '', status: 'active', sortOrder: 1, pinned: true, tone: '0', createdAt: now(), updatedAt: now()
    },
    {
      id: 'phone', title: '睡前少刷手机', direction: 'decrease', replacementAction: '把手机放远一点，做三次慢呼吸', replacementSeconds: 60,
      futureNote: '我想保护的是明天醒来时更轻松的自己。', status: 'active', sortOrder: 2, pinned: false, tone: '1', createdAt: now(), updatedAt: now()
    }
  ],
  events: []
}

let sqliteReady = false
let sqliteQueue = Promise.resolve()
let sqliteInitPromise: Promise<void> | null = null

function isAppPlus() {
  return typeof plus !== 'undefined' && Boolean(plus.sqlite)
}

function sqlText(value: string | undefined) {
  return `'${String(value || '').replaceAll("'", "''")}'`
}

function sqlNumber(value: number) {
  return Number.isFinite(value) ? String(Math.round(value)) : '0'
}

function executeSql(sql: string[]) {
  return new Promise<void>((resolve, reject) => {
    plus.sqlite.executeSql({ name: SQLITE_NAME, sql, success: resolve, fail: reject })
  })
}

function selectSql(sql: string) {
  return new Promise<Record<string, unknown>[]>((resolve, reject) => {
    plus.sqlite.selectSql({ name: SQLITE_NAME, sql, success: resolve, fail: reject })
  })
}

async function persistSqlite(data: LocalData) {
  if (!sqliteReady) return
  const statements = [
    'DELETE FROM goals',
    'DELETE FROM habit_events',
    ...data.goals.map(goal => `INSERT INTO goals (id,title,direction,replacement_action,replacement_seconds,future_note,status,sort_order,pinned,tone,created_at,updated_at) VALUES (${sqlText(goal.id)},${sqlText(goal.title)},${sqlText(goal.direction)},${sqlText(goal.replacementAction)},${sqlNumber(goal.replacementSeconds)},${sqlText(goal.futureNote)},${sqlText(goal.status)},${sqlNumber(goal.sortOrder)},${goal.pinned ? 1 : 0},${sqlText(goal.tone || '0')},${sqlNumber(goal.createdAt)},${sqlNumber(goal.updatedAt)})`),
    ...data.events.map(event => `INSERT INTO habit_events (id,goal_id,goal_title,result,occurred_at,note,helped_by) VALUES (${sqlText(event.id)},${sqlText(event.goalId)},${sqlText(event.goalTitle)},${sqlText(event.result)},${sqlNumber(event.occurredAt)},${sqlText(event.note)},${sqlText(event.helpedBy)})`)
  ]
  sqliteQueue = sqliteQueue.then(() => executeSql(statements)).catch(() => undefined)
  await sqliteQueue
}

async function loadSqlite(): Promise<LocalData | null> {
  const [goals, events] = await Promise.all([
    selectSql('SELECT * FROM goals ORDER BY sort_order ASC'),
    selectSql('SELECT * FROM habit_events ORDER BY occurred_at ASC')
  ])
  if (!goals.length && !events.length) return null
  return {
    schemaVersion: 1,
    goals: goals.map(row => ({
      id: String(row.id), title: String(row.title), direction: String(row.direction) as Goal['direction'],
      replacementAction: String(row.replacement_action || ''), replacementSeconds: Number(row.replacement_seconds || 60),
      futureNote: String(row.future_note || ''), status: String(row.status) as Goal['status'], sortOrder: Number(row.sort_order || 0),
      pinned: Number(row.pinned || 0) === 1, tone: String(row.tone || '0'), createdAt: Number(row.created_at || 0), updatedAt: Number(row.updated_at || 0)
    })),
    events: events.map(row => ({
      id: String(row.id), goalId: String(row.goal_id), goalTitle: String(row.goal_title), result: String(row.result) as HabitEvent['result'],
      occurredAt: Number(row.occurred_at || 0), ...(row.note ? { note: String(row.note) } : {}), ...(row.helped_by ? { helpedBy: String(row.helped_by) } : {})
    }))
  }
}

export function initStorage() {
  if (!isAppPlus() || sqliteReady) return Promise.resolve()
  if (sqliteInitPromise) return sqliteInitPromise
  sqliteInitPromise = (async () => {
   try {
    if (!plus.sqlite.isOpenDatabase({ name: SQLITE_NAME, path: SQLITE_PATH })) {
      await new Promise<void>((resolve, reject) => {
        plus.sqlite.openDatabase({ name: SQLITE_NAME, path: SQLITE_PATH, success: resolve, fail: reject })
      })
    }
    await executeSql([
      'CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, title TEXT NOT NULL, direction TEXT NOT NULL, replacement_action TEXT, replacement_seconds INTEGER, future_note TEXT, status TEXT, sort_order INTEGER, pinned INTEGER, tone TEXT, created_at INTEGER, updated_at INTEGER)',
      'CREATE TABLE IF NOT EXISTS habit_events (id TEXT PRIMARY KEY, goal_id TEXT NOT NULL, goal_title TEXT NOT NULL, result TEXT NOT NULL, occurred_at INTEGER NOT NULL, note TEXT, helped_by TEXT)',
      'CREATE INDEX IF NOT EXISTS idx_events_goal_time ON habit_events (goal_id, occurred_at)',
      'CREATE INDEX IF NOT EXISTS idx_events_time ON habit_events (occurred_at)'
    ])
    await executeSql(['ALTER TABLE goals ADD COLUMN tone TEXT']).catch(() => undefined)
    sqliteReady = true
    const sqliteData = await loadSqlite()
    if (sqliteData) {
      uni.setStorageSync(STORE_KEY, sqliteData)
    } else {
      await persistSqlite(readData())
    }
   } catch {
     // Keep the local storage fallback if SQLite is unavailable on this build.
     sqliteReady = false
   }
  })()
  return sqliteInitPromise
}

export function readData(): LocalData {
  const value = uni.getStorageSync(STORE_KEY)
  if (!value || value.schemaVersion !== 1) {
    const fresh = JSON.parse(JSON.stringify(demoData)) as LocalData
    uni.setStorageSync(STORE_KEY, fresh)
    return fresh
  }
  return value as LocalData
}

export function saveData(data: LocalData) {
  uni.setStorageSync(STORE_KEY, data)
  void persistSqlite(data)
}

export function createGoal(title: string, direction: Direction, tone = '0'): Goal {
  const data = readData()
  const goal: Goal = {
    id: id('goal'), title: title.trim(), direction, replacementAction: direction === 'decrease' ? '绂诲紑褰撳墠鐜锛屽仛涓€涓洿灏忕殑鍔ㄤ綔' : '',
    replacementSeconds: 60, futureNote: '', status: 'active', sortOrder: data.goals.length + 1, pinned: false, tone, createdAt: now(), updatedAt: now()
  }
  data.goals.push(goal)
  saveData(data)
  return goal
}

export function recordEvent(goalId: string, result: Result, note = '', helpedBy = ''): HabitEvent | null {
  const data = readData()
  const goal = data.goals.find(item => item.id === goalId)
  if (!goal) return null
  const event: HabitEvent = { id: id('event'), goalId, goalTitle: goal.title, result, occurredAt: now(), ...(note.trim() ? { note: note.trim() } : {}), ...(helpedBy.trim() ? { helpedBy: helpedBy.trim().slice(0, 80) } : {}) }
  data.events.push(event)
  saveData(data)
  return event
}

export function replaceGoal(goal: Goal) {
  const data = readData()
  const index = data.goals.findIndex(item => item.id === goal.id)
  if (index >= 0) data.goals.splice(index, 1, { ...goal, updatedAt: now() })
  saveData(data)
}

export function updateGoal(goalId: string, title: string, direction: Direction, tone?: string) {
  const data = readData()
  const goal = data.goals.find(item => item.id === goalId)
  if (!goal || !title.trim()) return false
  goal.title = title.trim()
  goal.direction = direction
  goal.tone = tone || goal.tone || '0'
  if (direction === 'increase') {
    goal.replacementAction = ''
    goal.futureNote = ''
  } else if (!goal.replacementAction) {
    goal.replacementAction = '绂诲紑褰撳墠鐜锛屽仛涓€涓洿灏忕殑鍔ㄤ綔'
  }
  // A renamed goal should keep its timeline readable and consistently linked.
  data.events = data.events.map(event => event.goalId === goalId ? { ...event, goalTitle: goal.title } : event)
  goal.updatedAt = now()
  saveData(data)
  return true
}

export function deleteGoal(goalId: string) {
  const data = readData()
  const exists = data.goals.some(goal => goal.id === goalId)
  if (!exists) return false
  data.goals = data.goals.filter(goal => goal.id !== goalId)
  data.events = data.events.filter(event => event.goalId !== goalId)
  saveData(data)
  return true
}

export function setGoalPaused(goalId: string, paused: boolean) {
  const data = readData()
  const goal = data.goals.find(item => item.id === goalId)
  if (!goal) return false
  goal.status = paused ? 'paused' : 'active'
  goal.pinned = paused ? false : goal.pinned
  goal.updatedAt = now()
  saveData(data)
  return true
}

export function setGoalPinned(goalId: string, pinned: boolean) {
  const data = readData()
  const goal = data.goals.find(item => item.id === goalId)
  if (!goal || goal.status !== 'active') return false
  goal.pinned = pinned
  goal.updatedAt = now()
  data.goals.sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.sortOrder - b.sortOrder)
    .forEach((item, index) => { item.sortOrder = index + 1 })
  saveData(data)
  return true
}

export function moveGoal(goalId: string, direction: -1 | 1) {
  const data = readData()
  const active = data.goals.filter(item => item.status === 'active' && !item.pinned).sort((a, b) => a.sortOrder - b.sortOrder)
  const from = active.findIndex(item => item.id === goalId)
  const to = from + direction
  if (from < 0 || !active[to]) return false
  ;[active[from], active[to]] = [active[to], active[from]]
  const pinned = data.goals.filter(item => item.status === 'active' && item.pinned)
  const paused = data.goals.filter(item => item.status !== 'active')
  ;[...pinned, ...active, ...paused].forEach((item, index) => { item.sortOrder = index + 1 })
  saveData(data)
  return true
}

export function deleteAll() {
  const fresh: LocalData = { schemaVersion: 1, goals: [], events: [] }
  saveData(fresh)
}

export function exportData() {
  return JSON.stringify(readData(), null, 2)
}

export function resultLabel(result: Result) {
  return ({ done: '完成了一小步', paused: '缓过来了', alternative: '做了替代动作', original: '还是做了', reflection: '记下了一次想法' } as Record<Result, string>)[result]
}

export function directionLabel(direction: Direction) {
  return direction === 'increase' ? '多做一点' : '少做一点'
}




