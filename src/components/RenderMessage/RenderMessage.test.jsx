import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RenderMessage, { UserMessage } from "./RenderMessage";
import { generatedImageDataUrl, legacyTokensToText } from "../../services/messageFormat.js";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1cAAAAASUVORK5CYII=";

describe("message rendering", () => {
  it("preserves fenced code and copies its actual text in user and model messages", async () => {
    const code = 'const view = <main data-value="a & b">Hi</main>;\n';
    const text = `Example:\n\n\`\`\`jsx\n${code}\`\`\``;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<><UserMessage text={text} /><RenderMessage text={text} /></>);
    const blocks = screen.getAllByLabelText("jsx code block");
    expect(blocks).toHaveLength(2);
    expect(blocks.every(block => block.textContent === code)).toBe(true);
    expect(document.querySelector("main[data-value]")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Copy code" })[0]);
    await screen.findByRole("button", { name: "Copied!" });
    expect(writeText).toHaveBeenCalledWith(code);
  });

  it("does not automatically load model supplied images or enable unsafe links", () => {
    const { container } = render(<RenderMessage text={'![tracker](https://tracker.example/pixel.png)\n\n[danger](javascript:alert(1))\n\n[Documentation](https://example.com/docs)\n\n<img src="https://tracker.example/other.png" onerror="alert(1)">'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("[External image omitted: tracker]")).toBeTruthy();
    expect(screen.getByText("danger").tagName).toBe("SPAN");
    const link = screen.getByRole("link", { name: "Documentation" });
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders downloadable native raster images and rejects URL/SVG payloads", () => {
    const image = { mime_type: "image/png", data: png, alt: "Generated landscape" };
    const { rerender } = render(<RenderMessage images={[image]} />);
    const displayed = screen.getByRole("img", { name: "Generated landscape" });
    expect(displayed.getAttribute("src")).toBe(`data:image/png;base64,${png}`);
    const download = screen.getByRole("link", { name: "Download image" });
    expect(download.getAttribute("download")).toBe("iapp-image-1.png");
    expect(download.getAttribute("href")).toBe(displayed.getAttribute("src"));
    rerender(<RenderMessage images={[{ mime_type: "image/svg+xml", data: "PHN2Zz48L3N2Zz4=" }]} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("could not be displayed");
    expect(generatedImageDataUrl({ mime_type: "image/png", data: "https://example.com/image.png" })).toBeNull();
    expect(generatedImageDataUrl({ mime_type: "image/jpeg", data: png })).toBeNull();
  });

  it("keeps nested backticks in legacy code history intact", () => {
    const code = 'console.log("```example```");';
    const converted = legacyTokensToText([{ type: "heading", level: 2, content: "Old answer" }, { type: "code", language: "javascript", content: code }]);
    render(<RenderMessage text={converted} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Old answer");
    expect(screen.getByLabelText("javascript code block").textContent).toBe(`${code}\n`);
  });
});
