import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import RowActions from './RowActions'

afterEach(cleanup)

describe('RowActions', () => {
  it('renders nothing when the user can neither edit nor delete', () => {
    const { container } = render(<RowActions label="Jane Doe" />)
    expect(container.innerHTML).toBe('')
  })

  it('offers only Edit to someone who can edit but not delete', () => {
    render(<RowActions label="Jane Doe" canEdit onEdit={() => {}} />)
    expect(screen.getByRole('button', { name: 'Edit Jane Doe' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Delete Jane Doe' })).toBeNull()
  })

  it('offers only Delete to someone who can delete but not edit', () => {
    render(<RowActions label="Jane Doe" canDelete onDelete={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Edit Jane Doe' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Delete Jane Doe' })).toBeTruthy()
  })

  it('calls the matching handler for each control', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<RowActions label="Jane Doe" canEdit canDelete onEdit={onEdit} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Jane Doe' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Jane Doe' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
