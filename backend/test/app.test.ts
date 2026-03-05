import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app';

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
});
