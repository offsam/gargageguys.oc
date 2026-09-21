export { CSLB_TOPICS, getCslbTopic, type CslbTopic, type CslbTopicId, type CslbTerm } from "./topics";
export {
  CSLB_QUESTIONS,
  getCslbQuestion,
  questionsForTopic,
  type CslbQuestion,
  type CslbOption,
} from "./questions";
export { addDays, applyAnswer, isDue, todayKey, type SrsBox, type SrsCard } from "./srs";
export {
  CSLB_SRS_STORAGE_KEY,
  answeredCountForTopic,
  dueQuestionIds,
  emptyCslbStore,
  loadCslbStore,
  markLessonRead,
  parseCslbStore,
  recordAnswer,
  saveCslbStore,
  type CslbSrsStore,
} from "./srs-store";

export function cslbAudioUrl(questionId: string): string {
  return `/audio/cslb/${encodeURIComponent(questionId)}.mp3`;
}
