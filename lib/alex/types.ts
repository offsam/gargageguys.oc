export type AlexChatRole = "user" | "assistant";

export type AlexQuickReply = { label: string; value: string };

export type AlexChatMessage = {
  role: AlexChatRole;
  content: string;
};

export type AlexCollectedContact = {
  name?: string;
  phone?: string;
  zip?: string;
  message?: string;
  schedulingMode?: "asap" | "scheduled" | "callback" | null;
  preferredScheduleAt?: string | null;
  schedulingPreference?: "today" | "tomorrow" | "specific" | "callback" | null;
  wantsCallback?: boolean;
};

export type AlexModelTurn = {
  reply: string;
  quickReplies: AlexQuickReply[];
  collected: AlexCollectedContact;
  readyToSubmit: boolean;
};

export type AlexTurnResult = {
  reply: string;
  quickReplies?: AlexQuickReply[];
  collected: AlexCollectedContact;
  leadSubmitted: boolean;
  inboxItemId?: string;
  leadCreated?: boolean;
};
