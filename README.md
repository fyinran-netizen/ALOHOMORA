# ALOHOMORA

ALOHOMORA is a lightweight 2D Hogwarts castle scene built with native HTML, CSS, and JavaScript modules. It has no build step or package installation.

## Run the local preview

Requirements: Node.js.

From the project root, run:

```powershell
node tools/preview.mjs
```

Keep that terminal open while using the preview. Open <http://127.0.0.1:5173/> in a browser. Stop the server with `Ctrl+C` in the terminal.

The server is implemented in `tools/preview.mjs`; it uses only Node.js built-in modules. Do not use `npm start`, Vite, or Python for this project.

## Preview workflow for Codex conversations

When asked to show or start the preview:

1. Check whether `http://127.0.0.1:5173/` already serves this project. If it does, reuse it and open that URL; do not start a second server or ask the user to start it again.
2. If it is not running, from `D:\Alohomora` run `node tools/preview.mjs` and keep the process alive, then open the URL above.
3. If port 5173 is occupied, first check whether it is already this project's preview. Reuse it when it is. If another service owns the port, explain the conflict before choosing another port.
4. If the environment blocks binding to localhost, request the required command approval and retry the same Node command. Do not detour into installing dependencies or changing the server stack.

## Checks

Run the existing regression suite with:

```powershell
node --test tests/*.test.mjs
```
