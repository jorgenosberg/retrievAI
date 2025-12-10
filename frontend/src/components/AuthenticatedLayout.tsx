import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  type SVGProps,
} from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { apiClient } from "@/lib/api";
import { useChatSessions } from "@/hooks/useChatSessions";
import {
  clearChatSessions,
  deleteChatSession,
  generateChatSessionId,
  type StoredChatSession,
} from "@/lib/chatStorage";

type AuthenticatedLayoutProps = {
  children: ReactNode;
};

const navItems = [
  { label: "Chat", to: "/chat", icon: ChatIcon },
  { label: "Documents", to: "/documents", icon: DocumentIcon },
  { label: "Settings", to: "/settings", icon: SettingsIcon },
];

const MAX_RECENT_CHATS = 12;

const truncate = (value: string, length = 42) => {
  if (value.length <= length) {
    return value;
  }
  return `${value.slice(0, length - 1)}…`;
};

const getSessionTitle = (session: StoredChatSession) => {
  const messages = Array.isArray(session.messages) ? session.messages : [];
  const prompt =
    messages.find((message) => message.role === "user")?.content ||
    messages[0]?.content ||
    session.id;
  const normalized = prompt?.trim() ?? "";
  if (!normalized) {
    return "Untitled chat";
  }
  return truncate(normalized);
};

const formatRelativeTime = (timestamp: number) => {
  const numericTimestamp =
    typeof timestamp === "number" ? timestamp : Number(timestamp);
  if (!Number.isFinite(numericTimestamp) || numericTimestamp <= 0) {
    return "Never";
  }
  const diffMs = Date.now() - numericTimestamp;
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(numericTimestamp).toLocaleDateString();
};

type ContextMenuState = {
  x: number;
  y: number;
  sessionId: string;
} | null;

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const navigate = useNavigate();
  const location = useRouterState({
    select: (state) => state.location,
  });
  const pathname = location.pathname;
  const searchParams = location.search as { sessionId?: string };

  const chatSessions = useChatSessions();
  const recentChats = useMemo(() => {
    if (!Array.isArray(chatSessions)) return [];
    return chatSessions
      .filter((session) => {
        return (
          session &&
          typeof session === "object" &&
          typeof session.id === "string" &&
          typeof session.createdAt === "number" &&
          typeof session.updatedAt === "number" &&
          Array.isArray(session.messages)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt) // Sort by creation time, newest first
      .slice(0, MAX_RECENT_CHATS);
  }, [chatSessions]);

  const isActive = (to: string) =>
    pathname === to || pathname.startsWith(`${to}/`);

  const activeSessionId = pathname.startsWith("/chat")
    ? (searchParams?.sessionId ?? "default")
    : null;

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [contextMenu]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, sessionId: string) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, sessionId });
    },
    []
  );

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      setContextMenu(null);
      deleteChatSession(sessionId);
      // Navigate away if deleting the active session
      if (activeSessionId === sessionId) {
        navigate({ to: "/chat", search: { sessionId: "default" } });
      }
    },
    [activeSessionId, navigate]
  );

  const handleLogout = () => {
    apiClient.logout();
    window.location.href = "/login";
  };

  const handleSelectSession = (sessionId: string) => {
    navigate({
      to: "/chat",
      search: { sessionId },
    });
    setMobileOpen(false);
  };

  const handleNewChat = () => {
    const nextSessionId = generateChatSessionId();
    handleSelectSession(nextSessionId);
  };

  const handleClearHistory = () => {
    if (recentChats.length === 0) return;
    const confirmed = window.confirm(
      "This removes your cached chat history from this browser. Continue?"
    );
    if (!confirmed) return;
    clearChatSessions();
    if (pathname.startsWith("/chat")) {
      handleSelectSession("default");
    }
  };

  const renderNav = () => (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const active = isActive(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            preload={false}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-primary-600/10 text-primary-700 dark:bg-primary-500/20 dark:text-primary-50"
                : "text-gray-700 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
            onClick={() => setMobileOpen(false)}
          >
            <Icon
              className={`h-4 w-4 ${
                active
                  ? "text-primary-600 dark:text-primary-50"
                  : "text-gray-400 dark:text-zinc-500"
              }`}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-gray-200 bg-white/95 p-4 shadow-lg shadow-zinc-900/10 backdrop-blur md:bg-white md:shadow-none dark:border-zinc-800 dark:bg-zinc-900/95 md:dark:bg-zinc-900 transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Fixed Header */}
          <div className="flex items-center justify-between pb-4">
            <div>
              <p className="text-sm font-semibold text-primary-600 dark:text-primary-500">
                RetrievAI
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Literature copilot
              </p>
            </div>
            <button
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-zinc-500 dark:hover:bg-zinc-800 md:hidden cursor-pointer"
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Fixed Menu */}
          <section className="pb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
              Menu
            </p>
            {renderNav()}
          </section>

          {/* Scrollable Recent Chats */}
          <section className="flex min-h-0 flex-1 flex-col pb-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                  Recent chats
                </p>
                <p className="text-[11px] text-gray-400 dark:text-zinc-500">
                  Stored locally for 30 days
                </p>
              </div>
              <button
                onClick={handleNewChat}
                className="inline-flex items-center rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
              >
                + New
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {recentChats.length === 0 ? (
                <p className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
                  Start a chat to see it here.
                </p>
              ) : (
                <div className="space-y-1">
                  {recentChats.map((session) => {
                    const active = activeSessionId === session.id;
                    return (
                      <button
                        key={session.id}
                        onClick={() => handleSelectSession(session.id)}
                        onContextMenu={(e) => handleContextMenu(e, session.id)}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm transition cursor-pointer ${
                          active
                            ? "border-primary-200 bg-primary-50 text-primary-900 dark:border-primary-400/40 dark:bg-primary-500/10 dark:text-primary-100"
                            : "border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-50 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                        }`}
                        title={getSessionTitle(session)}
                      >
                        <p className="truncate font-medium">
                          {getSessionTitle(session)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400">
                          Updated {formatRelativeTime(session.updatedAt)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {recentChats.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="mt-3 inline-flex items-center text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
              >
                Clear history
              </button>
            )}
          </section>

          {/* Fixed Logout Button */}
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center rounded-md border border-danger-200 px-3 py-2 text-sm font-medium text-danger-600 transition-colors hover:bg-danger-50 dark:border-danger-500/40 dark:text-danger-300 dark:hover:bg-danger-500/10 cursor-pointer"
          >
            <LogoutIcon className="mr-2 h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 text-gray-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 md:hidden">
          <button
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">Menu</span>
          <div className="w-8" />
        </header>
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-zinc-950">
          {children}
        </main>
      </div>

      {/* Context menu for chat sessions */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[140px] rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => handleDeleteSession(contextMenu.sessionId)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger-600 hover:bg-gray-100 dark:text-danger-400 dark:hover:bg-zinc-700 cursor-pointer"
          >
            <TrashIcon className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  );
}

function DocumentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8 2h8l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" />
      <path d="M14 2v4h4" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}

function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function LogoutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
      <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}
