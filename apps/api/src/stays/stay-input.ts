import {assertValidPeriod} from '@vilazuni/domain';
import {z} from 'zod';
import {badRequest} from '../http/errors.js';

const member = z
  .object({
    name: z.string().trim().min(2).max(120),
    band: z.enum(['adult', 'teen', 'child']),
    contact: z.string().trim().min(5).max(160).optional(),
  })
  .strict();

export const plateSchema = z
  .string()
  .trim()
  .max(12)
  .transform((plate) => plate.toUpperCase().replace(/[ -]/g, ''))
  .pipe(z.string().regex(/^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/));

const period = {
  checkInAt: z.iso.datetime({offset: true}).transform((s) => new Date(s)),
  checkOutAt: z.iso.datetime({offset: true}).transform((s) => new Date(s)),
};

export const createStaySchema = z
  .object({
    unitId: z.uuid(),
    requestId: z.uuid(),
    ...period,
    members: z.array(member).min(1).max(30),
    plates: z
      .array(plateSchema)
      .max(10)
      .default([])
      .transform((plates) => [...new Set(plates)]),
    exceptionReason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export const editPeriodSchema = z.object({...period, version: z.number().int().positive()}).strict();

export function checkStayPeople(input: z.infer<typeof createStaySchema>) {
  assertValidPeriod(input);
  const responsible = input.members.filter((m) => m.contact);
  if (
    !input.members[0]?.contact ||
    responsible.length > 2 ||
    responsible.some((m) => m.band !== 'adult') ||
    new Set(responsible.map((m) => m.name.toLocaleLowerCase('pt-BR'))).size !== responsible.length
  ) {
    throw badRequest(
      'responsaveis_invalidos',
      'Informe um responsável adulto principal e, se houver, um segundo adulto distinto.',
    );
  }
  if (responsible.length === 1 && !input.exceptionReason) {
    throw badRequest('justificativa_responsavel', 'Justifique a estadia com apenas um adulto responsável.');
  }
}

export function stayCounts(members: ReadonlyArray<{band: 'adult' | 'teen' | 'child'}>) {
  const counts = {adult: 0, teen: 0, child: 0};
  for (const guest of members) counts[guest.band] += 1;
  return counts;
}
