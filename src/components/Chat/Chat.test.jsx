import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Context } from "../../Context/context.js";
import { FALLBACK_CATALOG } from "../../services/modelCatalog.js";
import Chat from "./Chat";

afterEach(cleanup);

const baseContext = () => ({
  currentChat: null, currentChatId: null, onSent: vi.fn(), userPrompt: "Review this", setUserPrompt: vi.fn(),
  loading: false, cancelRequest: vi.fn(), error: "", dismissError: vi.fn(), attachments: [],
  addAttachments: vi.fn(), removeAttachment: vi.fn(), attachmentError: "", attachmentsLoading: false,
  mode: "chat", setMode: vi.fn(), setModelFeature: vi.fn(), modelCatalog: FALLBACK_CATALOG,
  selectedModels: {}, privacyMode: true, openModal: false, setOpenModal: vi.fn(), openSidebar: false,
  setOpenSidebar: vi.fn(), userName: "Calvin", saveHistory: true,
});

const showChat = (overrides = {}, provider = "Gemini") => {
  const context = { ...baseContext(), ...overrides };
  return { ...render(<Context.Provider value={context}><Chat provider={provider} /></Context.Provider>), context };
};

describe("chat controls", () => {
  it("allows a file-only analysis request", () => {
    const { context } = showChat({ userPrompt: "", attachments: [{ id: "file", name: "notes.txt", size: 4, data: "dGVzdA==" }] });
    const send = screen.getByRole("button", { name: "Send message" });
    expect(send.disabled).toBe(false);
    fireEvent.click(send);
    expect(context.onSent).toHaveBeenCalledOnce();
  });

  it("keeps attachments visible and blocks incompatible image creation", () => {
    showChat({ mode: "image", attachments: [{ id: "file", name: "notes.txt", size: 4, data: "dGVzdA==" }] });
    expect(screen.getAllByRole("button", { name: "Create image" }).find(button => button.type === "submit").disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Remove notes.txt" }).disabled).toBe(false);
    expect(screen.getByText(/Remove your attachments or switch to Chat/)).toBeTruthy();
  });

  it("prevents new draft text from being overwritten by pending request recovery", () => {
    const { context } = showChat({ loading: true });
    expect(screen.getByRole("textbox", { name: "Message Gemini" }).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(context.cancelRequest).toHaveBeenCalledOnce();
  });

  it("explains unavailable saved images and failed turns after reopening a chat", () => {
    showChat({ currentChatId: "saved", currentChat: { messages: [
      { id: "first", role: "user", text: "Check this", status: "failed", attachments: [{ name: "notes.txt" }] },
      { id: "second", role: "assistant", text: "", imagesOmitted: true },
    ] } });
    expect(screen.getByText("Reattach to analyze again")).toBeTruthy();
    expect(screen.getByText(/Request failed · This message is not included/)).toBeTruthy();
    expect(screen.getByText(/Generated images were not saved/)).toBeTruthy();
  });
});
