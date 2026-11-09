import type { AssistantStatus, ChatMessage, ConversationBranch, RuntimeOptions, UpdateRuntimeRequest } from "@simon/contracts";
import type { StoredRun } from "./store.js";

export interface AssistantRuntime {
  readonly name: string;
  getStatus(): Promise<AssistantStatus>;
  execute(stored: StoredRun, message: string): Promise<void>;
  regenerate(stored: StoredRun): Promise<void>;
  editAndResend(stored: StoredRun, userMessageIndex: number, message: string): Promise<void>;
  getBranches(conversationId: string): Promise<ConversationBranch[]>;
  selectBranch(conversationId: string, branchId: string): Promise<void>;
  getMessages?(conversationId: string): Promise<ChatMessage[]>;
  getRuntimeOptions?(conversationId: string): Promise<RuntimeOptions>;
  updateRuntime?(conversationId: string, update: UpdateRuntimeRequest): Promise<RuntimeOptions>;
  abort?(conversationId: string): Promise<void>;
  disposeConversation?(conversationId: string): Promise<void> | void;
  dispose?(): Promise<void> | void;
}
