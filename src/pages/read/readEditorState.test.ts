import { beforeEach, describe, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('../../lib/api', () => ({ readEditorSessionRequest: request, AUTH_TOKEN_CHANGED_EVENT: 'token-change' }));
import { getReadEditor, loadReadEditor, resetReadEditor } from './readEditorState';

beforeEach(() => { resetReadEditor(); request.mockReset(); });
describe('verified Read editor state', () => {
  it('starts closed and only accepts a successful server grant', async () => {
    expect(getReadEditor()).toBe(false);
    request.mockResolvedValue(true);
    await loadReadEditor();
    expect(getReadEditor()).toBe(true);
  });
  it('keeps refusal and dependency failure closed', async () => {
    request.mockResolvedValue(false);
    await loadReadEditor();
    expect(getReadEditor()).toBe(false);
    resetReadEditor();
    request.mockRejectedValue(new Error('offline'));
    await loadReadEditor();
    expect(getReadEditor()).toBe(false);
  });
  it('shares one session check across every mounted gate', async () => {
    request.mockResolvedValue(true);
    await Promise.all([loadReadEditor(), loadReadEditor(), loadReadEditor()]);
    expect(request).toHaveBeenCalledOnce();
  });
  it('drops an old in-flight grant on token change or sign-out', async () => {
    let complete!: (value: boolean) => void;
    request.mockReturnValue(new Promise<boolean>(resolve => { complete = resolve; }));
    const old = loadReadEditor();
    await Promise.resolve();
    resetReadEditor();
    complete(true);
    await old;
    expect(getReadEditor()).toBe(false);
  });
  it('serializes cookie writes so logout finishes after an older grant', async () => {
    let finishGrant!: (value: boolean) => void;
    request.mockReturnValueOnce(new Promise<boolean>(resolve => { finishGrant = resolve; })).mockResolvedValueOnce(false);
    const old = loadReadEditor();
    await Promise.resolve();
    resetReadEditor();
    const logout = loadReadEditor();
    expect(request).toHaveBeenCalledTimes(1);
    finishGrant(true);
    await Promise.all([old, logout]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(getReadEditor()).toBe(false);
  });

});
