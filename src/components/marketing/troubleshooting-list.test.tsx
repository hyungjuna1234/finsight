import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TroubleItem } from "@/lib/domain/guides";
import { TroubleshootingList } from "./troubleshooting-list";

const items: readonly TroubleItem[] = [
  {
    code: "ENCRYPTED_FILE",
    title: "암호가 걸린 파일이에요",
    fix: "암호 없이 저장한 뒤 올려요.",
  },
];

describe("TroubleshootingList", () => {
  it("오류 앵커가 있는 제목과 해결 방법을 표시한다", () => {
    render(<TroubleshootingList items={items} />);
    expect(screen.getByText("암호가 걸린 파일이에요")).toHaveAttribute(
      "id",
      "trouble-encrypted-file",
    );
    expect(screen.getByText("암호 없이 저장한 뒤 올려요.")).toBeInTheDocument();
  });
});
