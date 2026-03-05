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
});
