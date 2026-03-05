import express from 'express';
import cors from 'cors';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import multer from 'multer';

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const exec = promisify(execCb);

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..', '..');
const dataDir = process.env.DATA_DIR || path.join(rootDir, 'data');

type Project = { title: string; url: string; image: string; progress: number };
const projects: Project[] = [
  { title: 'Task_Manager', url: 'https://kolium.com', image: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1200&q=80', progress: 100 },
  { title: 'VPS-Visual-Dashboard', url: 'https://kelvin-vps.site', image: 'https://images.unsplash.com/photo-1551281044-8b5bd5f8f8f6?auto=format&fit=crop&w=1200&q=80', progress: 100 },
  { title: 'TerranovaEcommerce', url: 'https://terranovaecommerce.com', image: 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1200&q=80', progress: 100 }
];

const toSafeFileName = (rawName: string) =>
  String(rawName).trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_.]/g, '').replace(/\.{2,}/g, '.').replace(/^\.+/, '');

async function readMemory() {
  const memoryRoot = path.join(dataDir, 'memory');
  const agentEntries = await fs.readdir(memoryRoot, { withFileTypes: true });
  const agents = agentEntries.filter((entry) => entry.isDirectory());

  return Promise.all(
    agents.map(async (agent) => {
      const agentPath = path.join(memoryRoot, agent.name);
      const files = (await fs.readdir(agentPath)).filter((file) => file.endsWith('.md')).sort();
      const parsedFiles = await Promise.all(
        files.map(async (name) => ({ name: name.replace('.md', ''), content: await fs.readFile(path.join(agentPath, name), 'utf8') }))
      );
      return { agent: agent.name, files: parsedFiles };
    })
  );
}

async function readAgenda() {
  const agendaRoot = path.join(dataDir, 'agenda');
  const files = (await fs.readdir(agendaRoot)).filter((file) => file.endsWith('.md')).sort();
  return Promise.all(files.map(async (file) => ({ name: file.replace('.md', ''), content: await fs.readFile(path.join(agendaRoot, file), 'utf8') })));
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/projects', (_req, res) => res.json(projects));
app.get('/api/memory', async (_req, res) => {
  try { res.json(await readMemory()); } catch { res.status(500).json({ error: 'Failed to load memory data.' }); }
});

app.post('/api/memory', upload.single('file'), async (req, res) => {
  try {
    const { agent, title } = req.body as { agent?: string; title?: string };
    const file = req.file;

    if (!agent || !title || !file) {
      return res.status(400).json({ error: 'agent, title and .md file are required.' });
    }

    if (!file.originalname.toLowerCase().endsWith('.md')) {
      return res.status(400).json({ error: 'Only .md files are allowed.' });
    }

    const safeAgent = toSafeFileName(agent);
    const safeTitle = toSafeFileName(title);
    if (!safeAgent || !safeTitle) return res.status(400).json({ error: 'Invalid agent or title.' });

    const agentDir = path.join(dataDir, 'memory', safeAgent);
    await fs.mkdir(agentDir, { recursive: true });

    const fileName = safeTitle.endsWith('.md') ? safeTitle : `${safeTitle}.md`;
    const fullPath = path.join(agentDir, fileName);

    const rawContent = file.buffer.toString('utf8');
    await fs.writeFile(fullPath, rawContent, 'utf8');

    return res.status(201).json({ ok: true, agent: safeAgent, fileName });
  } catch {
    return res.status(500).json({ error: 'Failed to upload memory file.' });
  }
});

app.post('/api/memory/sync', async (req, res) => {
  try {
    const commitMessage = (req.body as { message?: string } | undefined)?.message?.trim() || 'chore(memory): sync memory files from mission control';
    const targetPath = path.join('data', 'memory');

    await exec(`git add ${targetPath}`, { cwd: rootDir });
    const { stdout: statusOut } = await exec(`git status --porcelain ${targetPath}`, { cwd: rootDir });

    if (!statusOut.trim()) {
      return res.json({ ok: true, pushed: false, message: 'No memory changes to sync.' });
    }

    await exec(`git commit -m ${JSON.stringify(commitMessage)}`, { cwd: rootDir });
    await exec('git push origin main', { cwd: rootDir });

    return res.json({ ok: true, pushed: true, message: 'Memory files synced to GitHub main.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to sync memory files to GitHub.' });
  }
});

app.get('/api/agenda', async (_req, res) => {
  try { res.json(await readAgenda()); } catch { res.status(500).json({ error: 'Failed to load agenda data.' }); }
});

export default app;
