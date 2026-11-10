<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { createGoal, deleteAll, deleteGoal, directionLabel, exportData, initStorage, moveGoal, readData, recordEvent, resultLabel, setGoalPinned, setGoalPaused, updateGoal } from '@/domain/storage'
import type { Direction, HabitEvent, LocalData } from '@/domain/types'

type Tab = 'today' | 'review' | 'practice' | 'settings'
type HistoryRange = 'all' | 'year' | '30d'

const tab = ref<Tab>('today')
const data = ref<LocalData>(readData())
const showGoalModal = ref(false)
const showGoalManager = ref(false)
const editingGoalId = ref('')
const editingGoalTitle = ref('')
const editingGoalDirection = ref<Direction>('decrease')
const showThoughtModal = ref(false)
const newGoalTitle = ref('')
const newGoalDirection = ref<Direction>('decrease')
const newGoalTone = ref('0')
const editingGoalTone = ref('0')
const toneOptions = [{ id: '0', label: '苔绿' }, { id: '1', label: '麦芽' }, { id: '2', label: '鸢尾' }, { id: '3', label: '湖盐' }, { id: '4', label: '淡黄' }, { id: '5', label: '山茶' }]
const composerGoalId = ref('')
const composerText = ref('')
const historyRange = ref<HistoryRange>('all')
const monthOpen = ref<Record<string, boolean>>({})
const heatmapOffset = ref(0)
const reviewGoalId = ref('')
const showCalmModal = ref(false)
const calmGoalId = ref('')
const calmSeconds = ref(120)
const calmReady = ref(false)
const calmChoosing = ref(false)
const calmPromptIndex = ref(0)
const showDoneModal = ref(false)
const doneGoalId = ref('')
const draggingGoalId = ref('')
const dragStartY = ref(0)
const dragMoved = ref(false)
const practiceRunning = ref(false)
const practiceSeconds = ref(120)
const practiceTool = ref<'breath' | 'nback' | 'stroop' | 'switch'>('breath')
const gameFeedback = ref('')
const gameFeedbackType = ref<'correct' | 'wrong' | 'miss' | ''>('')
const nbackN = ref<1 | 2 | 3 | 4 | 5>(2)
const nbackSequence = ref<string[]>([])
const nbackIndex = ref(0)
const nbackCorrect = ref(0)
const nbackAnswered = ref(0)
const nbackFinished = ref(false)
const nbackStartedAt = ref(0)
const nbackResults = ref<{ match: boolean; correct: boolean; rt: number }[]>([])
const nbackVisible = ref(false)
const nbackLocked = ref(false)
const nbackPaused = ref(false)
const stroopWords = ['红', '绿', '蓝', '黄', '紫']
const stroopColors = ['#e36f65', '#69aa7c', '#7b9fd0', '#e3b953', '#a987bd']
const stroopMode = ref<'simple' | 'standard' | 'advanced'>('standard')
const stroopPalette = computed(() => stroopMode.value === 'simple' ? [0, 2, 3] : stroopMode.value === 'advanced' ? [0, 1, 2, 3, 4] : [0, 1, 2, 3])
const stroopWord = ref('红')
const stroopAnswerOrder = ref([0, 1, 2, 3])
const lastStroopColor = ref(-1)
const lastStroopWordIndex = ref(-1)
const stroopConditionPlan = ref<boolean[]>([])
const stroopColorIndex = ref(0)
const stroopCondition = ref<'一致' | '不一致'>('一致')
const stroopStarted = ref(false)
const stroopCorrect = ref(0)
const stroopAnswered = ref(0)
const stroopFinished = ref(false)
const stroopStartedAt = ref(0)
const stroopResults = ref<{ condition: '一致' | '不一致'; correct: boolean; rt: number }[]>([])
const stroopPresented = ref(0)
const stroopLocked = ref(false)
const stroopPaused = ref(false)
const switchMode = ref<'stable' | 'flexible' | 'challenge'>('flexible')
const switchRule = ref<'color' | 'shape'>('color')
const switchPreviousRule = ref<'color' | 'shape' | ''>('')
const switchColor = ref<'red' | 'blue'>('red')
const switchShape = ref<'circle' | 'square'>('circle')
const switchStarted = ref(false)
const switchFinished = ref(false)
const switchAnswered = ref(0)
const switchCorrect = ref(0)
const switchPresented = ref(0)
const switchStartedAt = ref(0)
const switchLocked = ref(false)
const switchPaused = ref(false)
const switchResults = ref<{ switched: boolean; correct: boolean; rt: number }[]>([])
let gameAdvanceTimer: ReturnType<typeof setTimeout> | undefined
let stimulusTimer: ReturnType<typeof setTimeout> | undefined
let responseTimer: ReturnType<typeof setTimeout> | undefined
let practiceTimer: ReturnType<typeof setInterval> | undefined
const practicePhase = computed(() => {
  const elapsed = 120 - practiceSeconds.value
  if (!practiceRunning.value && practiceSeconds.value === 120) return '准备好了吗？'
  if (!practiceRunning.value && practiceSeconds.value === 0) return '做得很好，慢慢回到当下。'
  return elapsed % 8 < 4 ? '吸气' : '呼气'
})
const calmPrompts = [
  '你是真的想做，还是只想逃开此刻的不舒服？',
  '如果现在继续，十分钟后的你会怎么想？',
  '先把手上的动作停十秒。',
  '你不需要赢过念头，只要晚一点行动。'
]
let calmTimer: ReturnType<typeof setInterval> | undefined
let calmPromptTimer: ReturnType<typeof setInterval> | undefined
let calmAudio: ReturnType<typeof uni.createInnerAudioContext> | undefined

const goals = computed(() => data.value.goals.filter(goal => goal.status === 'active').sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.sortOrder - b.sortOrder))
const decreaseGoals = computed(() => goals.value.filter(goal => goal.direction === 'decrease'))
const todayStart = () => {
  const date = new Date()
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}
const todayEvents = computed(() => data.value.events.filter(event => event.occurredAt >= todayStart()).sort((a, b) => b.occurredAt - a.occurredAt))
const lastEvent = (goalId: string) => data.value.events.filter(event => event.goalId === goalId).sort((a, b) => b.occurredAt - a.occurredAt)[0]
const latestText = (goalId: string) => {
  const event = lastEvent(goalId)
  if (!event) return '还没有记录，从今天开始就好'
  const date = new Date(event.occurredAt)
  return `上次${event.result === 'done' ? '完成' : '发生'} · ${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
const intervalText = (goal: LocalData['goals'][number]) => {
  const relevant = data.value.events.filter(event => event.goalId === goal.id && event.result === (goal.direction === 'increase' ? 'done' : 'original')).sort((a, b) => b.occurredAt - a.occurredAt)[0]
  const from = relevant?.occurredAt || goal.createdAt
  const elapsed = Math.max(0, Date.now() - from)
  const days = Math.floor(elapsed / 86400000)
  const hours = Math.floor(elapsed / 3600000) % 24
  const minutes = Math.floor(elapsed / 60000) % 60
  const elapsedLabel = days ? `${days}天${hours ? ` ${hours}小时` : ''}` : hours ? `${hours}小时${minutes ? ` ${minutes}分` : ''}` : `${Math.max(1, minutes)}分钟`
  return relevant ? `距上次${goal.direction === 'increase' ? '完成' : '发生'} · ${elapsedLabel}` : `自计划开始 · ${elapsedLabel}`
}

const reviewGoals = computed(() => data.value.goals.filter(goal => goal.status === 'active'))
const historyEvents = computed(() => {
  const now = Date.now()
  const start = historyRange.value === 'all'
    ? 0
    : historyRange.value === 'year'
      ? new Date(new Date().getFullYear(), 0, 1).getTime()
      : new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 29).getTime()
  return data.value.events.filter(event => event.occurredAt >= start && event.occurredAt <= now && (!reviewGoalId.value || event.goalId === reviewGoalId.value)).sort((a, b) => b.occurredAt - a.occurredAt)
})

const historyGroups = computed(() => {
  const map = new Map<string, { key: string; label: string; records: HabitEvent[]; expanded: boolean }>()
  historyEvents.value.forEach(event => {
    const date = new Date(event.occurredAt)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (!map.has(key)) map.set(key, { key, label: `${date.getFullYear()}年${date.getMonth() + 1}月`, records: [], expanded: false })
    map.get(key)!.records.push(event)
  })
  return [...map.values()].map((group, index) => ({
    ...group,
    expanded: historyRange.value === '30d' || Boolean(monthOpen.value[group.key]) || (index === 0 && Object.keys(monthOpen.value).length === 0)
  }))
})

const heatmap = computed(() => {
  const today = new Date()
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) - heatmapOffset.value * 28)
  const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 21)
  const cells = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const count = data.value.events.filter(event => event.occurredAt >= dayStart && event.occurredAt < dayStart + 86400000 && (!reviewGoalId.value || event.goalId === reviewGoalId.value)).length
    return { key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`, day: date.getDate(), count, today: date.toDateString() === today.toDateString(), future: date.getTime() > today.getTime() }
  })
  return { weeks: Array.from({ length: 4 }, (_, index) => cells.slice(index * 7, index * 7 + 7)), total: cells.reduce((sum, cell) => sum + cell.count, 0), start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 27) }
})
function shiftHeatmap(direction: -1 | 1) { heatmapOffset.value = Math.max(0, heatmapOffset.value - direction) }
function showHeatCell(cell: { day: number; count: number }) { if (cell.count) uni.showToast({ title: `${cell.day}日 ${cell.count} 条记录`, icon: 'none' }) }

const weeklyInsight = computed(() => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime()
  const previousStart = start - 7 * 86400000
  const events = data.value.events.filter(event => event.occurredAt >= start)
  const previousEvents = data.value.events.filter(event => event.occurredAt >= previousStart && event.occurredAt < start)
  const counts = new Map<string, number>()
  const dayCounts = new Map<string, number>()
  events.forEach(event => { const date = new Date(event.occurredAt); const key = `${date.getMonth() + 1}月${date.getDate()}日`; counts.set(event.goalTitle, (counts.get(event.goalTitle) || 0) + 1); dayCounts.set(key, (dayCounts.get(key) || 0) + 1) })
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  const topDay = [...dayCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  const activeDays = new Set(events.map(event => new Date(event.occurredAt).toDateString())).size
  const completed = events.filter(event => event.result === 'done' || event.result === 'alternative').length
  const reflections = events.filter(event => event.result === 'reflection').length
  const trend = events.length - previousEvents.length
  return { total: events.length, activeDays, completed, reflections, trend, trendText: trend === 0 ? '与上周持平' : trend > 0 ? `比上周多 ${trend}` : `比上周少 ${Math.abs(trend)}`, topTitle: top?.[0] || '还没有记录', topCount: top?.[1] || 0, topDay: topDay?.[0] || '暂无', topDayCount: topDay?.[1] || 0 }
})

const totalDoneToday = computed(() => todayEvents.value.filter(event => event.result === 'done' || event.result === 'alternative').length)
const composerGoal = computed(() => data.value.goals.find(goal => goal.id === composerGoalId.value))
const editingGoal = computed(() => data.value.goals.find(goal => goal.id === editingGoalId.value))

function refresh() {
  data.value = readData()
}

function chooseTab(next: Tab) {
  tab.value = next
  if (next === 'review') monthOpen.value = {}
}

function startPractice() {
  if (practiceRunning.value) return
  practiceSeconds.value = 120
  practiceRunning.value = true
  if (practiceTimer) clearInterval(practiceTimer)
  practiceTimer = setInterval(() => {
    practiceSeconds.value -= 1
    if (practiceSeconds.value <= 0) { practiceSeconds.value = 0; practiceRunning.value = false; if (practiceTimer) clearInterval(practiceTimer); practiceTimer = undefined; uni.vibrateShort({ type: 'light', fail: () => undefined }) }
  }, 1000)
}

