import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveGitBranch } from '../src/git-branch.ts'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function scratch(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), `dsh-git-branch-${name}-`))
  dirs.push(dir)
  return dir
}

describe('resolveGitBranch', () => {
  it('rejects a relative or empty path', async () => {
    await expect(resolveGitBranch('relative/path')).rejects.toThrow(TypeError)
    await expect(resolveGitBranch('')).rejects.toThrow(TypeError)
  })

  it('reads the branch of a plain repository HEAD', async () => {
    const root = scratch('plain')
    mkdirSync(join(root, '.git'))
    writeFileSync(join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n')
    await expect(resolveGitBranch(root)).resolves.toBe('main')
  })

  it('walks up from a repository subdirectory', async () => {
    const root = scratch('nested')
    mkdirSync(join(root, '.git'))
    mkdirSync(join(root, 'deep', 'deeper'), { recursive: true })
    writeFileSync(join(root, '.git', 'HEAD'), 'ref: refs/heads/feature/x\n')
    await expect(resolveGitBranch(join(root, 'deep', 'deeper'))).resolves.toBe('feature/x')
  })

  it('follows a worktree gitdir pointer file', async () => {
    const root = scratch('worktree')
    const gitdir = join(root, 'wt')
    mkdirSync(gitdir, { recursive: true })
    writeFileSync(join(root, '.git'), `gitdir: ${gitdir}\n`)
    writeFileSync(join(gitdir, 'HEAD'), 'ref: refs/heads/wt-branch\n')
    await expect(resolveGitBranch(root)).resolves.toBe('wt-branch')
  })

  it('abbreviates a detached HEAD to its commit', async () => {
    const root = scratch('detached')
    mkdirSync(join(root, '.git'))
    writeFileSync(join(root, '.git', 'HEAD'), '0123456789abcdef0123456789abcdef01234567\n')
    await expect(resolveGitBranch(root)).resolves.toBe('0123456')
  })

  it('reports null outside a repository and for an unreadable HEAD', async () => {
    const plain = scratch('outside')
    await expect(resolveGitBranch(plain)).resolves.toBeNull()
    const broken = scratch('broken')
    mkdirSync(join(broken, '.git', 'HEAD'), { recursive: true })
    await expect(resolveGitBranch(broken)).resolves.toBeNull()
  })
})
