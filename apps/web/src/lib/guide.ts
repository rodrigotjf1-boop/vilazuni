import {ApiError, getFile, post} from './api';

export const photoSlots = [1, 2, 3] as const;
export type PhotoSlot = (typeof photoSlots)[number];

export const guideFields = {
  title: 100,
  description: 3000,
  directions: 2000,
  transport: 1200,
  tips: 2000,
} as const;

export type GuideFields = Record<keyof typeof guideFields, string>;
export type Attraction = GuideFields & {id: string; version: number; photoSlots: PhotoSlot[]};
export type GuideList = {attractions: Attraction[]};
export type UnitGuide = GuideList & {unitLabel: string; canEdit: boolean};
export type PhotoChanges = Partial<Record<PhotoSlot, File | null>>;

export const guidePath = (unitId: string) => `/units/${unitId}/guide`;
const guestGuidePath = '/stays/guest/guide';
export const guidePhotoPath = (id: string, slot: PhotoSlot) => `/${id}/photos/${slot}`;

export function saveAttraction(
  unitId: string,
  text: GuideFields,
  photos: PhotoChanges,
  current?: Attraction,
) {
  const body = new FormData();
  body.set(
    'data',
    JSON.stringify(
      current
        ? {
            ...text,
            version: current.version,
            removePhotos: photoSlots.filter((slot) => photos[slot] === null),
          }
        : text,
    ),
  );
  for (const slot of photoSlots) {
    const photo = photos[slot];
    if (photo) body.set(`photo${slot}`, photo);
  }
  return post<{id: string}>(current ? `${guidePath(unitId)}/${current.id}` : guidePath(unitId), body);
}

async function guestRequest(token: string, path: string) {
  const response = await fetch(`/api/v1${guestGuidePath}${path}`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    cache: 'no-store',
    body: JSON.stringify({token}),
  });
  if (!response.ok) throw new ApiError(response.status, 'estadia_indisponivel', '');
  return response;
}

export async function guestGuide(token: string): Promise<GuideList> {
  return (await guestRequest(token, '')).json();
}

export type LoadPhoto = (attractionId: string, slot: PhotoSlot) => Promise<Blob>;
export type PhotoSource = {key: string; load: LoadPhoto};
export const loadUnitPhoto = (unitId: string, id: string, slot: PhotoSlot) =>
  getFile(`${guidePath(unitId)}${guidePhotoPath(id, slot)}`);
export const loadGuestPhoto = async (token: string, id: string, slot: PhotoSlot) =>
  (await guestRequest(token, guidePhotoPath(id, slot))).blob();

export const photoFormats = 'image/jpeg,image/png,image/webp';
const maxPhotoBytes = 2 * 1024 * 1024;
const maxInputBytes = 32 * 1024 * 1024;
const maxPhotoSide = 1600;

export async function prepareGuidePhoto(file: File) {
  if (!photoFormats.split(',').includes(file.type) || file.size > maxInputBytes)
    throw new Error('guia_foto_invalida');
  const image = await createImageBitmap(file);
  try {
    if (Math.max(image.width, image.height) <= maxPhotoSide && file.size <= maxPhotoBytes) return file;
    const scale = Math.min(1, maxPhotoSide / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('guia_foto_invalida');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84));
    if (!blob || blob.size > maxPhotoBytes) throw new Error('guia_foto_invalida');
    return new File([blob], 'foto-da-atracao', {type: blob.type});
  } finally {
    image.close();
  }
}
