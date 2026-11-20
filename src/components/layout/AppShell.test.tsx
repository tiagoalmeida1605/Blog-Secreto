import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

vi.mock("../../features/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { displayName: "Owner", email: "owner@example.test" },
    logout: vi.fn(),
  }),
}));

vi.mock("../../services/api", () => ({
  api: {
    getOverview: vi.fn().mockResolvedValue({ overallState: "operational" }),
    getSettings: vi.fn().mockResolvedValue({
      visibleIntegrations: ["github", "vercel", "rga", "firebase"],
    }),
  },
}));

describe("AppShell", () => {
  it("renders real navigation and identifies planned areas without making them links", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={<p>Dashboard content</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Dashboard content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Projects/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /GitHub Activity/ })).toBeInTheDocument();
    expect(screen.getByText("Development Log").closest("a")).toBeNull();
    expect(screen.getByText("Idea Lab").closest("a")).toBeNull();
    expect(screen.getAllByText("FUTURE")).toHaveLength(2);
    expect(screen.queryByText(/NEXUS AI/)).not.toBeInTheDocument();
  });
});
