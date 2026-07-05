import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Anthropic SDK at module level (vi.mock is hoisted). The service uses
// the fenced-JSON contract via messages.create; messages.parse shares the same
// mock so a future switch to structured outputs keeps these tests honest.
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate, parse: mockCreate };
    },
  };
});

import {
  WEEKLY_PLAN_MODEL,
  WEEKLY_PLAN_SYSTEM_PROMPT,
  computeRecipeServeStats,
  buildRecipeLibraryEntries,
  buildRecipeLine,
  buildSlotsSection,
  buildReviewSection,
  buildWeeklyPlanUserMessage,
  buildRetryMessage,
  parseWeeklyPlanResponse,
  validatePlanItems,
  planApplyOperations,
  generateWeeklyPlan,
  dayNameFor,
  type RecipeLibraryEntry,
  type WeeklyPlanPromptInput,
} from '../services/weekly-plan-generator';
import { generateWeeklyPlanRequestSchema } from '@shared/schema';
import { allWeekSlots, computeEmptySlots, type WeekSlot } from '@shared/weekly-plan';

// 2026-07-06 is a Monday
const MONDAY = '2026-07-06';

function libraryEntry(id: number, overrides: Partial<RecipeLibraryEntry> = {}): RecipeLibraryEntry {
  return {
    id,
    nombre: `Receta ${id}`,
    categoria: 'Plato Principal',
    calificacionNinos: null,
    esFavorita: false,
    tiempoPreparacion: null,
    avgUserRating: null,
    timesServedLast8Weeks: 0,
    lastServedFecha: null,
    commentSnippets: [],
    proposedCount: 0,
    proposalAcceptedCount: 0,
    proposalRejectedCount: 0,
    proposalReasons: [],
    ...overrides,
  };
}

function promptInput(overrides: Partial<WeeklyPlanPromptInput> = {}): WeeklyPlanPromptInput {
  return {
    weekStartDate: MONDAY,
    slots: [
      { fecha: MONDAY, tipoComida: 'almuerzo' },
      { fecha: MONDAY, tipoComida: 'cena' },
    ],
    library: [libraryEntry(1), libraryEntry(2), libraryEntry(3)],
    recentReviews: [],
    signoffNotes: [],
    plannerPrompt: null,
    instructions: null,
    ...overrides,
  };
}

function textResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

function planResponse(items: unknown[], resumen = 'Semana variada y liviana.') {
  return textResponse(`¡Listo!\n\`\`\`json\n${JSON.stringify({ resumen, items })}\n\`\`\``);
}

// ─────────────────────────────────────────────
// parseWeeklyPlanResponse
// ─────────────────────────────────────────────
describe('parseWeeklyPlanResponse', () => {
  it('extracts and validates a well-formed plan', () => {
    const parsed = parseWeeklyPlanResponse(
      `Acá va el plan:\n\`\`\`json\n{"resumen": "Semana rica.", "items": [{"fecha": "2026-07-06", "tipoComida": "almuerzo", "recetaId": 3, "razon": "A los chicos les encanta."}]}\n\`\`\``
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.resumen).toBe('Semana rica.');
    expect(parsed!.items).toEqual([
      { fecha: '2026-07-06', tipoComida: 'almuerzo', recetaId: 3, razon: 'A los chicos les encanta.' },
    ]);
  });

  it('returns null when there is no json block', () => {
    expect(parseWeeklyPlanResponse('No pude armar el plan, perdón.')).toBeNull();
  });

  it('returns null on malformed JSON and does NOT fall back to regex extraction', () => {
    const response = '```json\n{"resumen": "x", "items": [{"recetaId": 5,]}\n```';
    expect(parseWeeklyPlanResponse(response)).toBeNull();
  });

  it('returns null when the shape does not match the schema', () => {
    expect(parseWeeklyPlanResponse('```json\n{"selected": [1, 2, 3]}\n```')).toBeNull();
    expect(
      parseWeeklyPlanResponse('```json\n{"resumen": "x", "items": [{"fecha": "hoy", "tipoComida": "almuerzo", "recetaId": 1}]}\n```')
    ).toBeNull();
    expect(
      parseWeeklyPlanResponse('```json\n{"resumen": "x", "items": [{"fecha": "2026-07-06", "tipoComida": "merienda", "recetaId": 1}]}\n```')
    ).toBeNull();
  });
});

