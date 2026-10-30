export type { DrillRetry, DrillSpec, DrillState, DrillSummary, LineResult } from './drill/types';
export { advanceDrill, createDrill } from './drill/drill';
export { lineResultOf, summarizeDrill } from './drill/result';
export {
  advanceExam,
  createExam,
  parseExamLine,
  partialLineResult,
  summarizeExam,
  type ExamLine,
  type ExamMode,
  type ExamSource,
  type ExamState,
  type ExamSummary,
} from './exam/exam';
export type {
  FlickDirection,
  GuideClaim,
  GuideKey,
  GuideLayer,
  GuideLayerId,
  GuideModifier,
  InputStep,
  KeyboardGuide,
} from './guide/types';
export { findKeyStep, guideClaims } from './guide/claims';
export { explainChar, explainText, lookupChar, type TextPart } from './guide/explain';
export { HELP_POLICY, helpIndex, missCounts, type HelpPolicy } from './help/help';
export type {
  CharStatus,
  InputError,
  InputErrorCause,
  InputSessionOptions,
  InputSessionState,
  InputSnapshot,
  JudgeMode,
  PendingStep,
} from './input/types';
export {
  charStatuses,
  createInputSession,
  pendingStep,
  reduceInputSession,
  replayInputSession,
} from './input/session';
export { classifyMistake, type MistakeKind } from './kana/classify';
export { KANA_KEY_ROWS, danOf, keyRowOf, sameKeyRow, type Dan } from './kana/rows';
export { isKana, toHiragana, toKatakana } from './kana/script';
export { tokenizeKana } from './kana/tokenize';
export { sameVariantFamily, variantBase } from './kana/variants';
export { addDays, dayKey, recentDays, streakOf, type Streak } from './progress/streak';
export { frontierLevel, unlockedLevels } from './progress/unlock';
export type { AttemptFlag, AttemptRecord, SessionRecord, TrainingRepo } from './record/types';
export { attemptRecordOf, type AttemptMeta } from './record/attempt';
export { createMemoryRepo } from './record/memoryRepo';
export { ulid } from './record/ulid';
export {
  confusions,
  SKILL_ORDER,
  skillsOf,
  skillStats,
  slowUnits,
  STATS_MIN_SAMPLES,
  weakUnits,
  type SkillId,
  type SkillStat,
  type TopicSkill,
  type WeakUnit,
} from './stats/skills';
export { normalizeBase, normalizeForCompare } from './text/normalize';
export { parseRuby, rubyReading, rubySurface, type RubySpan, type RubyText } from './text/ruby';
