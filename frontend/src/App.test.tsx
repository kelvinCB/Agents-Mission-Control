import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders sidebar and project data', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') return Promise.resolve(new Response(JSON.stringify({ agent: 'Etiven', fileName: 'Memory.md' }), { status: 200 }));
      if (String(url).includes('/api/projects')) return Promise.resolve(new Response(JSON.stringify([{ title: 'Task_Manager', url: 'https://kolium.com', image: 'x', progress: 100 }]), { status: 200 }));
      if (String(url).includes('/api/memory')) return Promise.resolve(new Response(JSON.stringify([{ agent: 'Etiven', files: [{ name: 'main-memory', content: 'hello world' }] }]), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    await waitFor(() => expect(screen.getByText('Task_Manager')).toBeInTheDocument());
  });

  it('shows error when API request fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify([]), { status: 500 }));
    render(<App />);
    await waitFor(() => expect(screen.getByText('Unable to load Mission Control data. Please retry.')).toBeInTheDocument());
  });
});
