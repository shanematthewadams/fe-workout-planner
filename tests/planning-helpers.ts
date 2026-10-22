import { fireEvent, screen } from "@testing-library/react";
/** Existing detailed workflow tests enter the explicit idea path first. */
export function startPlanning() {
  const idea = screen.queryByRole("button", {
    name: "I have an idea",
  });
  if (idea) fireEvent.click(idea);
}
export function openCreativeHelp() {
  const summary = screen.getByText("Help me change this", {
    selector: "summary",
  });
  if (!summary.parentElement?.hasAttribute("open")) fireEvent.click(summary);
}
