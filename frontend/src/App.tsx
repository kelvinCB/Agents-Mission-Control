import { FormEvent, useEffect, useMemo, useState } from 'react';
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
  const [newMemoryTitle, setNewMemoryTitle] = useState('Memory');
  const [newMemoryFile, setNewMemoryFile] = useState<File | null>(null);
  const [createMessage, setCreateMessage] = useState('');

  useEffect(() => {
    void loadAllData();
  }, []);

  async function loadAllData() {
    try {
      setLoading(true);
      setError('');
      const [projectsRes, memoryRes, agendaRes] = await Promise.all([fetch('/api/projects'), fetch('/api/memory'), fetch('/api/agenda')]);
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

  function toggleAgent(agent: string) {
    setOpenAgents((prev) => ({ ...prev, [agent]: !prev[agent] }));
  }

  function handleAddAgent() {
    const agentName = window.prompt('Agent name');
    if (!agentName) return;
    setNewMemoryAgent(agentName.trim());
    setOpenAgents((prev) => ({ ...prev, [agentName.trim()]: true }));
  }

  async function handleCreateMemoryFile(e: FormEvent) {
    e.preventDefault();
    setCreateMessage('');
    if (!newMemoryFile) return setCreateMessage('Please attach a .md file first.');

    const formData = new FormData();
    formData.append('agent', newMemoryAgent);
    formData.append('title', newMemoryTitle);
    formData.append('file', newMemoryFile);

    const response = await fetch('/api/memory', { method: 'POST', body: formData });
    const data = (await response.json()) as { error?: string; agent?: string; fileName?: string };
    if (!response.ok) return setCreateMessage(data.error || 'Failed to upload file');

    setCreateMessage(`Uploaded ${data.fileName} for ${data.agent}.`);
    setNewMemoryFile(null);
    await loadAllData();
  }

  return (
    <div className="min-h-screen bg-background text-foreground grid grid-cols-[240px_1fr]">
      <aside className="border-r border-border p-4 bg-card/80 backdrop-blur-sm">
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

      <main className="p-6">
        <div className="flex justify-between items-center mb-4">
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
          <section className="grid grid-cols-[280px_1fr_360px] gap-4">
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
                <CardTitle>{selectedMemory ? `${selectedMemory.name}.md` : 'No file selected'}</CardTitle>
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
                  <Input value={newMemoryTitle} onChange={(e) => setNewMemoryTitle(e.target.value)} placeholder="Title" required />
                  <Input type="file" accept=".md,text/markdown" onChange={(e) => setNewMemoryFile(e.target.files?.[0] || null)} required />
                  <Button type="submit" className="w-full">Upload and Classify</Button>
                  {createMessage && <p className="text-sm text-muted-foreground">{createMessage}</p>}
                </form>
              </CardContent>
            </Card>
          </section>
        )}

        {!loading && !error && activeMenu === 'Agenda' && (
          <section className="space-y-3">
            {agenda.map((entry) => (
              <Card key={entry.name}>
                <CardHeader>
                  <CardTitle>{entry.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap">{entry.content}</pre>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
