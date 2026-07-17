export type VerifyDistOptions = {
  rootDir?: string
}

export type VerifyDistResult = {
  files: string[]
}

export function verifyDist(
  options?: VerifyDistOptions,
): Promise<VerifyDistResult>
