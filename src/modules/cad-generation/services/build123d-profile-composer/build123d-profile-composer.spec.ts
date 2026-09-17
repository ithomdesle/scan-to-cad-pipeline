import { describe, expect, it } from "vitest";
import type { PartProfile } from "../../../image-profile/index.js";
import { composeProfileScript } from "./build123d-profile-composer.js";

const createProfile = (): PartProfile =>
  Object.freeze({
    outline: Object.freeze([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 20 },
      { x: 0, y: 20 },
    ]),
    cutouts: Object.freeze([
      Object.freeze([
        { x: 10, y: 5 },
        { x: 20, y: 5 },
        { x: 20, y: 15 },
        { x: 10, y: 15 },
      ]),
    ]),
    widthInMillimetres: 40,
    heightInMillimetres: 20,
    thicknessInMillimetres: 3,
    pixelsPerMillimetre: 10,
  });

describe("composeProfileScript", () => {
  it("extrudes the outline to the measured thickness", () => {
    // Arrange
    const profile = createProfile();

    // Act
    const source = composeProfileScript(profile);

    // Assert
    expect(source).toContain("amount=3.000");
    expect(source).toContain("part = extrude(make_face(Polyline(*outline, close=True))");
  });

  it("subtracts every cutout", () => {
    // Arrange
    const profile = createProfile();

    // Act
    const source = composeProfileScript(profile);

    // Assert
    expect(source).toContain("cutout_1 = [(10.000, 5.000)");
    expect(source).toContain("part = part - extrude(make_face(Polyline(*cutout_1, close=True))");
  });

  it("records the measured size as a comment", () => {
    // Arrange
    const profile = createProfile();

    // Act
    const source = composeProfileScript(profile);

    // Assert
    expect(source).toContain("# plate 40.00 x 20.00 x 3.00 mm");
  });
});
