# Excalidraw Monorepo

A full-stack web development monorepo built with **Turborepo**, **Next.js**, **TypeScript**, and **pnpm workspaces** — scaffolded to support an Excalidraw-style collaborative drawing application.

---

## 📁 Project Structure

```
excalidraw/
├── apps/
│   ├── web/          # Main Next.js application
│   └── docs/         # Next.js documentation app
├── packages/
│   ├── @repo/ui              # Shared React component library
│   ├── @repo/eslint-config   # Shared ESLint configuration
│   └── @repo/typescript-config  # Shared TypeScript configuration
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── .npmrc
```

Each app and package is written in **100% TypeScript**.

---

## 🛠️ Tech Stack

| Tool | Purpose |
|------|---------|
| [Turborepo](https://turborepo.dev) | Monorepo build system with caching |
| [Next.js](https://nextjs.org) | React framework for `web` and `docs` apps |
| [TypeScript](https://www.typescriptlang.org) | Static type checking across the monorepo |
| [pnpm](https://pnpm.io) | Fast, disk-efficient package manager |
| [ESLint](https://eslint.org) | Code linting |
| [Prettier](https://prettier.io) | Code formatting |

---

## ⚙️ Prerequisites

- **Node.js** >= 18
- **pnpm** 9.0.0

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/aarthi-kumari/excalidraw.git
cd excalidraw
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Start development servers

```bash
# All apps
pnpm dev

# Or with global turbo
turbo dev

# Specific app only
turbo dev --filter=web
turbo dev --filter=docs
```

---

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all packages |
| `pnpm format` | Format all `.ts`, `.tsx`, and `.md` files with Prettier |
| `pnpm check-types` | Run TypeScript type checking across the monorepo |

### Build a specific app

```bash
turbo build --filter=web
turbo build --filter=docs
```

---

## 🧩 Packages

### `apps/web`
The primary Next.js application — the main Excalidraw canvas interface.

### `apps/docs`
A Next.js documentation site for the project.

### `@repo/ui`
A shared React component library consumed by both `web` and `docs` apps.

### `@repo/eslint-config`
Centralised ESLint config extending `eslint-config-next` and `eslint-config-prettier`.

### `@repo/typescript-config`
Shared `tsconfig.json` base configurations used throughout the monorepo.

---

## ☁️ Remote Caching (Optional)

Turborepo supports [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching) via Vercel to share build artifacts across machines and CI/CD pipelines.

```bash
# Authenticate with Vercel
turbo login

# Link your repo to remote cache
turbo link
```

> Vercel Remote Cache is free for all plans.

---

## 🔗 Useful Links

- [Turborepo Docs](https://turborepo.dev/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Turborepo Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching)

---

## 👩‍💻 Author

**Aarthi Kumari** — [@aarthi-kumari](https://github.com/aarthi-kumari)
