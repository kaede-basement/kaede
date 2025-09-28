export class ChecksumError extends Error {
  declare readonly path    : string;
  declare readonly expected: string;
  declare readonly actual  : string;

  constructor(path: string, expected: string, actual: string) {
    super(`Checksum mismatch for ${path}, expected ${expected}, got ${actual}`);
    this.path = path;
    this.expected = expected;
    this.actual = actual;
  }
}

export class SizeError extends Error {
  declare readonly path    : string;
  declare readonly expected: string;
  declare readonly actual  : string;

  constructor(path: string, expected: string, actual: string) {
    super(`Size mismatch for ${path}, expected ${expected}, got ${actual}`);
    this.path = path;
    this.expected = expected;
    this.actual = actual;
  }
}
