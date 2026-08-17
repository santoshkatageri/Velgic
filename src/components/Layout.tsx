import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { useUI } from '../store/uiStore'
import { Button, useConfirm } from './ui'
import {
  IconDashboard,
  IconInbox,
  IconPipeline,
  IconFlask,
  IconChart,
  IconPlus,
  IconRefresh,
} from './icons'

const NAV = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/ideas', label: 'Ideas', icon: IconInbox, end: false },
  { to: '/pipeline', label: 'Pipeline', icon: IconPipeline, end: false },
  { to: '/experiments', label: 'Experiments', icon: IconFlask, end: false },
  { to: '/insights', label: 'Insights', icon: IconChart, end: false },
]

function pageTitle(pathname: string): string {
  if (pathname.startsWith('/items/')) return 'Content Detail'
  if (pathname.startsWith('/ideas')) return 'Idea Inbox'
  if (pathname.startsWith('/pipeline')) return 'Content Pipeline'
  if (pathname.startsWith('/experiments')) return 'Experiment Log'
  if (pathname.startsWith('/insights')) return 'Insights'
  return 'Dashboard'
}

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const openEditor = useUI((s) => s.openEditor)
  const resetData = useStore((s) => s.resetData)
  const confirm = useConfirm()

  const handleReset = async () => {
    const ok = await confirm('Reset all data back to the seeded example? Your changes will be lost.')
    if (ok) resetData()
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="brand-mark">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M8 17h5l2.2-6 4.6 11 2.2-5H24" stroke="#6e8bff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="brand-text">
            <span className="brand-name">Velgic</span>
            <span className="brand-sub">creator OS</span>
          </div>
        </div>

        <nav className="nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'nav__item nav__item--active' : 'nav__item')}>
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <button className="sidebar__reset" onClick={handleReset}>
            <IconRefresh size={14} />
            Reset demo data
          </button>
          <span className="sidebar__version">v0.1 · local-first</span>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1 className="topbar__title">{pageTitle(location.pathname)}</h1>
          <Button variant="primary" size="sm" icon={<IconPlus size={15} />} onClick={() => openEditor(null)}>
            New idea
          </Button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
