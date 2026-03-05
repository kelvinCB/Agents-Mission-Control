import { FormEvent, useEffect, useMemo, useState } from 'react';

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

  const [newMemoryAgent, setNewMemoryAgent] = useState('Etiven');
  const [newMemoryTitle, setNewMemoryTitle] = useState('Memory');
  const [newMemoryTags, setNewMemoryTags] = useState('journal');
  const [newMemorySource, setNewMemorySource] = useState('manual-entry');
  const [newMemoryPriority, setNewMemoryPriority] = useState('normal');
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [createMessage, setCreateMessage] = useState('');

  useEffect(() => { void loadAllData(); }, []);

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
  const selectedMemory = filteredMemory.find((f) => f.key === selectedMemoryKey) || filteredMemory[0];

  async function handleCreateMemoryFile(e: FormEvent) {
    e.preventDefault();
    setCreateMessage('');
    const response = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: newMemoryAgent,
        title: newMemoryTitle,
        tags: newMemoryTags,
        source: newMemorySource,
        priority: newMemoryPriority,
        content: newMemoryContent
      })
    });
    const data = (await response.json()) as { error?: string; agent?: string; fileName?: string };
    if (!response.ok) return setCreateMessage(data.error || 'Failed to create file');
    setCreateMessage(`Created ${data.fileName} for ${data.agent}.`);
    setNewMemoryContent('');
    await loadAllData();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 grid grid-cols-[250px_1fr]">
      <aside className="border-r border-slate-800 p-4">
        <h2 className="text-xl font-semibold mb-4">Mission Control</h2>
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <button key={item} onClick={() => setActiveMenu(item)} className={`w-full text-left px-4 py-2 rounded-lg border ${activeMenu === item ? 'border-violet-500 bg-violet-950 text-violet-200' : 'border-slate-700 bg-slate-900 hover:bg-slate-800'}`}>
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <main className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Agents Mission Control</h1>
          {activeMenu === 'Memory' && (
            <input className="w-80 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900" placeholder="Search memory..." value={memorySearch} onChange={(e) => setMemorySearch(e.target.value)} />
          )}
        </div>

        {loading && <p>Loading Mission Control...</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && !error && activeMenu === 'Projects' && (
          <section className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
            {projects.map((project) => (
              <article key={project.title} className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                <img src={project.image} alt={`${project.title} visual`} className="w-full h-36 object-cover rounded-lg" />
                <h3 className="mt-3 text-lg font-semibold">{project.title}</h3>
                <a href={project.url} target="_blank" rel="noreferrer noopener" className="text-sky-300 text-sm">{project.url}</a>
                <div className="mt-3 h-3 rounded-full bg-slate-700"><div className="h-3 rounded-full bg-green-500" style={{ width: `${project.progress}%` }} /></div>
                <p className="text-sm text-slate-300 mt-1">{project.progress}% complete</p>
              </article>
            ))}
          </section>
        )}

        {!loading && !error && activeMenu === 'Memory' && (
          <section className="grid grid-cols-[280px_1fr_360px] gap-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-2 max-h-[76vh] overflow-auto">
              {filteredMemory.map((file) => (
                <button key={file.key} className={`w-full text-left p-2 rounded-lg mb-2 border ${selectedMemory?.key === file.key ? 'border-violet-500 bg-violet-950' : 'border-slate-700 bg-slate-800'}`} onClick={() => setSelectedMemoryKey(file.key)}>
                  <div className="font-semibold">{file.name}.md</div>
                  <div className="text-xs text-slate-400">{file.agent}</div>
                </button>
              ))}
            </div>

            <article className="bg-slate-900 border border-slate-700 rounded-xl p-4">
              {selectedMemory ? (
                <>
                  <h2 className="text-lg font-semibold">{selectedMemory.name}.md</h2>
                  <p className="text-sm text-slate-400 mb-3">Agent: {selectedMemory.agent}</p>
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed">{selectedMemory.content}</pre>
                </>
              ) : <p>No memory file matches your search.</p>}
            </article>

            <form className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-2" onSubmit={(e) => void handleCreateMemoryFile(e)}>
              <h3 className="font-semibold">Create Memory File</h3>
              <input className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700" value={newMemoryAgent} onChange={(e) => setNewMemoryAgent(e.target.value)} placeholder="Agent" required />
              <input className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700" value={newMemoryTitle} onChange={(e) => setNewMemoryTitle(e.target.value)} placeholder="File title" required />
              <input className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700" value={newMemoryTags} onChange={(e) => setNewMemoryTags(e.target.value)} placeholder="Tags (optional)" />
              <input className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700" value={newMemorySource} onChange={(e) => setNewMemorySource(e.target.value)} placeholder="Source (optional)" />
              <select className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700" value={newMemoryPriority} onChange={(e) => setNewMemoryPriority(e.target.value)}>
                <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
              </select>
              <textarea className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700" rows={8} value={newMemoryContent} onChange={(e) => setNewMemoryContent(e.target.value)} placeholder="Memory content" required />
              <button type="submit" className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-500">Save Memory.md</button>
              {createMessage && <p className="text-sm text-slate-300">{createMessage}</p>}
            </form>
          </section>
        )}

        {!loading && !error && activeMenu === 'Agenda' && (
          <section className="space-y-3">
            {agenda.map((entry) => (
              <article key={entry.name} className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                <h3 className="font-semibold">{entry.name}</h3>
                <pre className="whitespace-pre-wrap">{entry.content}</pre>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
