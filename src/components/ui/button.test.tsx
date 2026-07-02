import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
  it("renders its label", () => {
    render(<Button>Открыть рейтинг</Button>);
    expect(
      screen.getByRole("button", { name: "Открыть рейтинг" }),
    ).toBeInTheDocument();
  });

  it("applies variant classes", () => {
    render(<Button variant="outline">Игроки</Button>);
    expect(screen.getByRole("button", { name: "Игроки" })).toHaveClass("border");
  });
});
