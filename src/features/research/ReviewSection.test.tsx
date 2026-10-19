import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { Viewer } from '@/domain/workspace';
import type { ProjectWorkspace } from '@/lib/research';
import { WorkspaceContext, type WorkspaceValue } from './workspaceContext';

const recordReview = vi.fn();
vi.mock('@/lib/research', () => ({
  recordReview: (...args: unknown[]) => recordReview(...args),
  addressCorrection: vi.fn(),
  resolveCorrection: vi.fn(),
}));

const { ReviewSection } = await import('./ReviewSection');

const ws = {
  reviews: [],
  corrections: [],
  names: {},
} as unknown as ProjectWorkspace;

function renderWith(viewer: Partial<Viewer>, awaiting: boolean) {
  const value: WorkspaceValue = {
    ws,
    viewer: {
      isStudent: false,
      isFaculty: true,
      isReviewer: false,
      isHod: false,
      canApproveException: false,
      ...viewer,
    },
    readOnly: false,
    busy: false,
    act: async (fn) => {
      await fn();
      return true;
    },
  };
  return render(
    <WorkspaceContext.Provider value={value}>
      <ReviewSection
        targetType="exploration"
        targetIds={['t1']}
        currentId="t1"
        awaiting={awaiting}
        label="exploration"
      />
    </WorkspaceContext.Provider>,
  );
}

describe('ReviewSection', () => {
  it('offers only a comment to faculty who are not reviewers (SEC-07)', () => {
    renderWith({ isReviewer: false }, true);
    expect(screen.getByRole('heading', { name: 'Comment on the exploration' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Outcome')).not.toBeInTheDocument();
  });

  it('lets a reviewer decide only while the work is waiting for review', () => {
    renderWith({ isReviewer: true }, false);
    expect(screen.queryByLabelText('Outcome')).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing is waiting for your decision/)).toBeInTheDocument();
  });

  it('sends corrections with "changes requested"', async () => {
    recordReview.mockResolvedValue('review-id');
    renderWith({ isReviewer: true }, true);
    await userEvent.selectOptions(screen.getByLabelText('Outcome'), 'changes_requested');
    await userEvent.type(screen.getByLabelText('Observations'), 'Needs work');
    await userEvent.type(screen.getByLabelText('Corrections 1'), 'Add a source');
    await userEvent.click(screen.getByRole('button', { name: 'Record review' }));
    await waitFor(() =>
      expect(recordReview).toHaveBeenCalledWith({
        targetType: 'exploration',
        targetId: 't1',
        outcome: 'changes_requested',
        observations: 'Needs work',
        comments: '',
        corrections: ['Add a source'],
      }),
    );
  });

  it('shows nothing to students but the thread', () => {
    renderWith({ isStudent: true, isFaculty: false }, true);
    expect(screen.getByText('No reviews yet.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Record review|Save comment/ }),
    ).not.toBeInTheDocument();
  });
});
