import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Context } from '../../Context/context.js';
import ChatSidebar from './ChatSidebar';

afterEach(cleanup);
describe.each(['Gemini', 'GPT', 'Claude'])('%s navigation', provider => {
  const setup = (openSidebar = true) => {
    const value = {
      chats: [{ id: 'files', messages: [{ text: '', attachments: [{ name: 'report.pdf' }] }] }],
      currentChatId: 'files', openSidebar, setOpenSidebar: vi.fn(), loadChat: vi.fn(),
      newChat: vi.fn(), deleteStorage: vi.fn(), handleDelete: vi.fn(), setOpenModal: vi.fn(),
    };
    render(<Context.Provider value={value}><ChatSidebar provider={provider} /></Context.Provider>);
    return value;
  };
  it('uses native buttons with separate open/delete actions and a file-based title', () => {
    const value = setup();
    expect(screen.getByRole('button', { name: 'New chat' }).tagName).toBe('BUTTON');
    const chat = screen.getByRole('button', { name: 'report.pdf', exact: true });
    expect(chat.getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: 'Delete chat: report.pdf' }));
    expect(value.handleDelete).toHaveBeenCalledWith(expect.anything(), 'files');
    expect(value.loadChat).not.toHaveBeenCalled();
    fireEvent.click(chat);
    expect(value.loadChat).toHaveBeenCalledWith('files');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(value.setOpenSidebar).toHaveBeenCalledWith(false);
  });
  it('keeps collapsed new/settings/clear controls labeled and operable', () => {
    const value = setup(false);
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
    expect(value.newChat).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(value.setOpenModal).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: 'Clear IApp data' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open chat navigation' }).getAttribute('aria-expanded')).toBe('false');
  });
});
