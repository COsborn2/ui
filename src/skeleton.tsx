import type { ComponentPropsWithRef } from "react";

export type SkeletonProps = ComponentPropsWithRef<"div">;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div aria-hidden="true" {...props} className={["bnh-skeleton", className].filter(Boolean).join(" ")} />;
}
