import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  emitEvaluationComplete,
  emitEvaluationFailed,
  onEvaluationEvent,
} from './evaluation-events';

describe('evaluation-events', () => {

    afterEach(() => {
        // Reset listeners after each test
        vi.resetAllMocks();
    });

    it('should emit and receive a "complete" event', () => {
        return new Promise((resolve, reject) => {
            const submissionId = 'sub-1';
            
            const callback = vi.fn((event) => {
                try {
                    expect(event.submissionId).toBe(submissionId);
                    expect(event.type).toBe('evaluated');
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
    
            onEvaluationEvent(submissionId, callback);
            emitEvaluationComplete(submissionId);
        });
    });

    it('should emit and receive a "failed" event', () => {
        return new Promise((resolve, reject) => {
            const submissionId = 'sub-2';

            const callback = vi.fn((event) => {
                try {
                    expect(event.submissionId).toBe(submissionId);
                    expect(event.type).toBe('failed');
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });

            onEvaluationEvent(submissionId, callback);
            emitEvaluationFailed(submissionId);
        });
    });

    it('should remove a listener when the cleanup function is called', () => {
        const submissionId = 'sub-3';
        const callback = vi.fn();

        const cleanup = onEvaluationEvent(submissionId, callback);
        
        // Unsubscribe
        cleanup();

        emitEvaluationComplete(submissionId);

        expect(callback).not.toHaveBeenCalled();
    });
});
