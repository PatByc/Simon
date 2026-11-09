import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary.js";

function BrokenComponent(): never {
  throw new Error("Test failure");
}

describe("ErrorBoundary", () => {
  it("shows a recoverable local error screen", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<ErrorBoundary><BrokenComponent /></ErrorBoundary>);

    expect(screen.getByRole("alert")).toHaveTextContent("The application could not continue");
    expect(screen.getByRole("button", { name: "Reload Simon" })).toBeVisible();
  });
});
