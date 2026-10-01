// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { GitBranchTag } from '../src/client/GitBranchTag.tsx'

afterEach(cleanup)

const t = (key: string): string => (key === 'git.none' ? '无git' : '当前工程 git 分支')

function snapshot(sessionIds: readonly string[]): WorkspaceSnapshot {
  return {
    items: [{
      workspaceId: 'ws-1' as never,
      path: '/work/repo',
      title: 'repo',
      sessionIds: sessionIds as never,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
    archivedSessionIds: [],
    pinnedSessionIds: [],
    state: 'idle',
    phase: 'ready',
    error: null,
  }
}

type TagProps = Parameters<typeof GitBranchTag>[0]

function props(options: {
  sessionId?: string
  gitBranch: (path: string) => Promise<string | null>
  items?: readonly string[]
}): TagProps {
  return {
    sessionId: (options.sessionId ?? 'session-1') as never,
    useWorkspaces: (selector: (snapshot: WorkspaceSnapshot) => unknown) =>
      selector(snapshot(options.items ?? ['session-1'])) as never,
    gitBranch: options.gitBranch,
    t: t as never,
  } as unknown as TagProps
}

describe('GitBranchTag', () => {
  it('shows the resolved branch of the session workspace', async () => {
    const gitBranch = vi.fn(async () => 'feature/git-tag')
    render(<GitBranchTag {...props({ gitBranch })} />)
    await waitFor(() => { expect(screen.getByText('feature/git-tag')).toBeTruthy() })
    expect(gitBranch).toHaveBeenCalledWith('/work/repo')
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('当前工程 git 分支')
  })

  it('shows the no-git copy for a non-repository workspace', async () => {
    render(<GitBranchTag {...props({ gitBranch: async () => null })} />)
    await waitFor(() => { expect(screen.getByText('无git')).toBeTruthy() })
  })

  it('treats a failed lookup as no git instead of throwing', async () => {
    render(<GitBranchTag {...props({ gitBranch: async () => { throw new Error('wire down') } })} />)
    await waitFor(() => { expect(screen.getByText('无git')).toBeTruthy() })
  })

  it('renders nothing while the lookup is in flight', () => {
    render(<GitBranchTag {...props({ gitBranch: () => new Promise(() => {}) })} />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('re-queries when the window regains focus', async () => {
    const gitBranch = vi.fn<() => Promise<string | null>>()
      .mockResolvedValueOnce('main')
      .mockResolvedValueOnce('next')
    render(<GitBranchTag {...props({ gitBranch })} />)
    await waitFor(() => { expect(screen.getByText('main')).toBeTruthy() })
    window.dispatchEvent(new Event('focus'))
    await waitFor(() => { expect(screen.getByText('next')).toBeTruthy() })
    expect(gitBranch).toHaveBeenCalledTimes(2)
  })

  it('follows the session to another workspace and never lands a stale reply', async () => {
    let resolveSecond: ((branch: string | null) => void) | undefined
    const gitBranch = vi.fn<() => Promise<string | null>>()
      .mockResolvedValueOnce('main')
      .mockImplementationOnce(() => new Promise<string | null>((resolve) => { resolveSecond = resolve }))
    const { rerender } = render(<GitBranchTag {...props({ gitBranch })} />)
    await waitFor(() => { expect(screen.getByText('main')).toBeTruthy() })

    rerender(<GitBranchTag {...props({ gitBranch, sessionId: 'session-2', items: [] })} />)
    // The session left every workspace; nothing renders while pathless.
    expect(screen.queryByRole('status')).toBeNull()
    // The superseded lookup's late reply must not resurrect the stale tag.
    resolveSecond?.('stale')
    await Promise.resolve()
    expect(screen.queryByText('stale')).toBeNull()
  })
})
