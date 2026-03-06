import { DragEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Select } from './components/ui/select';

type Project = { title: string; url: string; image: string; progress: number };
type MemoryFile = { name: string; content: string };
type MemoryGroup = { agent: string; files: MemoryFile[] };
type AgendaEntry = { name: string; content: string };

const menuItems = ['Memory', 'Projects', 'Agenda'] as const;
type Menu = (typeof menuItems)[number];

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') || '';
const apiUrl = (path: string) => `${API_BASE}${path}`;

type ParsedAgenda = {
  heading?: string;
  headers: string[];
  rows: string[][];
  notes: string[];
};

function parseMarkdownTableRow(line: string): string[] {
  const normalized = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let current = '';
  let inBackticks = false;
  let escaped = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      const next = normalized[i + 1];
      if (next === '|' || next === '\\' || next === '`') {
        escaped = true;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '`') {
      inBackticks = !inBackticks;
      current += ch;
      continue;
    }

    if (ch === '|' && !inBackticks) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  if (escaped) {
    // Preserve trailing backslash when it is not escaping a supported token.
    current += '\\';
  }

  cells.push(current.trim());
  return cells;
}

function parseAgenda(content: string): ParsedAgenda {
  const lines = content.split(/\r?\n/);
  const heading = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, '').trim();

  let tableHeaderIndex = -1;
  for (let i = 0; i < lines.length - 1; i += 1) {
    const current = lines[i].trim();
    const next = lines[i + 1].trim();
    if (current.includes('|') && /^\|?\s*:?-{3,}/.test(next)) {
      tableHeaderIndex = i;
      break;
    }
  }

  if (tableHeaderIndex === -1) {
    return {
      heading,
      headers: [],
      rows: [],
      notes: lines.filter((line) => line.trim() && !/^#\s+/.test(line)).map((line) => line.trim())
    };
  }

  const headers = parseMarkdownTableRow(lines[tableHeaderIndex]);
  const rows: string[][] = [];

  for (let i = tableHeaderIndex + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (!line.includes('|')) break;
    rows.push(parseMarkdownTableRow(line));
  }

  const notes = lines
    .slice(tableHeaderIndex + 2 + rows.length)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('|'));

  return { heading, headers, rows, notes };
}

function statusTone(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (/\b(done|complete|completed)\b/i.test(normalized)) {
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  }
  if (/\b(in\s*progress|progress|ongoing)\b/i.test(normalized)) {
    return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  }
  return 'bg-slate-500/15 text-slate-200 border-slate-500/30';
}

