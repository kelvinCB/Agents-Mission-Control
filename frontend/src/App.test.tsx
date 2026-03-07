import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

function resolvePathname(url: RequestInfo | URL): string {
  if (typeof url === 'string') return new URL(url, 'http://localhost').pathname;
  if (typeof url === 'object' && url !== null && 'href' in url) {
    return new URL(String((url as { href: string }).href), 'http://localhost').pathname;
  }
  return new URL((url as Request).url, 'http://localhost').pathname;
}

function mockFetchOk() {
  return vi.spyOn(global, 'fetch').mockImplementation((url: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method || 'GET';

    if (method === 'POST' && String(url).includes('/api/memory/sync')) {
      return Promise.resolve(new Response(JSON.stringify({ message: 'Memory files synced to GitHub main.' }), { status: 200 }));
    }

    if (method === 'PATCH' && String(url).includes('/api/memory/rename')) {
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    }

    if (method === 'DELETE' && String(url).includes('/api/memory')) {
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    }

    if (method === 'POST' && String(url).includes('/api/memory')) {
      return Promise.resolve(new Response(JSON.stringify({ agent: 'Etiven', files: ['Memory-test-1.md', 'Memory-test-2.md'] }), { status: 201 }));
    }

    const requestPath = resolvePathname(url);

    if (requestPath.startsWith('/api/projects')) {
      return Promise.resolve(new Response(JSON.stringify([{ title: 'Task_Manager', url: 'https://kolium.com', image: 'x', progress: 100 }]), { status: 200 }));
    }

    if (requestPath.startsWith('/api/memory')) {
      return Promise.resolve(
        new Response(
          JSON.stringify([
            { agent: 'Etiven', files: [{ name: 'main-memory', content: 'hello world' }] },
            {
              agent: 'Maggi',
              files: [
                { name: 'Memory-2026-02-06', content: 'older note' },
                { name: 'Memory-2026-03-06', content: 'latest note' },
                { name: 'Memory-2026-02-13-2245', content: 'mid note with time' }
              ]
            }
          ]),
          { status: 200 }
        )
      );
    }

    if (requestPath === '/api/agenda') {
      return Promise.resolve(
        new Response(
          JSON.stringify([
            {
              name: 'AGENDA-2026-March-06',
              content:
                '# Agenda - 2026-03-06\n\n| # | Task | Status |\n|---|------|--------|\n| 1 | Buy sportswear | Pending |\n| 2 | Review OpenClaw PR | In Progress |\n\nSource: workspace memory.'
            },
            { name: 'AGENDA-2026-Mar-01', content: 'Maratón prep and shopping list\n# Agenda - 2026-03-01' },
            { name: 'AGENDA-2026-March-10', content: '# Agenda - 2026-03-10' },
            { name: 'AGENDA-2025-August-01', content: '# Agenda - 2025-08-01' },
            { name: 'AGENDA-NO-DATE', content: 'manual note without parseable date' }
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

  it('shows agent memories sorted newest to oldest', async () => {
    mockFetchOk();
    render(<App />);

    await waitFor(() => expect(screen.getAllByTestId('memory-file-button').length).toBeGreaterThan(0));

    const orderedMemoryTitles = screen
      .getAllByTestId('memory-file-button')
      .map((el) => (el.textContent || '').match(/Memory-\d{4}-\d{2}-\d{2}(?:-\d{4})?\.md/)?.[0] || '')
      .filter((text) => text.startsWith('Memory-2026-'));

    expect(orderedMemoryTitles.slice(0, 3)).toEqual([
      'Memory-2026-03-06.md',
      'Memory-2026-02-13-2245.md',
      'Memory-2026-02-06.md'
    ]);
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

  it('deletes selected memory file', async () => {
    const fetchMock = mockFetchOk();
    render(<App />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete file' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete file' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Delete Memory File' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/memory', expect.objectContaining({ method: 'DELETE' }))
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

  it('renders agenda in a friendly table view', async () => {
    mockFetchOk();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Agenda' }));
    await waitFor(() => expect(screen.getByText('Agenda - 2026-03-06')).toBeInTheDocument());

    expect(screen.getByRole('columnheader', { name: 'Task' })).toBeInTheDocument();
    expect(screen.getByText('Buy sportswear')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('shows agenda sorted newest first by default and allows oldest first', async () => {
    mockFetchOk();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Agenda' }));
    await waitFor(() => expect(screen.getByText('Agenda - 2026-03-06')).toBeInTheDocument());

    const newest = screen.getByText('Agenda - 2026-03-06');
    const undated = screen.getByText('AGENDA-NO-DATE');
    expect(Boolean(newest.compareDocumentPosition(undated) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    fireEvent.change(screen.getByDisplayValue('Most recent → oldest'), { target: { value: 'asc' } });

    const oldest = screen.getByText('AGENDA-2025-August-01');
    const newestAfterAsc = screen.getByText('Agenda - 2026-03-06');
    expect(Boolean(oldest.compareDocumentPosition(newestAfterAsc) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
  });

  it('filters agenda entries by keyword', async () => {
    mockFetchOk();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Agenda' }));
    await waitFor(() => expect(screen.getByText('AGENDA-2026-Mar-01')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Search agenda by keyword...'), {
      target: { value: 'maraton' }
    });

    expect(screen.getByText('AGENDA-2026-Mar-01')).toBeInTheDocument();
    expect(screen.queryByText('AGENDA-2025-August-01')).not.toBeInTheDocument();
  });

  it('filters agenda by date range', async () => {
    mockFetchOk();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Agenda' }));
    await waitFor(() => expect(screen.getByText('Agenda - 2026-03-06')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Agenda from date'), { target: { value: '2026-03-05' } });
    fireEvent.change(screen.getByLabelText('Agenda to date'), { target: { value: '2026-03-07' } });

    expect(screen.getByText('Agenda - 2026-03-06')).toBeInTheDocument();
    expect(screen.queryByText('AGENDA-2026-Mar-01')).not.toBeInTheDocument();
    expect(screen.queryByText('AGENDA-2026-March-10')).not.toBeInTheDocument();
    expect(screen.queryByText('AGENDA-NO-DATE')).not.toBeInTheDocument();
  });

  it('shows validation message when date range is invalid', async () => {
    mockFetchOk();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Agenda' }));
    await waitFor(() => expect(screen.getByText('Agenda - 2026-03-06')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Agenda from date'), { target: { value: '2026-03-10' } });
    fireEvent.change(screen.getByLabelText('Agenda to date'), { target: { value: '2026-03-05' } });

    expect(screen.getByText(/Invalid range:/i)).toBeInTheDocument();
  });

  it('shows error when API request fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify([]), { status: 500 }));
    render(<App />);
    await waitFor(() => expect(screen.getByText('Unable to load Mission Control data. Please retry.')).toBeInTheDocument());
  });
});
