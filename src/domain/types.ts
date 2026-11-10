export type Direction = 'increase' | 'decrease'
export type Result = 'done' | 'paused' | 'alternative' | 'original' | 'reflection'

export interface Goal {
  id: string
  title: string
  direction: Direction
  replacementAction: string
  replacementSeconds: number
  futureNote: string
  status: 'active' | 'paused'
  sortOrder: number
  pinned: boolean
  tone?: string
  createdAt: number
  updatedAt: number
}

export interface HabitEvent {
  id: string
  goalId: string
  goalTitle: string
  result: Result
  occurredAt: number
  note?: string
  helpedBy?: string
}

export interface LocalData {
  schemaVersion: 1
  goals: Goal[]
  events: HabitEvent[]
}



