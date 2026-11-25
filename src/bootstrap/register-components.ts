import AddInstance from "@/components/add-instance/AddInstance.vue";
import ContextMenu from "@/components/general/layout/ContextMenu.vue";
import GlobalBackground from "@/components/general/layout/GlobalBackground.vue";
import LaunchProgress from "@/components/general/layout/LaunchProgress.vue";
import Layout from "@/components/general/layout/Layout.vue";
import PagesSelector from "@/components/general/layout/PagesSelector.vue";
import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import Router from "@/components/general/layout/Router.vue";
import Sidebar from "@/components/general/layout/Sidebar.vue";
import Tabs from "@/components/general/layout/Tabs.vue";
import Home from "@/components/home/Home.vue";
import Library from "@/components/library/Library.vue";
import Profile from "@/components/profile/Profile.vue";
import Settings from "@/components/settings/Settings.vue";
import { initializeComponents } from "@/extendable/component-registry.ts";

const builtins = {
  ContextMenu,
  GlobalBackground,
  LaunchProgress,
  Layout,
  PagesSelector,
  PageWrapper,
  Router,
  Sidebar,
  Tabs,
  AddInstance,
  Home,
  Library,
  Profile,
  Settings,
} as const;

export function registerComponents(): void {
  initializeComponents(builtins);
}
