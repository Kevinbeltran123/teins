import { describe, expect, it } from "vitest";
import { horaSinPartir } from "./formato";

describe("horaSinPartir", () => {
  it("une la hora con su a. m. o p. m. con espacios duros, y deja el resto del texto igual", () => {
    expect(horaSinPartir("Hoy · desde 2:00 p. m.")).toBe("Hoy · desde 2:00 p. m.");
    expect(horaSinPartir("9:00 a. m. a 11:30 a. m.")).toBe("9:00 a. m. a 11:30 a. m.");
    expect(horaSinPartir("Mañana")).toBe("Mañana");
  });
});
