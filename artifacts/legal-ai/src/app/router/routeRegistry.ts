import type { ComponentType } from "react";
import { HomePortal } from "@/portals/home/HomePortal";
import { ReviewerPortal } from "@/portals/reviewer/ReviewerPortal";
import { NotFoundPortal } from "@/portals/notFound/NotFoundPortal";

export interface RouteDef {
  path: string;
  Component: ComponentType;
}

export const routes: RouteDef[] = [
  { path: "/", Component: HomePortal },
  { path: "/review", Component: ReviewerPortal },
  { path: "*", Component: NotFoundPortal },
];
