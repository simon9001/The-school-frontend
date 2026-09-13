import React from 'react'
import { Pencil, Trash2 } from 'lucide-react'

interface RowActionsProps {
    /** The record's display name, used for each button's accessible label. */
    label: string
    canEdit?: boolean
    canDelete?: boolean
    onEdit?: () => void
    onDelete?: () => void
}

/** Edit and delete controls for a table row, each shown only to a user who
 *  holds the matching permission. Renders nothing when neither applies. */
const RowActions: React.FC<RowActionsProps> = ({ label, canEdit = false, canDelete = false, onEdit, onDelete }) => {
    if (!canEdit && !canDelete) return null

    return (
        <div className="flex items-center justify-end gap-1">
            {canEdit && (
                <button type="button" onClick={onEdit} className="btn btn-ghost btn-xs" aria-label={`Edit ${label}`}>
                    <Pencil size={14} />
                </button>
            )}
            {canDelete && (
                <button type="button" onClick={onDelete} className="btn btn-ghost btn-xs text-red-600" aria-label={`Delete ${label}`}>
                    <Trash2 size={14} />
                </button>
            )}
        </div>
    )
}

export default RowActions
