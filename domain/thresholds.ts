export const THRESHOLD = 4

export function shouldFireProvisional(args: {
  availableCount: number
  sessionExists: boolean
  alreadyNotified: boolean
}): boolean {
  return args.availableCount >= THRESHOLD && !args.sessionExists && !args.alreadyNotified
}

export function shouldCreateSession(args: {
  commitCount: number
  sessionExists: boolean
}): boolean {
  return args.commitCount >= THRESHOLD && !args.sessionExists
}
