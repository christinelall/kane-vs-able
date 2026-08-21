# macOS Codex autonomous repair fix

v0.5 changes the automatic ABLE repair command to the form proven to work on the user's Mac:

```bash
codex exec --skip-git-repo-check --sandbox workspace-write "<repair prompt>"
```

Why:
- the downloaded hackathon folder is not a Git repository;
- macOS does not currently have Apple command-line developer tools installed;
- Codex therefore needs `--skip-git-repo-check`;
- direct prompt invocation was confirmed working, while the previous stdin form did not behave reliably.

No Xcode installation is required for the duel.
