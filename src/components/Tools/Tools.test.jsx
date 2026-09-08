import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Context } from '../../Context/context.js';
import Tools from './Tools.jsx';

afterEach(cleanup);

describe('Tools hub', () => {
  it.each(['Gemini', 'GPT', 'Claude'])('keeps the %s palette and opens Interpreter only on request', modelFeature => {
    const onOpenInterpreter = vi.fn();
    const context = { modelFeature, openSidebar: false, setOpenSidebar: vi.fn(), setOpenModal: vi.fn() };
    const { container } = render(<Context.Provider value={context}><Tools onOpenInterpreter={onOpenInterpreter} /></Context.Provider>);
    expect(container.querySelector(`.iapp-chat-${modelFeature.toLowerCase()}`)).toBeTruthy();
    expect(screen.getByText(/Audio capture begins only when you press Start/)).toBeTruthy();
    expect(onOpenInterpreter).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Interpreter AI/ }));
    expect(onOpenInterpreter).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(context.setOpenModal).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle navigation' }));
    expect(context.setOpenSidebar).toHaveBeenCalledWith(true);
  });
});
