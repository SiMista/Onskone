import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider, useLocale } from '../i18n';
import { ToastProvider } from '../components/Toast';
import Legal from './Legal';

afterEach(cleanup);

let t!: ReturnType<typeof useLocale>['t'];
const Probe = () => { t = useLocale().t; return null; };

const KINDS = ['privacy', 'mentions', 'cgu', 'support'] as const;

describe('pages Legal (URLs publiques exigées par les stores)', () => {
  it.each(KINDS)('/%s se rend avec son titre et toutes ses sections', (kind) => {
    render(
      <ToastProvider>
        <LocaleProvider>
          <Probe />
          <MemoryRouter>
            <Legal kind={kind} />
          </MemoryRouter>
        </LocaleProvider>
      </ToastProvider>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(t.legal[kind].title);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(t.legal[kind].sections.length);
  });

  it('pose le <title> de la page (SEO) puis le restaure au démontage', () => {
    document.title = 'avant';
    const { unmount } = render(
      <ToastProvider>
        <LocaleProvider>
          <MemoryRouter>
            <Legal kind="privacy" />
          </MemoryRouter>
        </LocaleProvider>
      </ToastProvider>,
    );
    expect(document.title).not.toBe('avant');
    unmount();
    expect(document.title).toBe('avant');
  });
});