// ─────────────────────────────────────────────
// validatePlanItems
// ─────────────────────────────────────────────
describe('validatePlanItems', () => {
  const slots: WeekSlot[] = [
    { fecha: MONDAY, tipoComida: 'almuerzo' },
    { fecha: MONDAY, tipoComida: 'cena' },
    { fecha: '2026-07-07', tipoComida: 'almuerzo' },
  ];
  const libraryIds = new Set([1, 2, 3, 4]);

  it('accepts a complete valid plan in canonical slot order', () => {
    const result = validatePlanItems(
      [
        { fecha: '2026-07-07', tipoComida: 'almuerzo', recetaId: 3 },
        { fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 1, razon: 'Rápida y rica.' },
        { fecha: MONDAY, tipoComida: 'cena', recetaId: 2 },
      ],
      slots,
      libraryIds
    );
    expect(result.missingSlots).toEqual([]);
    expect(result.items.map((item) => item.recetaId)).toEqual([1, 2, 3]);
    expect(result.items[0].razon).toBe('Rápida y rica.');
  });

  it('drops items for slots that were not requested (extras)', () => {
    const result = validatePlanItems(
      [
        { fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 1 },
        { fecha: MONDAY, tipoComida: 'cena', recetaId: 2 },
        { fecha: '2026-07-07', tipoComida: 'almuerzo', recetaId: 3 },
        { fecha: '2026-07-07', tipoComida: 'cena', recetaId: 4 }, // not requested
        { fecha: '2026-08-01', tipoComida: 'almuerzo', recetaId: 4 }, // outside week
      ],
      slots,
      libraryIds
    );
    expect(result.items).toHaveLength(3);
    expect(result.missingSlots).toEqual([]);
  });

  it('rejects invented recipe ids and reports the slot as missing', () => {
    const result = validatePlanItems(
      [
        { fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 999 },
        { fecha: MONDAY, tipoComida: 'cena', recetaId: 2 },
        { fecha: '2026-07-07', tipoComida: 'almuerzo', recetaId: 3 },
      ],
      slots,
      libraryIds
    );
    expect(result.missingSlots).toEqual([{ fecha: MONDAY, tipoComida: 'almuerzo' }]);
    expect(result.items.map((item) => item.recetaId)).toEqual([2, 3]);
  });

  it('dedupes repeated recipes within the week when the library allows it', () => {
    const result = validatePlanItems(
      [
        { fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 1 },
        { fecha: MONDAY, tipoComida: 'cena', recetaId: 1 }, // repeat — dropped
        { fecha: '2026-07-07', tipoComida: 'almuerzo', recetaId: 2 },
      ],
      slots,
      libraryIds
    );
    expect(result.missingSlots).toEqual([{ fecha: MONDAY, tipoComida: 'cena' }]);
    expect(result.items.map((item) => item.recetaId)).toEqual([1, 2]);
  });

  it('allows repeats when the library is smaller than the requested slots', () => {
    const result = validatePlanItems(
      [
        { fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 1 },
        { fecha: MONDAY, tipoComida: 'cena', recetaId: 1 },
        { fecha: '2026-07-07', tipoComida: 'almuerzo', recetaId: 2 },
      ],
      slots,
      new Set([1, 2]) // 2 recipes, 3 slots
    );
    expect(result.missingSlots).toEqual([]);
    expect(result.items.map((item) => item.recetaId)).toEqual([1, 1, 2]);
  });

  it('keeps only the first fill when the model repeats the same slot', () => {
    const result = validatePlanItems(
      [
        { fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 1 },
        { fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 2 },
      ],
      [{ fecha: MONDAY, tipoComida: 'almuerzo' }],
      libraryIds
    );
    expect(result.items).toEqual([{ fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 1 }]);
  });

  it('truncates over-long razon instead of invalidating the item', () => {
    const result = validatePlanItems(
      [{ fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 1, razon: 'x'.repeat(500) }],
      [{ fecha: MONDAY, tipoComida: 'almuerzo' }],
      libraryIds
    );
    expect(result.items[0].razon).toHaveLength(300);
  });
});

