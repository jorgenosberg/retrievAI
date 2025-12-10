import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { getQueryCacheKey } from "@/lib/cacheKeys";
import { routeTree } from "./routeTree.gen";
import "./index.css";

const cacheKey = getQueryCacheKey();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24, // keep cached queries locally for a day
      retry: 1,
    },
  },
});

const CACHE_VERSION = "v1";
const isBrowser = typeof window !== "undefined";

const persister = isBrowser
  ? createSyncStoragePersister({
      storage: window.localStorage,
      key: cacheKey,
      throttleTime: 1000,
    })
  : undefined;

const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: persister!,
          buster: `${CACHE_VERSION}:${cacheKey}`,
          maxAge: 1000 * 60 * 60 * 24, // discard everything after 24h to avoid stale UI
          dehydrateOptions: {
            // Only persist document-related queries; user-specific data stays in-memory
            shouldDehydrateQuery: (query) =>
              Array.isArray(query.queryKey) && query.queryKey[0] === "documents",
          },
        }}
      >
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </PersistQueryClientProvider>
    </StrictMode>
  );
}
