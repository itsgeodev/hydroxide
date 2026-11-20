import { IMAGE_MIME_TYPES, imageIds } from '../../shared/image-requests.js';

export function validateImageFile(input) {
  if (!input || typeof input.id !== 'string' || !input.id || typeof input.dataUrl !== 'string')
    throw new Error('A generated image file is invalid.');
  if (input.dataUrl.length > 30 * 1024 * 1024)
    throw new Error('A generated image exceeds the 20 MB file limit.');
  const match = /^data:(image\/(?:png|jpeg|webp|gif|avif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    input.dataUrl,
  );
  if (!match || !IMAGE_MIME_TYPES.includes(match[1]))
    throw new Error('Generated images must be raster image files with base64 data.');
  const decodedBytes =
    Math.floor((match[2].length * 3) / 4) -
    (match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0);
  if (decodedBytes > 20 * 1024 * 1024)
    throw new Error('A generated image exceeds the 20 MB file limit.');
  let prefix;
  try {
    prefix = atob(match[2].slice(0, 64));
  } catch {
    throw new Error('The image file contains invalid base64 data.');
  }
  const starts = (signature) => signature.every((byte, index) => prefix.charCodeAt(index) === byte);
  const detected = starts([137, 80, 78, 71, 13, 10, 26, 10])
    ? 'image/png'
    : starts([255, 216, 255])
      ? 'image/jpeg'
      : prefix.startsWith('RIFF') && prefix.slice(8, 12) === 'WEBP'
        ? 'image/webp'
        : /^GIF8[79]a/.test(prefix)
          ? 'image/gif'
          : prefix.slice(4, 8) === 'ftyp' && /avif|avis/.test(prefix.slice(8, 32))
            ? 'image/avif'
            : '';
  if (detected !== match[1])
    throw new Error('The generated image data does not match its raster file type.');
  return { id: input.id, dataUrl: input.dataUrl, mimeType: match[1] };
}

export function validateImageBackup(raw, chats) {
  const needed = new Set(imageIds(chats));
  if (raw == null && !needed.size) return [];
  if (!Array.isArray(raw)) throw new Error('This backup is missing its generated image files.');
  const ids = new Set();
  const files = raw.map((entry) => {
    const image = validateImageFile(entry);
    if (ids.has(image.id)) throw new Error('The backup contains duplicate image files.');
    ids.add(image.id);
    return image;
  });
  if ([...needed].some((id) => !ids.has(id)))
    throw new Error('This backup is missing a generated image.');
  return files.filter((file) => needed.has(file.id));
}

export function createMediaStore({
  indexedDBFactory = globalThis.indexedDB,
  databaseName = 'hydroxide.media.v1',
} = {}) {
  let connection;
  const temporary = new Map();
  function database() {
    if (!indexedDBFactory)
      return Promise.reject(new Error('Image storage is unavailable in this browser.'));
    if (!connection) {
      connection = new Promise((resolve, reject) => {
        const request = indexedDBFactory.open(databaseName, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore('images', { keyPath: 'id' });
        request.onerror = () => reject(new Error('Could not open local image storage.'));
        request.onblocked = () =>
          reject(new Error('Close other Hydroxide tabs and try opening image storage again.'));
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            connection = undefined;
          };
          resolve(db);
        };
      }).catch((error) => {
        connection = undefined;
        throw error;
      });
    }
    return connection;
  }
  async function getImage(id) {
    if (temporary.has(id)) return temporary.get(id);
    const db = await database();
    return new Promise((resolve, reject) => {
      const request = db.transaction('images').objectStore('images').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Could not read this saved image.'));
    });
  }
  async function putImages(entries) {
    if (!entries.length) return;
    const files = entries.map(validateImageFile);
    const db = await database();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite');
      transaction.oncomplete = resolve;
      transaction.onerror = transaction.onabort = () =>
        reject(
          new Error('Could not save the images on this device. Check available browser storage.'),
        );
      for (const file of files) transaction.objectStore('images').put(file);
    });
  }
  async function saveImages(images) {
    const files = images.map((image) => ({ ...image, id: crypto.randomUUID() }));
    const validated = files.map(validateImageFile);
    let storageWarning;
    try {
      await putImages(validated);
    } catch {
      for (const file of validated) temporary.set(file.id, file);
      storageWarning =
        'Your image is ready, but local image storage is unavailable. Download it or export a backup before leaving this page.';
    }
    const metadata = files.map((image, index) => ({
      id: image.id,
      mimeType: validated[index].mimeType,
      revisedPrompt: image.revisedPrompt || '',
      model: image.model || '',
      prompt: image.prompt || '',
      aspectRatio: image.aspectRatio || '1:1',
    }));
    if (storageWarning) metadata.storageWarning = storageWarning;
    return metadata;
  }
  async function exportImages(chats) {
    return Promise.all(
      imageIds(chats).map(async (id) => {
        const image = await getImage(id);
        if (!image)
          throw new Error(
            'A saved image is missing. Restore its backup before exporting everything.',
          );
        return image;
      }),
    );
  }
  async function deleteImages(ids) {
    if (!ids.length) return;
    for (const id of ids) temporary.delete(id);
    const db = await database();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite');
      transaction.oncomplete = resolve;
      transaction.onerror = transaction.onabort = () =>
        reject(new Error('Could not remove a saved image.'));
      for (const id of ids) transaction.objectStore('images').delete(id);
    });
  }
  return {
    getImage,
    putImages,
    saveImages,
    exportImages,
    deleteImages,
    async close() {
      if (connection) (await connection).close();
      connection = undefined;
    },
  };
}

const store = createMediaStore();
export const getImage = (id) => store.getImage(id);
export const putImages = (images) => store.putImages(images);
export const saveImages = (images) => store.saveImages(images);
export const exportImages = (chats) => store.exportImages(chats);
export const deleteImages = (ids) => store.deleteImages(ids);
export async function downloadImage(id, filename = 'hydroxide-image.png', readImage = getImage) {
  const image = await readImage(id);
  if (!image) throw new Error('This image is no longer stored on this device.');
  const blob = await fetch(image.dataUrl).then((response) => response.blob());
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
