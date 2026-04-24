# Infographic Content Workflow

Edit `content/infographic.md` when the pitch/demo story changes.

Then run:

```powershell
npm run build:data
```

This regenerates `data/infographic.json`, which the app imports at runtime.

Keep stable section ids such as `overview`, `trends`, `players`, and `digital` when possible, because navigation links use them. Display titles, descriptions, chart rows, and badges can change freely.
