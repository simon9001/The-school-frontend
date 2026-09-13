import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import WidgetCard from './WidgetCard'
import type { DashboardWidget } from '../types'

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
})
