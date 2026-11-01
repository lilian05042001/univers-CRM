/** Hash scurt, nesecurizat (djb2), pentru chei React derivate din date. */
export function hashKey(value: string): string {
  let hash = 5381
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0
  return (hash >>> 0).toString(36)
}
