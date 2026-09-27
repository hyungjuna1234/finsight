import { render, screen } from "@testing-library/react"; import { describe, expect, it } from "vitest"; import { AiDisclaimer } from "./ai-disclaimer";
describe("AiDisclaimer", () => { it("shows the safety notice", () => { render(<AiDisclaimer />); expect(screen.getByText(/투자·세무 조언이 아니에요/)).toBeInTheDocument(); }); });
