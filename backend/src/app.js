import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';

const app = express();
app.use(cors());

const rootDir = path.resolve(process.cwd(), '..');
const dataDir = path.join(rootDir, 'data');

const projects = [
  {
    title: 'Task_Manager',
    url: 'https://kolium.com',
    image: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1200&q=80',
    progress: 100
  },
  {
    title: 'VPS-Visual-Dashboard',
    url: 'https://kelvin-vps.site',
    image: 'https://images.unsplash.com/photo-1551281044-8b5bd5f8f8f6?auto=format&fit=crop&w=1200&q=80',
    progress: 100
  },
  {
    title: 'TerranovaEcommerce',
    url: 'https://terranovaecommerce.com',
    image: 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1200&q=80',
    progress: 100
  }
];

function readMemory() {
  const memoryRoot = path.join(dataDir, 'memory');
  const agents = fs.readdirSync(memoryRoot, { withFileTypes: true }).filter((d) => d.isDirectory());

  return agents.map((agent) => {
    const agentPath = path.join(memoryRoot, agent.name);
    const files = fs
      .readdirSync(agentPath)
      .filter((file) => file.endsWith('.md'))
      .sort();

    return {
      agent: agent.name,
      files: files.map((name) => ({
        name: name.replace('.md', ''),
        content: fs.readFileSync(path.join(agentPath, name), 'utf8')
      }))
    };
  });
}

function readAgenda() {
  const agendaRoot = path.join(dataDir, 'agenda');
  return fs
    .readdirSync(agendaRoot)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => ({
      name: file.replace('.md', ''),
      content: fs.readFileSync(path.join(agendaRoot, file), 'utf8')
    }));
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/projects', (_req, res) => res.json(projects));
app.get('/api/memory', (_req, res) => res.json(readMemory()));
app.get('/api/agenda', (_req, res) => res.json(readAgenda()));

export default app;