function resetPractice() { if (practiceTimer) clearInterval(practiceTimer); practiceTimer = undefined; practiceRunning.value = false; practiceSeconds.value = 120 }
function choosePracticeTool(tool: 'breath' | 'nback' | 'stroop' | 'switch') { practiceTool.value = tool; resetPractice(); resetGame() }
function clearTrialTimers() {
  if (gameAdvanceTimer) clearTimeout(gameAdvanceTimer)
  if (stimulusTimer) clearTimeout(stimulusTimer)
  if (responseTimer) clearTimeout(responseTimer)
  gameAdvanceTimer = undefined; stimulusTimer = undefined; responseTimer = undefined
}
function resetGame() {
  clearTrialTimers()
  gameFeedback.value = ''; gameFeedbackType.value = ''
  nbackSequence.value = []; nbackIndex.value = 0; nbackCorrect.value = 0; nbackAnswered.value = 0; nbackFinished.value = false; nbackResults.value = []; nbackVisible.value = false; nbackLocked.value = false; nbackPaused.value = false
  stroopStarted.value = false; stroopCorrect.value = 0; stroopAnswered.value = 0; stroopFinished.value = false; stroopResults.value = []; stroopPresented.value = 0; stroopLocked.value = false; stroopPaused.value = false
  switchStarted.value = false; switchFinished.value = false; switchAnswered.value = 0; switchCorrect.value = 0; switchPresented.value = 0; switchLocked.value = false; switchPaused.value = false; switchPreviousRule.value = ''; switchResults.value = []
}
const nbackPool = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y']
function appendNbackLetter() {
  const index = nbackSequence.value.length
  if (index >= nbackN.value && Math.random() < 0.3) nbackSequence.value.push(nbackSequence.value[index - nbackN.value])
  else {
    const previous = index >= nbackN.value ? nbackSequence.value[index - nbackN.value] : ''
    const choices = nbackPool.filter(letter => letter !== previous)
    nbackSequence.value.push(choices[Math.floor(Math.random() * choices.length)])
  }
}
function setNbackLevel(level: number) { if (!nbackSequence.value.length && level >= 1 && level <= 5) nbackN.value = level as 1 | 2 | 3 | 4 | 5 }
function scheduleNbackTrial() {
  clearTrialTimers(); gameFeedback.value = ''; nbackLocked.value = false; nbackVisible.value = true; nbackStartedAt.value = Date.now()
  if (!nbackSequence.value[nbackIndex.value]) appendNbackLetter()
  const warmup = nbackIndex.value < nbackN.value
  stimulusTimer = setTimeout(() => { nbackVisible.value = false }, 700)
  responseTimer = setTimeout(() => { if (nbackLocked.value || nbackPaused.value) return; nbackLocked.value = true; advanceNback(false) }, warmup ? 1000 : 2300)
}
function advanceNback(withFeedback: boolean) {
  clearTrialTimers()
  if (nbackAnswered.value >= 20) { const finish = () => { nbackFinished.value = true; nbackVisible.value = false }; if (withFeedback) gameAdvanceTimer = setTimeout(finish, 420); else finish(); return }
  const next = () => { nbackIndex.value += 1; appendNbackLetter(); scheduleNbackTrial() }
  if (withFeedback) gameAdvanceTimer = setTimeout(next, 420); else next()
}
function startNback() { resetGame(); nbackSequence.value = []; appendNbackLetter(); scheduleNbackTrial() }
function answerNback(answer: boolean) {
  if (nbackFinished.value || nbackPaused.value || nbackLocked.value || nbackIndex.value < nbackN.value) return
  nbackLocked.value = true; clearTrialTimers()
  const index = nbackIndex.value
  const expected = nbackSequence.value[index] === nbackSequence.value[index - nbackN.value]
  const correct = answer === expected
  nbackAnswered.value += 1; if (correct) nbackCorrect.value += 1
  nbackResults.value.push({ match: expected, correct, rt: Date.now() - nbackStartedAt.value })
  gameFeedback.value = correct ? '正确' : '错误'; gameFeedbackType.value = correct ? 'correct' : 'wrong'
  advanceNback(true)
}
function toggleNbackPause() {
  if (nbackFinished.value || !nbackSequence.value.length) return
  nbackPaused.value = !nbackPaused.value; clearTrialTimers(); nbackLocked.value = true; nbackVisible.value = false
  if (!nbackPaused.value) { nbackIndex.value += 1; appendNbackLetter(); scheduleNbackTrial() }
}
function shuffleValues<T>(values: T[]) {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) { const swap = Math.floor(Math.random() * (index + 1)); [result[index], result[swap]] = [result[swap], result[index]] }
  return result
}
function buildStroopPlan() {
  const plan = [...Array(50).fill(true), ...Array(50).fill(false)] as boolean[]
  for (let attempt = 0; attempt < 40; attempt += 1) { const next = shuffleValues(plan); if (!next.some((value, index) => index >= 2 && value === next[index - 1] && value === next[index - 2])) return next }
  return shuffleValues(plan)
}
function scheduleStroopTrial() {
  clearTrialTimers(); gameFeedback.value = ''; stroopLocked.value = false
  const palette = stroopPalette.value
  const colorChoices = palette.filter(index => index !== lastStroopColor.value)
  const colorIndex = colorChoices[Math.floor(Math.random() * colorChoices.length)]
  const same = stroopConditionPlan.value[stroopPresented.value] ?? Math.random() < 0.5
  const wordChoices = same ? [colorIndex] : palette.filter(index => index !== colorIndex && index !== lastStroopWordIndex.value)
  const fallbackWords = same ? [colorIndex] : palette.filter(index => index !== colorIndex)
  const source = wordChoices.length ? wordChoices : fallbackWords
  const wordIndex = source[Math.floor(Math.random() * source.length)]
  stroopColorIndex.value = colorIndex; stroopCondition.value = same ? '一致' : '不一致'; stroopWord.value = stroopWords[wordIndex]
  stroopAnswerOrder.value = [...palette]; lastStroopColor.value = colorIndex; lastStroopWordIndex.value = wordIndex; stroopPresented.value += 1; stroopStartedAt.value = Date.now()
  responseTimer = setTimeout(() => { if (stroopLocked.value || stroopPaused.value) return; stroopLocked.value = true; scheduleStroopTrial() }, 3200)
}
function startStroop() { resetGame(); lastStroopColor.value = -1; lastStroopWordIndex.value = -1; stroopConditionPlan.value = buildStroopPlan(); stroopStarted.value = true; scheduleStroopTrial() }
function answerStroop(colorIndex: number) {
  if (stroopFinished.value || stroopPaused.value || stroopLocked.value) return
  stroopLocked.value = true; clearTrialTimers()
  const correct = colorIndex === stroopColorIndex.value
  stroopAnswered.value += 1; if (correct) stroopCorrect.value += 1
  stroopResults.value.push({ condition: stroopCondition.value, correct, rt: Date.now() - stroopStartedAt.value })
  gameFeedback.value = correct ? '正确' : '错误'; gameFeedbackType.value = correct ? 'correct' : 'wrong'
  gameAdvanceTimer = setTimeout(() => { if (stroopAnswered.value >= 20) stroopFinished.value = true; else scheduleStroopTrial() }, 420)
}
function toggleStroopPause() {
  if (!stroopStarted.value || stroopFinished.value) return
  stroopPaused.value = !stroopPaused.value; clearTrialTimers(); stroopLocked.value = true
  if (!stroopPaused.value) scheduleStroopTrial()
}
function switchProbability() { return switchMode.value === 'stable' ? 0.2 : switchMode.value === 'challenge' ? 0.6 : 0.4 }
function scheduleSwitchTrial() {
  clearTrialTimers(); gameFeedback.value = ''; switchLocked.value = false
  const previous = switchRule.value
  const shouldSwitch = switchPresented.value > 0 && Math.random() < switchProbability()
  switchPreviousRule.value = previous
  switchRule.value = shouldSwitch ? (previous === 'color' ? 'shape' : 'color') : previous
  switchColor.value = Math.random() < 0.5 ? 'red' : 'blue'
  switchShape.value = Math.random() < 0.5 ? 'circle' : 'square'
  switchPresented.value += 1; switchStartedAt.value = Date.now()
  responseTimer = setTimeout(() => { if (switchLocked.value || switchPaused.value) return; switchLocked.value = true; scheduleSwitchTrial() }, 3000)
}
function startSwitch() { resetGame(); switchStarted.value = true; switchRule.value = 'color'; scheduleSwitchTrial() }
function answerSwitch(answer: 'red' | 'blue' | 'circle' | 'square') {
  if (switchFinished.value || switchPaused.value || switchLocked.value) return
  switchLocked.value = true; clearTrialTimers()
  const expected = switchRule.value === 'color' ? switchColor.value : switchShape.value
  const correct = answer === expected
  const switched = switchPresented.value > 1 && switchPreviousRule.value !== switchRule.value
  switchAnswered.value += 1; if (correct) switchCorrect.value += 1
  switchResults.value.push({ switched, correct, rt: Date.now() - switchStartedAt.value })
  gameFeedback.value = correct ? '正确' : '错误'; gameFeedbackType.value = correct ? 'correct' : 'wrong'
  gameAdvanceTimer = setTimeout(() => { if (switchAnswered.value >= 28) switchFinished.value = true; else scheduleSwitchTrial() }, 420)
}
function toggleSwitchPause() {
  if (!switchStarted.value || switchFinished.value) return
  switchPaused.value = !switchPaused.value; clearTrialTimers(); switchLocked.value = true
  if (!switchPaused.value) scheduleSwitchTrial()
}
const switchAccuracy = computed(() => switchAnswered.value ? Math.round(switchCorrect.value * 100 / switchAnswered.value) : 0)
const switchStats = computed(() => {
  const stats = (switched: boolean) => { const rows = switchResults.value.filter(item => item.switched === switched); return { rt: rows.length ? Math.round(rows.reduce((sum, item) => sum + item.rt, 0) / rows.length) : 0, accuracy: rows.length ? Math.round(rows.filter(item => item.correct).length * 100 / rows.length) : 0 } }
  return { repeat: stats(false), switched: stats(true) }
})
const switchCost = computed(() => switchStats.value.switched.rt && switchStats.value.repeat.rt ? switchStats.value.switched.rt - switchStats.value.repeat.rt : 0)
const nbackAccuracy = computed(() => nbackAnswered.value ? Math.round(nbackCorrect.value * 100 / nbackAnswered.value) : 0)
const nbackMatchAccuracy = computed(() => { const rows = nbackResults.value.filter(item => item.match); return rows.length ? Math.round(rows.filter(item => item.correct).length * 100 / rows.length) : 0 })
const nbackNonMatchAccuracy = computed(() => { const rows = nbackResults.value.filter(item => !item.match); return rows.length ? Math.round(rows.filter(item => item.correct).length * 100 / rows.length) : 0 })
const nbackAverageRt = computed(() => nbackResults.value.length ? Math.round(nbackResults.value.reduce((sum, item) => sum + item.rt, 0) / nbackResults.value.length) : 0)
const stroopAccuracy = computed(() => stroopAnswered.value ? Math.round(stroopCorrect.value * 100 / stroopAnswered.value) : 0)
const stroopConditionStats = computed(() => {
  const stats = (condition: '一致' | '不一致') => { const rows = stroopResults.value.filter(item => item.condition === condition); return { accuracy: rows.length ? Math.round(rows.filter(item => item.correct).length * 100 / rows.length) : 0, rt: rows.length ? Math.round(rows.reduce((sum, item) => sum + item.rt, 0) / rows.length) : 0 } }
  return { congruent: stats('一致'), incongruent: stats('不一致') }
})
const stroopEffect = computed(() => stroopConditionStats.value.incongruent.rt && stroopConditionStats.value.congruent.rt ? stroopConditionStats.value.incongruent.rt - stroopConditionStats.value.congruent.rt : 0)
function openCalm(goalId?: string) {
  const options = decreaseGoals.value
  if (!options.length) return uni.showToast({ title: '先创建一个少做一点的目标', icon: 'none' })
  calmGoalId.value = goalId || (options.length === 1 ? options[0].id : '')
  calmChoosing.value = !calmGoalId.value
  calmSeconds.value = 120
  calmReady.value = false
  calmPromptIndex.value = 0
  showCalmModal.value = true
  if (calmPromptTimer) clearInterval(calmPromptTimer)
  if (calmChoosing.value) return
  calmPromptTimer = setInterval(() => {
    if (calmPromptIndex.value >= calmPrompts.length - 1) {
      calmReady.value = true
      if (calmPromptTimer) clearInterval(calmPromptTimer)
      calmPromptTimer = undefined
    } else calmPromptIndex.value += 1
  }, 1300)
}
function selectCalmGoal(goalId: string) {
  if (!decreaseGoals.value.some(goal => goal.id === goalId)) return
  calmGoalId.value = goalId
  calmChoosing.value = false
  calmReady.value = false
  calmPromptIndex.value = 0
  if (calmPromptTimer) clearInterval(calmPromptTimer)
  calmPromptTimer = setInterval(() => {
    if (calmPromptIndex.value >= calmPrompts.length - 1) { calmReady.value = true; if (calmPromptTimer) clearInterval(calmPromptTimer); calmPromptTimer = undefined }
    else calmPromptIndex.value += 1
  }, 1300)
}

