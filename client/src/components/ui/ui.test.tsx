// @vitest-environment jsdom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Settings } from 'lucide-react';
import {
  Button,
  Dialog,
  ErrorState,
  IconButton,
  Input,
  StatusPill,
  Tabs,
  ToastProvider,
  Tooltip,
  useToast,
} from '.';
import { LECTURE_STATUSES } from '../../types';
import Kitchen from '../../pages/_Kitchen';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('type-level rules', () => {
  it('IconButton requires aria-label', () => {
    // @ts-expect-error — aria-label is required by the type signature
    const el = <IconButton icon={<Settings />} />;
    expect(el).toBeTruthy();
  });
});

describe('Input', () => {
  it('wires aria-invalid and aria-describedby to hint and error', () => {
    render(<Input label="Email" hint="Work address" error="Invalid email" required />);
    const input = screen.getByLabelText(/Email/);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.hasAttribute('required')).toBe(true);
    const ids = input.getAttribute('aria-describedby')!.split(' ');
    expect(ids.map((id) => document.getElementById(id)!.textContent)).toEqual(['Work address', 'Invalid email']);
  });

  it('omits aria-invalid and aria-describedby when there is nothing to describe', () => {
    render(<Input label="Name" />);
    const input = screen.getByLabelText('Name');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('StatusPill', () => {
  it('renders a label and colour for every lecture status', () => {
    render(
      <>
        {LECTURE_STATUSES.map((s) => (
          <StatusPill key={s} status={s} />
        ))}
      </>,
    );
    const pill = (s: string) => document.querySelector(`[data-status="${s}"]`)!;
    expect(pill('ready').className).toContain('text-success');
    expect(pill('failed').className).toContain('text-danger');
    expect(pill('uploaded').className).toContain('text-ink-2');
    for (const s of ['extracting', 'transcribing', 'chunking', 'segmenting', 'summarising', 'indexing']) {
      expect(pill(s).className).toContain('text-warning');
      expect(pill(s).querySelector('.animate-ping')).not.toBeNull();
    }
  });
});

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <Dialog open={open} onOpenChange={setOpen} title="Rename" description="Desc" footer={<Button>Save</Button>}>
        <input aria-label="Title" />
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('focuses inside, traps Tab, locks scroll, closes on Escape and returns focus', () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Rename' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Title'));
    expect(document.body.style.overflow).toBe('hidden');

    // Focus order inside: Close, Title input, Save. Tab from last wraps to first.
    const save = screen.getByRole('button', { name: 'Save' });
    const close = screen.getByRole('button', { name: 'Close dialog' });
    save.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(save);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on backdrop click but not on panel click', () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(screen.queryByRole('dialog')).not.toBeNull();
    const backdrop = screen.getByTestId('dialog-backdrop');
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Tabs', () => {
  it('uses a roving tabindex and arrow/Home/End keys, skipping disabled tabs', () => {
    render(
      <Tabs
        label="Views"
        items={[
          { value: 'a', label: 'A', content: 'Panel A' },
          { value: 'b', label: 'B', content: 'Panel B', disabled: true },
          { value: 'c', label: 'C', content: 'Panel C' },
        ]}
      />,
    );
    const [a, , c] = screen.getAllByRole('tab');
    expect(a.getAttribute('aria-selected')).toBe('true');
    expect(a.tabIndex).toBe(0);
    expect(c.tabIndex).toBe(-1);

    a.focus();
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(c);
    expect(c.getAttribute('aria-selected')).toBe('true');
    expect(c.tabIndex).toBe(0);
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel C');

    fireEvent.keyDown(c, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(a);
    fireEvent.keyDown(a, { key: 'End' });
    expect(document.activeElement).toBe(c);
    fireEvent.keyDown(c, { key: 'Home' });
    expect(document.activeElement).toBe(a);
  });
});

describe('Tooltip', () => {
  it('shows on focus only after 300ms and hides on Escape', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Copy deep link">
        <button type="button">Copy</button>
      </Tooltip>,
    );
    const tip = screen.getByRole('tooltip', { hidden: true });
    const trigger = screen.getByRole('button', { name: 'Copy' });
    expect(trigger.getAttribute('aria-describedby')).toBe(tip.id);

    fireEvent.focus(trigger);
    act(() => vi.advanceTimersByTime(299));
    expect(tip.hidden).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(tip.hidden).toBe(false);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(tip.hidden).toBe(true);
  });
});

function ToastHarness() {
  const { toast } = useToast();
  return <Button onClick={() => toast({ variant: 'success', title: 'Saved' })}>Notify</Button>;
}

describe('Toast', () => {
  it('announces in a polite live region and auto-dismisses after 4s', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    const region = screen.getByRole('status', { name: 'Notifications' });
    expect(region.getAttribute('aria-live')).toBe('polite');
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    expect(region.textContent).toContain('Saved');
    act(() => vi.advanceTimersByTime(3999));
    expect(region.textContent).toContain('Saved');
    act(() => vi.advanceTimersByTime(1));
    expect(region.textContent).not.toContain('Saved');
  });

  it('can be dismissed manually', () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.getByRole('status', { name: 'Notifications' }).textContent).toBe('');
  });
});

describe('ErrorState', () => {
  it('notImplemented is a calm status panel without retry or danger styling', () => {
    render(<ErrorState variant="notImplemented" onRetry={() => undefined} />);
    const panel = screen.getByRole('status');
    expect(panel.textContent).toContain('Coming soon');
    expect(panel.className).not.toContain('danger');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('error variant is an alert with a working retry button', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('Kitchen page', () => {
  it('renders all 17 sections without throwing', () => {
    render(
      <ToastProvider>
        <Kitchen />
      </ToastProvider>,
    );
    expect(document.querySelectorAll('main section, section').length).toBe(17);
    // Every icon-only button has an accessible name.
    for (const btn of screen.getAllByRole('button')) {
      expect(btn.getAttribute('aria-label') || btn.textContent?.trim()).toBeTruthy();
    }
  });
});
