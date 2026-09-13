import { describe, it, expect } from 'vitest'
import { CHART_COLORS, formatValue, formatAxisTick, toRechartsRows } from './chartTheme'

describe('formatValue', () => {
  it('formats currency with a KES prefix and thousands separators', () => {
    expect(formatValue(1234567.5, 'currency')).toBe('KES 1,234,567.50')
  })

  it('formats a percentage to one decimal place', () => {
    expect(formatValue(90, 'percent')).toBe('90.0%')
  })

  it('formats a count with no decimals', () => {
    expect(formatValue(1200, 'count')).toBe('1,200')
  })

  it('formats zero rather than rendering it as blank', () => {
    expect(formatValue(0, 'currency')).toBe('KES 0.00')
    expect(formatValue(0, 'count')).toBe('0')
  })
})

describe('formatAxisTick', () => {
  it('abbreviates large money so axis labels do not overlap on a small card', () => {
    expect(formatAxisTick(1_500_000, 'currency')).toBe('1.5M')
    expect(formatAxisTick(12_000, 'currency')).toBe('12K')
  })

  it('leaves small numbers alone', () => {
    expect(formatAxisTick(250, 'currency')).toBe('250')
  })

  it('suffixes percentages', () => {
    expect(formatAxisTick(50, 'percent')).toBe('50%')
  })
})

describe('toRechartsRows', () => {
  it('flattens nested values into the flat rows Recharts expects', () => {
    const rows = toRechartsRows([
      { label: 'Jul', values: { billed: 1000, collected: 600 } },
      { label: 'Aug', values: { billed: 0, collected: 0 } },
    ])
    expect(rows).toEqual([
      { label: 'Jul', billed: 1000, collected: 600 },
      { label: 'Aug', billed: 0, collected: 0 },
    ])
  })

  it('preserves point order', () => {
    const rows = toRechartsRows([
      { label: 'Sep', values: { x: 1 } },
      { label: 'Jul', values: { x: 2 } },
    ])
    expect(rows.map((r) => r.label)).toEqual(['Sep', 'Jul'])
  })

  it('returns an empty array for no points', () => {
    expect(toRechartsRows([])).toEqual([])
  })

  // Defence in depth on the render path: the backend's zeroFill guarantees every
  // declared key is present, but if one ever were not, undefined reaches the
  // tooltip formatter as Number(undefined) and the card reads "KES NaN".
  it('renders a nullish point value as zero rather than passing undefined on', () => {
    const rows = toRechartsRows([
      { label: 'Jul', values: { billed: 1000, collected: undefined as unknown as number } },
    ])
    expect(rows).toEqual([{ label: 'Jul', billed: 1000, collected: 0 }])
  })

  it('fills a declared series key that the point omits entirely', () => {
    const rows = toRechartsRows([{ label: 'Jul', values: { billed: 1000 } }], ['billed', 'collected'])
    expect(rows).toEqual([{ label: 'Jul', billed: 1000, collected: 0 }])
  })

  it('still carries keys the series did not declare, so nothing is silently dropped', () => {
    const rows = toRechartsRows([{ label: 'Jul', values: { billed: 1000, extra: 5 } }], ['billed'])
    expect(rows).toEqual([{ label: 'Jul', billed: 1000, extra: 5 }])
  })
})

describe('CHART_COLORS', () => {
  it('offers enough distinct colours for the widest chart in the catalogue', () => {
    expect(CHART_COLORS.length).toBeGreaterThanOrEqual(8)
    expect(new Set(CHART_COLORS).size).toBe(CHART_COLORS.length)
  })
})
