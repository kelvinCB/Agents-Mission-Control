import { useEffect, useMemo, useState } from 'react';

const menuItems = ['Memory', 'Projects', 'Agenda'];

export default function App() {
  const [activeMenu, setActiveMenu] = useState('Memory');
  const [projects, setProjects] = useState([]);
  const [memory, setMemory] = useState([]);
  const [agenda, setAgenda] = useState([]);
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

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      setLoading(true);
      setError('');

      const [projectsRes, memoryRes, agendaRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/memory'),
        fetch('/api/agenda')
      ]);

      if (!projectsRes.ok || !memoryRes.ok || !agendaRes.ok) {
        throw new Error('One or more API requests failed.');
      }

      const [projectsData, memoryData, agendaData] = await Promise.all([
        projectsRes.json(),
        memoryRes.json(),
        agendaRes.json()
      ]);

      setProjects(projectsData);
      setMemory(memoryData);
      setAgenda(agendaData);

      const firstFile = memoryData?.[0]?.files?.[0];
      const firstAgent = memoryData?.[0]?.agent;
      if (firstFile && firstAgent) {
        setSelectedMemoryKey(`${firstAgent}/${firstFile.name}`);
      }
    } catch (_requestError) {
      setError('Unable to load Mission Control data. Please retry.');
    } finally {
      setLoading(false);
    }
  }

  const flattenedMemory = useMemo(
    () =>
      memory.flatMap((group) =>
        group.files.map((file) => ({
          ...file,
          agent: group.agent,
          key: `${group.agent}/${file.name}`
        }))
      ),
    [memory]
  );

  const filteredMemory = useMemo(() => {
    const query = memorySearch.trim().toLowerCase();
    if (!query) return flattenedMemory;

    return flattenedMemory.filter((item) => {
      return (
        item.name.toLowerCase().includes(query) ||
        item.agent.toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query)
      );
    });
  }, [flattenedMemory, memorySearch]);

  const selectedMemory = useMemo(
    () => filteredMemory.find((item) => item.key === selectedMemoryKey) || filteredMemory[0],
    [filteredMemory, selectedMemoryKey]
  );

  async function handleCreateMemoryFile(event) {
    event.preventDefault();
    setCreateMessage('');

    const payload = {
      agent: newMemoryAgent,
      title: newMemoryTitle,
      tags: newMemoryTags,
      source: newMemorySource,
      priority: newMemoryPriority,
      content: newMemoryContent
    };

    const response = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      setCreateMessage(data.error || 'Failed to create memory file.');
      return;
    }

    setCreateMessage(`Created ${data.fileName} for ${data.agent}.`);
    setNewMemoryContent('');
    await loadAllData();
    setActiveMenu('Memory');
    setSelectedMemoryKey(`${data.agent}/${data.fileName.replace('.md', '')}`);
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Mission Control</div>
        <nav className="left-menu">
          {menuItems.map((item) => (
            <button key={item} onClick={() => setActiveMenu(item)} className={activeMenu === item ? 'active' : ''}>
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <h1>Agents Mission Control</h1>
          {activeMenu === 'Memory' && (
            <input
              type="search"
              placeholder="Search memory..."
              value={memorySearch}
              onChange={(event) => setMemorySearch(event.target.value)}
            />
          )}
        </header>

        {loading && <p>Loading Mission Control...</p>}
        {error && <p>{error}</p>}

        {!loading && !error && activeMenu === 'Projects' && (
          <section className="grid">
            {projects.map((project) => (
              <article key={project.title} className="card">
                <img src={project.image} alt={`${project.title} visual`} />
                <h3>{project.title}</h3>
                <a href={project.url} target="_blank" rel="noreferrer noopener">
                  {project.url}
                </a>
                <div className="progress-wrap">
                  <div className="progress" style={{ width: `${project.progress}%` }} />
                </div>
                <p>{project.progress}% complete</p>
              </article>
            ))}
          </section>
        )}

        {!loading && !error && activeMenu === 'Memory' && (
          <section className="memory-layout">
            <div className="memory-list">
              {filteredMemory.map((file) => (
                <button key={file.key} className={selectedMemory?.key === file.key ? 'selected' : ''} onClick={() => setSelectedMemoryKey(file.key)}>
                  <strong>{file.name}.md</strong>
                  <span>{file.agent}</span>
                </button>
              ))}
            </div>

            <article className="memory-viewer">
              {selectedMemory ? (
                <>
                  <h2>{selectedMemory.name}.md</h2>
                  <p className="meta">Agent: {selectedMemory.agent}</p>
                  <pre>{selectedMemory.content}</pre>
                </>
              ) : (
                <p>No memory file matches your search.</p>
              )}
            </article>

            <form className="memory-form" onSubmit={handleCreateMemoryFile}>
              <h3>Create Memory File</h3>
              <label>
                Agent
                <input value={newMemoryAgent} onChange={(event) => setNewMemoryAgent(event.target.value)} required />
              </label>
              <label>
                File title (.md)
                <input value={newMemoryTitle} onChange={(event) => setNewMemoryTitle(event.target.value)} required />
              </label>
              <label>
                Tags (optional)
                <input value={newMemoryTags} onChange={(event) => setNewMemoryTags(event.target.value)} />
              </label>
              <label>
                Source (optional)
                <input value={newMemorySource} onChange={(event) => setNewMemorySource(event.target.value)} />
              </label>
              <label>
                Priority (optional)
                <select value={newMemoryPriority} onChange={(event) => setNewMemoryPriority(event.target.value)}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label>
                Content
                <textarea value={newMemoryContent} onChange={(event) => setNewMemoryContent(event.target.value)} required rows={8} />
              </label>
              <button type="submit">Save Memory.md</button>
              {createMessage && <p className="meta">{createMessage}</p>}
            </form>
          </section>
        )}

        {!loading && !error && activeMenu === 'Agenda' && (
          <section>
            {agenda.map((entry) => (
              <article key={entry.name} className="agenda-entry">
                <h3>{entry.name}</h3>
                <pre>{entry.content}</pre>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
