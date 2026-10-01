/**
 * Composer git-branch tag. Mounted on 'conversation.composer.dock' so the tag
 * sits under the composer of the active conversation. It reads the current
 * Session's owning Workspace and resolves that directory's git branch through
 * the Host; a non-git directory renders the localized "no git" copy. The
 * lookup re-runs when the Session's Workspace changes and when the window
 * regains focus, so a branch switch made outside the app shows up without a
 * restart.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { IconBranchOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './GitBranchTag.module.css'

/** Composer-tag injected share: the Host git-branch lookup, one callback. */
export interface GitBranchTagInjected {
  /** Resolve the git branch of one host directory; `null` when there is none. */
  gitBranch: (path: string) => Promise<string | null>
}

/** Full tag props: the session-scoped dock share, the lookup, and the locale seat. */
export type GitBranchTagProps =
  PropsRuntime<'conversation.composer.dock'>
  & InjectFace<GitBranchTagInjected>
  & PropsLocale<'workspace'>

/** The tag never shows while its lookup is in flight or before the first result. */
type BranchState = { readonly kind: 'loading' } | { readonly kind: 'resolved'; readonly branch: string | null }

export const GitBranchTag = memo(function GitBranchTag({
  sessionId, useWorkspaces, gitBranch, t,
}: GitBranchTagProps) {
  const workspaces = useWorkspaces(s => s)
  const owningWorkspace = workspaces.items.find(workspace => workspace.sessionIds.includes(sessionId))
  const path = owningWorkspace?.path
  const [state, setState] = useState<BranchState>({ kind: 'loading' })
  // Sequence token: a stale response for a superseded path never lands.
  const lookupSeq = useRef(0)
  const lookup = useCallback(() => {
    if (path === undefined) return
    const seq = ++lookupSeq.current
    gitBranch(path).then((branch) => {
      if (lookupSeq.current === seq) setState({ kind: 'resolved', branch })
    }).catch(() => {
      if (lookupSeq.current === seq) setState({ kind: 'resolved', branch: null })
    })
  }, [gitBranch, path])
  useEffect(lookup, [lookup])
  useEffect(() => {
    window.addEventListener('focus', lookup)
    return () => { window.removeEventListener('focus', lookup) }
  }, [lookup])

  if (path === undefined || state.kind === 'loading') return null
  return (
    <span className={css.root} role="status" aria-label={t('git.branch.aria')}>
      <IconBranchOutlineRegular size={12} />
      <span className={css.branch}>{state.branch ?? t('git.none')}</span>
    </span>
  )
})
