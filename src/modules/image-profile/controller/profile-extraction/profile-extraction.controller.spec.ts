import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { getPolygonArea } from "../../services/contour-tracer/contour-tracer.js";
import {
  createProfileExtractionController,
  DEFAULT_PROFILE_EXTRACTION_OPTIONS,
} from "./profile-extraction.controller.js";

const IMAGE_WIDTH = 800;
const IMAGE_HEIGHT = 600;

// A light plate on a dark background with two dark slots, mirroring a part photographed on a bench.
const createSyntheticPartImage = async (): Promise<Buffer> => {
  const pixels = new Uint8Array(IMAGE_WIDTH * IMAGE_HEIGHT).fill(30);

  const drawRectangle = (
    left: number,
    top: number,
    right: number,
    bottom: number,
    value: number,
  ) => {
    for (let row = top; row < bottom; row += 1) {
      for (let column = left; column < right; column += 1) {
        pixels[row * IMAGE_WIDTH + column] = value;
      }
    }
  };

  drawRectangle(100, 100, 700, 400, 220);
  drawRectangle(200, 180, 300, 260, 30);
  drawRectangle(450, 180, 550, 260, 30);

  return sharp(Buffer.from(pixels), {
    raw: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT, channels: 1 },
  })
    .png()
    .toBuffer();
};

const controller = createProfileExtractionController();

describe("createProfileExtractionController", () => {
  it("scales the outline to the declared longest edge", async () => {
    // Arrange
    const imageBuffer = await createSyntheticPartImage();

    // Act
    const profile = await controller.extract(imageBuffer, {
      ...DEFAULT_PROFILE_EXTRACTION_OPTIONS,
      knownLongestEdgeInMillimetres: 120,
      thicknessInMillimetres: 3,
    });

    // Assert
    expect(profile.widthInMillimetres).toBeCloseTo(120, 0);
    expect(profile.heightInMillimetres).toBeCloseTo(60, 0);
  });

  it("finds both interior cutouts", async () => {
    // Arrange
    const imageBuffer = await createSyntheticPartImage();

    // Act
    const profile = await controller.extract(imageBuffer, {
      ...DEFAULT_PROFILE_EXTRACTION_OPTIONS,
      knownLongestEdgeInMillimetres: 120,
    });

    // Assert
    expect(profile.cutouts).toHaveLength(2);
  });

  it("measures a cutout at its true size", async () => {
    // Arrange
    const imageBuffer = await createSyntheticPartImage();

    // Act
    const profile = await controller.extract(imageBuffer, {
      ...DEFAULT_PROFILE_EXTRACTION_OPTIONS,
      knownLongestEdgeInMillimetres: 120,
    });

    // Assert
    const cutoutArea = getPolygonArea(profile.cutouts[0]);
    expect(cutoutArea).toBeCloseTo(20 * 16, -1);
  });

  it("simplifies the outline to four corners", async () => {
    // Arrange
    const imageBuffer = await createSyntheticPartImage();

    // Act
    const profile = await controller.extract(imageBuffer, {
      ...DEFAULT_PROFILE_EXTRACTION_OPTIONS,
      knownLongestEdgeInMillimetres: 120,
    });

    // Assert
    expect(profile.outline.length).toBeLessThanOrEqual(6);
    expect(profile.outline.length).toBeGreaterThanOrEqual(4);
  });

  it("refuses an image with no distinguishable part", async () => {
    // Arrange
    const blankImage = await sharp(Buffer.from(new Uint8Array(100 * 100).fill(128)), {
      raw: { width: 100, height: 100, channels: 1 },
    })
      .png()
      .toBuffer();

    // Act
    const act = () => controller.extract(blankImage, DEFAULT_PROFILE_EXTRACTION_OPTIONS);

    // Assert
    await expect(act()).rejects.toThrow();
  });
});
