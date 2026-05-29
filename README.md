# Owee 🧾
**Dividí gastos sin drama**

---

## Cómo publicar la app

### Paso 1 — Configurar Firebase

1. Entrá a https://console.firebase.google.com
2. Creá un proyecto nuevo (dale cualquier nombre)
3. En el menú izquierdo → **Build → Realtime Database**
4. Clic en "Create Database" → elegí ubicación → modo **test** (por ahora)
5. Volvé a la pantalla principal del proyecto → clic en el ícono `</>` (Web app)
6. Registrá la app, copiá el objeto `firebaseConfig`
7. Pegá esos valores en `src/firebase.js`

---

### Paso 2 — Subir a GitHub

1. Creá una cuenta en https://github.com si no tenés
2. Creá un nuevo repositorio (vacío, público o privado)
3. En tu computadora, en la carpeta del proyecto:

```bash
npm install
git init
git add .
git commit -m "primer commit"
git remote add origin https://github.com/TU_USUARIO/owee.git
git push -u origin main
```

---

### Paso 3 — Deployar en Vercel

1. Entrá a https://vercel.com y creá cuenta con GitHub
2. Clic en "Add New Project"
3. Importá el repo de owee
4. Vercel detecta Vite solo → clic en **Deploy**
5. En ~2 minutos tenés tu URL tipo `owee.vercel.app` 🎉

---

### Paso 4 — Dominio propio (opcional, para AdSense)

1. Comprá un dominio en https://porkbun.com (~$10/año)
2. En Vercel → tu proyecto → Settings → Domains → agregá tu dominio
3. Seguí las instrucciones para apuntar los DNS

---

### Paso 5 — Google AdSense

1. Entrá a https://adsense.google.com
2. Agregá tu sitio web con el dominio propio
3. Pegá el script que te dan en el `<head>` de `index.html`
4. Esperás aprobación (puede tardar días/semanas)

---

## Cómo funciona el código

```
owee/
├── src/
│   ├── App.jsx        ← toda la app
│   ├── firebase.js    ← configuración Firebase (completar con tus datos)
│   ├── main.jsx       ← punto de entrada
│   └── index.css      ← estilos globales
├── public/
│   └── favicon.svg
├── index.html
├── package.json
└── vite.config.js
```

## Colaboración en tiempo real

Cada grupo tiene un **código único**. Para que otros se unan:
1. El creador del grupo ve el código en la pantalla del grupo
2. Lo comparte (aparece en el mensaje de WhatsApp)
3. Los demás entran a la app → "Unirse" → pegan el código
4. Todos ven y editan el grupo en tiempo real via Firebase

---

*Hecho con Owee 🤙*
