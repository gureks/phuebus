import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, DEFAULT_ROOM_CODE } from './server';

describe('Express Server API', () => {
  it('GET /api/session should return default room code and urls', async () => {
    const response = await request(app).get('/api/session');
    
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/json/);
    
    const body = response.body;
    expect(body).toHaveProperty('roomCode');
    expect(body.roomCode).toBe(DEFAULT_ROOM_CODE);
    expect(body.roomCode).toHaveLength(4);
    expect(body).toHaveProperty('port');
    expect(body).toHaveProperty('remoteUrl');
    expect(body).toHaveProperty('displayUrl');
    expect(body.remoteUrl).toContain(DEFAULT_ROOM_CODE);
    expect(body.displayUrl).toContain(DEFAULT_ROOM_CODE);
  });

  it('GET /api/session/new should generate a fresh room code on demand', async () => {
    const response = await request(app).get('/api/session/new');
    
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/json/);
    
    const body = response.body;
    expect(body).toHaveProperty('roomCode');
    expect(body.roomCode).toHaveLength(4);
    expect(body.roomCode).not.toBe(DEFAULT_ROOM_CODE);
  });
});
