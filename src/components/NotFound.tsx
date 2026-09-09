import React from 'react'
import { Link } from 'react-router'
import { FileQuestion } from 'lucide-react'

// Catch-all for URLs that match no route. Needed because the host now rewrites
// every unknown path to index.html (see vercel.json / netlify.toml) so the
// router can handle deep links — without this the app would mount and render
// nothing, showing a blank page instead of the host's 404.
// Deliberately standalone rather than wrapped in DashboardLayout: a bad URL can
// be hit by a signed-out visitor, who has no session for the layout to read.
const NotFound: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
            <FileQuestion size={48} className="text-gray-300 mb-4" />
            <h1 className="text-xl font-bold text-gray-700 mb-1">Page Not Found</h1>
            <p className="text-gray-500 max-w-md mb-6">
                The address you entered doesn't match any page in the system. It may have been moved, or the link may be mistyped.
            </p>
            <Link to="/dashboard" className="btn btn-primary btn-sm">
                Back to Dashboard
            </Link>
        </div>
    )
}

export default NotFound
