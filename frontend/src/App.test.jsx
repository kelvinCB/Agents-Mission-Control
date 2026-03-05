import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import App from './App.jsx';

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders sidebar and project data', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((url, init) => {
      if (init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ agent: 'Etiven', fileName: 'Memory.md' }) });
      }

      if (String(url).includes('/api/projects')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ title: 'Task_Manager', url: 'https://kolium.com', image: 'x', progress: 100 }]) });
      }

      if (String(url).includes('/api/memory')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ agent: 'Etiven', files: [{ name: 'main-memory', content: 'hello world' }] }])
        });
      }

      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<App />);
    expect(screen.getByText('Mission Control')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    await waitFor(() => expect(screen.getByText('Task_Manager')).toBeInTheDocument());
  });

  it('shows error when API request fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, json: () => Promise.resolve([]) });

    render(<App />);
    await waitFor(() =>
      expect(screen.getByText('Unable to load Mission Control data. Please retry.')).toBeInTheDocument()
    );
  });
});
