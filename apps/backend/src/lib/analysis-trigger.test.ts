import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerLearningAnalysis } from './analysis-trigger';
import { prisma } from './prisma';
import * as learningAnalyzer from '../llm/learning-analyzer';

vi.mock('./prisma', () => ({
    prisma: {
        userLearningAnalysis: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
        },
        submission: {
            count: vi.fn(),
            findMany: vi.fn(),
        },
        writingSubmission: {
            count: vi.fn(),
            findMany: vi.fn(),
        },
    }
}));

vi.mock('../llm/learning-analyzer');

const mockPrisma = prisma as any;
const mockLearningAnalyzer = learningAnalyzer as any;

describe('triggerLearningAnalysis', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should not trigger analysis if not on interval and analysis exists', async () => {
        mockPrisma.userLearningAnalysis.findUnique.mockResolvedValue({ analyzedAt: new Date() });
        mockPrisma.submission.count.mockResolvedValue(1);
        mockPrisma.writingSubmission.count.mockResolvedValue(1); // Total 2, not divisible by 3

        await triggerLearningAnalysis('user-1');

        expect(mockLearningAnalyzer.analyzeLearningProgress).not.toHaveBeenCalled();
    });

    it('should trigger analysis if analysis does not exist', async () => {
        mockPrisma.userLearningAnalysis.findUnique.mockResolvedValue(null);
        mockPrisma.submission.count.mockResolvedValue(0);
        mockPrisma.writingSubmission.count.mockResolvedValue(1);
        mockPrisma.submission.findMany.mockResolvedValue([]);
        mockPrisma.writingSubmission.findMany.mockResolvedValue([]);
        mockLearningAnalyzer.analyzeLearningProgress.mockResolvedValue({});

        await triggerLearningAnalysis('user-1');

        expect(mockLearningAnalyzer.analyzeLearningProgress).toHaveBeenCalled();
        expect(mockPrisma.userLearningAnalysis.upsert).toHaveBeenCalled();
    });

    it('should trigger analysis if on interval', async () => {
        mockPrisma.userLearningAnalysis.findUnique.mockResolvedValue({ analyzedAt: new Date() });
        mockPrisma.submission.count.mockResolvedValue(1);
        mockPrisma.writingSubmission.count.mockResolvedValue(2); // Total 3, divisible by 3
        mockPrisma.submission.findMany.mockResolvedValue([]);
        mockPrisma.writingSubmission.findMany.mockResolvedValue([]);
        mockLearningAnalyzer.analyzeLearningProgress.mockResolvedValue({});

        await triggerLearningAnalysis('user-1');

        expect(mockLearningAnalyzer.analyzeLearningProgress).toHaveBeenCalled();
    });

    it('should handle and swallow errors gracefully', async () => {
        mockPrisma.userLearningAnalysis.findUnique.mockRejectedValue(new Error('DB Error'));
        
        // It should not throw
        await expect(triggerLearningAnalysis('user-1')).resolves.toBeUndefined();
    });
});
