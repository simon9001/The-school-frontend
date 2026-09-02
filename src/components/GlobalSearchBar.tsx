import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router'
import {
  Search,
  X,
  FileText,
  Scale,
  CreditCard,
  GraduationCap,
  Users,
  BookOpen,
  Boxes,
  Package,
  Wallet,
  ShoppingCart,
  ArrowRight,
} from 'lucide-react'
import type { RootState } from '../store/store'
import { navigation } from '../dashboardDesign/navigation'
import { useSearchQuery } from '../modules/search/SearchApi'
import type { SearchResultItem } from '../modules/search/types'

export const GlobalSearchBar: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useSelector((state: RootState) => state.authSlice)
  const permissions = useMemo(() => user?.permissions ?? [], [user])

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Debounce input for backend record queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen(true)
        inputRef.current?.focus()
      } else if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 1. Client-Side Filter: Navigation Pages matching query that the user is permitted to see
  const matchedPages: SearchResultItem[] = useMemo(() => {
    if (!query.trim()) return []

    const q = query.toLowerCase().trim()
    const pages: SearchResultItem[] = []

    for (const section of navigation) {
      for (const item of section.items) {
        // User must have permission for this page
        if (!item.permission || permissions.includes(item.permission)) {
          if (
            item.name.toLowerCase().includes(q) ||
            section.title.toLowerCase().includes(q) ||
            item.path.toLowerCase().includes(q)
          ) {
            pages.push({
              id: `page-${item.path}`,
              category: 'page',
              title: item.name,
              subtitle: `${section.title} • ${item.path}`,
              path: item.path,
            })
          }
        }
      }
    }

    return pages.slice(0, 5)
  }, [query, permissions])

  // 2. Server-Side User Scoped Record Search
  const { data: recordResults = [], isFetching } = useSearchQuery(debouncedQuery, {
    skip: !debouncedQuery || debouncedQuery.length < 2,
  })

  // Combine results
  const allResults = useMemo(() => {
    return [...matchedPages, ...recordResults]
  }, [matchedPages, recordResults])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [allResults.length, query])

  const handleSelect = (item: SearchResultItem) => {
    navigate(item.path)
    setIsOpen(false)
    setQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < allResults.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allResults.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (allResults[selectedIndex]) {
        handleSelect(allResults[selectedIndex])
      }
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'page':
        return <FileText size={16} className="text-emerald-600" />
      case 'journal':
        return <Scale size={16} className="text-blue-600" />
      case 'fees':
        return <CreditCard size={16} className="text-amber-600" />
      case 'students':
        return <GraduationCap size={16} className="text-purple-600" />
      case 'admissions':
        return <Users size={16} className="text-indigo-600" />
      case 'academic':
        return <BookOpen size={16} className="text-teal-600" />
      case 'budgets':
        return <Wallet size={16} className="text-green-600" />
      case 'procurement':
        return <ShoppingCart size={16} className="text-orange-600" />
      case 'assets':
        return <Boxes size={16} className="text-rose-600" />
      case 'inventory':
        return <Package size={16} className="text-cyan-600" />
      default:
        return <Search size={16} className="text-gray-500" />
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md mx-2 sm:mx-4">
      {/* Search Input Trigger */}
      <div className="relative flex items-center">
        <Search
          size={16}
          className="absolute left-3.5 text-gray-400 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search records, journals, students, or pages..."
          className="w-full h-9 pl-9 pr-14 text-xs sm:text-sm bg-gray-50 hover:bg-gray-100/80 focus:bg-white border border-gray-200 focus:border-green-800 focus:ring-2 focus:ring-green-100 rounded-xl transition-all outline-none"
        />
        {query && (
          <div className="absolute right-2.5 flex items-center gap-1 pointer-events-none">
            <button
              type="button"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="p-1 hover:text-gray-700 pointer-events-auto text-gray-400"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Search Dropdown / Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-11 bg-white rounded-2xl shadow-2xl border border-gray-200/80 overflow-hidden z-50 max-h-96 flex flex-col animate-in fade-in-50 slide-in-from-top-2 duration-150">
          {/* Status Header */}
          <div className="px-4 py-2.5 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-medium">
            <span>
              {query ? `Search results for "${query}"` : 'Quick Navigation & Shortcuts'}
            </span>
            {isFetching && <span className="loading loading-spinner loading-xs text-green-700" />}
          </div>

          {/* Results List */}
          <div className="overflow-y-auto p-2 divide-y divide-gray-50 space-y-1">
            {allResults.length > 0 ? (
              allResults.map((item, idx) => {
                const isSelected = idx === selectedIndex
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-green-50/90 text-green-950 shadow-2xs'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-white border border-gray-100 shadow-2xs shrink-0">
                        {getCategoryIcon(item.category)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold truncate">{item.title}</p>
                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-gray-100 text-gray-600 uppercase">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate">{item.subtitle}</p>
                      </div>
                    </div>

                    <ArrowRight
                      size={14}
                      className={`shrink-0 ml-2 transition-transform ${
                        isSelected ? 'translate-x-0.5 text-green-800' : 'text-gray-300'
                      }`}
                    />
                  </div>
                )
              })
            ) : query.length >= 2 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                No matching records found for your account permissions.
              </div>
            ) : (
              <div className="py-6 px-3 text-center text-xs text-gray-400 space-y-1">
                <p className="font-semibold text-gray-600">Search anything across your authorized modules</p>
                <p className="text-[11px]">Type an admission number, JE code, student name, or page title.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default GlobalSearchBar
