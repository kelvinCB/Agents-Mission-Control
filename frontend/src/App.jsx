import { useEffect, useState } from 'react';

const tabs = ['Memory', 'Projects', 'Agenda'];

export default function App() {
  const [activeTab, setActiveTab] = useState('Projects');
  const [projects, setProjects] = useState([]);
  const [memory, setMemory] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAll() {
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
      } catch (requestError) {
        setError('Unable to load Mission Control data. Please retry.');
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, []);

  return (
    <main className="page">
      <header>
        <h1>Agents Mission Control</h1>
        <nav>
          {tabs.map((tab) => (
            <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </nav>
      </header>

      {loading && <p>Loading Mission Control...</p>}
      {error && <p>{error}</p>}

      {!loading && !error && activeTab === 'Projects' && (
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

      {!loading && !error && activeTab === 'Memory' && (
        <section>
          {memory.map((agentGroup) => (
            <article key={agentGroup.agent} className="agent-memory">
              <h2>{agentGroup.agent}</h2>
              <ul>
                {agentGroup.files.map((file) => (
                  <li key={file.name}>
                    <strong>{file.name}</strong>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      )}

      {!loading && !error && activeTab === 'Agenda' && (
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
  );
}
