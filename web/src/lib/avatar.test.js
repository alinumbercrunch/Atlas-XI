import { playerImage, initials } from "./avatar.js";

describe("avatar helpers", () => {
  it("initials takes the first two name parts, uppercased", () => {
    expect(initials("Yassir Zabiri")).toBe("YZ");
    expect(initials("Bilal Nadir")).toBe("BN");
    expect(initials("Ronaldinho")).toBe("R");
    expect(initials("")).toBe("");
  });

  it("playerImage returns null for missing ids/files", () => {
    expect(playerImage(null)).toBeNull();
    expect(playerImage(0)).toBeNull();
    expect(playerImage(99999999)).toBeNull(); // no downloaded file for this id
  });
});