function startCalm() {
  if (!calmGoalId.value) return uni.showToast({ title: '请选择一个目标', icon: 'none' })
  if (calmTimer) clearInterval(calmTimer)
  calmTimer = setInterval(() => {
    calmSeconds.value -= 1
    if (calmSeconds.value <= 0 && calmTimer) { clearInterval(calmTimer); calmTimer = undefined }
  }, 1000)
}

function recordOriginalAfterCalm() {
  if (calmGoalId.value) recordEvent(calmGoalId.value, 'original')
  closeCalm()
  refresh()
  uni.showToast({ title: '已诚实记录', icon: 'none' })
}
function completeCalmWithoutRecord() {
  closeCalm()
  uni.vibrateShort({ type: 'light', fail: () => undefined })
  uni.showToast({ title: '很好，先回到当下', icon: 'none' })
}
function closeCalm() {
  if (calmTimer) clearInterval(calmTimer)
  calmTimer = undefined
  if (calmPromptTimer) clearInterval(calmPromptTimer)
  calmPromptTimer = undefined
  calmAudio?.stop()
  calmAudio?.destroy()
  calmAudio = undefined
  showCalmModal.value = false
}

function skipCalmPrompts() {
  if (calmPromptTimer) clearInterval(calmPromptTimer)
  calmPromptTimer = undefined
  calmReady.value = true
}
function leaveOrSkip() { if (calmReady.value) closeCalm(); else skipCalmPrompts() }
function playCalmReminder() {
  try {
    calmAudio?.stop()
    calmAudio?.destroy()
    calmAudio = uni.createInnerAudioContext()
    calmAudio.src = '/static/reminder-stop.wav'
    calmAudio.volume = 0.86
    calmAudio.onError(() => uni.showToast({ title: '声音没有播放，请检查设备音量', icon: 'none' }))
    calmAudio.play()
  } catch {
    uni.vibrateShort({ type: 'light', fail: () => undefined })
  }
  uni.showToast({ title: '听一句，再决定下一步', icon: 'none' })
}
function openDone(goalId: string) { doneGoalId.value = goalId; showDoneModal.value = true }
function confirmDone() {
  recordEvent(doneGoalId.value, 'done')
  showDoneModal.value = false
  refresh()
  uni.vibrateShort({ type: 'light', fail: () => undefined })
  uni.showToast({ title: '记下了这一步', icon: 'none' })
}

function togglePinned(goalId: string) { setGoalPinned(goalId, !data.value.goals.find(goal => goal.id === goalId)?.pinned); refresh() }
function togglePaused(goalId: string) { setGoalPaused(goalId, data.value.goals.find(goal => goal.id === goalId)?.status === 'active'); refresh() }
function reorder(goalId: string, direction: -1 | 1) { moveGoal(goalId, direction); refresh() }
function dragStart(goalId: string, event: any) {
  const goal = goals.value.find(item => item.id === goalId)
  if (!goal || goal.pinned || goal.status !== 'active' || !touchY(event)) return
  draggingGoalId.value = goalId
  dragStartY.value = touchY(event)
  dragMoved.value = false
}
function touchY(event: any) {
  const touch = event?.touches?.[0]
  return Number(touch?.pageY ?? touch?.clientY ?? 0)
}
function dragMove(goalId: string, event: any) {
  if (draggingGoalId.value !== goalId) return
  if (!touchY(event)) return
  const delta = touchY(event) - dragStartY.value
  if (Math.abs(delta) < 70) return
  dragMoved.value = true
  moveGoal(goalId, delta < 0 ? -1 : 1)
  dragStartY.value = touchY(event)
  refresh()
}
function dragEnd() {
  if (dragMoved.value) uni.vibrateShort({ type: 'light', fail: () => undefined })
  draggingGoalId.value = ''
  dragMoved.value = false
}
function clearAllData() {
  uni.showModal({ title: '删除全部数据？', content: '所有目标和记录都会从当前设备删除，无法恢复。', confirmText: '全部删除', confirmColor: '#B06C57', success: result => { if (result.confirm) { deleteAll(); refresh(); uni.showToast({ title: '已清空', icon: 'none' }) } } })
}

function recordFor(goalId: string, result: 'done' | 'original') {
  recordEvent(goalId, result)
  refresh()
  uni.showToast({ title: result === 'done' ? '记下了这一步' : '已记录', icon: 'none' })
}

function openThought(goalId: string) {
  composerGoalId.value = goalId
  composerText.value = ''
  showThoughtModal.value = true
}

function openGoalManager(goalId: string) {
  const goal = data.value.goals.find(item => item.id === goalId)
  if (!goal) return
  editingGoalId.value = goal.id
  editingGoalTitle.value = goal.title
  editingGoalDirection.value = goal.direction
  editingGoalTone.value = goal.tone ?? '0'
  showGoalManager.value = true
}

function saveGoalEdit() {
  if (!updateGoal(editingGoalId.value, editingGoalTitle.value, editingGoalDirection.value, editingGoalTone.value)) {
    uni.showToast({ title: '请先填写目标名称', icon: 'none' })
    return
  }
  showGoalManager.value = false
  refresh()
  uni.showToast({ title: '目标已更新', icon: 'none' })
}

function toggleEditingPinned() {
  if (!editingGoalId.value) return
  const nextPinned = !editingGoal.value?.pinned
  setGoalPinned(editingGoalId.value, nextPinned)
  refresh()
  uni.showToast({ title: nextPinned ? '已置顶' : '已取消置顶', icon: 'none' })
}

function removeEditingGoal() {
  uni.showModal({
    title: '删除这个目标？',
    content: '目标和它的历史记录都会从本机移除。',
    confirmText: '删除',
    confirmColor: '#B06C57',
    success: (result) => {
      if (!result.confirm) return
      deleteGoal(editingGoalId.value)
      showGoalManager.value = false
      refresh()
      uni.showToast({ title: '目标已删除', icon: 'none' })
    }
  })
}

function saveThought() {
  if (!composerText.value.trim()) {
    uni.showToast({ title: '写一句就好', icon: 'none' })
    return
  }
  recordEvent(composerGoalId.value, 'reflection', composerText.value)
  showThoughtModal.value = false
  refresh()
  uni.showToast({ title: '想法已保存', icon: 'none' })
}

function saveGoal() {
  const title = newGoalTitle.value.trim()
  if (!title) {
    uni.showToast({ title: '先写一个目标名称', icon: 'none' })
    return
  }
  createGoal(title, newGoalDirection.value, newGoalTone.value)
  newGoalTitle.value = ''
  newGoalTone.value = String((Number(newGoalTone.value) + 1) % toneOptions.length)
  refresh()
  uni.showToast({ title: '目标已加入今天', icon: 'none' })
}

function toggleMonth(key: string) {
  monthOpen.value = { ...monthOpen.value, [key]: !monthOpen.value[key] }
}

function setHistoryRange(value: string) {
  if (value === 'all' || value === 'year' || value === '30d') {
    historyRange.value = value
    monthOpen.value = {}
  }
}

function copyBackup() {
  uni.setClipboardData({ data: exportData(), success: () => uni.showToast({ title: '备份已复制', icon: 'none' }) })
}

