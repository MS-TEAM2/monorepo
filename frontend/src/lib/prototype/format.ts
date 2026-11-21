/** "방금", "5분 전", "3시간 전", "2일 전" */
export function timeAgo(minutes: number): string {
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${Math.floor(minutes)}분 전`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`;
  return `${Math.floor(minutes / 60 / 24)}일 전`;
}

export function percent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
