# Velvet Ink — Red social anónima 18+ de relatos íntimos

Muro estilo Facebook pero de tinta: cualquiera publica relatos eróticos (ficción adulta consensuada),
cada anónimo guarda su sesión, sigue a otros anónimos, arma hilos/capítulos, comenta y da likes.
Mobile-first, diseño Velvet Noir (Fraunces + Inter, blur NSFW, modo discreto).

- **Frontend**: React 19 + Vite + Tailwind v4 + Framer Motion (`/frontend`) → deploy en **Vercel** (auto-deploy en cada push a `main`)
- **Backend + DB**: Express + SQLite en esta VPS (`/backend`, pm2 `velvet-ink`, nginx `https://169-58-215-154.sslip.io/velvet-api`)

## Moderación (3 modos)
1. **Automática**: regex de bloqueo duro (menores y delitos → 422, no se guarda) + cola de revisión para fantasías límite.
2. **Comunidad**: 3 reportes → el post pasa a revisión automáticamente.
3. **Humana**: cola en la app (vista 🛡) con `MOD_KEY`.

Reglas: +18, solo ficción consensuada entre adultos. Cero tolerancia a lo ilegal.

## Dev local
```bash
# backend
cd backend && npm install && cp .env.example .env && npm run dev
# frontend (otra terminal)
cd frontend && npm install && echo 'VITE_API_URL=http://localhost:4000' > .env && npm run dev
```

## Prod
- API pública: `https://169-58-215-154.sslip.io/velvet-api` (nginx → pm2 `velvet-ink` :4000)
- Frontend Vercel: variable `VITE_API_URL=https://169-58-215-154.sslip.io/velvet-api`
- `MOD_KEY` solo en `/root/velvet-ink/backend/.env` (nunca en git).
