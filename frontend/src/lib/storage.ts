const isBrowser = typeof window !== 'undefined'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const noopStorage: StorageLike = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

const localStorageRef: StorageLike = isBrowser ? window.localStorage : noopStorage

export function getItem(key: string) {
  try {
    return localStorageRef.getItem(key)
  } catch {
    return null
  }
}

export function setItem(key: string, value: string) {
  try {
    localStorageRef.setItem(key, value)
  } catch {
    // Swallow quota errors (e.g., private mode)
  }
}

export function removeItem(key: string) {
  try {
    localStorageRef.removeItem(key)
  } catch {
    // noop
  }
}
