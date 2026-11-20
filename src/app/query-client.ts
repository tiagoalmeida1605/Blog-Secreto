import { QueryClient } from "@tanstack/react-query";
import { DevHubApiError } from "../services/devhub-api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) =>
        error instanceof DevHubApiError
          ? error.status !== 401 && error.status !== 403 && failureCount < 1
          : failureCount < 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});
