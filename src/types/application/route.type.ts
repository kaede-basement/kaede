import { Routes } from "@/constants/routes.ts";

export type RouteType = (typeof Routes)[keyof typeof Routes];