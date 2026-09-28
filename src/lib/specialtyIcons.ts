import {
  Stethoscope, Baby, HeartPulse, Sparkles, Bone, Flower2, Smile, Ear,
  Eye, Brain, Droplets, Activity, Zap, Wind, Shield, Dumbbell, Apple,
  Scissors, BrainCircuit, Wand2, GitBranch, Syringe, ScanLine, Microscope,
  Siren, Armchair, Trophy,
  type LucideIcon,
} from "lucide-react";

// Single source of truth for Specialty.icon -> lucide component, shared by every place that
// renders a specialty (SpecialtyRail, the homepage's specialty chips, footer, etc.) — was
// previously only defined inline inside SpecialtyRail.tsx, an otherwise-unused component, so
// nothing else could reuse it without duplicating all 27 entries.
export const specialtyIconMap: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  baby: Baby,
  heartPulse: HeartPulse,
  sparkles: Sparkles,
  bone: Bone,
  flower: Flower2,
  smile: Smile,
  ear: Ear,
  eye: Eye,
  brain: Brain,
  droplets: Droplets,
  activity: Activity,
  zap: Zap,
  wind: Wind,
  shield: Shield,
  dumbbell: Dumbbell,
  apple: Apple,
  scissors: Scissors,
  brainCircuit: BrainCircuit,
  wand2: Wand2,
  gitBranch: GitBranch,
  syringe: Syringe,
  scanLine: ScanLine,
  microscope: Microscope,
  siren: Siren,
  armchair: Armchair,
  trophy: Trophy,
};

/** Falls back to a generic stethoscope icon for any future specialty added without a mapped key. */
export function getSpecialtyIcon(iconKey: string): LucideIcon {
  return specialtyIconMap[iconKey] ?? Stethoscope;
}
