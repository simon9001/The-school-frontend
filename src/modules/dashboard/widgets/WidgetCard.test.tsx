import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import WidgetCard from './WidgetCard'
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

  it('gives a chart an accessible label describing what it shows', async () => {
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
    expect(chart.getAttribute('aria-label')).toContain('Attendance Rate')
    expect(chart.getAttribute('aria-label')).toContain('Present')
  })
})
