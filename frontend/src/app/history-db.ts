export type CharacterDetection = {
  label: string;
  character: string;
  confidence: number;
  x: number;
  y: number;
  row: string;
};

export type DetectedPlate = {
  plate_confidence: number;
  plate_bbox: number[];
  recognized_text: string;
  top_line: string;
  bottom_line: string;
  character_detections: CharacterDetection[];
};

export type ApiResult = {
  status: string;
  filename: string;
  file_size: number;
  model_loaded: boolean;
  message: string;
  detected_plates: DetectedPlate[];
};

export type HistoryRecord = {
  id: string;
  createdAt: string;
  image: Blob;
  filename: string;
  result: ApiResult;
};

const DATABASE = "bd-platevision-history";
const STORE = "detections";
const VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not support IndexedDB."));
      return;
    }
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Cannot open history database."));
    request.onblocked = () => reject(new Error("History database is blocked by another tab."));
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error("History operation failed.")); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error("History operation aborted.")); };
  });
}

export async function saveHistory(image: File, result: ApiResult): Promise<void> {
  const record: HistoryRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    image,
    filename: image.name,
    result,
  };
  await transact<IDBValidKey>("readwrite", (store) => store.put(record));
}

export async function getHistory(): Promise<HistoryRecord[]> {
  const items = await transact<HistoryRecord[]>("readonly", (store) => store.getAll());
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteHistory(id: string): Promise<void> {
  await transact<undefined>("readwrite", (store) => store.delete(id));
}
