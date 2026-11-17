#!/usr/bin/env node
/**
 * Carga de dados de teste no Supabase LOCAL (nunca no projeto remoto).
 *
 *   npm run seed:test            cria/atualiza a carga (idempotente)
 *   npm run seed:test -- --clean apaga tudo o que a carga criou (IDs 5eed…)
 *
 * Gera PDFs de partitura (pdf-lib) e áudios WAV de entrega, envia ao storage local e roda
 * supabase/seed/test-data.sql no container do banco. Contas e senha: ver o cabeçalho do SQL.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORG_ID = 'a0000000-0000-4000-8000-000000000001';
const BUCKET = 'org-assets';
const SQL_PATH = join(ROOT, 'supabase', 'seed', 'test-data.sql');

const FILES = {
  sinfonia: {
    pieceId: '5eed0003-0000-4000-8000-000000000001',
    fileId: '5eed0004-0000-4000-8000-000000000001',
    name: 'Sinfonia_de_Testes.pdf',
  },
  hino: {
    pieceId: '5eed0003-0000-4000-8000-000000000002',
    fileId: '5eed0004-0000-4000-8000-000000000002',
    name: 'Hino_de_Testes.pdf',
  },
};

/** Entregas do SQL: [submissionId, taskId, musicianId, frequência base]. */
const SUBMISSIONS = [
  ['5eed0008-0000-4000-8000-000000000001', '5eed0007-0000-4000-8000-000000000001', '5eed0002-0000-4000-8000-000000000011', 440],
  ['5eed0008-0000-4000-8000-000000000002', '5eed0007-0000-4000-8000-000000000001', '5eed0002-0000-4000-8000-000000000012', 233],
  ['5eed0008-0000-4000-8000-000000000003', '5eed0007-0000-4000-8000-000000000001', '5eed0002-0000-4000-8000-000000000013', 392],
  ['5eed0008-0000-4000-8000-000000000004', '5eed0007-0000-4000-8000-000000000005', '5eed0002-0000-4000-8000-000000000013', 523],
  ['5eed0008-0000-4000-8000-000000000005', '5eed0007-0000-4000-8000-000000000007', '5eed0002-0000-4000-8000-000000000011', 349],
  ['5eed0008-0000-4000-8000-000000000006', '5eed0007-0000-4000-8000-000000000007', '5eed0002-0000-4000-8000-000000000011', 349],
  ['5eed0008-0000-4000-8000-000000000007', '5eed0007-0000-4000-8000-000000000103', '5eed0002-0000-4000-8000-000000000011', 294],
];

const AUDIO_SECONDS = 6;

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function readLocalSupabaseEnv() {
  const result = spawnSync('npx supabase status -o env', {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  });
  if (result.status !== 0) {
    fail(`Supabase local não respondeu (rode "npx supabase start").\n${result.stderr}`);
  }
  const env = {};
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (match) env[match[1]] = match[2];
  }
  const apiUrl = env.API_URL;
  const serviceKey = env.SERVICE_ROLE_KEY || env.SECRET_KEY;
  if (!apiUrl || !serviceKey) fail('Não achei API_URL / SERVICE_ROLE_KEY no "supabase status".');
  const host = new URL(apiUrl).hostname;
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) {
    fail(`Recusado: a carga de teste só roda no Supabase local (API_URL=${apiUrl}).`);
  }
  return { apiUrl, serviceKey };
}

function dbContainerName() {
  const config = readFileSync(join(ROOT, 'supabase', 'config.toml'), 'utf8');
  const projectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
  if (!projectId) fail('project_id não encontrado em supabase/config.toml.');
  return `supabase_db_${projectId}`;
}

