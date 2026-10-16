import { render, screen } from '@testing-library/react';
import { StatusChip } from './StatusChip';

describe('StatusChip', () => {
  it('shows a text label, not only a colour', () => {
    render(<StatusChip family="execution_status" value="blocked_dependency_dataset" />);
    expect(screen.getByText('Blocked by dependency or dataset')).toBeInTheDocument();
  });

  it('marks the icon as decorative', () => {
    const { container } = render(<StatusChip family="task_status" value="verified" />);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('✓');
  });
});
