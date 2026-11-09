import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SafeMarkdown } from "./SafeMarkdown.js";

describe("SafeMarkdown", () => {
  it("renders safe links in a separate protected tab", () => {
    render(<SafeMarkdown>[Documentation](https://example.com/docs)</SafeMarkdown>);
    expect(screen.getByRole("link", { name: "Documentation" })).toMatchObject({
      target: "_blank",
      rel: "noreferrer noopener",
    });
  });

  it("does not expose unsafe javascript links", () => {
    render(<SafeMarkdown>[Unsafe](javascript:alert(1))</SafeMarkdown>);
    expect(screen.getByText("Unsafe").closest("a")).not.toHaveAttribute("href", expect.stringContaining("javascript"));
  });

  it("copies fenced code without mutating the rendered content", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<SafeMarkdown>{"```ts\nconst ready = true;\n```"}</SafeMarkdown>);

    await user.click(screen.getByRole("button", { name: "Copy code" }));
    expect(writeText).toHaveBeenCalledWith("const ready = true;");
    expect(screen.getByRole("button", { name: "Code copied" })).toBeVisible();
  });

  it("blocks remote Markdown images", () => {
    render(<SafeMarkdown>![private diagram](https://example.com/private.png)</SafeMarkdown>);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("[Image blocked: private diagram]")).toBeVisible();
  });
});
