import { describe, expect, test } from "vitest";
import { calculateOffsetBounds, calculateSquareCrop } from "../image-crop-upload-dialog";

describe("calculateSquareCrop", () => {
  test("centers a landscape image inside a square crop", () => {
    expect(
      calculateSquareCrop({
        naturalWidth: 1200,
        naturalHeight: 800,
        viewportSize: 288,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      }),
    ).toEqual({
      sx: 200,
      sy: 0,
      size: 800,
    });
  });

  test("keeps offsets inside the source image bounds", () => {
    expect(
      calculateSquareCrop({
        naturalWidth: 600,
        naturalHeight: 600,
        viewportSize: 288,
        zoom: 2,
        offsetX: 240,
        offsetY: -240,
      }),
    ).toEqual({
      sx: 0,
      sy: 300,
      size: 300,
    });
  });

  test("calculates draggable bounds from rendered image coverage", () => {
    expect(
      calculateOffsetBounds({
        naturalWidth: 1200,
        naturalHeight: 800,
        viewportSize: 288,
        zoom: 1,
      }),
    ).toEqual({
      maxX: 72,
      maxY: 0,
    });

    expect(
      calculateOffsetBounds({
        naturalWidth: 600,
        naturalHeight: 600,
        viewportSize: 288,
        zoom: 2,
      }),
    ).toEqual({
      maxX: 144,
      maxY: 144,
    });
  });

  test("adds movement room around the visible avatar frame", () => {
    expect(
      calculateOffsetBounds({
        frameSize: 240,
        naturalWidth: 600,
        naturalHeight: 600,
        viewportSize: 288,
        zoom: 1,
      }),
    ).toEqual({
      maxX: 24,
      maxY: 24,
    });

    const crop = calculateSquareCrop({
      frameSize: 240,
      naturalWidth: 1200,
      naturalHeight: 800,
      viewportSize: 288,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });

    expect(crop.sx).toBeCloseTo(266.67, 2);
    expect(crop.sy).toBeCloseTo(66.67, 2);
    expect(crop.size).toBeCloseTo(666.67, 2);
  });
});
