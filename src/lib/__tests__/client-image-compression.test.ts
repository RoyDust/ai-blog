import { beforeEach, describe, expect, test, vi } from "vitest";

type MockCompressorOptions = {
  maxHeight?: number;
  maxWidth?: number;
  mimeType?: string;
  quality?: number;
  success?: (file: File | Blob) => void;
  error?: (error: Error) => void;
};

const compressorMock = vi.hoisted(() => vi.fn());

vi.mock("compressorjs", () => ({
  default: compressorMock,
}));

import { compressImageForUpload } from "../client-image-compression";

function createFile(size: number, name: string, type: string) {
  return new File([new Uint8Array(size)], name, { type, lastModified: 123 });
}

beforeEach(() => {
  compressorMock.mockReset();
});

describe("compressImageForUpload", () => {
  test("compresses markdown images with the markdown profile", async () => {
    const original = createFile(10, "demo.jpg", "image/jpeg");
    const output = new Blob([new Uint8Array(3)], { type: "image/jpeg" });

    compressorMock.mockImplementation((_file: File, options: MockCompressorOptions) => {
      options.success?.(output);
      return { abort: vi.fn() };
    });

    const result = await compressImageForUpload(original, "markdown");

    expect(result.compressed).toBe(true);
    expect(result.file.name).toBe("demo.jpg");
    expect(result.file.type).toBe("image/jpeg");
    expect(result.outputSize).toBe(3);
    expect(compressorMock).toHaveBeenCalledWith(
      original,
      expect.objectContaining({
        convertSize: 1_000_000,
        convertTypes: ["image/png"],
        maxHeight: 1920,
        maxWidth: 1920,
        mimeType: "image/jpeg",
        quality: 0.82,
      }),
    );
  });

  test("tries the lower quality pass when a jpeg remains above the target size", async () => {
    const original = createFile(2_000_000, "cover.jpg", "image/jpeg");

    compressorMock.mockImplementation((_file: File, options: MockCompressorOptions) => {
      const size = options.quality === 0.84 ? 1_700_000 : 900_000;
      options.success?.(new Blob([new Uint8Array(size)], { type: "image/jpeg" }));
      return { abort: vi.fn() };
    });

    const result = await compressImageForUpload(original, "cover");

    expect(result.compressed).toBe(true);
    expect(result.outputSize).toBe(900_000);
    expect(compressorMock).toHaveBeenCalledTimes(2);
    expect(compressorMock.mock.calls.map((call) => call[1].quality)).toEqual([0.84, 0.72]);
  });

  test("renames converted image files to match the output mime type", async () => {
    const original = createFile(10, "screenshot.png", "image/png");

    compressorMock.mockImplementation((_file: File, options: MockCompressorOptions) => {
      options.success?.(new Blob([new Uint8Array(3)], { type: "image/jpeg" }));
      return { abort: vi.fn() };
    });

    const result = await compressImageForUpload(original, "markdown");

    expect(result.compressed).toBe(true);
    expect(result.file.name).toBe("screenshot.jpg");
    expect(result.file.type).toBe("image/jpeg");
  });

  test("keeps the original file when compression is not smaller", async () => {
    const original = createFile(4, "tiny.webp", "image/webp");

    compressorMock.mockImplementation((_file: File, options: MockCompressorOptions) => {
      options.success?.(new Blob([new Uint8Array(8)], { type: "image/webp" }));
      return { abort: vi.fn() };
    });

    const result = await compressImageForUpload(original, "markdown");

    expect(result.compressed).toBe(false);
    expect(result.file).toBe(original);
    expect(result.skippedReason).toBe("not-smaller");
  });

  test("skips unsupported image formats", async () => {
    const original = createFile(100, "motion.gif", "image/gif");

    const result = await compressImageForUpload(original, "markdown");

    expect(result.compressed).toBe(false);
    expect(result.file).toBe(original);
    expect(result.skippedReason).toBe("unsupported-type");
    expect(compressorMock).not.toHaveBeenCalled();
  });

  test("falls back to the original file when browser compression fails", async () => {
    const original = createFile(100, "broken.jpg", "image/jpeg");

    compressorMock.mockImplementation((_file: File, options: MockCompressorOptions) => {
      options.error?.(new Error("decode failed"));
      return { abort: vi.fn() };
    });

    const result = await compressImageForUpload(original, "cover");

    expect(result.compressed).toBe(false);
    expect(result.file).toBe(original);
    expect(result.skippedReason).toBe("compression-failed");
  });
});
