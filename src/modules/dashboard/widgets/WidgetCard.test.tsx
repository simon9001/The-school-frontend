import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import WidgetCard from './WidgetCard'
import ChartErrorBoundary from './ChartErrorBoundary'
import type { DashboardWidget } from '../types'

// WidgetCard lazy-loads SeriesWidget (and, through it, Recharts) via
// React.lazy(() => import('./SeriesWidget')). Dynamic imports are cached by
// resolved specifier, so pre-warming it here means the first render in the
// tests below doesn't pay the one-time module-transform cost inside the
// default findBy*/waitFor polling window.
beforeAll(async () => {
  await import('./SeriesWidget')
})

afterEach(cleanup)

describe('WidgetCard', () => {
  it('renders a stats widget', () => {
    const widget: DashboardWidget = {
      id: 'w1',
      title: 'Fees',
      kind: 'stats',
      stats: [{ label: 'Total Invoiced', value: 'KES 1,000.00' }],
    }
    render(<WidgetCard widget={widget} />)
    expect(screen.getByText('Fees')).toBeTruthy()
    expect(screen.getByText('KES 1,000.00')).toBeTruthy()
  })

  it('renders a list widget row', () => {
    const widget: DashboardWidget = {
      id: 'w2',
      title: 'Awaiting You',
      kind: 'list',
      emptyText: 'Nothing awaiting approval.',
      rows: [{ label: 'JE-2026-004', sublabel: 'Pending approval', value: 'KES 50.00' }],
    }
    render(<WidgetCard widget={widget} />)
    expect(screen.getByText('JE-2026-004')).toBeTruthy()
  })

  it('renders a list widget empty text when it has no rows', () => {
    const widget: DashboardWidget = {
      id: 'w3',
      title: 'Awaiting You',
      kind: 'list',
      emptyText: 'Nothing awaiting approval.',
      rows: [],
    }
    render(<WidgetCard widget={widget} />)
    expect(screen.getByText('Nothing awaiting approval.')).toBeTruthy()
  })

  it('renders the empty text instead of a chart when a series has no points', async () => {
    const widget: DashboardWidget = {
      id: 'w4',
      title: 'Fee Collection Trend',
      kind: 'series',
      form: 'line',
      valueFormat: 'currency',
      series: [{ key: 'collected', label: 'Collected' }],
      points: [],
      emptyText: 'No invoices or payments in this period.',
    }
    render(<WidgetCard widget={widget} />)
    expect(await screen.findByText('No invoices or payments in this period.')).toBeTruthy()
  })

  it('renders the empty text when every point is zero, rather than a flat line at zero', async () => {
    const widget: DashboardWidget = {
      id: 'w5',
      title: 'Fee Collection Trend',
      kind: 'series',
      form: 'line',
      valueFormat: 'currency',
      series: [{ key: 'collected', label: 'Collected' }],
      points: [
        { label: 'Jul', values: { collected: 0 } },
        { label: 'Aug', values: { collected: 0 } },
      ],
      emptyText: 'No invoices or payments in this period.',
    }
    render(<WidgetCard widget={widget} />)
    expect(await screen.findByText('No invoices or payments in this period.')).toBeTruthy()
  })

  // The decision to ship no table alternative was justified on the grounds that
  // this label IS the text alternative, so it has to carry the numbers — a label
  // naming only the series tells a screen-reader user nothing about the data.
  it('gives a chart an accessible label carrying the actual values, not just the series name', async () => {
    const widget: DashboardWidget = {
      id: 'w6',
      title: 'Attendance Rate',
      kind: 'series',
      form: 'line',
      valueFormat: 'percent',
      series: [{ key: 'rate', label: 'Present' }],
      points: [
        { label: '11 Sep', values: { rate: 91 } },
        { label: '12 Sep', values: { rate: 88 } },
      ],
      emptyText: 'No attendance registers taken in this period.',
    }
    render(<WidgetCard widget={widget} />)
    const chart = await screen.findByRole('img')
    const label = chart.getAttribute('aria-label') ?? ''
    expect(label).toContain('Attendance Rate')
    expect(label).toContain('Present')
    // First and last value, each with its point label, then the range.
    expect(label).toContain('91.0%')
    expect(label).toContain('11 Sep')
    expect(label).toContain('88.0%')
    expect(label).toContain('12 Sep')
    expect(label).toContain('lowest 88.0%')
    expect(label).toContain('highest 91.0%')
  })

  it('names every series in the label of a multi-series chart, each with its own values', async () => {
    const widget: DashboardWidget = {
      id: 'w7',
      title: 'Fee Collection Trend',
      kind: 'series',
      form: 'line',
      valueFormat: 'currency',
      series: [
        { key: 'billed', label: 'Billed' },
        { key: 'collected', label: 'Collected' },
      ],
      points: [
        { label: 'Jul', values: { billed: 1000, collected: 600 } },
        { label: 'Aug', values: { billed: 2000, collected: 1500 } },
      ],
      emptyText: 'No invoices or payments in this period.',
    }
    render(<WidgetCard widget={widget} />)
    const label = (await screen.findByRole('img')).getAttribute('aria-label') ?? ''
    expect(label).toContain('Billed, from KES 1,000.00 on Jul to KES 2,000.00 on Aug')
    expect(label).toContain('Collected, from KES 600.00 on Jul to KES 1,500.00 on Aug')
    // min/max would be redundant noise once there is more than one series.
    expect(label).not.toContain('lowest')
  })

  it('keeps the label short enough to be read aloud on a full 30-point chart', async () => {
    const widget: DashboardWidget = {
      id: 'w8',
      title: 'Attendance Rate',
      kind: 'series',
      form: 'line',
      valueFormat: 'percent',
      series: [{ key: 'rate', label: 'Present' }],
      points: Array.from({ length: 30 }, (_, i) => ({
        label: `${i + 1} Sep`,
        values: { rate: 80 + (i % 20) },
      })),
      emptyText: 'No attendance registers taken in this period.',
    }
    render(<WidgetCard widget={widget} />)
    const label = (await screen.findByRole('img')).getAttribute('aria-label') ?? ''
    expect(label.length).toBeLessThan(200)
  })
})

