import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const mocks = vi.hoisted(() => ({ check: vi.fn(), relaunch: vi.fn(), version: vi.fn(), desktop: true }));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: mocks.check }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: mocks.relaunch }));
vi.mock('@tauri-apps/api/app', () => ({ getVersion: mocks.version }));
vi.mock('../src/persistence', () => ({ get desktop() { return mocks.desktop; } }));
import AppUpdates from '../src/AppUpdates';
import type { WorkspaceSession } from '../src/persistence';
beforeEach(() => { vi.resetAllMocks(); mocks.desktop = true; mocks.version.mockResolvedValue('0.2.1'); });
function setup() {
  const flush = vi.fn().mockResolvedValue(undefined), lock = vi.fn();
  render(<AppUpdates session={{ flush } as unknown as WorkspaceSession} visible lock={lock}/>);
  return { flush, lock, user: userEvent.setup() };
}
function update() {
  return {version:'0.2.2', body:'Better notes', close:vi.fn().mockResolvedValue(undefined), download:vi.fn().mockResolvedValue(undefined), install:vi.fn().mockResolvedValue(undefined)};
}
it('reports no update and prevents duplicate checks while checking', async () => {
  let finish!: (value: null) => void;
  mocks.check.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { user } = setup(); await user.click(screen.getByText('Check for updates'));
  expect((screen.getByText('Check for updates') as HTMLButtonElement).disabled).toBe(true);
  finish(null); await screen.findByText('You’re up to date.'); expect(mocks.check).toHaveBeenCalledTimes(1);
});
it('downloads before flushing and flushes before installation and restart', async () => {
  const next = update(), order: string[] = [];
  next.download.mockImplementation(async () => { order.push('download'); });
  next.install.mockImplementation(async () => { order.push('install'); });
  mocks.check.mockResolvedValue(next); mocks.relaunch.mockImplementation(async () => { order.push('restart'); });
  const { user, flush, lock } = setup(); flush.mockImplementation(async () => { order.push('save'); });
  await user.click(screen.getByText('Check for updates')); expect(await screen.findByText('Better notes')).toBeTruthy();
  await user.click(screen.getByText('Download and install 0.2.2'));
  await waitFor(() => expect(order).toEqual(['download','save','install','restart']));
  expect(lock).toHaveBeenCalledWith(true); expect(lock).toHaveBeenLastCalledWith(false);
});
it('keeps the app open when workspace saving fails', async () => {
  const next = update(); mocks.check.mockResolvedValue(next);
  const { user, flush, lock } = setup(); flush.mockRejectedValue(Error('disk full'));
  await user.click(screen.getByText('Check for updates')); await user.click(await screen.findByText('Download and install 0.2.2'));
  await screen.findByText(/Update paused because your workspace could not be saved/);
  expect(next.install).not.toHaveBeenCalled(); expect(mocks.relaunch).not.toHaveBeenCalled(); expect(lock).toHaveBeenLastCalledWith(false);
});
it('allows retry after a failed download without installing', async () => {
  const next = update(); next.download.mockRejectedValueOnce(Error('bad signature')); mocks.check.mockResolvedValue(next);
  const { user, flush } = setup(); await user.click(screen.getByText('Check for updates'));
  await user.click(await screen.findByText('Download and install 0.2.2')); await screen.findByRole('alert');
  expect(flush).not.toHaveBeenCalled(); expect(next.install).not.toHaveBeenCalled();
  await user.click(screen.getByText('Download and install 0.2.2')); await waitFor(() => expect(next.install).toHaveBeenCalledTimes(1));
});
it('offers restart again without reinstalling if restart fails', async () => {
  const next = update(); mocks.check.mockResolvedValue(next); mocks.relaunch.mockRejectedValueOnce(Error('restart failed'));
  const { user } = setup(); await user.click(screen.getByText('Check for updates')); await user.click(await screen.findByText('Download and install 0.2.2'));
  await user.click(await screen.findByText('Restart Noted')); await waitFor(() => expect(mocks.relaunch).toHaveBeenCalledTimes(2)); expect(next.install).toHaveBeenCalledTimes(1);
});
it('explains offline errors and allows another check', async () => {
  mocks.check.mockRejectedValueOnce(Error('offline')).mockResolvedValue(null);
  const { user } = setup(); await user.click(screen.getByText('Check for updates')); await screen.findByRole('alert');
  await user.click(screen.getByText('Check for updates')); await screen.findByText('You’re up to date.');
});
it('disables the updater in browser previews', () => {
  mocks.desktop = false; setup(); expect((screen.getByText('Check for updates') as HTMLButtonElement).disabled).toBe(true); expect(mocks.check).not.toHaveBeenCalled();
});
