import express from 'express';
import cors from 'cors';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
app.use(cors());

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..', '..');
const dataDir = process.env.DATA_DIR || path.join(rootDir, 'data');

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

async function readMemory() {
  const memoryRoot = path.join(dataDir, 'memory');
  const agentEntries = await fs.readdir(memoryRoot, { withFileTypes: true });
  const agents = agentEntries.filter((entry) => entry.isDirectory());

  return Promise.all(
    agents.map(async (agent) => {
      const agentPath = path.join(memoryRoot, agent.name);
      const files = (await fs.readdir(agentPath)).filter((file) => file.endsWith('.md')).sort();

      const parsedFiles = await Promise.all(
        files.map(async (name) => ({
          name: name.replace('.md', ''),
          content: await fs.readFile(path.join(agentPath, name), 'utf8')
        }))
      );

      return {
        agent: agent.name,
        files: parsedFiles
      };
    })
  );
}

async function readAgenda() {
  const agendaRoot = path.join(dataDir, 'agenda');
  const files = (await fs.readdir(agendaRoot)).filter((file) => file.endsWith('.md')).sort();

  return Promise.all(
    files.map(async (file) => ({
      name: file.replace('.md', ''),
      content: await fs.readFile(path.join(agendaRoot, file), 'utf8')
    }))
  );
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/projects', (_req, res) => res.json(projects));

app.get('/api/memory', async (_req, res) => {
  try {
    res.json(await readMemory());
  } catch (error) {
    res.status(500).json({ error: 'Failed to load memory data.' });
  }
});

app.get('/api/agenda', async (_req, res) => {
  try {
    res.json(await readAgenda());
  } catch (error) {
    res.status(500).json({ error: 'Failed to load agenda data.' });
  }
});

export default app;
