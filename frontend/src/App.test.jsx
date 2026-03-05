import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

global.fetch = vi.fn((url) => Promise.resolve({
  json: () => Promise.resolve(url.includes('projects') ? [{ title: 'Task_Manager', url: 'https://kolium.com', image: 'x', progress: 100 }] : [])
}));

describe('App', () => {
  it('renders title', () => {
    render(<App />);
    expect(screen.getByText('Agents Mission Control')).toBeInTheDocument();
  });
});
