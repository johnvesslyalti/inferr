import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { ChatController } from '../src/chat/chat.controller';
import { ChatService, ChatResult } from '../src/chat/chat.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import {
  mintAccessToken,
  setTestJwtEnv,
  restoreTestJwtEnv,
  TEST_JWT_SECRET,
  TEST_USER,
} from './test-utils';

// Hoisted mocks so that importing ChatController (which pulls ChatService -> AgenticRagService -> @langchain/*) does not explode with ESM uuid during e2e collection.
jest.mock('@langchain/langgraph', () => ({
  StateGraph: class {},
  START: 'START',
  END: 'END',
  Annotation: { Root: (s: any) => s },
}));
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: class {
    constructor(_opts?: any) {}
    withStructuredOutput(_s: any) {
      return this;
    }
  },
}));

describe('Chat (e2e, isolated + JWT)', () => {
  let app: INestApplication<App>;
  let chatService: jest.Mocked<ChatService>;

  beforeAll(() => {
    setTestJwtEnv();
  });

  afterAll(() => {
    restoreTestJwtEnv();
  });

  beforeEach(async () => {
    chatService = {
      query: jest.fn(),
    } as any;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: TEST_JWT_SECRET,
          signOptions: { expiresIn: '15m' },
        }),
      ],
      controllers: [ChatController],
      providers: [
        { provide: ChatService, useValue: chatService },
        JwtAuthGuard,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /chat with valid JWT (minted via helper) calls service and returns result', async () => {
    const token = await mintAccessToken();
    const authHeader = `Bearer ${token}`;

    const fake: ChatResult = {
      answer: 'RAG uses retrieval then generation.',
      sources: [{ title: 'RAG Guide', url: 'https://ex.com/rag', source: 'hn' }],
    };
    chatService.query.mockResolvedValue(fake);

    const res = await request(app.getHttpServer())
      .post('/chat')
      .set('Authorization', authHeader)
      .send({ message: 'Explain RAG' })
      .expect(201);

    expect(res.body).toEqual(fake);
    expect(chatService.query).toHaveBeenCalledWith(TEST_USER.id, 'Explain RAG', []);
  });

  it('POST /chat without Authorization header is rejected by JwtAuthGuard (401)', async () => {
    await request(app.getHttpServer())
      .post('/chat')
      .send({ message: 'secret?' })
      .expect(401);
  });
});
