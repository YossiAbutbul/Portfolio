"use client";

import { Avatar } from "@bible-strong/avatar-react";
import type { AvatarDefinition } from "@bible-strong/avatar-core";

/**
 * Thin wrapper around the procedural avatar runtime.
 *
 * The definition is read from disk at build time and handed down as a prop, so
 * the site still builds when no avatar has been exported yet. Ambient motion
 * and blinking are configured inside the definition itself; the section-driven
 * `expression` is the only thing we steer from here.
 *
 * Sequences are used rather than single expressions: each one loops through
 * several expressions and carries its own blink timing, which is where the
 * random blinking comes from.
 *
 * The runtime is AGPL-3.0-only, which is why this project carries the same
 * licence. See LICENSE.
 */
export default function AvatarRuntime({
  definition,
  animation,
  expression,
  size,
  className,
  ariaLabel = "Yossi Abutbul avatar",
}: {
  /** Parsed at build time, so it arrives untyped; cast is contained here. */
  definition: unknown;
  /** Sequence key. Sequences carry their own blink timing, so this drives
   *  both the expression cycling and the blinking. */
  animation?: string;
  /** Static pose. Mutually exclusive with `animation` - used for the hero,
   *  where the pose must stay front-facing and the eyes are steered directly. */
  expression?: string;
  size?: number | string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Avatar
      definition={definition as AvatarDefinition}
      // Unknown keys are reported through onError rather than thrown, so a
      // definition missing one of these sequences still renders.
      animation={expression ? undefined : animation}
      expression={expression}
      size={size}
      className={className}
      ariaLabel={ariaLabel}
      onError={(error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[avatar]", error.code, error.message);
        }
      }}
    />
  );
}
