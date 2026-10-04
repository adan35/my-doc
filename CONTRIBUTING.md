# Contributing

Thanks for helping improve My Doc.

1. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) to see where your change belongs, and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for setup.
2. Create a branch from `main`.
3. Make the change, with tests for new behavior.
4. Before opening a pull request, run:

   ```bash
   npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
   npm run test:e2e
   ```

5. Open a pull request that says what changed for the user and how you tested it. CI must pass.

## Guidelines

- User data comes first. A change must never lose or silently change a user's documents. Writes go through `Workspace`, which commits atomically.
- Files stay portable. Don't store information only in My Doc's database if it belongs in the document itself.
- Ship real features only. Don't add buttons or settings for things that don't work yet.
- Check your change at phone, tablet and desktop widths, and in light and dark themes.
- Keep it accessible: real buttons and links, labels on icon buttons, visible focus, and keyboard support.
- Treat all document content as untrusted. See [SECURITY.md](SECURITY.md).
