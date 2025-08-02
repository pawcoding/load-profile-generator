import { PageTransition } from "./page-transition";

export interface Page {
  id: number;
  label: string;
  avgTimeOnPage: number;
  url: string;
  transition?: PageTransition;
  interactionRate?: number;
}
