import express from 'express';
import cors from 'cors';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import multer from 'multer';

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    }
  })
);

app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const exec = promisify(execCb);

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..', '..');
const dataDir = process.env.DATA_DIR || path.join(rootDir, 'data');

type Project = { title: string; url: string; image: string; progress: number };
type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
};

const projects: Project[] = [
  { title: 'Task_Manager', url: 'https://kolium.com', image: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1200&q=80', progress: 100 },
  { title: 'VPS-Visual-Dashboard', url: 'https://kelvin-vps.site', image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80', progress: 100 },
  { title: 'TerranovaEcommerce', url: 'https://terranovaecommerce.com', image: 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1200&q=80', progress: 100 }
];

const toSafeFileName = (rawName: string) =>
  String(rawName).trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_.]/g, '').replace(/\.{2,}/g, '.').replace(/^\.+/, '');

function startOfMonthIso(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0)).toISOString();
}

function startOfNextMonthIso(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0)).toISOString();
}

function resolveGoogleCalendarScriptCandidates(): string[] {
  return [
    process.env.GOOGLE_CALENDAR_SCRIPT,
    path.join(rootDir, 'scripts', 'google-calendar', 'gcal.js'),
    path.resolve(rootDir, '..', '..', 'scripts', 'google-calendar', 'gcal.js')
  ].filter(Boolean) as string[];
}

function parseCalendarListOutput(stdout: string): CalendarEvent[] {
  const blocks = stdout
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length < 3) return null;

      const id = lines[0];
      const rangeMatch = lines[1].match(/^(.+?)\s*->\s*(.+)$/);
      if (!rangeMatch) return null;

      const start = rangeMatch[1].trim();
      const end = rangeMatch[2].trim();
      const title = lines.slice(2).join(' ').trim() || '(No title)';
      const allDay = !start.includes('T');

      return { id, title, start, end, allDay } satisfies CalendarEvent;
    })
    .filter((event): event is CalendarEvent => event !== null);
}

function isCalendarModuleEnabled(): boolean {
  return process.env.ENABLE_GOOGLE_CALENDAR_MODULE === 'true';
}

async function readCalendarMonth(year: number, monthIndex: number) {
  const candidates = resolveGoogleCalendarScriptCandidates();
  let scriptPath: string | null = null;

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      scriptPath = candidate;
      break;
    } catch {
      // try next candidate
    }
  }

  if (!scriptPath) {
    throw new Error('Google Calendar script not configured.');
  }

  const scriptDir = path.dirname(scriptPath);
  const tokenPath = process.env.GCAL_TOKEN || path.join(scriptDir, 'token.json');
  const credentialsPath = process.env.GCAL_CREDENTIALS || path.join(scriptDir, 'credentials.json');

  await fs.access(credentialsPath);
  await fs.access(tokenPath);

  const fromIso = startOfMonthIso(year, monthIndex);
  const toIso = startOfNextMonthIso(year, monthIndex);
  const command = `node ${JSON.stringify(scriptPath)} list --from ${JSON.stringify(fromIso)} --to ${JSON.stringify(toIso)} --max 500`;
  const { stdout } = await exec(command, {
    cwd: scriptDir,
    timeout: 15000,
    env: {
      ...process.env,
      GCAL_CREDENTIALS: credentialsPath,
      GCAL_TOKEN: tokenPath,
    }
  });

  return parseCalendarListOutput(stdout);
}

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

app.post('/api/memory', upload.array('files', 30), async (req, res) => {
  try {
    const { agent, titlePrefix = '' } = req.body as { agent?: string; titlePrefix?: string };
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    if (!agent || files.length === 0) {
      return res.status(400).json({ error: 'agent and at least one .md file are required.' });
    }

    const safeAgent = toSafeFileName(agent);
    const safePrefix = toSafeFileName(titlePrefix);
    if (!safeAgent) return res.status(400).json({ error: 'Invalid agent.' });

    const invalid = files.find((file) => !file.originalname.toLowerCase().endsWith('.md'));
    if (invalid) {
      return res.status(400).json({ error: `Only .md files are allowed. Invalid: ${invalid.originalname}` });
    }

    const agentDir = path.join(dataDir, 'memory', safeAgent);
    await fs.mkdir(agentDir, { recursive: true });

    const savedFiles: string[] = [];

    for (const file of files) {
      const originalBase = toSafeFileName(file.originalname.replace(/\.md$/i, '')) || 'Memory';
      const baseName = safePrefix ? `${safePrefix}-${originalBase}` : originalBase;
      const fileName = `${baseName}.md`;
      const fullPath = path.join(agentDir, fileName);
      await fs.writeFile(fullPath, file.buffer.toString('utf8'), 'utf8');
      savedFiles.push(fileName);
    }

    return res.status(201).json({ ok: true, agent: safeAgent, files: savedFiles });
  } catch {
    return res.status(500).json({ error: 'Failed to upload memory files.' });
  }
});

app.delete('/api/memory', async (req, res) => {
  try {
    const { agent, name } = (req.body ?? {}) as { agent?: string; name?: string };

    if (!agent || !name) {
      return res.status(400).json({ error: 'agent and name are required.' });
    }

    const safeAgent = toSafeFileName(agent);
    const safeName = `${toSafeFileName(name.replace(/\.md$/i, ''))}.md`;

    if (!safeAgent || !safeName) {
      return res.status(400).json({ error: 'Invalid delete payload.' });
    }

    const filePath = path.join(dataDir, 'memory', safeAgent, safeName);
    await fs.unlink(filePath);

    return res.json({ ok: true, agent: safeAgent, name: safeName });
  } catch {
    return res.status(500).json({ error: 'Failed to delete memory file.' });
  }
});

app.patch('/api/memory/rename', async (req, res) => {
  try {
    const { agent, oldName, newName } = (req.body ?? {}) as { agent?: string; oldName?: string; newName?: string };

    if (!agent || !oldName || !newName) {
      return res.status(400).json({ error: 'agent, oldName and newName are required.' });
    }

    const safeAgent = toSafeFileName(agent);
    const safeOld = `${toSafeFileName(oldName.replace(/\.md$/i, ''))}.md`;
    const safeNew = `${toSafeFileName(newName.replace(/\.md$/i, ''))}.md`;

    if (!safeAgent || !safeOld || !safeNew) {
      return res.status(400).json({ error: 'Invalid rename payload.' });
    }

    const agentDir = path.join(dataDir, 'memory', safeAgent);
    const oldPath = path.join(agentDir, safeOld);
    const newPath = path.join(agentDir, safeNew);

    await fs.rename(oldPath, newPath);

    return res.json({ ok: true, agent: safeAgent, oldName: safeOld, newName: safeNew });
  } catch {
    return res.status(500).json({ error: 'Failed to rename memory file.' });
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

app.get('/api/calendar', async (req, res) => {
  try {
    if (!isCalendarModuleEnabled()) {
      return res.status(503).json({ error: 'Google Calendar module is disabled.' });
    }

    const now = new Date();
    const rawYear = Number(req.query.year ?? now.getUTCFullYear());
    const rawMonth = Number(req.query.month ?? now.getUTCMonth() + 1);

    if (!Number.isInteger(rawYear) || !Number.isInteger(rawMonth) || rawMonth < 1 || rawMonth > 12) {
      return res.status(400).json({ error: 'year and month must be valid integers.' });
    }

    const events = await readCalendarMonth(rawYear, rawMonth - 1);
    return res.json({
      year: rawYear,
      month: rawMonth,
      events
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load Google Calendar events.' });
  }
});

export default app;
