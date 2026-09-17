import type { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AppModule } from './../src/app.module.js';
import { ProxyService } from './../src/proxy/proxy.service.js';

function crearToken(
  sub: string,
  grupos: string[],
): string {
  const header = Buffer.from(
    JSON.stringify({
      alg: 'RS256',
      typ: 'JWT',
    }),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub,
      token_use: 'access',
      'cognito:groups': grupos,
    }),
  ).toString('base64url');

  return `${header}.${payload}.firma-prueba`;
}

describe('BFF autorización (e2e)', () => {
  let app: INestApplication;
  const forward = vi.fn();

  beforeAll(async () => {
    forward.mockResolvedValue({
      status: 200,
      data: [],
    });

    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(ProxyService)
        .useValue({
          forward,
        })
        .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('devuelve 401 cuando falta el token', async () => {
    await request(app.getHttpServer())
      .get('/v1/catalogo')
      .expect(401);
  });

  it('devuelve 401 cuando el token no tiene formato JWT', async () => {
    await request(app.getHttpServer())
      .get('/v1/catalogo')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);
  });

  it('permite leer el catálogo con una sesión válida', async () => {
    await request(app.getHttpServer())
      .get('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${crearToken('jugador-1', [
          'jugadores',
        ])}`,
      )
      .expect(200);
  });

  it('devuelve 403 cuando un jugador intenta crear', async () => {
    await request(app.getHttpServer())
      .post('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${crearToken('jugador-1', [
          'jugadores',
        ])}`,
      )
      .send({
        titulo: 'Juego',
      })
      .expect(403);
  });

  it('permite crear a un editor', async () => {
    await request(app.getHttpServer())
      .post('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${crearToken('editor-1', [
          'editores',
        ])}`,
      )
      .send({
        titulo: 'Juego',
      })
      .expect(200);
  });

  it('devuelve 403 cuando un editor lista licencias', async () => {
    await request(app.getHttpServer())
      .get('/v1/licencias')
      .set(
        'Authorization',
        `Bearer ${crearToken('editor-1', [
          'editores',
        ])}`,
      )
      .expect(403);
  });

  it('permite listar licencias a un administrador', async () => {
    await request(app.getHttpServer())
      .get('/v1/licencias')
      .set(
        'Authorization',
        `Bearer ${crearToken('admin-1', [
          'administradores',
        ])}`,
      )
      .expect(200);

    expect(forward).toHaveBeenCalled();
  });
});
