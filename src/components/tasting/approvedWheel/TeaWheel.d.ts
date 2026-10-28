export interface WheelNote { name: string; group: string; taste: boolean; aroma: boolean }
export const families: { name: string; description: string; notes: string[] }[];
export interface WheelHandle {
  updateNotes(notes: WheelNote[]): void;
  navigate(name: string | number | null): void;
  locate(name: string, sense: 'taste' | 'aroma'): void;
  destroy(): void;
}
export function mount(container: HTMLElement, options: {
  notes: WheelNote[];
  splitSenses: boolean;
  study: number;
  innerGlow: boolean;
  compactSummary: boolean;
  onToggle?(name: string, group: string): void;
  onNavigate?(family: string | null): void;
  onToggleSense(name: string, group: string, sense: 'taste' | 'aroma'): void;
}): WheelHandle;
