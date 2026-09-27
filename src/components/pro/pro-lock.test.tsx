import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ProLock } from "./pro-lock";
it("왼쪽 정렬 안내와 가격 링크를 표시한다", () => { render(<ProLock />); expect(screen.getByText("Pro에서 전체 목록을 볼 수 있어요")).toBeInTheDocument(); expect(screen.getByRole("link", { name: "Pro 시작하기" })).toHaveAttribute("href", "/pricing"); });
