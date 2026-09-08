import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Context } from "../../Context/context.js";
import { FALLBACK_CATALOG } from "../../services/modelCatalog.js";
import Modal from "./Modal";

afterEach(cleanup);

const settings = () => ({
  setOpenModal: vi.fn(), modelFeature: "Gemini", modelCatalog: FALLBACK_CATALOG,
  setSelectedModel: vi.fn(), privacyMode: true, setPrivacyMode: vi.fn(), saveHistory: true,
  setSaveHistory: vi.fn(), instructions: "Explain in Spanish", setInstructions: vi.fn(),
  clearHistory: vi.fn(), loading: false, attachmentsLoading: false,
});

describe("settings dialog", () => {
  it("explains Interpreter privacy boundaries separately from chat settings", () => {
    render(<Context.Provider value={{ ...settings(), activeSection: 'interpreter' }}><Modal /></Context.Provider>);
    expect(screen.getByText(/changing privacy mode stops listening and clears its transcript and glossary/)).toBeTruthy();
    expect(screen.getByText(/apply to Chat, not speech or translation/)).toBeTruthy();
  });
  it("excludes private context controls and accurately explains retention", () => {
    const context = settings();
    render(<Context.Provider value={context}><Modal /></Context.Provider>);
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Custom instructions" }).disabled).toBe(true);
    expect(screen.getByRole("switch", { name: "Save chat history on this device" }).disabled).toBe(true);
    expect(screen.getByText(/instructions stay in memory until you reload/)).toBeTruthy();
    expect(screen.getByText(/This is not zero data retention/)).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "Privacy mode" }));
    expect(context.setPrivacyMode).toHaveBeenCalledWith(false);
  });

  it("focuses close, handles Escape, and restores focus and scrolling on dismissal", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const previousOverflow = document.body.style.overflow;
    const context = settings();
    const { unmount } = render(<Context.Provider value={context}><Modal /></Context.Provider>);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close settings" }));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(context.setOpenModal).toHaveBeenCalledWith(false);
    unmount();
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe(previousOverflow);
    opener.remove();
  });
});
