import React from 'react'

const Footer: React.FC = () => {
    return (
        <footer className="bg-white border-t border-gray-200 py-4 px-6 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} School Management System
        </footer>
    )
}

export default Footer
