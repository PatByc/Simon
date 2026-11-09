import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type { AssistantStatus, Conversation, ConversationBranch, ConversationSearchResult, KnowledgeSource, Proposal, RuntimeOptions, StreamEvent, UsageStatus } from "@simon/contracts";
import {
  abortConversation,
  createConversation,
  createDemoProposal,
  createRun,
  decideProposal,
  deleteAllConversations,
  deleteConversation,
  editAndResendRun,
  getAssistantStatus,
  getConversationBranches,
  getConversationMessages,
  getRuntimeOptions,
  getUsageStatus,
  listConversations,
  regenerateRun,
  searchConversations,
  searchSyntheticKnowledge,
  selectConversationBranch,
  updateConversation,
  updateRuntime,
  watchRun,
  type RunConnectionState,
} from "./api.js";
const SafeMarkdown = lazy(() =>
  import("./SafeMarkdown.js").then((module) => ({ default: module.SafeMarkdown })),
);
import { useAssistantUi } from "./store.js";

interface ActivityItem {
  id: string;
  label: string;
  detail?: string;
  status: "running" | "completed" | "failed" | "aborted";
}

interface ChatEntry {
  id: string;
  question: string;
  answer: string;
  activity: string;
  activities: ActivityItem[];
  status: "running" | "completed" | "failed";
}