export default function App() {
  const [activeMenu, setActiveMenu] = useState<Menu>('Memory');
  const [projects, setProjects] = useState<Project[]>([]);
  const [memory, setMemory] = useState<MemoryGroup[]>([]);
  const [agenda, setAgenda] = useState<AgendaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [memorySearch, setMemorySearch] = useState('');
  const [selectedMemoryKey, setSelectedMemoryKey] = useState('');
  const [openAgents, setOpenAgents] = useState<Record<string, boolean>>({});

  const [newMemoryAgent, setNewMemoryAgent] = useState('Etiven');
  const [newMemoryTitle, setNewMemoryTitle] = useState('');
  const [newMemoryFiles, setNewMemoryFiles] = useState<File[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [createMessage, setCreateMessage] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncing, setSyncing] = useState(false);

  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentError, setNewAgentError] = useState('');

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    void loadAllData();
  }, []);

  async function loadAllData() {
    try {
      setLoading(true);
      setError('');
      const [projectsRes, memoryRes, agendaRes] = await Promise.all([fetch(apiUrl('/api/projects')), fetch(apiUrl('/api/memory')), fetch(apiUrl('/api/agenda'))]);
      if (!projectsRes.ok || !memoryRes.ok || !agendaRes.ok) throw new Error('request failed');
      const [projectsData, memoryData, agendaData] = await Promise.all([
        projectsRes.json() as Promise<Project[]>,
        memoryRes.json() as Promise<MemoryGroup[]>,
        agendaRes.json() as Promise<AgendaEntry[]>
      ]);
      setProjects(projectsData);
      setMemory(memoryData);
      setAgenda(agendaData);
      setOpenAgents(Object.fromEntries(memoryData.map((group) => [group.agent, true])));
      const first = memoryData?.[0];
      if (first?.files?.[0]) setSelectedMemoryKey(`${first.agent}/${first.files[0].name}`);
    } catch {
      setError('Unable to load Mission Control data. Please retry.');
    } finally {
      setLoading(false);
    }
  }

  const flattenedMemory = useMemo(() => memory.flatMap((g) => g.files.map((f) => ({ ...f, agent: g.agent, key: `${g.agent}/${f.name}` }))), [memory]);
  const filteredMemory = useMemo(() => {
    const q = memorySearch.trim().toLowerCase();
    if (!q) return flattenedMemory;
    return flattenedMemory.filter((m) => m.name.toLowerCase().includes(q) || m.agent.toLowerCase().includes(q) || m.content.toLowerCase().includes(q));
  }, [flattenedMemory, memorySearch]);

  const groupedFilteredMemory = useMemo(() => {
    return filteredMemory.reduce<Record<string, typeof filteredMemory>>((acc, item) => {
      if (!acc[item.agent]) acc[item.agent] = [];
      acc[item.agent].push(item);
      return acc;
    }, {});
  }, [filteredMemory]);

  const selectedMemory = filteredMemory.find((f) => f.key === selectedMemoryKey) || filteredMemory[0];

  const agentOptions = useMemo(() => {
    const fromMemory = Array.from(new Set(memory.map((group) => group.agent)));
    const merged = new Set([...fromMemory, newMemoryAgent].filter(Boolean));
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [memory, newMemoryAgent]);

  const parsedAgendaEntries = useMemo(
    () => agenda.map((entry) => ({ entry, parsed: parseAgenda(entry.content) })),
    [agenda],
  );

  function toggleAgent(agent: string) {
    setOpenAgents((prev) => ({ ...prev, [agent]: !prev[agent] }));
  }

  function handleAddAgent() {
    setNewAgentName('');
    setNewAgentError('');
    setShowAddAgentModal(true);
  }

  function openRenameModal() {
    if (!selectedMemory) return;
    setRenameValue(selectedMemory.name);
    setRenameError('');
    setShowRenameModal(true);
  }

  function openDeleteModal() {
    if (!selectedMemory) return;
    setDeleteError('');
    setShowDeleteModal(true);
  }

  function handleConfirmAddAgent() {
    const normalized = newAgentName.trim();

    if (!normalized) {
      setNewAgentError('Agent name is required.');
      return;
    }

    if (!/^[a-zA-Z0-9-_\s]+$/.test(normalized)) {
      setNewAgentError('Use only letters, numbers, spaces, dash or underscore.');
      return;
    }

    const exists = agentOptions.some((agent) => agent.toLowerCase() === normalized.toLowerCase());
    if (exists) {
      setNewAgentError('This agent already exists.');
      return;
    }

    setNewMemoryAgent(normalized);
    setOpenAgents((prev) => ({ ...prev, [normalized]: true }));
    setShowAddAgentModal(false);
    setNewAgentName('');
    setNewAgentError('');
  }

  async function handleCreateMemoryFile(e: FormEvent) {
    e.preventDefault();
    setCreateMessage('');
    if (newMemoryFiles.length === 0) return setCreateMessage('Please attach at least one .md file.');

    const formData = new FormData();
    formData.append('agent', newMemoryAgent);
    if (newMemoryTitle.trim()) formData.append('titlePrefix', newMemoryTitle.trim());
    newMemoryFiles.forEach((file) => formData.append('files', file));

    const response = await fetch(apiUrl('/api/memory'), { method: 'POST', body: formData });
    const data = (await response.json()) as { error?: string; agent?: string; files?: string[] };
    if (!response.ok) return setCreateMessage(data.error || 'Failed to upload files');

    setCreateMessage(`Uploaded ${data.files?.length || 0} file(s) for ${data.agent}.`);
    setNewMemoryFiles([]);
    setNewMemoryTitle('');
    await loadAllData();
  }

  function mergeFilesWithExisting(incoming: File[]) {
    const map = new Map<string, File>();
    [...newMemoryFiles, ...incoming].forEach((file) => {
      if (file.name.toLowerCase().endsWith('.md')) map.set(file.name, file);
    });
    setNewMemoryFiles(Array.from(map.values()));
  }

  function handleDropFiles(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    const files = Array.from(event.dataTransfer.files || []);
    mergeFilesWithExisting(files);
  }

  async function handleRenameMemoryTitle() {
    if (!selectedMemory) return;

    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError('New title is required.');
      return;
    }

    const response = await fetch(apiUrl('/api/memory/rename'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: selectedMemory.agent,
        oldName: selectedMemory.name,
        newName: trimmed
      })
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setRenameError(data.error || 'Failed to rename file.');
      return;
    }

    setShowRenameModal(false);
    setRenameValue('');
    setRenameError('');
    await loadAllData();
  }

  async function handleDeleteMemoryFile() {
    if (!selectedMemory) return;

    const response = await fetch(apiUrl('/api/memory'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: selectedMemory.agent, name: selectedMemory.name })
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setDeleteError(data.error || 'Failed to delete file.');
      return;
    }

    setShowDeleteModal(false);
    setDeleteError('');
    await loadAllData();
  }

  async function handleSyncMemoriesToGithub() {
    setSyncing(true);
    setSyncMessage('');

    try {
      const response = await fetch(apiUrl('/api/memory/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setSyncMessage(data.error || 'Failed to sync memory files to GitHub.');
      } else {
        setSyncMessage(data.message || 'Memory files synced to GitHub.');
      }
    } catch {
      setSyncMessage('Failed to sync memory files to GitHub.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground grid grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="border-b md:border-b-0 md:border-r border-border p-4 bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-1">
          <img src="/brand/logo.svg" alt="Mission Control logo" className="h-8 w-8" />
          <h2 className="text-xl font-semibold tracking-tight">Mission Control</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Memory · Projects · Agenda</p>
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <Button key={item} variant={activeMenu === item ? 'default' : 'outline'} className="w-full justify-start" onClick={() => setActiveMenu(item)}>
              {item}
            </Button>
          ))}
        </nav>
      </aside>

      <main className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 mb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Agents Mission Control</h1>
          {activeMenu === 'Memory' && <Input className="w-80" placeholder="Search memory..." value={memorySearch} onChange={(e) => setMemorySearch(e.target.value)} />}
        </div>

        {loading && <p>Loading Mission Control...</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && !error && activeMenu === 'Projects' && (
          <section className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
            {projects.map((project) => (
              <Card key={project.title}>
                <CardHeader>
                  <img src={project.image} alt={`${project.title} visual`} className="w-full h-36 object-cover rounded-lg" />
                  <CardTitle>{project.title}</CardTitle>
                  <a href={project.url} target="_blank" rel="noreferrer noopener" className="text-sky-300 text-sm">{project.url}</a>
                </CardHeader>
                <CardContent>
                  <div className="h-3 rounded-full bg-secondary"><div className="h-3 rounded-full bg-green-500" style={{ width: `${project.progress}%` }} /></div>
                  <p className="text-sm text-muted-foreground mt-1">{project.progress}% complete</p>
                </CardContent>
              </Card>
            ))}
          </section>
        )}

        {!loading && !error && activeMenu === 'Memory' && (
          <section className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={handleSyncMemoriesToGithub} disabled={syncing}>
                {syncing ? 'Syncing...' : 'Guardar memories a GitHub'}
              </Button>
            </div>
            {syncMessage && <p className="text-sm text-muted-foreground text-right">{syncMessage}</p>}

            <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_360px] gap-4">
            <Card className="p-2 max-h-[76vh] overflow-auto">
              {Object.entries(groupedFilteredMemory).map(([agent, files]) => {
                const isOpen = openAgents[agent] ?? true;
                return (
                  <div key={agent} className="mb-2 rounded-md border border-border bg-secondary/30">
                    <button
                      type="button"
                      onClick={() => toggleAgent(agent)}
                      className="w-full px-3 py-2 text-left text-sm font-semibold flex items-center justify-between"
                    >
                      <span>{agent}</span>
                      <span className="text-xs text-muted-foreground">{isOpen ? '−' : '+'}</span>
                    </button>

                    {isOpen && (
                      <div className="px-2 pb-2 space-y-2">
                        {files.map((file) => (
                          <Button
                            key={file.key}
                            variant={selectedMemory?.key === file.key ? 'default' : 'secondary'}
                            className="w-full justify-start h-auto py-2"
                            onClick={() => setSelectedMemoryKey(file.key)}
                          >
                            <div>
                              <div className="font-semibold">{file.name}.md</div>
                              <div className="text-xs opacity-80">{agent}</div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <Button variant="outline" className="w-full mt-2" onClick={handleAddAgent}>
                Agregar Agente
              </Button>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{selectedMemory ? `${selectedMemory.name}.md` : 'No file selected'}</CardTitle>
                  {selectedMemory && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={openRenameModal}>
                        Edit title
                      </Button>
                      <Button variant="outline" size="sm" onClick={openDeleteModal}>
                        Delete file
                      </Button>
                    </div>
                  )}
                </div>
                {selectedMemory && <p className="text-sm text-muted-foreground">Agent: {selectedMemory.agent}</p>}
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed">{selectedMemory?.content || 'No memory file matches your search.'}</pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Attach Memory File (.md)</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-2" onSubmit={(e) => void handleCreateMemoryFile(e)}>
                  <Select value={newMemoryAgent} onChange={(e) => setNewMemoryAgent(e.target.value)} required>
                    {agentOptions.map((agent) => (
                      <option key={agent} value={agent}>
                        {agent}
                      </option>
                    ))}
                  </Select>
                  <Input value={newMemoryTitle} onChange={(e) => setNewMemoryTitle(e.target.value)} placeholder="Optional title prefix (e.g. Memory-2026-03-05)" />
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragActive(true);
                    }}
                    onDragLeave={() => setIsDragActive(false)}
                    onDrop={handleDropFiles}
                    className={`rounded-md border-2 border-dashed p-4 text-sm text-center transition-colors ${
                      isDragActive ? 'border-primary bg-accent/40' : 'border-border bg-background/40'
                    }`}
                  >
                    <p className="font-medium">Drag & drop .md files here</p>
                    <p className="text-xs text-muted-foreground mt-1">or use the file picker below</p>
                  </div>

                  <Input
                    type="file"
                    accept=".md,text/markdown"
                    multiple
                    onChange={(e) => mergeFilesWithExisting(Array.from(e.target.files || []))}
                    required={newMemoryFiles.length === 0}
                  />

                  {newMemoryFiles.length > 0 && (
                    <div className="rounded-md border border-border p-2 max-h-28 overflow-auto">
                      <p className="text-xs text-muted-foreground mb-1">Selected files ({newMemoryFiles.length})</p>
                      <ul className="space-y-1">
                        {newMemoryFiles.map((file) => (
                          <li key={file.name} className="text-xs">• {file.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button type="submit" className="w-full">Upload and Classify</Button>
                  {createMessage && <p className="text-sm text-muted-foreground">{createMessage}</p>}
                </form>
              </CardContent>
            </Card>
            </div>
          </section>
        )}

        {!loading && !error && activeMenu === 'Agenda' && (
          <section className="space-y-4">
            {parsedAgendaEntries.map(({ entry, parsed }) => (
              <Card key={entry.name} className="overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/70 bg-secondary/25">
                  <CardTitle className="text-lg">{parsed.heading || entry.name}</CardTitle>
                  {parsed.heading && <p className="text-xs text-muted-foreground">{entry.name}</p>}
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {parsed.headers.length > 0 ? (
                    <div className="overflow-x-auto rounded-md border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/35">
                          <tr>
                            {parsed.headers.map((header, idx) => (
                              <th key={`${entry.name}-h-${header || 'col'}-${idx}`} className="px-3 py-2 text-left font-semibold">
                                {header || `Column ${idx + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {parsed.rows.length > 0 ? (
                            parsed.rows.map((row, rowIndex) => (
                              <tr key={`${entry.name}-r-${rowIndex}`} className="border-t border-border/60">
                                {row.map((cell, cellIndex) => {
                                  const isStatusCol = parsed.headers[cellIndex]?.toLowerCase().includes('status');
                                  return (
                                    <td key={`${entry.name}-c-${rowIndex}-${cellIndex}`} className="px-3 py-2 align-top">
                                      {isStatusCol ? (
                                        <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium ${statusTone(cell)}`}>
                                          {cell}
                                        </span>
                                      ) : (
                                        <span>{cell}</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))
                          ) : (
                            <tr className="border-t border-border/60">
                              <td colSpan={Math.max(parsed.headers.length, 1)} className="px-3 py-3 text-sm text-muted-foreground">
                                No items in this agenda yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-md border border-border bg-secondary/15 p-3">
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed">{entry.content}</pre>
                    </div>
                  )}

                  {parsed.notes.length > 0 && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      {parsed.notes.map((note, idx) => (
                        <p key={`${entry.name}-note-${note}-${idx}`}>{note}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </main>

      {showAddAgentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add Agent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={newAgentName}
                onChange={(e) => {
                  setNewAgentName(e.target.value);
                  if (newAgentError) setNewAgentError('');
                }}
                placeholder="Agent name"
                autoFocus
              />
              {newAgentError && <p className="text-sm text-red-400">{newAgentError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddAgentModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmAddAgent}>Add Agent</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showRenameModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Edit Memory Title</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={renameValue}
                onChange={(e) => {
                  setRenameValue(e.target.value);
                  if (renameError) setRenameError('');
                }}
                placeholder="New title"
                autoFocus
              />
              {renameError && <p className="text-sm text-red-400">{renameError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowRenameModal(false)}>
                  Cancel
                </Button>
                <Button onClick={() => void handleRenameMemoryTitle()}>Save title</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Delete Memory File</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This will permanently delete <strong>{selectedMemory?.name}.md</strong> from <strong>{selectedMemory?.agent}</strong>.
              </p>
              {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </Button>
                <Button onClick={() => void handleDeleteMemoryFile()}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