function runSql(sql) {
  const result = spawnSync(
    'docker',
    ['exec', '-i', dbContainerName(), 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'],
    { input: sql, encoding: 'utf8' },
  );
  if (result.status !== 0) fail(`Erro no SQL:\n${result.stderr || result.stdout}`);
}

function pieceStorageKey(file) {
  return `${ORG_ID}/pieces/${file.pieceId}/${file.fileId}-${file.name}`;
}

function submissionStorageKey([submissionId, taskId, musicianId]) {
  return `${ORG_ID}/practice/${taskId}/${musicianId}/${submissionId}.wav`;
}

/** Partitura fictícia: pautas, números de compasso e cabeçalho de seção. */
async function buildScorePdf({ title, sections, pages }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.1);
  let measure = 1;

  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    const page = pdf.addPage([595, 842]);
    const section = sections.find((s) => pageNumber >= s.from && pageNumber <= s.to);
    let y = 790;
    if (pageNumber === 1) {
      page.drawText(title, { x: 50, y, size: 22, font: bold, color: ink });
      y -= 30;
    }
    if (section && section.from === pageNumber) {
      page.drawText(section.label, { x: 50, y, size: 15, font: bold, color: ink });
      y -= 26;
    }
    for (let system = 0; y > 90; system += 1) {
      for (let line = 0; line < 5; line += 1) {
        page.drawLine({
          start: { x: 50, y: y - line * 7 },
          end: { x: 545, y: y - line * 7 },
          thickness: 0.6,
          color: ink,
        });
      }
      for (let bar = 0; bar <= 4; bar += 1) {
        const x = 50 + bar * 123.75;
        page.drawLine({ start: { x, y }, end: { x, y: y - 28 }, thickness: 0.8, color: ink });
        if (bar < 4) {
          page.drawText(String(measure), { x: x + 2, y: y + 5, size: 8, font, color: ink });
          // Algumas "notas" para não parecer uma pauta vazia.
          for (let note = 0; note < 4; note += 1) {
            const noteY = y - 3.5 * (((measure + note * 3 + system) % 9));
            page.drawEllipse({ x: x + 20 + note * 26, y: noteY, xScale: 4, yScale: 3, color: ink });
          }
          measure += 1;
        }
      }
      y -= 70;
    }
    page.drawText(`${section?.label ?? ''} — página ${pageNumber} de ${pages}`, {
      x: 50,
      y: 40,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }
  return Buffer.from(await pdf.save());
}

/** WAV mono 16 kHz com um arpejo simples (cada entrega soa diferente). */
function buildWav(baseFrequency) {
  const sampleRate = 16000;
  const samples = sampleRate * AUDIO_SECONDS;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples * 2, 40);
  const ratios = [1, 5 / 4, 3 / 2, 2, 3 / 2, 5 / 4];
  const noteLength = samples / ratios.length;
  for (let i = 0; i < samples; i += 1) {
    const noteIndex = Math.floor(i / noteLength);
    const t = (i % noteLength) / sampleRate;
    const envelope = Math.min(1, t * 40) * Math.exp(-t * 2.5);
    const value = Math.sin(2 * Math.PI * baseFrequency * ratios[noteIndex] * (i / sampleRate)) * envelope * 0.4;
    buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  return buffer;
}

async function upload(storage, key, body, contentType) {
  const { error } = await storage.upload(key, body, { contentType, upsert: true });
  if (error) fail(`Falha ao enviar ${key}: ${error.message}`);
}

async function clean(storage) {
  const keys = [
    ...Object.values(FILES).map(pieceStorageKey),
    ...SUBMISSIONS.map(submissionStorageKey),
  ];
  const { error } = await storage.remove(keys);
  if (error) fail(`Falha ao remover arquivos: ${error.message}`);
  runSql(`
    BEGIN;
    DELETE FROM practice_tasks WHERE id::text LIKE '5eed%';
    DELETE FROM program_items WHERE id::text LIKE '5eed%';
    DELETE FROM events WHERE id::text LIKE '5eed%';
    DELETE FROM pieces WHERE id::text LIKE '5eed%';
    DELETE FROM assignments WHERE id::text LIKE '5eed%';
    DELETE FROM musicians WHERE id::text LIKE '5eed%';
    DELETE FROM memberships WHERE user_id::text LIKE '5eed%';
    DELETE FROM profiles WHERE id::text LIKE '5eed%';
    DELETE FROM auth.users WHERE id::text LIKE '5eed%';
    COMMIT;
  `);
  console.log('✔ Carga de teste removida.');
}

async function main() {
  const { apiUrl, serviceKey } = readLocalSupabaseEnv();
  const supabase = createClient(apiUrl, serviceKey, { auth: { persistSession: false } });
  const storage = supabase.storage.from(BUCKET);

  if (process.argv.includes('--clean')) {
    await clean(storage);
    return;
  }

  console.log(`→ Supabase local: ${apiUrl}`);

  const sinfonia = await buildScorePdf({
    title: 'Sinfonia de Testes',
    pages: 12,
    sections: [
      { label: 'I. Allegro', from: 1, to: 4 },
      { label: 'II. Andante', from: 5, to: 8 },
      { label: 'III. Minueto', from: 9, to: 10 },
      { label: 'IV. Final', from: 11, to: 12 },
    ],
  });
  const hino = await buildScorePdf({
    title: 'Hino de Testes',
    pages: 4,
    sections: [
      { label: 'Estrofe 1', from: 1, to: 2 },
      { label: 'Refrão', from: 3, to: 4 },
    ],
  });
  await upload(storage, pieceStorageKey(FILES.sinfonia), sinfonia, 'application/pdf');
  await upload(storage, pieceStorageKey(FILES.hino), hino, 'application/pdf');
  console.log('✔ PDFs enviados');

  let audioSize = 0;
  for (const submission of SUBMISSIONS) {
    const wav = buildWav(submission[3]);
    audioSize = wav.length;
    await upload(storage, submissionStorageKey(submission), wav, 'audio/wav');
  }
  console.log(`✔ ${SUBMISSIONS.length} áudios de entrega enviados`);

  const sql = readFileSync(SQL_PATH, 'utf8')
    .replaceAll('{{SINFONIA_KEY}}', pieceStorageKey(FILES.sinfonia))
    .replaceAll('{{SINFONIA_SIZE}}', String(sinfonia.length))
    .replaceAll('{{HINO_KEY}}', pieceStorageKey(FILES.hino))
    .replaceAll('{{HINO_SIZE}}', String(hino.length))
    .replaceAll('{{AUDIO_DURATION_MS}}', String(AUDIO_SECONDS * 1000))
    .replaceAll('{{AUDIO_SIZE}}', String(audioSize));
  if (/\{\{[A-Z_]+\}\}/.test(sql)) fail('Sobrou marcador {{...}} sem valor no SQL.');
  runSql(sql);

  console.log('✔ Dados inseridos. Contas (senha kairos-teste):');
  console.log('  maestro@ · professora@ · ana@ · bruno@ · carla@ · diego@ · elisa@ kairos.local');
}

main().catch((error) => fail(error instanceof Error ? error.stack ?? error.message : String(error)));