function formatReset(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.max(1, Math.ceil((seconds % 3_600) / 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function transcriptToEntries(messages: Awaited<ReturnType<typeof getConversationMessages>>): ChatEntry[] {
  const restored: ChatEntry[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      restored.push({
        id: message.messageId,
        question: message.text,
        answer: "",
        activity: "Completed",
        activities: [{ id: `${message.messageId}-restored`, label: "Restored from Pi session", status: "completed" }],
        status: "completed",
      });
    } else {
      const entry = restored.at(-1);
      if (entry) entry.answer = message.text;
    }
  }
  return restored;
}

type IconName = "new" | "history" | "settings" | "pin" | "close" | "plus" | "shield" | "zap" | "send" | "stop" | "copy" | "check" | "retry" | "edit";

function ToolbarIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    new: <><path d="M12 5v14M5 12h14" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3h4v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1h.1v4h-.09a1.7 1.7 0 0 0-1.51 1Z" /></>,
    pin: <><path d="m14 4 6 6-3 1-4 4-1 5-2-2-4-4-2-2 5-1 4-4 1-3Z" /><path d="m5 19 4-4" /></>,
    close: <><path d="M6 6l12 12M18 6 6 18" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
    zap: <><path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" /></>,
    send: <><path d="M12 19V5M6 11l6-6 6 6" /></>,
    stop: <><rect x="7" y="7" width="10" height="10" rx="1" /></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    retry: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>,
    edit: <><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function AskDrawer({ standalone = false }: { standalone?: boolean }) {
  const { isOpen, isPinned, approvalMode, close, togglePinned, setApprovalMode } = useAssistantUi();
  const visible = standalone || isOpen;
  const pinned = standalone || isPinned;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [message, setMessage] = useState(() => localStorage.getItem("simon-draft:new") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [coverageNote, setCoverageNote] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [runtimeOptions, setRuntimeOptions] = useState<RuntimeOptions | null>(null);
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus | null>(null);
  const [commandIndex, setCommandIndex] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("simon-sidebar-collapsed") === "true");
  const [copiedEntryId, setCopiedEntryId] = useState<string | null>(null);
  const [branches, setBranches] = useState<ConversationBranch[]>([]);
  const [conversationSearch, setConversationSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ConversationSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
  const [connectionState, setConnectionState] = useState<RunConnectionState | null>(null);
  const [editingEntryIndex, setEditingEntryIndex] = useState<number | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationScrollRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const usageRef = useRef<HTMLDivElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const stopWatching = useRef<(() => void) | null>(null);
  const isRunning = entries.some((entry) => entry.status === "running");
  const commands = [
    { command: "/new", description: "Start a new conversation" },
    { command: "/history", description: "Open conversation history" },
    { command: "/clear", description: "Clear the visible transcript" },
    { command: "/stop", description: "Stop the active response" },
    { command: "/model", description: "Show the active model" },
    { command: "/thinking", description: "Show the thinking level" },
    { command: "/demo-search", description: "Search bundled synthetic engineering fixtures" },
    { command: "/demo-review", description: "Create a synthetic review card" },
    { command: "/help", description: "Show available commands" },
  ];
  const matchingCommands = message.startsWith("/")
    ? commands.filter((item) => item.command.startsWith(message.split(/\s/, 1)[0] ?? ""))
    : [];

  useEffect(() => () => stopWatching.current?.(), []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const loadUsage = () => void getUsageStatus().then((status) => {
      if (!cancelled) setUsageStatus(status);
    }).catch(() => {
      if (!cancelled) setUsageStatus(null);
    });
    loadUsage();
    const timer = window.setInterval(loadUsage, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [visible]);

  useEffect(() => {
    if (!usageOpen) return;
    const closeUsage = (event: MouseEvent) => {
      if (!usageRef.current?.contains(event.target as Node)) setUsageOpen(false);
    };
    document.addEventListener("mousedown", closeUsage);
    return () => document.removeEventListener("mousedown", closeUsage);
  }, [usageOpen]);

  useEffect(() => {
    if (!modeMenuOpen) return;
    const closeMenu = (event: MouseEvent) => {
      if (!modeMenuRef.current?.contains(event.target as Node)) setModeMenuOpen(false);
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, [modeMenuOpen]);

  useEffect(() => {
    localStorage.setItem("simon-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const query = conversationSearch.trim();
    if (!query) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      void searchConversations(query)
        .then(setSearchResults)
        .catch((searchError: unknown) => setError(searchError instanceof Error ? searchError.message : "Unable to search conversations"))
        .finally(() => setSearchLoading(false));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [conversationSearch]);

  useEffect(() => {
    if (!standalone) return;
    let cancelled = false;
    setHistoryLoading(true);
    void listConversations()
      .then((items) => {
        if (!cancelled) setConversations(items);
      })
      .catch((historyError: unknown) => {
        if (!cancelled) setError(historyError instanceof Error ? historyError.message : "Unable to load conversations");
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [standalone]);

  useEffect(() => {
    setCommandIndex(0);
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "23px";
      const height = Math.min(textarea.scrollHeight, 92);
      textarea.style.height = `${height}px`;
      textarea.style.overflowY = textarea.scrollHeight > 92 ? "auto" : "hidden";
    }
  }, [message]);

  useEffect(() => {
    if (editingEntryIndex !== null) return;
    const key = `simon-draft:${conversation?.conversationId ?? "new"}`;
    if (message) localStorage.setItem(key, message);
    else localStorage.removeItem(key);
  }, [conversation?.conversationId, editingEntryIndex, message]);

  useEffect(() => {
    if (!historyOpen && !settingsOpen && isNearBottom) {
      conversationEndRef.current?.scrollIntoView?.({ block: "end" });
    }
  }, [entries, proposals, historyOpen, isNearBottom, settingsOpen]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void getAssistantStatus()
      .then((status) => {
        if (!cancelled) setAssistantStatus(status);
      })
      .catch((statusError: unknown) => {
        if (!cancelled) {
          setAssistantStatus({
            available: false,
            runtime: "unknown",
            reason: statusError instanceof Error ? statusError.message : "Assistant status unavailable",
            modelCount: 0,
            capabilities: {
              tools: [],
              externalAccess: false,
              mutations: false,
              scope: "Status could not be loaded",
            },
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (visible) {
      previousFocus.current = document.activeElement as HTMLElement | null;
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      previousFocus.current?.focus();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || pinned) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const drawer = document.querySelector<HTMLElement>("[data-ask-drawer]");
      const focusable = drawer?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, pinned, visible]);

  const scrollToLatest = (behavior: ScrollBehavior = "smooth") => {
    setIsNearBottom(true);
    conversationEndRef.current?.scrollIntoView?.({ block: "end", behavior });
  };

  const handleConversationScroll = () => {
    const element = conversationScrollRef.current;
    if (!element) return;
    setIsNearBottom(element.scrollHeight - element.scrollTop - element.clientHeight < 96);
  };

  const handleConnectionState = (state: RunConnectionState) => {
    if (state.status === "connected") {
      setConnectionState(null);
      return;
    }
    setConnectionState(state);
    if (state.status === "recovered") {
      window.setTimeout(() => setConnectionState((current) => current?.status === "recovered" ? null : current), 1800);
    }
  };

  const copyResponse = async (entry: ChatEntry) => {
    try {
      await navigator.clipboard.writeText(entry.answer);
      setCopiedEntryId(entry.id);
      window.setTimeout(() => setCopiedEntryId((current) => current === entry.id ? null : current), 1600);
    } catch {
      setError("Unable to copy this response to the clipboard");
    }
  };

  const regenerateLatest = async (entry: ChatEntry) => {
    if (!conversation || isRunning) return;
    setError(null);
    setConversation((current) => current ? { ...current, status: "running" } : current);
    setIsNearBottom(true);
    setEntries((current) => current.map((item) => item.id === entry.id ? {
      ...item,
      answer: "",
      activity: "Regenerating",
      activities: [{ id: `${item.id}-regenerate`, label: "Branching from the latest prompt", status: "running" }],
      status: "running",
    } : item));
    try {
      const runId = await regenerateRun(conversation.conversationId);
      stopWatching.current = watchRun(runId, (streamEvent) => handleEvent(entry.id, streamEvent), (watchError) => {
        setError(watchError.message);
        setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, status: "failed", activity: "Connection interrupted" } : item));
      }, handleConnectionState);
    } catch (regenerateError) {
      const text = regenerateError instanceof Error ? regenerateError.message : "Unable to regenerate this response";
      setError(text);
      setConversation((current) => current ? { ...current, status: "failed" } : current);
      setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, status: "failed", activity: text } : item));
    }
  };

  const refreshHistory = async () => {
    setHistoryLoading(true);
    try {
      setConversations(await listConversations());
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : "Unable to load conversations");
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = async () => {
    if (standalone) {
      setSidebarCollapsed((collapsed) => !collapsed);
      if (sidebarCollapsed) await refreshHistory();
      return;
    }
    setSettingsOpen(false);
    setHistoryOpen(true);
    await refreshHistory();
  };

  const refreshBranches = async (conversationId: string) => {
    try {
      setBranches(await getConversationBranches(conversationId));
    } catch (branchError) {
      setError(branchError instanceof Error ? branchError.message : "Unable to load response branches");
    }
  };

  const switchBranch = async (branch: ConversationBranch) => {
    if (!conversation || branch.current || isRunning) return;
    try {
      await selectConversationBranch(conversation.conversationId, branch.branchId);
      const [messages, nextBranches] = await Promise.all([
        getConversationMessages(conversation.conversationId),
        getConversationBranches(conversation.conversationId),
      ]);
      setEntries(transcriptToEntries(messages));
      setBranches(nextBranches);
      setIsNearBottom(true);
    } catch (branchError) {
      setError(branchError instanceof Error ? branchError.message : "Unable to switch response branch");
    }
  };

  const selectConversation = async (selected: Conversation) => {
    setError(null);
    setTranscriptLoading(true);
    try {
      const [messages, nextBranches] = await Promise.all([
        getConversationMessages(selected.conversationId),
        getConversationBranches(selected.conversationId),
      ]);
      setConversation(selected);
      setEntries(transcriptToEntries(messages));
      setBranches(nextBranches);
      setProposals([]);
      setKnowledgeSources([]);
      setCoverageNote(null);
      setHistoryOpen(false);
      setEditingEntryIndex(null);
      setIsNearBottom(true);
      setMessage(localStorage.getItem(`simon-draft:${selected.conversationId}`) ?? "");
      if (standalone && window.innerWidth <= 720) setSidebarCollapsed(true);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to restore conversation");
    } finally {
      setTranscriptLoading(false);
    }
  };

  const openRuntimeSettings = async () => {
    setError(null);
    try {
      const activeConversation = conversation ?? (await createConversation(approvalMode));
      setConversation(activeConversation);
      setRuntimeOptions(await getRuntimeOptions(activeConversation.conversationId));
      setHistoryOpen(false);
      setSettingsOpen(true);
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : "Unable to load runtime settings");
    }
  };

  const changeRuntime = async (update: { model?: { provider: string; id: string }; thinkingLevel?: string }) => {
    if (!conversation) return;
    try {
      const options = await updateRuntime(conversation.conversationId, update);
      setRuntimeOptions(options);
      setConversation((current) => current ? {
        ...current,
        selectedModel: options.activeModel,
        thinkingLevel: options.thinkingLevel,
      } : current);
    } catch (runtimeError) {
      setError(runtimeError instanceof Error ? runtimeError.message : "Unable to update runtime");
    }
  };

  const startNewConversation = () => {
    stopWatching.current?.();
    setConversation(null);
    setEntries([]);
    setProposals([]);
    setKnowledgeSources([]);
    setCoverageNote(null);
    setError(null);
    setHistoryOpen(false);
    setSettingsOpen(false);
    setRuntimeOptions(null);
    setBranches([]);
    setEditingEntryIndex(null);
    setIsNearBottom(true);
    setMessage(localStorage.getItem("simon-draft:new") ?? "");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const renameSelectedConversation = async (selected: Conversation) => {
    const title = window.prompt("Conversation name", selected.title)?.trim();
    if (!title || title === selected.title) return;
    const updated = await updateConversation(selected.conversationId, { title });
    setConversations((current) => current.map((item) => item.conversationId === updated.conversationId ? updated : item));
    if (conversation?.conversationId === updated.conversationId) setConversation(updated);
  };

  const removeAllConversations = async () => {
    if (!window.confirm("Delete all local Simon conversations and Pi transcripts? This cannot be undone.")) return;
    try {
      await deleteAllConversations();
      setConversations([]);
      startNewConversation();
      setHistoryOpen(true);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete conversation history");
    }
  };

  const removeConversation = async (selected: Conversation) => {
    if (!window.confirm(`Delete “${selected.title}”?`)) return;
    await deleteConversation(selected.conversationId);
    setConversations((current) => current.filter((item) => item.conversationId !== selected.conversationId));
    if (conversation?.conversationId === selected.conversationId) startNewConversation();
  };

  const handleEvent = (entryId: string, event: StreamEvent) => {
    if (event.eventType === "run.completed") {
      void refreshBranches(event.conversationId);
      setConversation((current) => current ? { ...current, status: "idle", updatedAt: event.occurredAt } : current);
    }
    if (event.eventType === "run.failed") setConversation((current) => current ? { ...current, status: "failed", updatedAt: event.occurredAt } : current);
    if (event.eventType === "run.aborted") setConversation((current) => current ? { ...current, status: "idle", updatedAt: event.occurredAt } : current);
    if (event.eventType === "knowledge.sources") {
      setKnowledgeSources(event.payload.result.sources);
      setCoverageNote(event.payload.result.coverage.note);
    }
    setEntries((current) =>
      current.map((entry) => {
        if (entry.id !== entryId) return entry;
        switch (event.eventType) {
          case "assistant.text.delta":
            return { ...entry, answer: entry.answer + event.payload.delta };
          case "activity.started":
            return {
              ...entry,
              activity: event.payload.label,
              activities: [
                ...entry.activities,
                {
                  id: event.payload.activityId,
                  label: event.payload.label,
                  ...(event.payload.detail ? { detail: event.payload.detail } : {}),
                  status: "running",
                },
              ],
            };
          case "activity.updated":
            return {
              ...entry,
              activity: event.payload.label ?? event.payload.detail ?? entry.activity,
              activities: entry.activities.map((item) => item.id === event.payload.activityId ? {
                ...item,
                ...(event.payload.label ? { label: event.payload.label } : {}),
                ...(event.payload.detail ? { detail: event.payload.detail } : {}),
              } : item),
            };
          case "activity.completed":
            return {
              ...entry,
              activity: "Response prepared",
              activities: entry.activities.map((item) => item.id === event.payload.activityId ? {
                ...item,
                status: event.payload.outcome,
              } : item),
            };
          case "run.completed":
            return {
              ...entry,
              status: "completed",
              activity: "Completed",
              activities: [...entry.activities, { id: `${entry.id}-complete`, label: "Run completed", status: "completed" }],
            };
          case "run.failed":
            return {
              ...entry,
              status: "failed",
              activity: event.payload.message,
              activities: [...entry.activities, { id: `${entry.id}-failed`, label: "Run failed", detail: event.payload.message, status: "failed" }],
            };
          case "run.aborted":
            return {
              ...entry,
              status: "failed",
              activity: "Stopped",
              activities: [
                ...entry.activities,
                {
                  id: `${entry.id}-aborted`,
                  label: "Run stopped",
                  ...(event.payload.reason ? { detail: event.payload.reason } : {}),
                  status: "aborted",
                },
              ],
            };
          default:
            return entry;
        }
      }),
    );
  };

  const addLocalResponse = (question: string, answer: string) => {
    setEntries((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        question,
        answer,
        activity: "Local command",
        activities: [{ id: crypto.randomUUID(), label: "Handled by Simon", detail: "No model request was needed", status: "completed" }],
        status: "completed",
      },
    ]);
  };

  const runCommand = async (prompt: string): Promise<boolean> => {
    const command = prompt.split(/\s+/, 1)[0]?.toLowerCase();
    if (!command?.startsWith("/")) return false;
    switch (command) {
      case "/new":
        startNewConversation();
        return true;
      case "/history":
        await openHistory();
        return true;
      case "/clear":
        setEntries([]);
        return true;
      case "/stop":
        if (isRunning) await stop();
        else addLocalResponse(prompt, "There is no active response to stop.");
        return true;
      case "/model":
      case "/thinking":
        await openRuntimeSettings();
        return true;
      case "/demo-search": {
        const query = prompt.slice("/demo-search".length).trim();
        if (!query) {
          addLocalResponse(prompt, "Add a search query, for example: /demo-search pump restart delay");
          return true;
        }
        const result = await searchSyntheticKnowledge(query);
        setKnowledgeSources(result.sources);
        setCoverageNote(result.coverage.note);
        addLocalResponse(prompt, result.sources.length > 0
          ? `Found ${result.sources.length} synthetic source${result.sources.length === 1 ? "" : "s"}.`
          : "No matching synthetic sources were found.");
        return true;
      }
      case "/demo-review": {
        const activeConversation = conversation ?? (await createConversation(approvalMode));
        setConversation(activeConversation);
        const proposal = await createDemoProposal(activeConversation.conversationId);
        setProposals((current) => [...current, proposal]);
        return true;
      }
      case "/help":
        addLocalResponse(prompt, commands.map((item) => `${item.command} — ${item.description}`).join("\n"));
        return true;
      default:
        addLocalResponse(prompt, `Unknown command: ${command}. Use /help to see available commands.`);
        return true;
    }
  };

  const submitEditedMessage = async (prompt: string, entryIndex: number) => {
    if (!conversation) return;
    const target = entries[entryIndex];
    if (!target) return;
    setError(null);
    setConversation((current) => current ? { ...current, status: "running" } : current);
    setIsNearBottom(true);
    setEntries((current) => current.slice(0, entryIndex + 1).map((item, index) => index === entryIndex ? {
      ...item,
      question: prompt,
      answer: "",
      activity: "Branching from edited prompt",
      activities: [{ id: `${item.id}-edit`, label: "Creating edited conversation branch", status: "running" }],
      status: "running",
    } : item));
    try {
      const runId = await editAndResendRun(conversation.conversationId, entryIndex, prompt);
      localStorage.removeItem(`simon-draft:${conversation.conversationId}`);
      setMessage("");
      setEditingEntryIndex(null);
      stopWatching.current = watchRun(runId, (streamEvent) => handleEvent(target.id, streamEvent), (watchError) => {
        setError(watchError.message);
        setEntries((current) => current.map((item) => item.id === target.id ? { ...item, status: "failed", activity: "Connection interrupted" } : item));
      }, handleConnectionState);
    } catch (editError) {
      const text = editError instanceof Error ? editError.message : "Unable to edit and resend this message";
      setError(text);
      setConversation((current) => current ? { ...current, status: "failed" } : current);
      setEntries((current) => current.map((item) => item.id === target.id ? { ...item, status: "failed", activity: text } : item));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const prompt = message.trim();
    if (!prompt || isRunning) return;
    if (editingEntryIndex !== null) {
      await submitEditedMessage(prompt, editingEntryIndex);
      return;
    }
    if (await runCommand(prompt)) {
      setMessage("");
      return;
    }
    setError(null);
    setIsNearBottom(true);
    const entryId = crypto.randomUUID();
    setEntries((current) => [
      ...current,
      {
        id: entryId,
        question: prompt,
        answer: "",
        activity: "Starting",
        activities: [{ id: `${entryId}-start`, label: "Starting run", status: "running" }],
        status: "running",
      },
    ]);
    try {
      let activeConversation = conversation;
      if (!activeConversation) {
        activeConversation = await createConversation(approvalMode);
        const title = prompt.replace(/\s+/g, " ").slice(0, 60);
        activeConversation = await updateConversation(activeConversation.conversationId, { title });
        setConversations((current) => [activeConversation!, ...current.filter((item) => item.conversationId !== activeConversation!.conversationId)]);
      }
      setConversation({ ...activeConversation, status: "running" });
      const runId = await createRun(activeConversation.conversationId, prompt);
      localStorage.removeItem("simon-draft:new");
      localStorage.removeItem(`simon-draft:${activeConversation.conversationId}`);
      setMessage("");
      stopWatching.current = watchRun(runId, (streamEvent) => handleEvent(entryId, streamEvent), (watchError) => {
        setError(watchError.message);
        setEntries((current) =>
          current.map((entry) =>
            entry.id === entryId ? { ...entry, status: "failed", activity: "Connection interrupted" } : entry,
          ),
        );
      }, handleConnectionState);
    } catch (submitError) {
      const text = submitError instanceof Error ? submitError.message : "Unable to start the assistant";
      setError(text);
      setConversation((current) => current ? { ...current, status: "failed" } : current);
      setEntries((current) =>
        current.map((entry) => (entry.id === entryId ? { ...entry, status: "failed", activity: text } : entry)),
      );
    }
  };

  const decide = async (proposal: Proposal, decision: "approve" | "reject" | "revise") => {
    try {
      const updated = await decideProposal(proposal.proposalId, proposal.contentDigest, decision);
      setProposals((current) => current.map((item) => item.proposalId === updated.proposalId ? updated : item));
      if (decision === "revise") {
        setMessage("Revise the synthetic proposal: ");
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Unable to decide proposal");
    }
  };

  const changeApprovalMode = async (nextMode: "manual" | "auto") => {
    setApprovalMode(nextMode);
    if (!conversation) return;
    try {
      const updated = await updateConversation(conversation.conversationId, { approvalMode: nextMode });
      setConversation(updated);
    } catch (modeError) {
      setError(modeError instanceof Error ? modeError.message : "Unable to update approval mode");
    }
  };

  const stop = async () => {
    if (!conversation) return;
    try {
      await abortConversation(conversation.conversationId);
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : "Unable to stop the assistant");
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (matchingCommands.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCommandIndex((index) => (index + 1) % matchingCommands.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setCommandIndex((index) => (index - 1 + matchingCommands.length) % matchingCommands.length);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMessage("");
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        const selected = matchingCommands[commandIndex];
        if (selected && message.trim() !== selected.command) {
          event.preventDefault();
          setMessage(selected.command);
          return;
        }
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <>
      {visible && !pinned && <button className="ask-backdrop" aria-label="Close Simon" onClick={close} />}
      <aside
        data-ask-drawer
        className={`ask-drawer ${visible ? "is-open" : ""} ${pinned ? "is-pinned" : ""} ${standalone ? "is-standalone" : ""}`}
        role={standalone ? "region" : pinned ? "complementary" : "dialog"}
        aria-modal={!standalone && !pinned ? true : undefined}
        aria-label="Simon assistant"
        aria-hidden={!visible}
        inert={!visible}
      >
        {standalone && (
          <nav className={`chat-sidebar${sidebarCollapsed ? " is-collapsed" : ""}`} aria-label="Conversations">
            <div className="sidebar-head">
              <div className="sidebar-brand"><span>S</span><strong>SIMON</strong></div>
              <button type="button" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-label={sidebarCollapsed ? "Expand conversation sidebar" : "Collapse conversation sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
                <ToolbarIcon name="history" />
              </button>
            </div>
            <button className="sidebar-new" type="button" onClick={startNewConversation} aria-label="New conversation" title="New conversation">
              <ToolbarIcon name="new" /><span>New conversation</span>
            </button>
            {!sidebarCollapsed && (
              <label className="sidebar-search">
                <span className="sr-only">Search conversations</span>
                <input value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="Search conversations" />
                {conversationSearch && <button type="button" onClick={() => setConversationSearch("")} aria-label="Clear conversation search">×</button>}
              </label>
            )}
            <div className="sidebar-list" aria-live="polite">
              {!sidebarCollapsed && (historyLoading || searchLoading) && <p>{searchLoading ? "Searching local transcripts…" : "Loading conversations…"}</p>}
              {!sidebarCollapsed && !historyLoading && !searchLoading && conversationSearch && searchResults.length === 0 && <p>No matching conversations.</p>}
              {!sidebarCollapsed && !historyLoading && !conversationSearch && conversations.length === 0 && <p>No conversations yet.</p>}
              {(conversationSearch ? searchResults.map((result) => result.conversation) : conversations).map((item) => {
                const searchResult = searchResults.find((result) => result.conversation.conversationId === item.conversationId);
                return (
                  <div className={`sidebar-conversation${conversation?.conversationId === item.conversationId ? " is-active" : ""}`} key={item.conversationId}>
                    <button className="sidebar-select" type="button" onClick={() => selectConversation(item)} title={item.title}>
                      <span>{item.title}</span>
                      <small>{searchResult ? `${searchResult.matchedRole} · ${searchResult.excerpt}` : new Date(item.updatedAt).toLocaleDateString()}</small>
                    </button>
                    {!sidebarCollapsed && !conversationSearch && (
                      <div className="sidebar-item-actions">
                        <button type="button" onClick={() => renameSelectedConversation(item)} aria-label={`Rename ${item.title}`} title="Rename">✎</button>
                        <button type="button" onClick={() => removeConversation(item)} aria-label={`Delete ${item.title}`} title="Delete">×</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!sidebarCollapsed && <div className="sidebar-foot"><span className="runtime-indicator is-ready" />Local workspace</div>}
          </nav>
        )}
        <header className="ask-header">
          <div className="ask-identity">
            <span className="simon-mark" aria-hidden="true">S</span>
            <div><strong>{conversation?.title ?? "SIMON"}</strong>
            <span className="runtime-state">
              <i className={`runtime-indicator${assistantStatus?.available ? " is-ready" : ""}`} aria-hidden="true" />
              {isRunning
                ? "Working"
                : assistantStatus?.available
                  ? `${assistantStatus.runtime} ready · ${assistantStatus.modelCount} models`
                  : assistantStatus
                    ? "Assistant unavailable"
                    : "Checking assistant"}
            </span></div>
          </div>
          <div className="ask-header-actions">
            {!standalone && <button type="button" onClick={startNewConversation} aria-label="New conversation" title="New conversation"><ToolbarIcon name="new" /></button>}
            <button type="button" onClick={openHistory} aria-label="Conversation history" title="Conversation history"><ToolbarIcon name="history" /></button>
            <div className={`usage-control${usageOpen ? " is-open" : ""}`} ref={usageRef}>
              <button type="button" className="usage-orb" onClick={() => setUsageOpen((open) => !open)} aria-label={usageStatus?.available ? `Usage: ${usageStatus.primary?.usedPercent ?? 0}% of 5-hour window used` : "Usage unavailable"} aria-expanded={usageOpen}>
                <svg className="usage-ring" viewBox="0 0 40 40" aria-hidden="true">
                  <circle className="usage-ring-track" cx="20" cy="20" r="16" />
                  <circle className="usage-ring-value" cx="20" cy="20" r="16" style={{ strokeDashoffset: 100.53 * (1 - (usageStatus?.primary?.usedPercent ?? 0) / 100) }} />
                </svg>
                <span className="usage-bolt"><ToolbarIcon name="zap" /></span>
              </button>
              <div className="usage-popover" role="status">
                <div className="usage-popover-head">
                  <div><span>Power budget</span><strong>{usageStatus?.planType ?? "Codex"}</strong></div>
                  <small>Live</small>
                </div>
                {usageStatus?.available && usageStatus.primary && usageStatus.secondary ? (
                  <div className="usage-windows">
                    {[usageStatus.primary, usageStatus.secondary].map((window) => (
                      <div className="usage-window" key={window.label}>
                        <div><strong>{window.label}</strong><span>{window.usedPercent}% used</span></div>
                        <div className="usage-meter"><i style={{ width: `${window.usedPercent}%` }} /></div>
                        <small>{100 - window.usedPercent}% available · resets in {formatReset(window.resetAfterSeconds)}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>{usageStatus?.reason ?? "Loading usage windows…"}</p>
                )}
                <footer>Updated {usageStatus ? new Date(usageStatus.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "now"}</footer>
              </div>
            </div>
            <button type="button" onClick={openRuntimeSettings} aria-label="Settings" title="Settings"><ToolbarIcon name="settings" /></button>
            {!standalone && <button type="button" onClick={togglePinned} aria-pressed={isPinned} aria-label={isPinned ? "Unpin" : "Pin"} title={isPinned ? "Unpin" : "Pin"}><ToolbarIcon name="pin" /></button>}
            {!standalone && <button type="button" onClick={close} aria-label="Close" title="Close"><ToolbarIcon name="close" /></button>}
          </div>
        </header>

        {connectionState && (
          <div className={`connection-banner is-${connectionState.status}`} role="status">
            <span className="connection-pulse" aria-hidden="true" />
            <strong>
              {connectionState.status === "reconnecting"
                ? `Reconnecting · attempt ${connectionState.attempt}`
                : connectionState.status === "recovered"
                  ? "Connection restored"
                  : "Connection unavailable"}
            </strong>
            <small>
              {connectionState.status === "reconnecting"
                ? `Replaying from the last confirmed event in ${Math.ceil(connectionState.delayMs / 1000)}s`
                : connectionState.status === "recovered"
                  ? "No streamed events were lost"
                  : "Automatic retries were exhausted"}
            </small>
          </div>
        )}

        <div ref={conversationScrollRef} className="ask-conversation" aria-live="polite" onScroll={handleConversationScroll}>
          {settingsOpen ? (
            <section className="runtime-settings" aria-label="Runtime settings">
              <div className="history-heading">
                <div><p className="eyebrow">Pi runtime</p><h2>Model settings</h2></div>
                <button type="button" onClick={() => setSettingsOpen(false)}>Back</button>
              </div>
              {runtimeOptions ? (
                <div className="settings-fields">
                  <label>
                    <span>Model</span>
                    <select
                      value={runtimeOptions.activeModel ?? ""}
                      onChange={(event) => {
                        const selected = runtimeOptions.models.find((model) => `${model.provider}/${model.id}` === event.target.value);
                        if (selected) void changeRuntime({ model: { provider: selected.provider, id: selected.id } });
                      }}
                    >
                      {runtimeOptions.models.map((model) => (
                        <option key={`${model.provider}/${model.id}`} value={`${model.provider}/${model.id}`}>
                          {model.name} · {model.provider}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Thinking level</span>
                    <select
                      value={runtimeOptions.thinkingLevel ?? "off"}
                      onChange={(event) => void changeRuntime({ thinkingLevel: event.target.value })}
                    >
                      {runtimeOptions.thinkingLevels.map((level) => <option key={level} value={level}>{level}</option>)}
                    </select>
                  </label>
                  {assistantStatus && (
                    <div className="capability-card">
                      <strong>Active capability boundary</strong>
                      <p>{assistantStatus.capabilities.scope}</p>
                      <dl>
                        <div><dt>Allowed tools</dt><dd>{assistantStatus.capabilities.tools.length > 0 ? assistantStatus.capabilities.tools.join(", ") : "None"}</dd></div>
                        <div><dt>External access</dt><dd>{assistantStatus.capabilities.externalAccess ? "Enabled" : "Disabled"}</dd></div>
                        <div><dt>Mutations</dt><dd>{assistantStatus.capabilities.mutations ? "Enabled" : "Disabled"}</dd></div>
                      </dl>
                    </div>
                  )}
                  <p>Shell, filesystem, MCP, internet, and TIA access remain disabled.</p>
                </div>
              ) : <p>Loading runtime settings…</p>}
            </section>
          ) : historyOpen ? (
            <section className="conversation-history" aria-label="Conversation history">
              <div className="history-heading">
                <div><p className="eyebrow">History</p><h2>Conversations</h2></div>
                <div className="history-actions">
                  {conversations.length > 0 && <button type="button" className="danger" onClick={removeAllConversations}>Delete all</button>}
                  <button type="button" onClick={() => setHistoryOpen(false)}>Back</button>
                </div>
              </div>
              {historyLoading && <p>Loading…</p>}
              {!historyLoading && conversations.length === 0 && <p>No saved conversations yet.</p>}
              <ul>
                {conversations.map((item) => (
                  <li key={item.conversationId}>
                    <button className="conversation-select" type="button" onClick={() => selectConversation(item)}>
                      <strong>{item.title}</strong>
                      <span>{item.status} · {new Date(item.updatedAt).toLocaleString()}</span>
                    </button>
                    <button type="button" onClick={() => renameSelectedConversation(item)}>Rename</button>
                    <button type="button" onClick={() => removeConversation(item)}>Delete</button>
                  </li>
                ))}
              </ul>
            </section>
          ) : transcriptLoading ? (
            <div className="transcript-skeleton" role="status" aria-label="Loading conversation">
              <span /><span /><span /><span />
              <p>Restoring conversation…</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="ask-empty">
              <div className="empty-sigil" aria-hidden="true"><span>S</span></div>
              <p className="eyebrow">Private engineering intelligence</p>
              <h2>What are we solving?</h2>
              <p className="empty-lead">Think through controls, review logic, or explore Simon's synthetic engineering examples.</p>
              <div className="starter-prompts" aria-label="Suggested prompts">
                {([
                  ["Reason", "Explain a control strategy clearly"],
                  ["Inspect", "Search the pump restart example"],
                  ["Draft", "Structure a safe implementation plan"],
                ] as const).map(([label, prompt]) => (
                  <button key={label} type="button" onClick={() => { setMessage(prompt); inputRef.current?.focus(); }}>
                    <span>{label}</span><strong>{prompt}</strong><i aria-hidden="true">↗</i>
                  </button>
                ))}
              </div>
              <small className="scope-note">Local Pi runtime · restricted capability boundary</small>
            </div>
          ) : null}
          {!historyOpen && !settingsOpen && !transcriptLoading && conversation?.status === "interrupted" && (
            <div className="conversation-notice" role="status">
              <strong>Previous response was interrupted</strong>
              <span>The saved transcript is intact. Send a new message or retry the latest response to continue.</span>
            </div>
          )}
          {!historyOpen && !settingsOpen && !transcriptLoading && entries.map((entry, entryIndex) => (
            <article className="chat-entry" key={entry.id}>
              <div className="user-message-wrap">
                <p className="user-message">{entry.question}</p>
                {!isRunning && (
                  <button type="button" className="edit-message" onClick={() => { setEditingEntryIndex(entryIndex); setMessage(entry.question); inputRef.current?.focus(); }} aria-label="Edit this message" title="Edit and resend">
                    <ToolbarIcon name="edit" />
                  </button>
                )}
              </div>
              <div className="assistant-message">
                <span className={`activity-dot ${entry.status}`} aria-hidden="true" />
                <div>
                  <div className="assistant-meta"><strong>SIMON</strong><small>{entry.activity}</small></div>
                  {entry.answer && (
                    <>
                      <div className="assistant-content">
                        <Suspense fallback={<p>{entry.answer}</p>}>
                          <SafeMarkdown>{entry.answer}</SafeMarkdown>
                        </Suspense>
                      </div>
                      <div className="message-actions">
                        <button type="button" onClick={() => void copyResponse(entry)} aria-label={copiedEntryId === entry.id ? "Response copied" : "Copy response"} title={copiedEntryId === entry.id ? "Copied" : "Copy response"}>
                          <ToolbarIcon name={copiedEntryId === entry.id ? "check" : "copy"} />
                          <span>{copiedEntryId === entry.id ? "Copied" : "Copy"}</span>
                        </button>
                        {entryIndex === entries.length - 1 && entry.status === "completed" && conversation && (
                          <button type="button" onClick={() => void regenerateLatest(entry)} aria-label="Regenerate response" title="Regenerate response">
                            <ToolbarIcon name="retry" /><span>Retry</span>
                          </button>
                        )}
                      </div>
                      {entryIndex === entries.length - 1 && branches.length > 1 && (
                        <label className="branch-switcher">
                          <span>Conversation branch</span>
                          <select
                            value={branches.find((branch) => branch.current)?.branchId ?? ""}
                            onChange={(event) => {
                              const branch = branches.find((item) => item.branchId === event.target.value);
                              if (branch) void switchBranch(branch);
                            }}
                            disabled={isRunning}
                          >
                            {branches.map((branch, index) => (
                              <option value={branch.branchId} key={branch.branchId}>
                                {index + 1} of {branches.length} · {branch.preview || "Response branch"}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </>
                  )}
                  <details className="activity-trace">
                    <summary>{entry.activities.length} activity {entry.activities.length === 1 ? "step" : "steps"}</summary>
                    <ol>
                      {entry.activities.map((item) => (
                        <li key={item.id} className={`activity-${item.status}`}>
                          <span>{item.label}</span>
                          {item.detail && <small>{item.detail}</small>}
                        </li>
                      ))}
                    </ol>
                  </details>
                </div>
              </div>
            </article>
          ))}
          {!historyOpen && !settingsOpen && knowledgeSources.length > 0 && (
            <section className="source-results" aria-label="Synthetic knowledge sources">
              <div className="proposal-label"><span>Synthetic read-only results</span><strong>{knowledgeSources.length} sources</strong></div>
              {knowledgeSources.map((source) => (
                <article className="source-card" key={source.sourceId}>
                  <h3>{source.title}</h3>
                  <code>{source.objectPath}</code>
                  <p>{source.excerpt}</p>
                  <small>{source.provenance.replaceAll("_", " ")} · synthetic fixture</small>
                </article>
              ))}
              {coverageNote && <p className="coverage-note">{coverageNote}</p>}
            </section>
          )}
          {!historyOpen && !settingsOpen && proposals.map((proposal) => (
            <article className="proposal-card" key={proposal.proposalId}>
              <div className="proposal-label"><span>Synthetic demonstration</span><strong>{proposal.status}</strong></div>
              <h3>{proposal.summary}</h3>
              {proposal.actions.map((action) => (
                <div className="proposal-action" key={action.actionId}>
                  <strong>{action.operation} · {action.targetType}</strong>
                  <p>{action.description}</p>
                  <pre>{JSON.stringify(action.fields, null, 2)}</pre>
                </div>
              ))}
              <small>No external system or TIA project will be changed.</small>
              {proposal.status === "pending" && (
                <div className="proposal-actions">
                  <button type="button" onClick={() => decide(proposal, "reject")}>Reject</button>
                  <button type="button" onClick={() => decide(proposal, "revise")}>Revise</button>
                  <button type="button" className="approve" onClick={() => decide(proposal, "approve")}>Approve demo</button>
                </div>
              )}
            </article>
          ))}
          {assistantStatus && !assistantStatus.available && !historyOpen && !settingsOpen && (
            <p className="ask-error" role="alert">
              {assistantStatus.reason ?? "No authenticated Pi model is available."}
            </p>
          )}
          {error && <p className="ask-error" role="alert">{error}</p>}
          <div ref={conversationEndRef} />
        </div>

        {!isNearBottom && !historyOpen && !settingsOpen && entries.length > 0 && (
          <button type="button" className="scroll-latest" onClick={() => scrollToLatest()} aria-label="Scroll to latest message">
            <span aria-hidden="true">↓</span> Latest
          </button>
        )}

        <form className="ask-composer-wrap" onSubmit={submit}>
          {matchingCommands.length > 0 && !isRunning && (
            <div className="command-palette" role="listbox" aria-label="Commands">
              {matchingCommands.map((item, index) => (
                <button
                  key={item.command}
                  type="button"
                  role="option"
                  aria-selected={index === commandIndex}
                  className={index === commandIndex ? "active" : ""}
                  onMouseEnter={() => setCommandIndex(index)}
                  onClick={() => {
                    setMessage(item.command);
                    inputRef.current?.focus();
                  }}
                >
                  <strong>{item.command}</strong><span>{item.description}</span>
                </button>
              ))}
            </div>
          )}
          {editingEntryIndex !== null && (
            <div className="editing-banner">
              <span>Editing message · later responses will become an alternate branch</span>
              <button type="button" onClick={() => { setEditingEntryIndex(null); setMessage(""); inputRef.current?.focus(); }}>Cancel</button>
            </div>
          )}
          <div className="ask-composer">
            <button
              type="button"
              className="ask-tool-toggle"
              onClick={() => {
                setMessage("/");
                inputRef.current?.focus();
              }}
              disabled={isRunning}
              aria-label="Browse slash commands"
              title="Commands"
            >
              <ToolbarIcon name="plus" />
            </button>
            <div className="ask-mode-picker" ref={modeMenuRef}>
              <button
                type="button"
                className={`ask-mode-trigger${approvalMode === "auto" ? " ask-mode-trigger-auto" : ""}`}
                onClick={() => setModeMenuOpen((open) => !open)}
                disabled={isRunning}
                aria-label={`Execution mode: ${approvalMode === "auto" ? "Auto" : "Manual"}`}
                aria-haspopup="menu"
                aria-expanded={modeMenuOpen}
                title={approvalMode === "auto" ? "Auto execution" : "Manual approval"}
              >
                <ToolbarIcon name={approvalMode === "auto" ? "zap" : "shield"} />
              </button>
              {modeMenuOpen && (
                <div className="ask-mode-menu" role="menu" aria-label="Execution mode">
                  <button
                    type="button"
                    className="ask-mode-option"
                    role="menuitemradio"
                    aria-checked={approvalMode === "manual"}
                    onClick={() => { void changeApprovalMode("manual"); setModeMenuOpen(false); inputRef.current?.focus(); }}
                  >
                    <ToolbarIcon name="shield" />
                    <span><strong>Manual approval</strong><small>Review every proposed change</small></span>
                    {approvalMode === "manual" && <ToolbarIcon name="check" />}
                  </button>
                  <button
                    type="button"
                    className="ask-mode-option"
                    role="menuitemradio"
                    aria-checked={approvalMode === "auto"}
                    onClick={() => { void changeApprovalMode("auto"); setModeMenuOpen(false); inputRef.current?.focus(); }}
                  >
                    <ToolbarIcon name="zap" />
                    <span><strong>Auto execute</strong><small>Safe local and demo actions only</small></span>
                    {approvalMode === "auto" && <ToolbarIcon name="check" />}
                  </button>
                </div>
              )}
            </div>
            <label className="sr-only" htmlFor="ask-message">Message Simon</label>
            <textarea
              id="ask-message"
              ref={inputRef}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder="Ask Simon anything…"
              rows={1}
              disabled={isRunning || assistantStatus?.available === false}
            />
            {isRunning ? (
              <button type="button" className="ask-send" onClick={stop} aria-label="Stop response" title="Stop response"><ToolbarIcon name="stop" /></button>
            ) : (
              <button className="ask-send" type="submit" aria-label="Send message" title="Send" disabled={!message.trim() || assistantStatus?.available === false}><ToolbarIcon name="send" /></button>
            )}
          </div>
        </form>
      </aside>
    </>
  );
}