// ─────────────────────────────────────────────
// Slot computation (behavioral spec for the generate route)
// ─────────────────────────────────────────────
describe('slot computation for generation', () => {
  it('replaceWeek targets all 14 slots Monday->Sunday, almuerzo before cena', () => {
    const slots = allWeekSlots(MONDAY);
    expect(slots).toHaveLength(14);
    expect(slots[0]).toEqual({ fecha: MONDAY, tipoComida: 'almuerzo' });
    expect(slots[1]).toEqual({ fecha: MONDAY, tipoComida: 'cena' });
    expect(slots[13]).toEqual({ fecha: '2026-07-12', tipoComida: 'cena' });
  });

  it('fill-empty targets only the slots without a planned meal', () => {
    const occupied = [
      { fecha: MONDAY, tipoComida: 'almuerzo' },
      { fecha: '2026-07-09', tipoComida: 'cena' },
    ];
    const slots = computeEmptySlots(MONDAY, occupied);
    expect(slots).toHaveLength(12);
    expect(slots).not.toContainEqual({ fecha: MONDAY, tipoComida: 'almuerzo' });
    expect(slots).not.toContainEqual({ fecha: '2026-07-09', tipoComida: 'cena' });
  });

  it('a fully planned week leaves zero empty slots (the route then 400s)', () => {
    expect(computeEmptySlots(MONDAY, allWeekSlots(MONDAY))).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// Apply merge semantics (pure behavioral spec for the apply route)
// ─────────────────────────────────────────────
describe('planApplyOperations', () => {
  const items = [
    { fecha: MONDAY, tipoComida: 'almuerzo' as const, recetaId: 1 },
    { fecha: MONDAY, tipoComida: 'cena' as const, recetaId: 2 },
    { fecha: '2026-07-07', tipoComida: 'almuerzo' as const, recetaId: 3 },
  ];

  it('replaceWeek clears the week first and inserts every draft item', () => {
    const result = planApplyOperations(items, [{ fecha: MONDAY, tipoComida: 'almuerzo' }], true);
    expect(result.clearWeekFirst).toBe(true);
    expect(result.toInsert).toEqual(items);
    expect(result.skipped).toBe(0);
  });

  it('fill-empty skips slots that got occupied since generation', () => {
    const occupied = [
      { fecha: MONDAY, tipoComida: 'almuerzo' },
      { fecha: '2026-07-07', tipoComida: 'almuerzo' },
    ];
    const result = planApplyOperations(items, occupied, false);
    expect(result.clearWeekFirst).toBe(false);
    expect(result.toInsert).toEqual([{ fecha: MONDAY, tipoComida: 'cena', recetaId: 2 }]);
    expect(result.skipped).toBe(2);
  });

  it('fill-empty with a still-empty week inserts everything', () => {
    const result = planApplyOperations(items, [], false);
    expect(result.toInsert).toEqual(items);
    expect(result.skipped).toBe(0);
    expect(result.clearWeekFirst).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Context builders
// ─────────────────────────────────────────────
describe('computeRecipeServeStats', () => {
  it('counts serves and keeps the latest fecha per recipe (string compare, no Date)', () => {
    const stats = computeRecipeServeStats([
      { fecha: '2026-06-01', recetaId: 1 },
      { fecha: '2026-06-29', recetaId: 1 },
      { fecha: '2026-06-15', recetaId: 1 },
      { fecha: '2026-06-10', recetaId: 2 },
      { fecha: '2026-06-10', recetaId: null }, // slot without recipe — ignored
    ]);
    expect(stats.get(1)).toEqual({ timesServed: 3, lastServedFecha: '2026-06-29' });
    expect(stats.get(2)).toEqual({ timesServed: 1, lastServedFecha: '2026-06-10' });
    expect(stats.has(3)).toBe(false);
  });
});

describe('buildRecipeLibraryEntries', () => {
  it('merges ratings, history, comments and proposal signals per recipe', () => {
    const entries = buildRecipeLibraryEntries({
      recipes: [
        { id: 1, nombre: 'Milanesas', categoria: 'Plato Principal', calificacionNinos: 5, esFavorita: 1, tiempoPreparacion: 30 },
        { id: 2, nombre: 'Sopa de verduras', categoria: 'Sopa', calificacionNinos: 2, esFavorita: 0, tiempoPreparacion: null },
      ],
      ratings: [
        { recipeId: 1, rating: 5 },
        { recipeId: 1, rating: 4 },
      ],
      history: [
        { fecha: '2026-06-29', recetaId: 1 },
        { fecha: '2026-06-01', recetaId: 1 },
      ],
      comments: [
        { recipeId: 1, comment: '¡Quedaron riquísimas!' },
        { recipeId: null, comment: 'huérfano — ignorado' },
      ],
      proposals: [
        { proposedRecipeId: 2, status: 'accepted', reason: 'Algo más liviano' },
        { proposedRecipeId: 2, status: 'rejected', reason: null },
      ],
    });

    const milanesas = entries.find((entry) => entry.id === 1)!;
    expect(milanesas.avgUserRating).toBe(4.5);
    expect(milanesas.timesServedLast8Weeks).toBe(2);
    expect(milanesas.lastServedFecha).toBe('2026-06-29');
    expect(milanesas.esFavorita).toBe(true);
    expect(milanesas.commentSnippets).toEqual(['¡Quedaron riquísimas!']);

    const sopa = entries.find((entry) => entry.id === 2)!;
    expect(sopa.proposedCount).toBe(2);
    expect(sopa.proposalAcceptedCount).toBe(1);
    expect(sopa.proposalRejectedCount).toBe(1);
    expect(sopa.proposalReasons).toEqual(['Algo más liviano']);
    expect(sopa.avgUserRating).toBeNull();
    expect(sopa.timesServedLast8Weeks).toBe(0);
  });
});

describe('buildRecipeLine', () => {
  it('includes kid rating, family rating, favorite flag and serve recency', () => {
    const line = buildRecipeLine(
      libraryEntry(7, {
        nombre: 'Ñoquis',
        calificacionNinos: 4,
        avgUserRating: 4.5,
        esFavorita: true,
        tiempoPreparacion: 45,
        timesServedLast8Weeks: 2,
        lastServedFecha: '2026-06-29',
      })
    );
    expect(line).toContain('[7] Ñoquis');
    expect(line).toContain('niños:4/5');
    expect(line).toContain('familia:4.5/5');
    expect(line).toContain('⭐favorita');
    expect(line).toContain('45min');
    expect(line).toContain('servida 2x en 8 semanas (última: 2026-06-29)');
  });

  it('surfaces proposal accept/reject signals with their reasons', () => {
    const line = buildRecipeLine(
      libraryEntry(3, {
        proposedCount: 3,
        proposalAcceptedCount: 2,
        proposalRejectedCount: 1,
        proposalReasons: ['Queremos algo liviano'],
      })
    );
    expect(line).toContain('pedida como cambio 3x');
    expect(line).toContain('2 aceptada(s)');
    expect(line).toContain('1 rechazada(s)');
    expect(line).toContain('"Queremos algo liviano"');
  });

  it('marks never-served recipes', () => {
    expect(buildRecipeLine(libraryEntry(1))).toContain('no servida en 8 semanas');
  });
});

describe('buildSlotsSection / dayNameFor', () => {
  it('lists slots with Spanish weekday names', () => {
    expect(dayNameFor(MONDAY)).toBe('lunes');
    expect(dayNameFor('2026-07-12')).toBe('domingo');
    const section = buildSlotsSection([
      { fecha: MONDAY, tipoComida: 'almuerzo' },
      { fecha: '2026-07-08', tipoComida: 'cena' },
    ]);
    expect(section).toContain('- lunes 2026-07-06 — almuerzo');
    expect(section).toContain('- miércoles 2026-07-08 — cena');
  });
});

describe('buildReviewSection', () => {
  it('includes recent verdicts and signoff notes with author and verdict', () => {
    const section = buildReviewSection(
      [
        { weekStartDate: '2026-06-22', status: 'approved' },
        { weekStartDate: '2026-06-29', status: 'changes_requested' },
      ],
      [
        { userName: 'Ana', verdict: 'changes_requested', note: 'Menos frituras por favor' },
        { userName: 'Beto', verdict: 'approved', note: null }, // no note — omitted
      ]
    );
    expect(section).toContain('semana 2026-06-22: approved');
    expect(section).toContain('semana 2026-06-29: changes_requested');
    expect(section).toContain('Ana (changes_requested): "Menos frituras por favor"');
    expect(section).not.toContain('Beto');
  });

  it('returns empty string when there is nothing to report', () => {
    expect(buildReviewSection([], [])).toBe('');
  });
});

describe('buildWeeklyPlanUserMessage', () => {
  it('assembles slots, library, planner profile, instructions and family signals', () => {
    const message = buildWeeklyPlanUserMessage(
      promptInput({
        library: [
          libraryEntry(1, { nombre: 'Milanesas', calificacionNinos: 5, timesServedLast8Weeks: 1, lastServedFecha: '2026-06-30' }),
        ],
        plannerPrompt: 'Somos 4, sin frutos secos.',
        instructions: 'El viernes comemos afuera.',
        recentReviews: [{ weekStartDate: '2026-06-29', status: 'approved' }],
        signoffNotes: [{ userName: 'Ana', verdict: 'approved', note: 'Más pastas' }],
      })
    );

    expect(message).toContain(`SEMANA A PLANIFICAR: lunes ${MONDAY}`);
    expect(message).toContain('PERFIL DE LA FAMILIA (respetalo siempre):\n"Somos 4, sin frutos secos."');
    expect(message).toContain('INSTRUCCIONES PARA ESTA SEMANA (prioridad máxima):\n"El viernes comemos afuera."');
    expect(message).toContain('CASILLEROS A COMPLETAR (2)');
    expect(message).toContain('- lunes 2026-07-06 — almuerzo');
    expect(message).toContain('usá SOLO estos recetaId');
    expect(message).toContain('niños:5/5');
    expect(message).toContain('(última: 2026-06-30)');
    expect(message).toContain('SEÑALES DE LA FAMILIA:');
    expect(message).toContain('Ana (approved): "Más pastas"');
  });

  it('omits profile, instructions and signals sections when absent', () => {
    const message = buildWeeklyPlanUserMessage(promptInput());
    expect(message).not.toContain('PERFIL DE LA FAMILIA');
    expect(message).not.toContain('INSTRUCCIONES PARA ESTA SEMANA');
    expect(message).not.toContain('SEÑALES DE LA FAMILIA');
  });
});

describe('buildRetryMessage', () => {
  it('lists the uncovered slots and demands the full plan again', () => {
    const message = buildRetryMessage([{ fecha: MONDAY, tipoComida: 'cena' }]);
    expect(message).toContain('- lunes 2026-07-06 — cena');
    expect(message).toContain('plan COMPLETO');
  });
});

// ─────────────────────────────────────────────
// generateWeeklyPlan (mocked SDK)
// ─────────────────────────────────────────────
describe('generateWeeklyPlan', () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
  });

  it('throws when ANTHROPIC_API_KEY is not set, without calling the API', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(generateWeeklyPlan(promptInput())).rejects.toThrow(/ANTHROPIC_API_KEY/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns the validated plan on a complete first response', async () => {
    mockCreate.mockResolvedValueOnce(
      planResponse([
        { fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 1, razon: 'Arrancás la semana con un clásico.' },
        { fecha: MONDAY, tipoComida: 'cena', recetaId: 2, razon: 'Liviana para la noche.' },
      ])
    );

    const result = await generateWeeklyPlan(promptInput());

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.model).toBe(WEEKLY_PLAN_MODEL);
    expect(result.resumen).toBe('Semana variada y liviana.');
    expect(result.items).toEqual([
      { fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 1, razon: 'Arrancás la semana con un clásico.' },
      { fecha: MONDAY, tipoComida: 'cena', recetaId: 2, razon: 'Liviana para la noche.' },
    ]);
  });

  it('sends the pinned model, adaptive thinking and the voseo system prompt', async () => {
    mockCreate.mockResolvedValueOnce(
      planResponse([
        { fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 1 },
        { fecha: MONDAY, tipoComida: 'cena', recetaId: 2 },
      ])
    );

    await generateWeeklyPlan(promptInput({ plannerPrompt: 'Sin picante.' }));

    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toBe('claude-opus-4-8');
    expect(call.max_tokens).toBe(16000);
    expect(call.thinking).toEqual({ type: 'adaptive' });
    expect(call.temperature).toBeUndefined(); // removed on this model family
    expect(call.system).toBe(WEEKLY_PLAN_SYSTEM_PROMPT);
    expect(call.system).toContain('español rioplatense');
    expect(call.system).toContain('NUNCA inventes ids');
    expect(call.messages[0].role).toBe('user');
    expect(call.messages[0].content).toContain('Sin picante.');
  });

  it('retries once with a corrective message when slots are missing, then succeeds', async () => {
    mockCreate
      .mockResolvedValueOnce(
        planResponse([{ fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 1 }]) // cena missing
      )
      .mockResolvedValueOnce(
        planResponse([
          { fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 1 },
          { fecha: MONDAY, tipoComida: 'cena', recetaId: 3 },
        ])
      );

    const result = await generateWeeklyPlan(promptInput());

    expect(mockCreate).toHaveBeenCalledTimes(2);
    const retryMessages = mockCreate.mock.calls[1][0].messages;
    expect(retryMessages).toHaveLength(3); // user, assistant, corrective user
    expect(retryMessages[1].role).toBe('assistant');
    expect(retryMessages[2].role).toBe('user');
    expect(retryMessages[2].content).toContain('sin cubrir');
    expect(retryMessages[2].content).toContain('- lunes 2026-07-06 — cena');
    expect(result.items).toHaveLength(2);
  });

  it('rejects invented recipe ids, retries, and throws GENERATION_INCOMPLETE if still unusable', async () => {
    mockCreate
      .mockResolvedValueOnce(
        planResponse([
          { fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 999 }, // invented
          { fecha: MONDAY, tipoComida: 'cena', recetaId: 2 },
        ])
      )
      .mockResolvedValueOnce(
        planResponse([
          { fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 888 }, // invented again
          { fecha: MONDAY, tipoComida: 'cena', recetaId: 2 },
        ])
      );

    await expect(generateWeeklyPlan(promptInput())).rejects.toThrow('GENERATION_INCOMPLETE');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('throws GENERATION_INCOMPLETE when both responses are unparseable', async () => {
    mockCreate
      .mockResolvedValueOnce(textResponse('No hay JSON acá.'))
      .mockResolvedValueOnce(textResponse('Tampoco acá.'));

    await expect(generateWeeklyPlan(promptInput())).rejects.toThrow('GENERATION_INCOMPLETE');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('drops extra slots the model added beyond the requested ones', async () => {
    mockCreate.mockResolvedValueOnce(
      planResponse([
        { fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 1 },
        { fecha: MONDAY, tipoComida: 'cena', recetaId: 2 },
        { fecha: '2026-07-10', tipoComida: 'cena', recetaId: 3 }, // not requested
      ])
    );

    const result = await generateWeeklyPlan(promptInput());

    expect(mockCreate).toHaveBeenCalledTimes(1); // extras alone don't trigger a retry
    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.fecha === MONDAY)).toBe(true);
  });

  it('dedupes a repeated recipe and recovers it via the retry', async () => {
    mockCreate
      .mockResolvedValueOnce(
        planResponse([
          { fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 1 },
          { fecha: MONDAY, tipoComida: 'cena', recetaId: 1 }, // repeat within the week
        ])
      )
      .mockResolvedValueOnce(
        planResponse([
          { fecha: MONDAY, tipoComida: 'almuerzo', recetaId: 1 },
          { fecha: MONDAY, tipoComida: 'cena', recetaId: 2 },
        ])
      );

    const result = await generateWeeklyPlan(promptInput());

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.items.map((item) => item.recetaId)).toEqual([1, 2]);
  });
});

// ─────────────────────────────────────────────
// Request schema (route contract)
// ─────────────────────────────────────────────
describe('generateWeeklyPlanRequestSchema', () => {
  it('accepts a Monday and defaults replaceWeek to false', () => {
    const parsed = generateWeeklyPlanRequestSchema.parse({ weekStartDate: MONDAY });
    expect(parsed.weekStartDate).toBe(MONDAY);
    expect(parsed.replaceWeek).toBe(false);
    expect(parsed.instructions).toBeUndefined();
  });

  it('rejects a non-Monday date with the Spanish message', () => {
    const result = generateWeeklyPlanRequestSchema.safeParse({ weekStartDate: '2026-07-07' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('La fecha debe ser un lunes');
    }
  });

  it('rejects malformed dates and over-long instructions', () => {
    expect(generateWeeklyPlanRequestSchema.safeParse({ weekStartDate: '06/07/2026' }).success).toBe(false);
    expect(
      generateWeeklyPlanRequestSchema.safeParse({ weekStartDate: MONDAY, instructions: 'x'.repeat(2001) }).success
    ).toBe(false);
  });

  it('accepts explicit replaceWeek and instructions', () => {
    const parsed = generateWeeklyPlanRequestSchema.parse({
      weekStartDate: MONDAY,
      replaceWeek: true,
      instructions: 'Sin pescado esta semana.',
    });
    expect(parsed.replaceWeek).toBe(true);
    expect(parsed.instructions).toBe('Sin pescado esta semana.');
  });
});
