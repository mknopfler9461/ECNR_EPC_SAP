import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'content', 'infographic.md');
const outputPath = path.join(root, 'data', 'infographic.json');

function parseJsonBlock(markdown, name, fallback = {}) {
  const pattern = new RegExp('```json\\s+' + name + '\\n([\\s\\S]*?)\\n```', 'm');
  const match = markdown.match(pattern);
  if (!match) return fallback;
  return JSON.parse(match[1]);
}

function stripJsonBlocks(markdown) {
  return markdown.replace(/```json\s+\w+\n[\s\S]*?\n```/g, '').trim();
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isDivider(line) {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function parseTable(lines, startIndex) {
  const tableLines = [];
  let i = startIndex;
  while (i < lines.length && lines[i].trim().startsWith('|')) {
    if (!isDivider(lines[i])) tableLines.push(lines[i]);
    i += 1;
  }
  if (tableLines.length < 2) return { rows: [], nextIndex: i };

  const headers = splitTableRow(tableLines[0]);
  const rows = tableLines.slice(1).map((line) => {
    const cells = splitTableRow(line);
    return Object.fromEntries(headers.map((header, index) => [header, coerce(cells[index] ?? '')]));
  });
  return { rows, nextIndex: i };
}

function coerce(value) {
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function collectParagraph(lines, startIndex) {
  const parts = [];
  let i = startIndex;
  while (i < lines.length && !lines[i].startsWith('### ') && !lines[i].startsWith('## ')) {
    if (lines[i].trim()) parts.push(lines[i].trim());
    i += 1;
  }
  return { text: parts.join('\n'), nextIndex: i };
}

function parseList(lines, startIndex) {
  const items = [];
  let i = startIndex;
  while (i < lines.length && lines[i].trim().startsWith('- ')) {
    items.push(lines[i].trim().slice(2));
    i += 1;
  }
  return { items, nextIndex: i };
}

function makeDatasets(rows, headers) {
  return headers.slice(1).map((header, index) => ({
    label: header,
    data: rows.map((row) => row[header]),
    backgroundColor: index === 0 ? '#FD349C' : '#00338D',
  }));
}

function parseChart(meta, rows) {
  const [, id, type, title, note = '', height = '350'] = meta.split('|').map((part) => part.trim());
  if (!id || !type || !title) throw new Error(`Invalid chart heading: ${meta}`);

  if (type === 'doughnut') {
    return {
      id,
      type,
      title,
      note,
      height: Number(height),
      labels: rows.map((row) => row.label),
      datasets: [
        {
          label: title,
          data: rows.map((row) => row.value),
          backgroundColor: rows.map((row) => row.color),
        },
      ],
    };
  }

  if (type === 'horizontalBar') {
    const valueKey = Object.keys(rows[0] ?? {}).find((key) => key !== 'label' && key !== 'color');
    return {
      id,
      type,
      title,
      note,
      height: Number(height || 400),
      labels: rows.map((row) => row.label),
      datasets: [
        {
          label: valueKey,
          data: rows.map((row) => row[valueKey]),
          backgroundColor: rows.map((row) => row.color),
        },
      ],
    };
  }

  if (type === 'radar') {
    const [labelKey, digitalKey, traditionalKey] = Object.keys(rows[0] ?? {});
    return {
      id,
      type,
      title,
      note,
      height: Number(height || 350),
      labels: rows.map((row) => String(row[labelKey]).split('/').map((item) => item.trim())),
      datasets: [
        {
          label: digitalKey,
          data: rows.map((row) => row[digitalKey]),
          backgroundColor: 'rgba(0, 180, 216, 0.2)',
          borderColor: '#FD349C',
          pointBackgroundColor: '#00338D',
        },
        {
          label: traditionalKey,
          data: rows.map((row) => row[traditionalKey]),
          backgroundColor: 'rgba(239, 71, 111, 0.2)',
          borderColor: '#ACEAFF',
          pointBackgroundColor: '#00338D',
        },
      ],
    };
  }

  const headers = Object.keys(rows[0] ?? {});
  return {
    id,
    type,
    title,
    note,
    height: Number(height || 350),
    labels: rows.map((row) => row.label),
    datasets: makeDatasets(rows, headers),
  };
}

function parseSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let i = 0;

  while (i < lines.length) {
    const sectionMatch = lines[i].match(/^##\s+([^|]+)\|\s*([^|]+)\|\s*(.+)$/);
    if (!sectionMatch) {
      i += 1;
      continue;
    }

    const section = {
      id: sectionMatch[1].trim(),
      title: sectionMatch[2].trim(),
      accent: sectionMatch[3].trim(),
      intro: '',
      stats: null,
      charts: [],
      notes: [],
      badges: [],
      steps: null,
    };

    const intro = collectParagraph(lines, i + 1);
    section.intro = intro.text;
    i = intro.nextIndex;

    while (i < lines.length && !lines[i].startsWith('## ')) {
      const subheading = lines[i].match(/^###\s+(.+)$/);
      if (!subheading) {
        i += 1;
        continue;
      }

      const heading = subheading[1].trim();
      i += 1;
      while (i < lines.length && !lines[i].trim()) i += 1;

      if (heading.startsWith('Stats')) {
        const [, title = '', description = ''] = heading.split('|').map((part) => part.trim());
        const table = parseTable(lines, i);
        section.stats = { title, description, items: table.rows };
        i = table.nextIndex;
      } else if (heading.startsWith('Chart')) {
        const table = parseTable(lines, i);
        section.charts.push(parseChart(heading, table.rows));
        i = table.nextIndex;
      } else if (heading === 'Notes') {
        const table = parseTable(lines, i);
        section.notes = table.rows;
        i = table.nextIndex;
      } else if (heading === 'Badges') {
        const list = parseList(lines, i);
        section.badges = list.items;
        i = list.nextIndex;
      } else if (heading.startsWith('Steps')) {
        const [, title = ''] = heading.split('|').map((part) => part.trim());
        const table = parseTable(lines, i);
        section.steps = { title, items: table.rows };
        i = table.nextIndex;
      } else {
        i += 1;
      }
    }

    sections.push(section);
  }

  return sections;
}

function parseInfographic(markdown) {
  const clean = stripJsonBlocks(markdown);
  const title = clean.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const subtitle = clean.match(/^>\s+(.+)$/m)?.[1]?.trim();
  if (!title || !subtitle) throw new Error('The markdown must start with a # title and > subtitle.');

  return {
    hero: { title, subtitle },
    meta: parseJsonBlock(markdown, 'meta'),
    ai: parseJsonBlock(markdown, 'ai'),
    sections: parseSections(clean),
  };
}

const markdown = await readFile(sourcePath, 'utf8');
const data = parseInfographic(markdown);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

console.log(`Generated ${path.relative(root, outputPath)} from ${path.relative(root, sourcePath)}`);
