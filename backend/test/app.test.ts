import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import app from '../src/app';

const tempPaths: string[] = [];

afterAll(async () => {
  await Promise.all(tempPaths.map(async (target) => {
    try {
      await fs.rm(target, { recursive: true, force: true });
    } catch {
      // noop
    }
  }));
});

describe('api', () => {
  it('returns projects', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('returns memory groups with files array', async () => {
    const res = await request(app).get('/api/memory');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('uploads one or more memory markdown files', async () => {
    const res = await request(app)
      .post('/api/memory')
      .field('agent', 'Etiven')
      .field('titlePrefix', 'Memory-Unit-Test')
      .attach('files', Buffer.from('# Test Memory\n\ncontent 1'), 'test-1.md')
      .attach('files', Buffer.from('# Test Memory\n\ncontent 2'), 'test-2.md');

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.files)).toBe(true);
    expect(res.body.files.length).toBe(2);
  });

  it('rejects non-markdown attachments', async () => {
    const res = await request(app)
      .post('/api/memory')
      .field('agent', 'Etiven')
      .attach('files', Buffer.from('text'), 'bad.txt');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Only .md files are allowed');
  });

  it('rejects upload without agent', async () => {
    const res = await request(app)
      .post('/api/memory')
      .attach('files', Buffer.from('# test'), 'test.md');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('agent and at least one .md file are required');
  });

  it('renames a memory file', async () => {
    await request(app)
      .post('/api/memory')
      .field('agent', 'Etiven')
      .attach('files', Buffer.from('# Rename Test'), 'rename-source.md');

    const res = await request(app)
      .patch('/api/memory/rename')
      .send({ agent: 'Etiven', oldName: 'rename-source', newName: 'rename-target' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.newName).toBe('rename-target.md');
  });

  it('deletes a memory file', async () => {
    await request(app)
      .post('/api/memory')
      .field('agent', 'Etiven')
      .attach('files', Buffer.from('# Delete Test'), 'delete-source.md');

    const res = await request(app)
      .delete('/api/memory')
      .send({ agent: 'Etiven', name: 'delete-source' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns calendar events from the configured Google Calendar script', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-control-calendar-'));
    tempPaths.push(tempDir);
    const fakeScript = path.join(tempDir, 'gcal.js');
    const previousScript = process.env.GOOGLE_CALENDAR_SCRIPT;
    const previousEnabled = process.env.ENABLE_GOOGLE_CALENDAR_MODULE;

    await fs.writeFile(
      fakeScript,
      [
        '#!/usr/bin/env node',
        "console.log('event-1');",
        "console.log('  2026-03-23T09:00:00-04:00 -> 2026-03-23T10:00:00-04:00');",
        "console.log('  Desayunar');",
        "console.log('');",
        "console.log('event-2');",
        "console.log('  2026-03-24 -> 2026-03-25');",
        "console.log('  Cumpleaños');",
      ].join('\n'),
      'utf8'
    );
    await fs.writeFile(path.join(tempDir, 'credentials.json'), '{}', 'utf8');
    await fs.writeFile(path.join(tempDir, 'token.json'), '{}', 'utf8');

    process.env.GOOGLE_CALENDAR_SCRIPT = fakeScript;
    process.env.ENABLE_GOOGLE_CALENDAR_MODULE = 'true';

    try {
      const res = await request(app).get('/api/calendar?year=2026&month=3');

      expect(res.status).toBe(200);
      expect(res.body.year).toBe(2026);
      expect(res.body.month).toBe(3);
      expect(Array.isArray(res.body.events)).toBe(true);
      expect(res.body.events).toHaveLength(2);
      expect(res.body.events[0]).toMatchObject({
        id: 'event-1',
        title: 'Desayunar',
        allDay: false,
      });
      expect(res.body.events[1]).toMatchObject({
        id: 'event-2',
        title: 'Cumpleaños',
        allDay: true,
      });
    } finally {
      if (previousScript === undefined) delete process.env.GOOGLE_CALENDAR_SCRIPT;
      else process.env.GOOGLE_CALENDAR_SCRIPT = previousScript;
      if (previousEnabled === undefined) delete process.env.ENABLE_GOOGLE_CALENDAR_MODULE;
      else process.env.ENABLE_GOOGLE_CALENDAR_MODULE = previousEnabled;
    }
  });

  it('returns 503 when the calendar module is disabled', async () => {
    const previousEnabled = process.env.ENABLE_GOOGLE_CALENDAR_MODULE;
    delete process.env.ENABLE_GOOGLE_CALENDAR_MODULE;

    try {
      const res = await request(app).get('/api/calendar?year=2026&month=3');
      expect(res.status).toBe(503);
      expect(res.body.error).toContain('disabled');
    } finally {
      if (previousEnabled === undefined) delete process.env.ENABLE_GOOGLE_CALENDAR_MODULE;
      else process.env.ENABLE_GOOGLE_CALENDAR_MODULE = previousEnabled;
    }
  });
});