function formatEvent(event: HabitEvent) {
  const date = new Date(event.occurredAt)
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

let refreshTimer: ReturnType<typeof setInterval> | undefined
onHide(() => {
  if (nbackSequence.value.length && !nbackFinished.value) { nbackPaused.value = true; nbackLocked.value = true; nbackVisible.value = false; clearTrialTimers() }
  if (stroopStarted.value && !stroopFinished.value) { stroopPaused.value = true; stroopLocked.value = true; clearTrialTimers() }
  if (switchStarted.value && !switchFinished.value) { switchPaused.value = true; switchLocked.value = true; clearTrialTimers() }
})

onMounted(async () => {
  await initStorage()
  refresh()
  refreshTimer = setInterval(refresh, 30000)
})
onUnmounted(() => {
  clearTrialTimers()
  if (practiceTimer) clearInterval(practiceTimer)
  if (refreshTimer) clearInterval(refreshTimer)
  if (calmTimer) clearInterval(calmTimer)
  if (calmPromptTimer) clearInterval(calmPromptTimer)
  calmAudio?.stop()
  calmAudio?.destroy()
})
</script>

<template>
  <view class="app-shell">
    <view class="page-scroll" :class="{ 'training-locked': (nbackSequence.length && !nbackFinished && !nbackPaused) || (stroopStarted && !stroopFinished && !stroopPaused) || (switchStarted && !switchFinished && !switchPaused) }">
      <view v-if="tab === 'today'" class="page page-today">
        <view class="topline"><text class="eyebrow">雾明 · 今天</text><text class="date-label">{{ new Date().getMonth() + 1 }}月{{ new Date().getDate() }}日</text></view>
        <view class="hero-block">
          <text class="hero-kicker">给自己留一点空间</text>
          <text class="hero-title">今天，想往哪边走？</text>
          <text class="hero-note">不用一次改变全部。只记下此刻真实发生的这一小步。</text>
        </view>

        <view class="daily-summary">
          <view><text class="summary-number">{{ totalDoneToday }}</text><text class="summary-label">今天的主动记录</text></view>
          <view class="summary-tail"><text>{{ todayEvents.length ? '继续保持温和的观察' : '从一个很小的动作开始' }}</text><text class="summary-dot">·</text></view>
        </view>

        <view class="section-heading"><view><text class="section-kicker">现在进行中</text><text class="section-title">我的目标</text><text class="sort-hint">长按卡片可调整顺序</text></view><button class="text-action" @tap="showGoalModal = true">＋ 新目标</button></view>
        <view v-if="goals.length" class="goal-list">
          <view v-for="(goal, index) in goals" :key="goal.id" class="goal-card" :class="[`tone-${goal.tone ?? (index % 6)}`, { pinned: goal.pinned, dragging: draggingGoalId === goal.id }]" :data-id="goal.id">
            <view class="goal-accent"></view>
            <view class="goal-card-head"><view class="goal-heading-copy"><text class="goal-direction">{{ directionLabel(goal.direction) }}</text><text class="goal-title">{{ goal.title }}</text></view><view class="goal-head-actions"><text v-if="!goal.pinned" class="drag-handle" @touchstart.stop="dragStart(goal.id, $event)" @touchmove.stop.prevent="dragMove(goal.id, $event)" @touchend.stop="dragEnd" @touchcancel.stop="dragEnd" @longpress.stop="dragStart(goal.id, $event)">⠿</text><text v-if="goal.pinned" class="pin-mark">置顶</text><button class="manage-trigger" @tap="openGoalManager(goal.id)">••• 管理</button></view></view>
            <text class="goal-last">{{ intervalText(goal) }}</text><text class="goal-last goal-last-secondary">{{ latestText(goal.id) }}</text>
            <view class="goal-actions">
              <button v-if="goal.direction === 'increase'" class="primary-action" @tap="openDone(goal.id)">我做到了</button>
              <button v-else class="primary-action calm-action" @tap="openCalm(goal.id)">先缓一下</button>
              <button class="secondary-action" @tap="openThought(goal.id)">写一句想法</button>
              <button v-if="goal.direction === 'decrease'" class="quiet-action" @tap="recordFor(goal.id, 'original')">还是做了</button>
            </view>
          </view>
        </view>
        <view v-else class="empty-card"><text>还没有目标</text><button class="primary-action" @tap="showGoalModal = true">创建第一个目标</button></view>

        <view v-if="todayEvents.length" class="recent-section"><view class="section-heading compact"><view><text class="section-kicker">刚刚发生</text><text class="section-title">今天的足迹</text></view><text class="small-count">{{ todayEvents.length }} 条</text></view><view class="mini-event" v-for="event in todayEvents.slice(0, 3)" :key="event.id"><view class="event-bullet"></view><view><text class="event-title">{{ event.goalTitle }}</text><text class="event-meta">{{ resultLabel(event.result) }} · {{ formatEvent(event) }}</text></view></view></view>
      </view>

      <view v-else-if="tab === 'review'" class="page">
        <view class="topline"><text class="eyebrow">回顾 · 时间轴</text><text class="date-label">{{ historyEvents.length }} 条记录</text></view>
        <view class="review-intro"><text class="hero-title">留下来的，都会有迹可循</text><text class="hero-note">按月份整理你的主动记录。点击月份，可以只看那一段时间。</text></view>
        <view class="heatmap-card"><view class="heatmap-head"><text>四周足迹</text><text>{{ heatmap.total }} 次记录</text></view><view class="heatmap-nav"><button :disabled="heatmapOffset >= 12" @tap="shiftHeatmap(-1)">‹ 更早</button><text>{{ heatmap.start.getMonth() + 1 }}月{{ heatmap.start.getDate() }}日 — {{ heatmap.end.getMonth() + 1 }}月{{ heatmap.end.getDate() }}日</text><button :disabled="heatmapOffset === 0" @tap="shiftHeatmap(1)">较近 ›</button></view><view class="heatmap-weekdays"><text v-for="day in ['一','二','三','四','五','六','日']" :key="day">{{ day }}</text></view><view v-for="(week, weekIndex) in heatmap.weeks" :key="weekIndex" class="heatmap-week"><view v-for="cell in week" :key="cell.key" class="heatmap-cell" :class="[`level-${Math.min(cell.count, 4)}`, { today: cell.today, future: cell.future }]" @tap="showHeatCell(cell)"><text class="heatmap-day">{{ cell.day }}</text><text v-if="cell.count" class="heatmap-count">{{ cell.count }}</text></view></view></view>
        <view class="insight-card"><view class="insight-head"><text class="section-kicker">本周洞察</text><text>{{ weeklyInsight.trendText }}</text></view><view class="insight-grid"><view><text class="insight-value">{{ weeklyInsight.total }}</text><text class="insight-label">本周记录</text></view><view><text class="insight-value">{{ weeklyInsight.activeDays }}</text><text class="insight-label">活跃天数</text></view><view><text class="insight-value">{{ weeklyInsight.completed }}</text><text class="insight-label">完成行动</text></view><view><text class="insight-value">{{ weeklyInsight.reflections }}</text><text class="insight-label">想法记录</text></view></view><view class="insight-detail"><view><text>记录最多的目标</text><text>{{ weeklyInsight.topTitle }}<text v-if="weeklyInsight.topCount"> · {{ weeklyInsight.topCount }} 次</text></text></view><view><text>最活跃的一天</text><text>{{ weeklyInsight.topDay }}<text v-if="weeklyInsight.topDayCount"> · {{ weeklyInsight.topDayCount }} 条</text></text></view></view></view>
        <view class="range-switch"><button v-for="item in [{ id: 'all', label: '全部' }, { id: 'year', label: '今年' }, { id: '30d', label: '近30天' }]" :key="item.id" :class="{ active: historyRange === item.id }" @tap="setHistoryRange(item.id)">{{ item.label }}</button></view>
        <scroll-view scroll-x class="goal-filter"><button :class="{ active: !reviewGoalId }" @tap="reviewGoalId = ''">全部目标</button><button v-for="goal in reviewGoals" :key="goal.id" :class="{ active: reviewGoalId === goal.id }" @tap="reviewGoalId = goal.id">{{ goal.title }}</button></scroll-view>
        <view v-if="historyGroups.length" class="timeline">
          <view v-for="month in historyGroups" :key="month.key" class="month-group" :class="{ collapsed: !month.expanded }">
            <button class="month-heading" :class="{ open: month.expanded }" @tap="toggleMonth(month.key)"><text>{{ month.label }}</text><view><text class="month-count">{{ month.records.length }} 条</text><text class="chevron">⌄</text></view></button>
            <view v-if="month.expanded" class="month-records"><view v-for="event in month.records" :key="event.id" class="timeline-record"><view class="record-time"><text>{{ new Date(event.occurredAt).getDate() }}日</text><text>{{ formatEvent(event).split('·')[1] }}</text></view><view class="record-body"><text class="record-goal">{{ event.goalTitle }}</text><text class="record-result">{{ resultLabel(event.result) }}</text><text v-if="event.note" class="record-note">“{{ event.note }}”</text></view></view></view>
          </view>
        </view>
        <view v-else class="empty-card"><text>还没有记录</text><text class="empty-note">完成一次小行动，或写下此刻的想法后，它会出现在这里。</text></view>
      </view>

      <view v-else-if="tab === 'practice'" class="page practice-page">
        <view class="topline"><text class="eyebrow">专注 · 练习工具</text><text class="date-label">不参与习惯计分</text></view>
        <view class="practice-intro"><text class="hero-title">把注意力带回来</text><text class="hero-note">呼吸是准备，训练是练习。选择一个短练习，给自己几分钟。</text></view>
        <view class="practice-tool-tabs"><button :class="{ active: practiceTool === 'breath' }" @tap="choosePracticeTool('breath')">呼吸</button><button :class="{ active: practiceTool === 'nback' }" @tap="choosePracticeTool('nback')">N‑Back</button><button :class="{ active: practiceTool === 'stroop' }" @tap="choosePracticeTool('stroop')">Stroop</button><button :class="{ active: practiceTool === 'switch' }" @tap="choosePracticeTool('switch')">切换</button></view>
        <view v-if="practiceTool === 'breath'" class="practice-card"><view class="practice-orb" :class="{ running: practiceRunning }"></view><text class="practice-phase">{{ practicePhase }}</text><text class="practice-clock">{{ String(Math.floor(practiceSeconds / 60)).padStart(2, '0') }}:{{ String(practiceSeconds % 60).padStart(2, '0') }}</text><text class="practice-note">吸气四秒，呼气四秒。感到分心时，温柔地回来。</text><view class="practice-actions"><button class="sheet-primary" @tap="startPractice">{{ practiceRunning ? '正在练习' : practiceSeconds === 0 ? '再来一次' : '开始练习' }}</button><button class="secondary-action" @tap="resetPractice">重新开始</button></view></view>
<view v-else-if="practiceTool === 'nback'" class="training-card"><view class="training-head"><view><text class="section-kicker">工作记忆 · {{ nbackN }}‑Back</text><text class="training-title">当前字母，和前 N 个相同吗？</text></view><text class="training-count">{{ nbackFinished ? '完成' : nbackSequence.length ? `${nbackAnswered} / 20 有效` : '准备' }}</text></view><view v-if="!nbackSequence.length || nbackFinished" class="training-start"><view v-if="nbackFinished" class="result-grid"><view><text>{{ nbackAnswered }}</text><text class="result-label">有效作答</text></view><view><text>{{ nbackAccuracy }}%</text><text class="result-label">总正确率</text></view><view><text>{{ nbackMatchAccuracy }}%</text><text class="result-label">匹配正确率</text></view><view><text>{{ nbackNonMatchAccuracy }}%</text><text class="result-label">非匹配正确率</text></view><view><text>{{ nbackAverageRt }} ms</text><text class="result-label">平均反应时</text></view></view><text class="training-note">字母显示 0.7 秒，隐藏后仍可作答。未作答会直接跳到下一题，不计入统计。</text><view class="difficulty-row"><button v-for="level in [1, 2, 3, 4, 5]" :key="level" :class="{ active: nbackN === level }" @tap="setNbackLevel(level)">{{ level }}‑back</button></view><button class="sheet-primary full-action" @tap="startNback">{{ nbackFinished ? '再来一轮' : '开始训练' }}</button></view><view v-else class="training-play"><view class="live-status"><text>当前 {{ nbackN }}‑Back</text><text>正确率 {{ nbackAccuracy }}%</text><button @tap="toggleNbackPause">{{ nbackPaused ? '继续' : '暂停' }}</button></view><view v-if="nbackPaused" class="paused-panel"><text>训练已暂停</text><text>继续后从下一试次开始</text></view><template v-else><text class="stimulus-letter">{{ nbackVisible ? nbackSequence[nbackIndex] : '·' }}</text><text class="training-feedback" :class="gameFeedbackType">{{ nbackIndex < nbackN ? `记忆 ${nbackIndex + 1} / ${nbackN}` : (gameFeedback || (nbackVisible ? '看清字母' : '现在作答')) }}</text><view v-if="nbackIndex >= nbackN" class="answer-row"><button :disabled="nbackLocked" @tap="answerNback(true)">相同</button><button :disabled="nbackLocked" @tap="answerNback(false)">不同</button></view><view v-else class="memory-wait">建立记忆序列…</view></template></view></view>
<view v-else-if="practiceTool === 'stroop'" class="training-card"><view class="training-head"><view><text class="section-kicker">抑制控制 · Stroop</text><text class="training-title">只看颜色，不读字义</text></view><text class="training-count">{{ stroopFinished ? '完成' : stroopStarted ? `${stroopAnswered} / 20 有效` : '准备' }}</text></view><view v-if="!stroopStarted && !stroopFinished" class="training-start"><text class="training-note">单题最多 3.2 秒。未作答会直接跳过，不反馈，也不计入统计。</text><view class="stroop-modes"><button :class="{ active: stroopMode === 'simple' }" @tap="stroopMode = 'simple'"><text>简化三色</text><text class="mode-note">红 · 蓝 · 黄</text></button><button :class="{ active: stroopMode === 'standard' }" @tap="stroopMode = 'standard'"><text>标准四色</text><text class="mode-note">默认</text></button><button :class="{ active: stroopMode === 'advanced' }" @tap="stroopMode = 'advanced'"><text>进阶五色</text><text class="mode-note">加入紫色</text></button></view><button class="sheet-primary full-action" @tap="startStroop">开始训练</button></view><view v-else-if="stroopFinished" class="training-start"><view class="result-grid"><view><text>{{ stroopAnswered }}</text><text class="result-label">有效作答</text></view><view><text>{{ stroopAccuracy }}%</text><text class="result-label">总正确率</text></view><view><text>{{ stroopConditionStats.congruent.accuracy }}%</text><text class="result-label">一致正确率</text></view><view><text>{{ stroopConditionStats.incongruent.accuracy }}%</text><text class="result-label">不一致正确率</text></view><view><text>{{ stroopConditionStats.congruent.rt }} ms</text><text class="result-label">一致平均 RT</text></view><view><text>{{ stroopConditionStats.incongruent.rt }} ms</text><text class="result-label">不一致平均 RT</text></view><view><text>{{ stroopEffect }} ms</text><text class="result-label">Stroop 效应</text></view></view><view class="stroop-modes"><button :class="{ active: stroopMode === 'simple' }" @tap="stroopMode = 'simple'"><text>简化三色</text><text class="mode-note">红 · 蓝 · 黄</text></button><button :class="{ active: stroopMode === 'standard' }" @tap="stroopMode = 'standard'"><text>标准四色</text><text class="mode-note">默认</text></button><button :class="{ active: stroopMode === 'advanced' }" @tap="stroopMode = 'advanced'"><text>进阶五色</text><text class="mode-note">加入紫色</text></button></view><button class="sheet-primary full-action" @tap="startStroop">再来一轮</button></view><view v-else class="training-play"><view class="live-status"><text>有效 {{ stroopAnswered }} / 20</text><text>正确率 {{ stroopAccuracy }}%</text><button @tap="toggleStroopPause">{{ stroopPaused ? '继续' : '暂停' }}</button></view><view v-if="stroopPaused" class="paused-panel"><text>训练已暂停</text><text>继续后从下一试次开始</text></view><template v-else><view class="stroop-stage"><text class="stroop-word" :style="{ color: stroopColors[stroopColorIndex] }">{{ stroopWord }}</text><text class="training-feedback" :class="gameFeedbackType">{{ gameFeedback || '按字体颜色作答' }}</text></view><view class="answer-row color-answer"><button v-for="colorIndex in stroopAnswerOrder" :key="colorIndex" :disabled="stroopLocked" @tap="answerStroop(colorIndex)">{{ stroopWords[colorIndex] }}</button></view></template></view></view>
        <view v-else class="training-card"><view class="training-head"><view><text class="section-kicker">认知灵活性 · 任务切换</text><text class="training-title">根据当前规则作答</text></view><text class="training-count">{{ switchFinished ? '完成' : switchStarted ? `${switchAnswered} / 28 有效` : '准备' }}</text></view><view v-if="!switchStarted || switchFinished" class="training-start"><view v-if="switchFinished" class="result-grid"><view><text>{{ switchAnswered }}</text><text class="result-label">有效作答</text></view><view><text>{{ switchAccuracy }}%</text><text class="result-label">总正确率</text></view><view><text>{{ switchStats.repeat.rt }} ms</text><text class="result-label">重复平均 RT</text></view><view><text>{{ switchStats.switched.rt }} ms</text><text class="result-label">切换平均 RT</text></view><view><text>{{ switchCost }} ms</text><text class="result-label">切换代价</text></view></view><text class="training-note">颜色和形状会随机组合，规则在试次之间切换。未作答会直接跳过，不计入统计。</text><view class="stroop-modes"><button :class="{ active: switchMode === 'stable' }" @tap="switchMode = 'stable'"><text>稳定</text><text class="mode-note">少切换</text></button><button :class="{ active: switchMode === 'flexible' }" @tap="switchMode = 'flexible'"><text>灵活</text><text class="mode-note">默认</text></button><button :class="{ active: switchMode === 'challenge' }" @tap="switchMode = 'challenge'"><text>挑战</text><text class="mode-note">多切换</text></button></view><button class="sheet-primary full-action" @tap="startSwitch">{{ switchFinished ? '再来一轮' : '开始训练' }}</button></view><view v-else class="training-play"><view class="live-status"><text>当前规则：{{ switchRule === 'color' ? '按颜色' : '按形状' }}</text><text>正确率 {{ switchAccuracy }}%</text><button @tap="toggleSwitchPause">{{ switchPaused ? '继续' : '暂停' }}</button></view><view v-if="switchPaused" class="paused-panel"><text>训练已暂停</text><text>继续后从下一试次开始</text></view><template v-else><view class="switch-stage"><text class="switch-rule">{{ switchRule === 'color' ? '按颜色' : '按形状' }}</text><view class="switch-stimulus" :class="[switchColor, switchShape]"></view><text class="training-feedback" :class="gameFeedbackType">{{ gameFeedback || '只判断当前规则对应的维度' }}</text></view><view class="answer-row"><button :disabled="switchLocked" @tap="answerSwitch(switchRule === 'color' ? 'red' : 'circle')">{{ switchRule === 'color' ? '红' : '圆' }}</button><button :disabled="switchLocked" @tap="answerSwitch(switchRule === 'color' ? 'blue' : 'square')">{{ switchRule === 'color' ? '蓝' : '方' }}</button></view></template></view></view>
        <view class="practice-tip"><text class="section-kicker">小提示</text><text>这些训练只记录本轮结果，不会写入目标足迹。先呼吸，再开始也很好。</text></view>
      </view>
      <view v-else class="page settings-page">
        <view class="topline"><text class="eyebrow">我的空间</text></view>
        <view class="settings-hero"><text class="hero-title">把改变留在自己手里</text><text class="hero-note">当前版本的数据只保存在这台设备上。你可以随时复制一份备份。</text></view>
        <view class="settings-list"><button class="settings-row" @tap="copyBackup"><view><text class="settings-title">导出数据备份</text><text class="settings-note">复制目标和全部记录的 JSON</text></view><text class="row-arrow">↓</text></button><view class="settings-row static"><view><text class="settings-title">当前目标</text><text class="settings-note">{{ goals.length }} 个进行中的目标</text></view><text class="row-value">{{ data.events.length }} 条记录</text></view></view>
        <view class="plan-list"><view class="plan-list-title">我的计划</view><view v-for="goal in data.goals" :key="goal.id" class="plan-row"><view class="plan-copy"><text>{{ goal.title }}</text><text>{{ goal.status === 'active' ? '进行中' : '已暂停' }}<text v-if="goal.pinned"> · 已置顶</text></text></view><button class="plan-mini" @tap="togglePinned(goal.id)">{{ goal.pinned ? '取消置顶' : '置顶' }}</button><button v-if="goal.status === 'active' && !goal.pinned" class="plan-mini" @tap="reorder(goal.id, -1)">↑</button><button v-if="goal.status === 'active' && !goal.pinned" class="plan-mini" @tap="reorder(goal.id, 1)">↓</button><button class="plan-mini" @tap="togglePaused(goal.id)">{{ goal.status === 'active' ? '暂停' : '继续' }}</button><button class="plan-mini" @tap="openGoalManager(goal.id)">编辑</button></view></view><button class="clear-data" @tap="clearAllData">删除全部本地数据</button>
        
      </view>
    </view>

    <button v-if="tab === 'today' && decreaseGoals.length" class="floating-calm" @tap="openCalm()"><text>先缓一下</text><text>给冲动两分钟</text></button>
    <view class="bottom-nav"><button :class="{ selected: tab === 'today' }" @tap="chooseTab('today')"><text class="nav-icon">◒</text><text>今天</text></button><button :class="{ selected: tab === 'review' }" @tap="chooseTab('review')"><text class="nav-icon">⌁</text><text>回顾</text></button><button :class="{ selected: tab === 'practice' }" @tap="chooseTab('practice')"><text class="nav-icon">◌</text><text>专注</text></button><button :class="{ selected: tab === 'settings' }" @tap="chooseTab('settings')"><text class="nav-icon">○</text><text>我的</text></button></view>

    <view v-if="showGoalModal" class="modal-mask" @tap="showGoalModal = false"><view class="sheet" @tap.stop><view class="sheet-handle"></view><text class="sheet-kicker">新的方向</text><text class="sheet-title">你想给生活加一点什么？</text><input v-model="newGoalTitle" class="sheet-input" placeholder="例如：睡前少刷手机" :maxlength="40"/><view class="direction-picker"><button :class="{ active: newGoalDirection === 'increase' }" @tap="newGoalDirection = 'increase'">多做一点<text>建立想要的动作</text></button><button :class="{ active: newGoalDirection === 'decrease' }" @tap="newGoalDirection = 'decrease'">少做一点<text>给冲动留出缓冲</text></button></view>
        <view class="tone-picker"><text class="picker-label">卡片颜色</text><view class="tone-options"><button v-for="tone in toneOptions" :key="tone.id" class="tone-swatch" :class="[`swatch-${tone.id}`, { selected: newGoalTone === tone.id }]" @tap="newGoalTone = tone.id"><text v-if="newGoalTone === tone.id">✓</text></button></view></view><button class="sheet-primary" @tap="saveGoal">加入我的目标</button><button class="sheet-cancel" @tap="showGoalModal = false">先不添加</button></view></view>
    <view v-if="showGoalManager" class="modal-mask" @tap="showGoalManager = false"><view class="sheet" @tap.stop><view class="sheet-handle"></view><text class="sheet-kicker">管理目标</text><text class="sheet-title">{{ editingGoal?.title }}</text><input v-model="editingGoalTitle" class="sheet-input" :maxlength="40"/><view class="direction-picker"><button :class="{ active: editingGoalDirection === 'increase' }" @tap="editingGoalDirection = 'increase'">多做一点<text>建立想要的动作</text></button><button :class="{ active: editingGoalDirection === 'decrease' }" @tap="editingGoalDirection = 'decrease'">少做一点<text>给冲动留出缓冲</text></button></view>
        <view class="tone-picker"><text class="picker-label">卡片颜色</text><view class="tone-options"><button v-for="tone in toneOptions" :key="tone.id" class="tone-swatch" :class="[`swatch-${tone.id}`, { selected: editingGoalTone === tone.id }]" @tap="editingGoalTone = tone.id"><text v-if="editingGoalTone === tone.id">✓</text></button></view></view><button class="sheet-primary" @tap="saveGoalEdit">保存修改</button><button class="pin-action" @tap="toggleEditingPinned">{{ editingGoal?.pinned ? '取消置顶' : '置顶这个目标' }}</button><button class="danger-action" @tap="removeEditingGoal">删除这个目标</button><button class="sheet-cancel" @tap="showGoalManager = false">取消</button></view></view>
    <view v-if="showThoughtModal" class="modal-mask" @tap="showThoughtModal = false"><view class="sheet thought-sheet" @tap.stop><view class="sheet-handle"></view><text class="sheet-kicker">{{ composerGoal?.title }}</text><text class="sheet-title">写下此刻的想法</text><textarea v-model="composerText" class="thought-input" :maxlength="5000" placeholder="不用组织好语言，写给自己看就好。"/><view class="thought-footer"><text>{{ composerText.length }} / 5000</text><button class="sheet-primary" @tap="saveThought">保存想法</button></view></view></view>
    <view v-if="showCalmModal" class="modal-mask" @tap="closeCalm"><view class="sheet calm-sheet" @tap.stop><view class="sheet-handle"></view><text class="sheet-kicker">先缓一下</text><text class="sheet-title">{{ calmReady ? '你还在，选择也还在。' : '先不用做决定。' }}</text><text class="hero-note">{{ calmReady ? '这两分钟不是考验，只是把行动往后放一点。' : '让念头经过几秒钟，不必立刻跟着它行动。' }}</text><view class="calm-stage"><view class="calm-orb"></view><text class="calm-prompt">{{ calmReady ? '现在可以继续缓一会儿，也可以回去做别的事。' : calmPrompts[calmPromptIndex] }}</text><view class="calm-progress"><text v-for="(_, index) in calmPrompts" :key="index" :class="{ active: index <= calmPromptIndex }"></text></view><text class="calm-goal-label">正在面对 · {{ decreaseGoals.find(goal => goal.id === calmGoalId)?.title }}</text></view><text v-if="calmReady" class="calm-ready-note">不需要给刚才的自己打分。你愿意停下来，就已经多了一次选择。</text><view class="calm-actions"><button v-if="calmReady" class="sheet-primary" @tap="startCalm">进入两分钟缓冲 <text v-if="calmSeconds < 120">{{ String(Math.floor(calmSeconds / 60)).padStart(2, '0') }}:{{ String(calmSeconds % 60).padStart(2, '0') }}</text></button><button v-if="calmReady" class="secondary-action" @tap="completeCalmWithoutRecord">我现在缓下来了</button><button class="secondary-action" @tap="playCalmReminder">听一句声音提醒</button><button class="sheet-cancel" @tap="leaveOrSkip">{{ calmReady ? '先回去' : '跳过提示' }}</button></view><view class="calm-bottom-actions"><button @tap="recordOriginalAfterCalm">还是做了</button><button @tap="closeCalm">先离开</button></view></view></view>
    <view v-if="showDoneModal" class="modal-mask" @tap="showDoneModal = false"><view class="sheet done-sheet" @tap.stop><view class="sheet-handle"></view><text class="sheet-kicker">记录这一小步</text><text class="sheet-title">{{ data.goals.find(goal => goal.id === doneGoalId)?.title }}</text><text class="hero-note">确认已经完成了吗？记录会出现在今天和回顾里。</text><button class="sheet-primary" @tap="confirmDone">确认记下</button><button class="sheet-cancel" @tap="showDoneModal = false">先不记录</button></view></view>
  </view>
</template>

<style>
:root { --ink: #274d3a; --moss: #39715a; --sage: #e7f2e8; --cream: #f7f5ee; --clay: #b47a5b; --muted: #718477; --line: #dce7dd; }
page { background: var(--cream); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", sans-serif; }
button { padding: 0; border: 0; line-height: 1.4; background: transparent; }
button::after { border: 0; }
.app-shell { min-height: 100vh; background: radial-gradient(circle at 85% 0%, #fffdf8 0, #f7f5ee 40%, #f1f5ee 100%); }
.page-scroll { min-height: calc(100vh - 132rpx); padding-bottom: 500rpx; box-sizing: border-box; }
.page { padding: calc(68rpx + env(safe-area-inset-top, 0px)) 38rpx 20rpx; }
.topline { display: flex; justify-content: space-between; align-items: center; margin-bottom: 54rpx; }
.eyebrow, .section-kicker, .sheet-kicker { color: var(--muted); font-size: 22rpx; letter-spacing: 2rpx; }
.date-label { color: #91a095; font-size: 22rpx; }
.hero-block { display: flex; flex-direction: column; gap: 16rpx; margin-bottom: 42rpx; }
.hero-kicker { color: var(--clay); font-size: 25rpx; font-weight: 650; }
.hero-title { display: block; color: var(--ink); font-family: "Songti SC", "STSong", serif; font-size: 58rpx; font-weight: 600; letter-spacing: -1rpx; line-height: 1.18; }
.hero-note { color: #687d6e; font-size: 25rpx; line-height: 1.75; }
.daily-summary { display: flex; justify-content: space-between; align-items: flex-end; padding: 28rpx 30rpx; border: 1rpx solid #e2e9df; border-radius: 30rpx 30rpx 12rpx 30rpx; background: #fffdf8cc; box-shadow: 0 18rpx 45rpx #315a4309, inset 4rpx 0 0 #b47a5b5c; }
.summary-number { font-family: "Songti SC", serif; font-size: 64rpx; font-weight: 600; line-height: 1; }
.summary-label { margin-left: 12rpx; color: var(--muted); font-size: 22rpx; }
.summary-tail { display: flex; align-items: center; gap: 12rpx; color: #738579; font-size: 21rpx; }
.summary-dot { color: var(--clay); font-size: 30rpx; }
.section-heading { display: flex; justify-content: space-between; align-items: flex-end; margin: 58rpx 0 20rpx; }
.section-heading.compact { margin-top: 48rpx; }
.section-title { display: block; margin-top: 8rpx; font-family: "Songti SC", serif; font-size: 35rpx; font-weight: 600; }
.sort-hint { display: block; margin-top: 6rpx; color: #9aa99d; font-size: 18rpx; }
.text-action { color: var(--moss); font-size: 24rpx; }
.small-count { color: #8b9b90; font-size: 22rpx; }
.goal-list { display: flex; flex-direction: column; gap: 20rpx; }
.goal-card { position: relative; overflow: hidden; padding: 28rpx 28rpx 24rpx; border: 1rpx solid #dfe8df; border-radius: 30rpx 30rpx 16rpx 30rpx; background: #f7fbf3; box-shadow: 0 16rpx 36rpx #315a4308; animation: rise-in .35s ease both; transition: transform .2s ease, box-shadow .2s ease; }
.goal-card.dragging { transform: scale(.985); box-shadow: 0 22rpx 44rpx #315a4322; }
.goal-card.tone-1 { background: #fffaf0; border-color: #eadfca; }
.goal-card.tone-2 { background: #f5f0f8; border-color: #e3d8eb; }
.goal-card.tone-3 { background: #eef5f2; border-color: #d4e6df; }
.goal-card.tone-4 { background: #f8f1df; border-color: #eadbb6; }
.goal-card.tone-5 { background: #faf0ee; border-color: #ecd8d3; }
.goal-accent { position: absolute; inset: 0 auto 0 0; width: 8rpx; background: #6fa57f; }
.tone-1 .goal-accent { background: #caa071; }
.tone-2 .goal-accent { background: #9b86b7; }
.tone-3 .goal-accent { background: #7ba69c; }
.tone-4 .goal-accent { background: #d0af65; }
.tone-5 .goal-accent { background: #c9897d; }
.goal-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 18rpx; }
.goal-heading-copy { min-width: 0; flex: 1; }
.goal-head-actions { display: flex; align-items: center; gap: 10rpx; flex: none; }
.drag-handle { touch-action: none; user-select: none; display: inline-flex; align-items: center; justify-content: center; width: 48rpx; height: 54rpx; color: #88a391; font-size: 34rpx; line-height: 1; }
.goal-direction { display: block; color: #71917b; font-size: 20rpx; letter-spacing: 1rpx; }
.goal-title { display: block; margin-top: 8rpx; color: var(--ink); font-size: 34rpx; font-weight: 700; line-height: 1.35; }
.pin-mark { flex: none; color: var(--clay); font-size: 21rpx; }
.goal-last { display: block; margin-top: 16rpx; color: #718477; font-size: 22rpx; }
.goal-last-secondary { margin-top: 6rpx; color: #98a79b; font-size: 19rpx; }
.goal-actions { display: grid; grid-template-columns: minmax(240rpx, 360rpx) minmax(240rpx, 360rpx) auto; align-items: center; justify-content: space-between; gap: 18rpx; margin-top: 24rpx; }
.primary-action, .secondary-action, .quiet-action { display: flex; align-items: center; justify-content: center; min-height: 72rpx; margin: 0; padding: 0 18rpx; border-radius: 18rpx; font-size: 24rpx; font-weight: 650; line-height: 1.2; box-sizing: border-box; }
.primary-action { background: var(--moss); color: white; box-shadow: 0 10rpx 20rpx #39715a22; }
.calm-action { background: #5d866a; }
.secondary-action { color: var(--moss); border: 1rpx solid #c9ddcb; background: #ffffffa6; }
.quiet-action { margin-left: auto; color: #9b8070; font-size: 21rpx; }
.goal-actions .primary-action, .goal-actions .secondary-action { width: 100%; }
@media (max-width: 460px) {
  .goal-actions { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 10rpx; }
  .goal-actions .primary-action, .goal-actions .secondary-action { padding-left: 10rpx; padding-right: 10rpx; font-size: 22rpx; }
}
.manage-trigger { display: flex; align-items: center; justify-content: center; min-height: 54rpx; margin: 0; padding: 0 14rpx; border: 1rpx solid #c9ddcb; border-radius: 14rpx; background: #ffffffaa; color: var(--moss); font-size: 20rpx; line-height: 1.2; }
.empty-card { display: flex; flex-direction: column; gap: 22rpx; align-items: center; padding: 54rpx 30rpx; border: 1rpx dashed #c9d8ca; border-radius: 28rpx; background: #fffdf8b5; color: var(--muted); font-size: 27rpx; }
.recent-section { margin-top: 12rpx; }
.mini-event { display: flex; gap: 20rpx; padding: 22rpx 4rpx; border-bottom: 1rpx solid #e4ebe2; }
.event-bullet { flex: none; width: 15rpx; height: 15rpx; margin-top: 9rpx; border: 5rpx solid #f7f5ee; border-radius: 50%; background: var(--moss); box-shadow: 0 0 0 2rpx #aec2b1; }
.event-title, .event-meta { display: block; }
.event-title { font-size: 25rpx; font-weight: 650; }
.event-meta { margin-top: 5rpx; color: var(--muted); font-size: 21rpx; }
.review-intro, .settings-hero { display: flex; flex-direction: column; gap: 14rpx; margin-bottom: 36rpx; }
.heatmap-card { margin-bottom: 26rpx; padding: 24rpx 26rpx 26rpx; border: 1rpx solid #dce7dd; border-radius: 26rpx; background: #fffdf8c7; }
.heatmap-head, .heatmap-nav { display: flex; align-items: center; justify-content: space-between; }
.heatmap-head text:first-child { color: var(--ink); font-family: "Songti SC", serif; font-size: 31rpx; font-weight: 600; }
.heatmap-head text:last-child { color: var(--muted); font-size: 21rpx; }
.heatmap-nav { gap: 8rpx; margin: 18rpx 0; color: var(--muted); font-size: 19rpx; }
.heatmap-nav text { flex: 1; text-align: center; }
.heatmap-nav button { flex: none; padding: 8rpx 6rpx; color: var(--moss); font-size: 19rpx; }
.heatmap-nav button[disabled] { color: #b5c0b7; }
.heatmap-weekdays, .heatmap-week { display: flex; gap: 6rpx; }
.heatmap-weekdays { margin-bottom: 6rpx; }
.heatmap-weekdays text, .heatmap-cell { flex: 1; text-align: center; }
.heatmap-weekdays text { color: #829388; font-size: 18rpx; }
.heatmap-week { margin-bottom: 6rpx; }
.heatmap-cell { height: 64rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 13rpx; background: #edf2ec; color: #8b9b90; font-size: 18rpx; line-height: 1.15; }
.heatmap-day { font-size: 18rpx; }
.heatmap-count { margin-top: 4rpx; font-size: 21rpx; font-weight: 700; }
.heatmap-cell.level-1 { background: #d6e8d7; color: #5a7b62; }
.heatmap-cell.level-2 { background: #a8cbaa; color: #315a43; }
.heatmap-cell.level-3, .heatmap-cell.level-4 { background: #39715a; color: #fff; }
.heatmap-cell.today { box-shadow: inset 0 0 0 3rpx #b47a5b; }
.heatmap-cell.future { opacity: .42; }
.range-switch { display: flex; gap: 10rpx; padding: 8rpx; border: 1rpx solid #dce7dd; border-radius: 22rpx; background: #e9f0e7; }
.range-switch button { display: flex; align-items: center; justify-content: center; flex: 1; min-height: 70rpx; margin: 0; padding: 0; border-radius: 16rpx; color: var(--muted); font-size: 23rpx; line-height: 1.2; }
.range-switch button.active { background: #fffdf8; color: var(--moss); font-weight: 700; box-shadow: 0 8rpx 18rpx #315a430c; }
.goal-filter { display: flex; white-space: nowrap; margin-top: 18rpx; }
.goal-filter button { display: inline-block; margin-right: 28rpx; padding: 12rpx 18rpx; border: 1rpx solid #d9e5d8; border-radius: 999rpx; color: var(--muted); font-size: 21rpx; }
.goal-filter button.active { border-color: #a9c9b0; background: #edf5eb; color: var(--moss); font-weight: 650; }
.timeline { margin-top: 38rpx; }
.month-group { margin-top: 30rpx; }
.month-group.collapsed { margin-top: 18rpx; }
.month-heading { display: flex; justify-content: space-between; align-items: center; width: 100%; min-height: 86rpx; padding: 0 24rpx; border: 1rpx solid #d6e3d5; border-radius: 24rpx; background: #fffdf8b8; color: var(--ink); text-align: left; transition: .2s ease; }
.month-heading.open { border-color: #a9c9b0; background: #f4f8f0; box-shadow: inset 3rpx 0 0 #b47a5b66; }
.month-heading > text:first-child { font-family: "Songti SC", serif; font-size: 31rpx; font-weight: 600; }
.month-heading > view { display: flex; align-items: center; gap: 12rpx; }
.month-count { color: #7b8e80; font-size: 21rpx; }
.chevron { color: #5e7c68; font-size: 28rpx; transform: rotate(-90deg); transition: transform .2s ease; }
.month-heading.open .chevron { transform: rotate(0); }
.month-records { margin: 20rpx 0 0 12rpx; padding-left: 38rpx; border-left: 2rpx solid #cddccf; animation: rise-in .22s ease both; }
.timeline-record { position: relative; display: flex; gap: 22rpx; padding: 22rpx 0; }
.timeline-record::before { content: ''; position: absolute; left: -47rpx; top: 32rpx; width: 14rpx; height: 14rpx; border: 4rpx solid var(--cream); border-radius: 50%; background: var(--moss); box-shadow: 0 0 0 2rpx #aec2b1; }
.record-time { flex: none; width: 112rpx; color: #385d48; font-size: 22rpx; line-height: 1.45; }
.record-time text { display: block; }
.record-time text:last-child { color: #8a9a8e; font-size: 19rpx; }
.record-body { flex: 1; padding-bottom: 20rpx; border-bottom: 1rpx solid #e2e8df; }
.timeline-record:last-child .record-body { border-bottom: 0; }
.record-goal, .record-result, .record-note { display: block; }
.record-goal { font-size: 27rpx; font-weight: 700; }
.record-result { margin-top: 5rpx; color: #637b6b; font-size: 22rpx; }
.record-note { margin-top: 12rpx; padding: 12rpx 16rpx; border-radius: 16rpx; background: #edf4eb; color: #496b57; font-size: 22rpx; line-height: 1.55; }
.settings-list { overflow: hidden; border: 1rpx solid #dfe8df; border-radius: 26rpx; background: #fffdf8b8; }
.settings-row { display: flex; justify-content: space-between; align-items: center; width: 100%; min-height: 112rpx; padding: 0 28rpx; border-bottom: 1rpx solid #e2e9df; text-align: left; }
.settings-row:last-child { border-bottom: 0; }
.settings-row.static { background: transparent; }
.settings-row > view { min-width: 0; flex: 1; }
.settings-title, .settings-note { display: block; }
.settings-title { color: var(--ink); font-size: 27rpx; font-weight: 650; }
.settings-note { margin-top: 6rpx; color: var(--muted); font-size: 21rpx; }
.row-arrow { color: var(--moss); font-size: 32rpx; }
.row-value { display: block; flex: 0 0 auto; width: auto; min-width: 190rpx; max-width: none; overflow: visible; padding-left: 8rpx; padding-right: 16rpx; margin-right: 36rpx; box-sizing: border-box; color: var(--muted); font-size: 21rpx; line-height: 1.6; text-align: right; white-space: nowrap; letter-spacing: 0; }
.about-note { margin-top: 34rpx; padding: 24rpx 26rpx; border-left: 6rpx solid var(--clay); background: #fffaf0aa; color: #687d6e; font-size: 22rpx; line-height: 1.7; }
.about-title { display: block; margin-bottom: 8rpx; color: var(--ink); font-family: "Songti SC", serif; font-size: 29rpx; font-weight: 600; }
.plan-list { margin-top: 34rpx; overflow: hidden; border: 1rpx solid #dfe8df; border-radius: 26rpx; background: #fffdf8b8; }
.plan-list-title { padding: 22rpx 28rpx 14rpx; color: var(--ink); font-family: "Songti SC", serif; font-size: 29rpx; font-weight: 600; }
.plan-row { display: flex; align-items: center; gap: 8rpx; min-height: 92rpx; padding: 0 18rpx 0 28rpx; border-top: 1rpx solid #e2e9df; }
.plan-copy { min-width: 0; flex: 1; }
.plan-copy text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.plan-copy text:first-child { color: var(--ink); font-size: 24rpx; font-weight: 650; }
.plan-copy text:last-child { margin-top: 4rpx; color: var(--muted); font-size: 19rpx; }
.plan-mini { flex: none; padding: 10rpx 8rpx; color: var(--moss); font-size: 19rpx; }
.clear-data { width: 100%; margin-top: 20rpx; padding: 22rpx; border: 1rpx solid #e8cfc5; border-radius: 18rpx; background: #fff7f3; color: #ae6b57; font-size: 23rpx; }
.bottom-nav { position: fixed; z-index: 10; right: 24rpx; bottom: 24rpx; left: 24rpx; display: flex; justify-content: space-around; padding: 14rpx 10rpx; padding-bottom: calc(14rpx + env(safe-area-inset-bottom)); border: 1rpx solid #dfe8df; border-radius: 32rpx; background: #fffdf8e8; box-shadow: 0 18rpx 45rpx #315a4318; backdrop-filter: blur(18px); }
.bottom-nav button { display: flex; flex-direction: column; align-items: center; gap: 4rpx; flex: 1; min-width: 0; color: #91a095; font-size: 20rpx; }
.bottom-nav button.selected { color: var(--moss); font-weight: 700; border-radius: 18rpx; background: #edf4ebd9; box-shadow: inset 0 1rpx 0 #ffffffb8; }
.nav-icon { font-size: 30rpx; line-height: 1; }
.floating-calm { position: fixed; z-index: 8; right: 42rpx; bottom: calc(150rpx + env(safe-area-inset-bottom)); width: 140rpx; height: 140rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0; border: 1rpx solid #b8d3bee6; border-radius: 50%; background: linear-gradient(145deg, #fffefae6, #e5f2e6d1); color: #2c6d52; font-size: 24rpx; font-weight: 750; line-height: 1.2; box-shadow: 0 12rpx 32rpx #244c3526, inset 0 1rpx 0 #fffffff0; backdrop-filter: blur(14px) saturate(130%); }
.floating-calm::before { content: ''; position: absolute; inset: -14rpx; border: 1rpx solid #8ab99a54; border-radius: 50%; animation: calm-halo 3.6s ease-in-out infinite; }
.floating-calm text:first-child { font-size: 25rpx; font-weight: 750; }
.floating-calm text:last-child { margin-top: 6rpx; color: #788d7e; font-size: 18rpx; font-weight: 500; }
.modal-mask { position: fixed; z-index: 20; inset: 0; display: flex; align-items: flex-end; background: #20352b66; }
.sheet { width: 100%; max-height: 88vh; overflow-y: auto; padding: 24rpx 38rpx calc(42rpx + env(safe-area-inset-bottom)); border-radius: 34rpx 34rpx 0 0; background: #fffdf8; box-sizing: border-box; animation: sheet-up .25s ease both; }
.sheet-handle { width: 78rpx; height: 8rpx; margin: 0 auto 30rpx; border-radius: 999rpx; background: #d7e1d5; }
.sheet-kicker { display: block; margin-bottom: 12rpx; color: var(--clay); }
.sheet-title { display: block; margin-bottom: 24rpx; color: var(--ink); font-family: "Songti SC", serif; font-size: 38rpx; font-weight: 600; }
.sheet-input, .thought-input { width: 100%; box-sizing: border-box; border: 1rpx solid #d5e2d4; border-radius: 18rpx; background: #f7faf5; color: var(--ink); font-size: 27rpx; }
.sheet-input { height: 82rpx; padding: 0 22rpx; }
.direction-picker { display: flex; gap: 12rpx; margin: 20rpx 0 26rpx; }
.direction-picker button { flex: 1; padding: 18rpx; border: 1rpx solid #d9e5d8; border-radius: 18rpx; color: var(--moss); font-size: 25rpx; text-align: left; }
.direction-picker button.active { border-color: #9fc8ad; background: var(--sage); }
.direction-picker text { display: block; margin-top: 8rpx; color: var(--muted); font-size: 19rpx; font-weight: 400; }
.sheet-primary { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 78rpx; margin: 0; padding: 0 24rpx; border-radius: 20rpx; background: var(--moss); color: white; font-size: 27rpx; font-weight: 700; line-height: 1.2; box-sizing: border-box; }
.pin-action, .danger-action { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 70rpx; margin: 14rpx 0 0; padding: 0 20rpx; border-radius: 18rpx; font-size: 23rpx; line-height: 1.2; box-sizing: border-box; }
.pin-action { border: 1rpx solid #d6e5d6; background: #f2f8f1; color: var(--moss); }
.danger-action { border: 1rpx solid #e8cfc5; background: #fff7f3; color: #ae6b57; }
.sheet-cancel { display: block; margin: 20rpx auto 0; color: var(--muted); font-size: 23rpx; }
.thought-input { min-height: 300rpx; padding: 20rpx; line-height: 1.65; }
.thought-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 18rpx; color: #8a9a8e; font-size: 20rpx; }
.thought-footer .sheet-primary { width: 260rpx; }
.calm-sheet { text-align: center; }
.calm-choice-list { margin-top: 26rpx; text-align: left; }
.calm-choice-list > button:not(.sheet-cancel) { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 76rpx; margin-top: 12rpx; padding: 0 22rpx; border: 1rpx solid #dce9dc; border-radius: 18rpx; background: #fff; color: #3f644f; font-size: 25rpx; }
.calm-choice-list > button:not(.sheet-cancel) text { color: #7b9a89; font-size: 34rpx; }
.calm-goals { display: flex; gap: 12rpx; margin: 24rpx 0; overflow-x: auto; }
.calm-goals button { flex: 1; min-width: 220rpx; padding: 18rpx; border: 1rpx solid #d9e5d8; border-radius: 18rpx; color: var(--moss); font-size: 23rpx; }
.calm-goals button.active { border-color: #9fc8ad; background: var(--sage); font-weight: 650; }
.calm-clock { margin: 12rpx 0 24rpx; color: var(--ink); font-family: "Songti SC", serif; font-size: 76rpx; letter-spacing: 4rpx; }
.calm-stage { position: relative; overflow: hidden; margin: 24rpx 0 18rpx; padding: 54rpx 24rpx 22rpx; border: 1rpx solid #dce9dc; border-radius: 26rpx; background: radial-gradient(circle at 50% 18%, #fffdf9 0, transparent 50%), linear-gradient(160deg, #f7f2e9, #e8f1e8); }
.calm-orb { width: 150rpx; height: 150rpx; margin: 0 auto 22rpx; border: 1rpx solid #afd2ba; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fffefb, #cfe5d3 68%, #a9cbb0); box-shadow: 0 0 0 18rpx #ffffff45, 0 18rpx 38rpx #3e745327; animation: calm-breathe 3.6s ease-in-out infinite; }
.calm-prompt { display: block; min-height: 48rpx; color: #496452; font-size: 25rpx; line-height: 1.6; }
.calm-progress { display: flex; justify-content: center; gap: 10rpx; margin-top: 22rpx; }
.calm-progress text { width: 12rpx; height: 12rpx; border-radius: 50%; background: #cbdccf; transition: transform .2s ease, background .2s ease; }
.calm-progress text.active { background: #5f8c70; transform: scale(1.2); }
.calm-goal-label { display: block; margin-top: 20rpx; color: #6c8072; font-size: 21rpx; }
.calm-ready-note { display: block; margin: 12rpx 0 18rpx; color: #607565; font-size: 22rpx; line-height: 1.6; }
.calm-actions { display: flex; flex-direction: column; gap: 12rpx; margin-top: 18rpx; }
.calm-actions .sheet-primary, .calm-actions .secondary-action { width: 100%; min-height: 76rpx; }
.help-panel { margin-top: 20rpx; padding: 24rpx; border: 1rpx solid #e3ece2; border-radius: 22rpx; background: #fbfcf8; text-align: left; }
.small-sheet-title { margin-top: 6rpx; font-size: 32rpx; }
.help-options { display: flex; flex-wrap: wrap; gap: 10rpx; margin: 18rpx 0; }
.help-options button { padding: 14rpx 18rpx; border: 1rpx solid #dce9dc; border-radius: 999rpx; background: #fff; color: #3f644f; font-size: 22rpx; }
.help-options button.active { border-color: #9acbac; background: #eaf5ed; color: #2c654b; font-weight: 650; }
.help-panel .sheet-primary { margin-top: 16rpx; }
.calm-bottom-actions { display: flex; justify-content: center; gap: 34rpx; margin-top: 18rpx; }
.calm-bottom-actions button { color: #826f60; font-size: 22rpx; }
.done-sheet { text-align: center; }
@keyframes calm-breathe { 0%, 100% { transform: scale(.88); opacity: .72; } 50% { transform: scale(1.06); opacity: 1; } }
.calm-actions button { display: flex; align-items: center; justify-content: center; flex: 1; min-height: 70rpx; margin: 0; padding: 0 18rpx; border: 1rpx solid #d9e5d8; border-radius: 18rpx; color: var(--moss); font-size: 23rpx; line-height: 1.2; }
.calm-actions .sheet-primary { border: 0; background: var(--moss); color: #fff; box-shadow: 0 10rpx 20rpx #39715a22; }
.calm-actions .secondary-action { background: #fff; color: var(--moss); }
@keyframes rise-in { from { opacity: 0; transform: translateY(12rpx); } to { opacity: 1; transform: translateY(0); } }
@keyframes sheet-up { from { opacity: 0; transform: translateY(40rpx); } to { opacity: 1; transform: translateY(0); } }
@keyframes calm-halo { 0%, 100% { transform: scale(.92); opacity: .35; } 50% { transform: scale(1.08); opacity: .8; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
.practice-card { margin-top: 34rpx; padding: 54rpx 34rpx 34rpx; border: 1rpx solid #dbe7dc; border-radius: 32rpx; background: linear-gradient(155deg, #fffdf8, #edf5ec); text-align: center; box-shadow: 0 18rpx 42rpx #315a4312; }
.practice-orb { width: 220rpx; height: 220rpx; margin: 0 auto 30rpx; border: 1rpx solid #b9d6c0; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fffefb, #cfe5d3 68%, #a9cbb0); box-shadow: 0 0 0 20rpx #ffffff70, 0 22rpx 48rpx #3e74532b; }
.practice-orb.running { animation: calm-breathe 3.6s ease-in-out infinite; }
.practice-phase { display: block; color: #496452; font-size: 30rpx; font-weight: 650; }
.practice-clock { display: block; margin-top: 14rpx; color: var(--ink); font-family: "Songti SC", serif; font-size: 72rpx; letter-spacing: 4rpx; }
.practice-note { display: block; margin: 14rpx 18rpx 28rpx; color: var(--muted); font-size: 22rpx; line-height: 1.6; }
.practice-actions { display: flex; gap: 14rpx; }
.practice-actions button { flex: 1; min-height: 76rpx; display: flex; align-items: center; justify-content: center; border-radius: 18rpx; font-size: 24rpx; }
.practice-actions .secondary-action { border: 1rpx solid #d6e5d6; background: #fff; color: var(--moss); }
.practice-tip { margin-top: 24rpx; padding: 22rpx 24rpx; border-left: 6rpx solid #b7cfb7; border-radius: 0 18rpx 18rpx 0; background: #f4f8f1; color: #617465; font-size: 22rpx; line-height: 1.6; }
.practice-tip .section-kicker { display: block; margin-bottom: 8rpx; }
.tone-picker { margin: 22rpx 0 26rpx; }
.picker-label { display: block; margin-bottom: 12rpx; color: var(--muted); font-size: 22rpx; }
.tone-options { display: flex; gap: 16rpx; }
.tone-swatch { width: 56rpx; height: 56rpx; display: flex; align-items: center; justify-content: center; border: 4rpx solid transparent; border-radius: 50%; color: #fff; font-size: 27rpx; box-sizing: border-box; }
.tone-swatch.selected { border-color: #315a43; box-shadow: 0 0 0 4rpx #fff, 0 0 0 6rpx #315a43; }
.swatch-0 { background: #8fb99a; }.swatch-1 { background: #caa071; }.swatch-2 { background: #9b86b7; }.swatch-3 { background: #7ba69c; }.swatch-4 { background: #d0af65; }.swatch-5 { background: #c9897d; }
.switch-stage { min-height: 330rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22rpx; border: 1rpx solid #dbe6dc; border-radius: 26rpx; background: #f7faf5; }
.switch-rule { color: var(--moss); font-size: 25rpx; font-weight: 700; }
.switch-stimulus { width: 150rpx; height: 150rpx; box-sizing: border-box; border: 12rpx solid #dd6e63; background: #dd6e63; }
.switch-stimulus.blue { border-color: #789bc8; background: #789bc8; }
.switch-stimulus.circle { border-radius: 50%; }
.switch-stimulus.square { border-radius: 18rpx; }
.practice-tool-tabs { display: flex; gap: 10rpx; margin-top: 28rpx; padding: 8rpx; border: 1rpx solid #dbe7dc; border-radius: 22rpx; background: #eef5ed; }
.practice-tool-tabs button { flex: 1; min-height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 16rpx; color: #789080; font-size: 22rpx; }
.practice-tool-tabs button.active { background: #fffdf8; color: var(--moss); font-weight: 700; box-shadow: 0 7rpx 16rpx #315a4312; }
.training-card { margin-top: 28rpx; padding: 28rpx; border: 1rpx solid #dbe7dc; border-radius: 30rpx 30rpx 16rpx 30rpx; background: linear-gradient(155deg, #fffdf8, #f1f7ef); box-shadow: 0 18rpx 42rpx #315a4310; }
.training-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18rpx; }
.training-title { display: block; margin-top: 9rpx; color: var(--ink); font-family: "Songti SC", serif; font-size: 30rpx; font-weight: 600; line-height: 1.3; }
.training-count { flex: none; color: #789080; font-size: 21rpx; }
.training-start { padding: 56rpx 8rpx 18rpx; text-align: center; }
.training-note { display: block; color: var(--muted); font-size: 23rpx; line-height: 1.65; }
.training-result { display: block; margin-bottom: 14rpx; color: var(--moss); font-family: "Songti SC", serif; font-size: 34rpx; font-weight: 650; }
.difficulty-row { display: flex; flex-wrap: wrap; gap: 12rpx; margin: 28rpx 0 18rpx; }
.difficulty-row button { display: flex; align-items: center; justify-content: center; flex: 1 1 calc(20% - 12rpx); min-height: 64rpx; padding: 0 12rpx; line-height: 1.2; border: 1rpx solid #d8e6d8; border-radius: 16rpx; background: #fff; color: #6f8475; font-size: 22rpx; }
.difficulty-row button.active { border-color: #9ec5a7; background: #eaf4e9; color: var(--moss); font-weight: 700; }
.full-action { width: 100%; min-height: 76rpx; display: flex; align-items: center; justify-content: center; margin-top: 20rpx; }
.training-play { padding: 46rpx 0 20rpx; text-align: center; }
.stimulus-letter { display: block; color: var(--ink); font-family: Arial, sans-serif; font-size: 108rpx; font-weight: 700; letter-spacing: 5rpx; }
.stroop-word { display: block; margin: 18rpx 0 46rpx; font-size: 82rpx; font-weight: 750; }
.training-feedback { display: block; min-height: 34rpx; color: #829187; font-size: 23rpx; }
.training-feedback.correct { color: #4c8a63; font-weight: 700; }
.training-feedback.wrong { color: #b36f5b; font-weight: 700; }
.training-feedback.miss { color: #9a8b62; font-weight: 700; }
.answer-row { display: flex; gap: 14rpx; margin-top: 26rpx; }
.answer-row button { flex: 1; min-height: 78rpx; display: flex; align-items: center; justify-content: center; border: 1rpx solid #d5e4d6; border-radius: 18rpx; background: #fff; color: var(--moss); font-size: 26rpx; font-weight: 650; }
.answer-row button:active { transform: scale(.98); background: #edf5ed; }
.color-answer button { color: #365846; font-size: 26rpx; }
.memory-wait { min-height: 78rpx; display: flex; align-items: center; justify-content: center; margin-top: 26rpx; border: 1rpx dashed #cbdccb; border-radius: 18rpx; color: #86968b; font-size: 22rpx; }
.insight-card { margin-bottom: 26rpx; padding: 24rpx 26rpx; border: 1rpx solid #dce7dd; border-radius: 26rpx; background: linear-gradient(145deg, #f8fbf4, #fffaf0); box-shadow: 0 12rpx 30rpx #315a430b; }
.insight-head { display: flex; align-items: center; justify-content: space-between; color: #89988e; font-size: 19rpx; }
.insight-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12rpx; margin-top: 20rpx; }
.insight-grid > view { padding: 20rpx; border-radius: 18rpx; background: #ffffffa8; }
.insight-value, .insight-label { display: block; }
.insight-value { color: var(--ink); font-family: "Songti SC", serif; font-size: 40rpx; font-weight: 650; }
.insight-label { margin-top: 5rpx; color: var(--muted); font-size: 20rpx; }
.insight-top { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; margin-top: 14rpx; padding: 18rpx 20rpx; border-radius: 18rpx; background: #edf4eb; color: #6f8275; font-size: 21rpx; }
.insight-top > text:last-child { min-width: 0; overflow: hidden; color: var(--moss); font-weight: 650; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.stroop-modes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; margin: 26rpx 0 8rpx; }
.stroop-modes button { min-height: 92rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5rpx; padding: 10rpx; border: 1rpx solid #d8e4d8; border-radius: 16rpx; background: #fff; color: #63786a; }
.stroop-modes button text { font-size: 21rpx; font-weight: 650; }
.stroop-modes .mode-note { color: #91a095; font-size: 17rpx; }
.stroop-modes button.active { border-color: #8eb59a; background: #eaf3e9; color: var(--moss); box-shadow: inset 0 0 0 1rpx #c9ddcd; }
.stroop-stage { margin-top: 20rpx; padding: 50rpx 20rpx 32rpx; border-radius: 24rpx; background: #26302c; box-shadow: inset 0 1rpx 0 #ffffff12, 0 16rpx 36rpx #1d2c2424; }
.stroop-stage .stroop-word { margin: 0 0 38rpx; text-shadow: 0 2rpx 8rpx #00000038; }
.stroop-stage .training-feedback { color: #dce5df; }
.stroop-stage .training-feedback.correct { color: #9ed3ae; }
.stroop-stage .training-feedback.wrong { color: #efad9d; }
.color-answer { flex-wrap: wrap; }
.color-answer button { flex: 1 1 calc(33.333% - 14rpx); min-width: 150rpx; border-color: #37443e; background: #303b36; color: #f2f5f2; box-shadow: inset 0 1rpx 0 #ffffff14; }
.color-answer button:active { background: #435149; color: #fff; }
.insight-detail { display: flex; flex-direction: column; gap: 10rpx; margin-top: 14rpx; }
.insight-detail > view { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; padding: 18rpx 20rpx; border-radius: 18rpx; background: #edf4eb; color: #6f8275; font-size: 21rpx; }
.insight-detail > view > text:last-child { min-width: 0; overflow: hidden; color: var(--moss); font-weight: 650; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.result-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12rpx; margin-bottom: 26rpx; text-align: left; }
.result-grid > view { padding: 18rpx; border: 1rpx solid #dde8dd; border-radius: 17rpx; background: #fff; }
.result-grid > view > text:first-child { display: block; color: var(--ink); font-family: "Songti SC", serif; font-size: 31rpx; font-weight: 650; }
.result-label { display: block; margin-top: 5rpx; color: var(--muted); font-size: 18rpx; }
.live-status { display: flex; align-items: center; gap: 14rpx; margin-bottom: 18rpx; color: #687d6f; font-size: 20rpx; }
.live-status text:nth-child(2) { flex: 1; text-align: center; }
.live-status button { flex: none; min-width: 88rpx; min-height: 52rpx; display: flex; align-items: center; justify-content: center; border: 1rpx solid #d7e4d7; border-radius: 14rpx; background: #fff; color: var(--moss); font-size: 19rpx; }
.paused-panel { min-height: 310rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12rpx; border: 1rpx dashed #c9d9ca; border-radius: 24rpx; background: #f4f8f2; color: var(--muted); }
.paused-panel text:first-child { color: var(--ink); font-family: "Songti SC", serif; font-size: 34rpx; font-weight: 600; }
.answer-row button[disabled] { opacity: .45; }
.page-scroll.training-locked { height: 100vh; overflow: hidden; }
</style>









































