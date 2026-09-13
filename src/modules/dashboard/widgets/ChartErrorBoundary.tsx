import React from 'react'

/**
 * Scoped to a single chart body. <Suspense> covers a lazy import that is still
 * pending, not one that REJECTED — and the chart import genuinely rejects when a
 * tab is left open across a deploy (the hashed chunk no longer exists), on a
 * flaky network, or offline. Without a boundary React unmounts the whole tree,
 * so the reader gets a blank Overview instead of one degraded card. It also
 * catches a render throw from a stale bundle meeting a widget kind it does not
 * know about.
 *
 * Deliberately not a shared app-wide boundary: kept around the chart body only,
 * so the card shell and its title keep rendering.
 */
interface ChartErrorBoundaryProps {
    /** Shown in place of the chart. The widget's own emptyText, where there is one. */
    fallback: string
    children: React.ReactNode
}

class ChartErrorBoundary extends React.Component<ChartErrorBoundaryProps, { failed: boolean }> {
    state = { failed: false }

    static getDerivedStateFromError() {
        return { failed: true }
    }

    componentDidCatch(error: Error) {
        // No telemetry pipeline in the app yet, so this is all the breadcrumb a
        // support call has. React logs the error itself as well.
        console.error('[dashboard] chart failed to render:', error)
    }

    render() {
        if (this.state.failed) {
            return <div className="text-sm text-gray-400">{this.props.fallback}</div>
        }
        return this.props.children
    }
}

export default ChartErrorBoundary
