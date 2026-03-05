import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

function mockFetchOk() {
  return vi.spyOn(global, 'fetch').mockImplementation((url: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method || 'GET';

    if (method === 'POST' && String(url).includes('/api/memory/sync')) {
      return Promise.resolve(new Response(JSON.stringify({ message: 'Memory files synced to GitHub main.' }), { status: 200 }));
    }

    if (method === 'PATCH' && String(url).includes('/api/memory/rename')) {
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    }

    if (method === 'POST' && String(url).includes('/api/memory')) {
      return Promise.resolve(new Response(JSON.stringify({ agent: 'Etiven', files: ['Memory-test-1.md', 'Memory-test-2.md'] }), { status: 201 }));
    }

    if (String(url).includes('/api/projects')) {
      return Promise.resolve(new Response(JSON.stringify([{ title: 'Task_Manager', url: 'https://kolium.com', image: 'x', progress: 100 }]), { status: 200 }));
    }

    if (String(url).includes('/api/memory')) {
      return Promise.resolve(
        new Response(
          JSON.stringify([
            { agent: 'Etiven', files: [{ name: 'main-memory', content: 'hello world' }] },
            { agent: 'Maggi', files: [{ name: 'Memory-2026-03-03', content: 'notes' }] }
          ]),
          { status: 200 }
        )
      );
    }

    return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
  });
}

describe('App', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders sidebar and project data', async () => {
    mockFetchOk();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    await waitFor(() => expect(screen.getByText('Task_Manager')).toBeInTheDocument());
  });

  it('opens add-agent modal and validates duplicate names', async () => {
    mockFetchOk();
    render(<App />);

    await waitFor(() => expect(screen.getAllByText('main-memory.md').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Agente' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Add Agent' })).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Agent name'), { target: { value: 'Etiven' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Agent' })[0]);

    await waitFor(() => expect(screen.getByText('This agent already exists.')).toBeInTheDocument());
  });

  it('shows drag and drop helper in memory upload card', async () => {
    mockFetchOk();
    render(<App />);

    await waitFor(() => expect(screen.getByText('Drag & drop .md files here')).toBeInTheDocument());
  });

  it('renames selected memory title', async () => {
    const fetchMock = mockFetchOk();
    render(<App />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit title' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Edit title' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Edit Memory Title' })).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('New title'), { target: { value: 'Memory-Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save title' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/memory/rename', expect.objectContaining({ method: 'PATCH' }))
    );
  });

  it('triggers memory sync action', async () => {
    const fetchMock = mockFetchOk();
    render(<App />);

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Guardar memories a GitHub' }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar memories a GitHub' })[0]);

    await waitFor(() => expect(screen.getByText('Memory files synced to GitHub main.')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/memory/sync', expect.objectContaining({ method: 'POST' }));
  });

  it('shows error when API request fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify([]), { status: 500 }));
    render(<App />);
    await waitFor(() => expect(screen.getByText('Unable to load Mission Control data. Please retry.')).toBeInTheDocument());
  });
});