describe('ChartErrorBoundary', () => {
  const Boom = (): never => {
    throw new Error('chunk load failed')
  }

  // React logs every error it catches to console.error by design. Silenced for
  // this test only, so a deliberately thrown error does not look like a failure
  // in otherwise-pristine output.
  it('renders the fallback instead of unmounting the tree when the chart throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(
        <ChartErrorBoundary fallback="No attendance registers taken in this period.">
            <Boom />
        </ChartErrorBoundary>,
      )
      expect(screen.getByText('No attendance registers taken in this period.')).toBeTruthy()
    } finally {
      consoleError.mockRestore()
    }
  })

  it('renders its children untouched when nothing throws', () => {
    render(
      <ChartErrorBoundary fallback="Chart unavailable.">
            <div>the chart</div>
      </ChartErrorBoundary>,
    )
    expect(screen.getByText('the chart')).toBeTruthy()
    expect(screen.queryByText('Chart unavailable.')).toBeNull()
  })

  // The card shell and title must survive a broken chart body: a blank Overview
  // is a far worse outcome than one degraded card.
  it('keeps the card title rendered when the chart body fails', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(
        <div>
            <div>Attendance Rate</div>
            <ChartErrorBoundary fallback="Chart unavailable.">
                <Boom />
            </ChartErrorBoundary>
        </div>,
      )
      expect(screen.getByText('Attendance Rate')).toBeTruthy()
      expect(screen.getByText('Chart unavailable.')).toBeTruthy()
    } finally {
      consoleError.mockRestore()
    }
  })
})
