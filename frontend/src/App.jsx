import { useEffect, useState } from 'react';

const tabs = ['Memory', 'Projects', 'Agenda'];

export default function App() {
  const [activeTab, setActiveTab] = useState('Projects');
  const [projects, setProjects] = useState([]);
  const [memory, setMemory] = useState([]);
  const [agenda, setAgenda] = useState([]);

  useEffect(() => {
    fetch('http://localhost:4000/api/projects').then((r) => r.json()).then(setProjects);
    fetch('http://localhost:4000/api/memory').then((r) => r.json()).then(setMemory);
    fetch('http://localhost:4000/api/agenda').then((r) => r.json()).then(setAgenda);
  }, []);

  return (
    <main className="page">
      <header>
        <h1>Agents Mission Control</h1>
        <nav>
          {tabs.map((tab) => (
            <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </nav>
      </header>

      {activeTab === 'Projects' && (
        <section className="grid">
          {projects.map((project) => (
            <article key={project.title} className="card">
              <img src={project.image} alt={`${project.title} visual`} />
              <h3>{project.title}</h3>
              <a href={project.url} target="_blank">{project.url}</a>
              <div className="progress-wrap"><div className="progress" style={{ width: `${project.progress}%` }} /></div>
              <p>{project.progress}% complete</p>
            </article>
          ))}
        </section>
      )}

      {activeTab === 'Memory' && (
        <section>
          {memory.map((agentGroup) => (
            <article key={agentGroup.agent} className="agent-memory">
              <h2>{agentGroup.agent}</h2>
              <ul>
                {agentGroup.files.map((file) => <li key={file.name}><strong>{file.name}</strong></li>)}
              </ul>
            </article>
          ))}
        </section>
      )}

      {activeTab === 'Agenda' && (
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
