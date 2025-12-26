import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { progressController } from './progressController';
import { GetUserProgressUseCase } from '../../../application/usecases/GetUserProgressUseCase';

const mockGetUserProgressUseCase = {
    execute: vi.fn(),
} as unknown as GetUserProgressUseCase;


describe('progressController', () => {
    let app: ReturnType<typeof Fastify>;

    beforeEach(() => {
        app = Fastify();
        app.register((instance, opts, done) => {
            progressController(instance, mockGetUserProgressUseCase);
            done();
        });
        vi.clearAllMocks();
    });

    describe('GET /progress', () => {
        it('should call the use case and return progress', async () => {
            const progressData = { totalExercises: 10, completedExercises: 1 };
            mockGetUserProgressUseCase.execute.mockResolvedValue(progressData as any);
            
            const response = await app.inject({
                method: 'GET',
                url: '/progress?userId=d2d3b878-348c-4f70-9a57-7988351f5c69'
            });

            expect(response.statusCode).toBe(200);
            expect(JSON.parse(response.payload)).toEqual(progressData);
            expect(mockGetUserProgressUseCase.execute).toHaveBeenCalledWith('d2d3b878-348c-4f70-9a57-7988351f5c69');
        });

        it('should return 400 if userId is invalid', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/progress?userId=invalid'
            });
            expect(response.statusCode).toBe(400);
        });
    });
});
