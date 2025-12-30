'use client';

import { useEffect, useRef } from 'react';
import { api, MentorWorkflowStep } from '@/lib/api';

type Params = {
  userId?: string;
  step: MentorWorkflowStep;
  enabled?: boolean;
};

export function useMentorWorkflowTracker({ userId, step, enabled = true }: Params) {
  const lastStepRef = useRef<MentorWorkflowStep | null>(null);

  useEffect(() => {
    if (!userId || !enabled) return;
    if (lastStepRef.current === step) return;
    lastStepRef.current = step;

    api.updateMentorWorkflowState({ userId, step }).catch((error) => {
      console.error('Failed to update mentor workflow step:', error);
    });
  }, [userId, step, enabled]);
}
