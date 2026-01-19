// Type declarations for @deepcitation/deepcitation-js/react
// This is a workaround for missing .d.ts files in version 1.1.28
declare module "@deepcitation/deepcitation-js/react" {
  import type { FC, RefAttributes, ReactNode } from "react";
  // Re-export types from main package for compatibility
  import type { Citation, Verification, CitationStatus } from "@deepcitation/deepcitation-js";

  export type { Citation, Verification, CitationStatus };

  export interface CitationComponentProps {
    citation: Citation;
    verification?: Verification;
    children?: ReactNode;
    className?: string;
    fallbackDisplay?: string;
    isLoading?: boolean;
    variant?: "brackets" | "chip" | "text" | "superscript" | "minimal";
    content?: string;
    eventHandlers?: {
      onClick?: (citation: Citation, citationKey: string, event: React.MouseEvent) => void;
      onMouseEnter?: (citation: Citation, citationKey: string) => void;
      onMouseLeave?: (citation: Citation, citationKey: string) => void;
      onTouchEnd?: (citation: Citation, citationKey: string, event: React.TouchEvent) => void;
    };
    behaviorConfig?: {
      onClick?: (state: any, event: React.MouseEvent) => any;
      onHover?: {
        onEnter?: (state: any) => void;
        onLeave?: (state: any) => void;
      };
    };
    isMobile?: boolean;
    renderIndicator?: (status: CitationStatus) => ReactNode;
    renderContent?: (props: any) => ReactNode;
    popoverPosition?: "top" | "bottom" | "hidden";
    renderPopoverContent?: (props: any) => ReactNode;
  }

  export const CitationComponent: FC<CitationComponentProps & RefAttributes<HTMLSpanElement>>;
  export const MemoizedCitationComponent: FC<CitationComponentProps & RefAttributes<HTMLSpanElement>>;

  export interface DeepCitationIconProps {
    className?: string;
  }

  export const DeepCitationIcon: FC<DeepCitationIconProps>;
  export const CheckIcon: FC<{ className?: string }>;
  export const SpinnerIcon: FC<{ className?: string }>;
  export const WarningIcon: FC<{ className?: string }>;

  export function classNames(...classes: (string | undefined | null | false)[]): string;
  export function extractDomain(url: string): string;
  export function generateCitationInstanceId(citationKey: string): string;
  export function generateCitationKey(citation: Citation): string;
  export function getCitationDisplayText(
    citation: Citation,
    options?: { fallbackDisplay?: string }
  ): string;
  export function getCitationKeySpanText(citation: Citation): string;
  export function getCitationNumber(citation: Citation): string;
  export function isBlockedStatus(status: string): boolean;
  export function isErrorStatus(status: string): boolean;
  export function isVerifiedStatus(status: string): boolean;

  export const CITATION_X_PADDING: number;
  export const CITATION_Y_PADDING: number;
}
