/**
 * Host git-branch resolution for the `workspace.gitBranch` Remote: reads the
 * resolved directory's git metadata directly, so no git executable, PATH, or
 * subprocess confinement participates. The lookup walks upward from the
 * requested directory the way git does, so a Workspace rooted in a repository
 * subdirectory reports the containing repository's branch.
 */

import { readFile, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'

/** Maximum directories examined above the requested one before giving up. */
const MAX_UPWARD_STEPS = 64

/** Length of the abbreviated commit SHA reported for a detached HEAD. */
const DETACHED_ABBREV = 7

/**
 * Resolve the git branch of a directory tree.
 * @param path - fully qualified host directory; anything else is a contract violation.
 * @returns the checked-out branch name, the abbreviated commit SHA for a detached HEAD,
 *   or `null` when no git worktree is found or its metadata is unreadable.
 */
export async function resolveGitBranch(path: string): Promise<string | null> {
  if (typeof path !== 'string' || path === '' || !isAbsolute(path)) {
    throw new TypeError('gitBranch path must be a non-empty absolute directory path')
  }
  const head = await findHead(resolve(path))
  if (head === null) return null
  try {
    const content = (await readFile(head, 'utf8')).trim()
    // A normal checkout names its branch; a detached HEAD names the commit.
    if (content.startsWith('ref: refs/heads/')) return content.slice('ref: refs/heads/'.length)
    if (content.startsWith('ref: ')) return null
    return content === '' ? null : content.slice(0, DETACHED_ABBREV)
  } catch {
    // The worktree exists but its HEAD is unreadable; report no branch rather
    // than failing the whole composer.
    return null
  }
}

/**
 * Walk from the start directory upward to the nearest git metadata entry.
 * @param start - resolved directory to search from.
 * @returns the git HEAD file path, or `null` when none is found.
 */
async function findHead(start: string): Promise<string | null> {
  let dir = start
  for (let steps = 0; steps < MAX_UPWARD_STEPS; steps += 1) {
    const dotGit = join(dir, '.git')
    try {
      const info = await stat(dotGit)
      if (info.isFile()) {
        // A worktree/ submodule pointer file: "gitdir: <path>", relative to
        // this directory or absolute.
        const pointer = (await readFile(dotGit, 'utf8')).trim()
        if (pointer.startsWith('gitdir:')) {
          const target = pointer.slice('gitdir:'.length).trim()
          const gitdir = isAbsolute(target) ? target : join(dir, target)
          return join(gitdir, 'HEAD')
        }
      } else if (info.isDirectory()) {
        return join(dotGit, 'HEAD')
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return null
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
  return null
}
